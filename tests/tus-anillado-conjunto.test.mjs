import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {normalizarTrabajoTUS,enviarPedidoTUSV2} from '../integraciones/autocotizador/recepcion/tus-directo-cliente.mjs';
import {crearTandaTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from '../integraciones/autocotizador/recepcion/tus-pedido-puente.mjs';
import {manifiestoServidorTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-worker.mjs';
import {conciliarManifiestoV2ConServidor,registrarManifiestoV2EnCentral} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';

const ORDER='WEB-ANILLADO-GRUPO-TEST-20261101';
const SECRET='solo-pruebas-anillado-'+('0'.repeat(48));
const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));

async function crearPdf(paginas){
 const d=await PDFDocument.create();
 for(let i=0;i<paginas;i++)d.addPage([595.28,841.89]);
 const data=new Uint8Array(await d.save());
 const sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',data)).toString('hex');
 return {data,sha256,paginas};
}
const opciones=(n,grupo='1')=>({
 servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',copias:2,
 modo:'bn',caras:n===1?'double':'simple',paginasPorHoja:n===1?2:1,
 papelPoster:'obra80',anillado:'grupo',grupoAnillado:grupo,
 materialColor:'obra70',productoFoto:'',productoGrafica:'',
 corteVariante:'gt3',corteMetros:1
});
test('TUS preserva el grupo y rechaza un anillado conjunto incompleto ANTES de crear sesiones',async()=>{
 const meta={fileId:'pdf-grupo-1',name:'Primero.pdf',mode:'bn',
  bytes:3000,sha256:'a'.repeat(64),pages:8};
 const d={reference:{nombre:meta.name,bytes:meta.bytes,sha256:meta.sha256,paginas:8},
  archivoLocal:{name:meta.name,size:meta.bytes,arrayBuffer:async()=>new ArrayBuffer(meta.bytes)}};
 const t=normalizarTrabajoTUS(d,{meta,opcionesKey:JSON.stringify({
  formato:'a4',caras:'double',copias:2,anillado:'grupo',grupoAnillado:'1',
  materialColor:'obra70',paginasPorHoja:2})});
 assert.equal(t.opciones.anillado,'grupo');
 assert.equal(t.opciones.grupoAnillado,'1');
 let calls=0;
 await assert.rejects(enviarPedidoTUSV2({
  orderId:ORDER,clientOrderId:randomUUID(),trabajos:[t],
  loadUploader:async()=>{calls++;throw Error('No debería cargarse Uppy');},
  fetcher:async()=>{calls++;throw Error('No debería llamarse el servidor');}
 }),/requiere al menos dos PDF/);
 assert.equal(calls,0);
});
test('dos PDF reales: anillado de grupo solo una vez, ficha de producción y manifiesto conciliados',async()=>{
 const pdfs=await Promise.all([crearPdf(8),crearPdf(6)]);
 const metas=pdfs.map((p,i)=>({
  fileId:'archivo-grupo-'+(i+1),name:'Documento'+(i+1)+'.pdf',
  mode:'bn',bytes:p.data.length,sha256:p.sha256,pages:p.paginas
 }));
 const signed=await crearTandaTUS({
  orderId:ORDER,metas,secret:SECRET,subtle:webcrypto.subtle,
  uuid:randomUUID,ahora:()=>1800000000,
  firmarSubida:async()=>('TEST_SIGNED_'+randomUUID())
 });
 const objetos=new Map(signed.sessions.map((x,i)=>[x.objectName,pdfs[i].data]));
 const entries=signed.sessions.map((x,i)=>({proof:x.proof,opciones:opciones(i+1)}));
 const checked=await verificarTandaTUSYRecalcular({
  orderId:ORDER,entries,secret:SECRET,subtle:webcrypto.subtle,
  ahora:()=>1800000001,preciosServidor:prices,
  leerObjetoPrivado:async path=>objetos.get(path)
 });
 const verified=checked.verificacion;
 assert.equal(verified.recibos.length,2);
 assert.equal(verified.ficha.trabajos.length,2);
 assert.deepEqual(verified.ficha.trabajos.map(t=>t.grupoAnillado),['1','1']);
 assert.deepEqual(verified.ficha.trabajos.map(t=>t.tipoAnillado),['grupo','grupo']);
 assert.equal(verified.ficha.gruposAnillado.length,1);
 const grupo=verified.ficha.gruposAnillado[0];
 assert.equal(grupo.juegos,2);
 const subtotal=verified.cotizacion.detalleImpresiones.reduce((sum,d)=>sum+d.subtotal,0);
 assert.equal(verified.importeVerificado,subtotal+grupo.subtotal,
  'La encuadernación conjunta no se duplica por archivo');
 assert.equal(verified.cotizacion.subtotalAnillados,grupo.subtotal);
 const manifest=manifiestoServidorTUS(checked);
 assert.deepEqual(manifest.items.map(x=>x.opciones.grupoAnillado),['1','1']);
 const reconciled=conciliarManifiestoV2ConServidor({manifiesto:manifest,verificacion:verified});
 assert.equal(reconciled.importeServidor,verified.importeVerificado);
 const registered=await registrarManifiestoV2EnCentral({
  manifiesto:manifest,verificacion:verified,
  env:{DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_TEST_URL:'https://example.invalid',CENTRAL_BRIDGE_KEY:'test'},
  enviar:async({verificacion})=>{
   assert.equal(verificacion.ficha.gruposAnillado.length,1);
   return {ok:true,webOrderId:ORDER,guardado:true,paymentAuthorized:false,
    listoParaProducir:false,existia:false};
  }
 });
 assert.equal(registered.registeredInD1,true,'Resultado simulado de Central');
 assert.equal(registered.paymentAuthorized,false);
 const wrong={...manifest,items:manifest.items.map((x,i)=>i===1
  ?{...x,opciones:{...x.opciones,grupoAnillado:'2'}}:x)};
 assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:wrong,verificacion:verified}),
  /grupo de anillado no coincide/);
});
