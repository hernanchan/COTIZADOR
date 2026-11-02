import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {crearTandaTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from '../integraciones/autocotizador/recepcion/tus-pedido-puente.mjs';
import {normalizarTrabajoTUS} from '../integraciones/autocotizador/recepcion/tus-directo-cliente.mjs';
import {conciliarManifiestoV2ConServidor} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';
import {manifiestoServidorTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-worker.mjs';

const orderId='WEB-ENSAYO-AB12345678901234567890ABCDEF123456';
const secret='seleccion_real_solo_pruebas_'+'s'.repeat(48);
const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const options={
 servicio:'auto',seleccion:'a4',paginasSeleccionadas:'1-3,5',
 copias:1,modo:'bn',caras:'simple',paginasPorHoja:1,papelPoster:'obra80',
 anillado:'ninguno',grupoAnillado:'',materialColor:'obra70',
 productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1
};
async function signedPdf(){
 const pdf=await PDFDocument.create();
 for(let i=0;i<8;i++)pdf.addPage([595.28,841.89]);
 const bytes=new Uint8Array(await pdf.save());
 const sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const meta={fileId:'documento-ocho-paginas',name:'Apunte_A4_8_paginas.pdf',
  mode:'bn',bytes:bytes.length,sha256,pages:8};
 const signed=await crearTandaTUS({orderId,metas:[meta],secret,
  uuid:()=>randomUUID(),ahora:()=>1800000000,subtle:webcrypto.subtle,
  firmarSubida:async()=>('PRIVATE_TEST_SIGNATURE_'+randomUUID())});
 return {signed,bytes,meta};
}
async function serverQuote(signed,bytes,paginasSeleccionadas){
 return verificarTandaTUSYRecalcular({
  orderId,entries:[{proof:signed.sessions[0].proof,
   opciones:{...options,paginasSeleccionadas}}],
  secret,ahora:()=>1800000001,subtle:webcrypto.subtle,
  preciosServidor:prices,
  leerObjetoPrivado:async path=>{
   assert.equal(path,signed.sessions[0].objectName);
   return bytes;
  }
 });
}
test('PDF real de 8 páginas cotiza solo 1-3,5 sin alterar el original ni el manifiesto D1',async()=>{
 const {signed,bytes}=await signedPdf();
 const partial=await serverQuote(signed,bytes,'1-3,5');
 const full=await serverQuote(signed,bytes,'');
 assert.equal(partial.verificacion.recibos[0].pages,8);
 assert.deepEqual(partial.verificacion.ficha.trabajos[0].paginasElegidas,[1,2,3,5]);
 assert.equal(partial.verificacion.ficha.trabajos[0].paginasOriginales,8);
 assert.equal(full.verificacion.ficha.trabajos[0].paginasElegidas.length,8);
 assert.ok(partial.verificacion.importeVerificado<full.verificacion.importeVerificado,
  'El subtotal debe responder a 4 páginas y no a 8');
 assert.equal(partial.verificacion.paymentAuthorized,false);
 assert.equal(partial.verificacion.listoParaProducir,false);
 const manifest=manifiestoServidorTUS(partial);
 const checked=conciliarManifiestoV2ConServidor({
  manifiesto:manifest,verificacion:partial.verificacion
 });
 assert.equal(checked.importeServidor,partial.verificacion.importeVerificado);
 assert.equal(checked.cantidadArchivos,1);
});
test('el servidor rechaza selección fuera de rango, invertida o inválida',async()=>{
 const {signed,bytes}=await signedPdf();
 for(const spec of ['1,9','4-2','0','1,a','1-9','2,,3']){
  await assert.rejects(serverQuote(signed,bytes,spec));
 }
});
test('normalizador TUS entrega las páginas elegidas sin sustituirlas por PDF completo',async()=>{
 const {meta}=await signedPdf();
 const file=new File([new Uint8Array(meta.bytes)],meta.name,{type:'application/pdf'});
 const d={archivoLocal:file,reference:{sha256:meta.sha256,nombre:meta.name,
  bytes:meta.bytes,paginas:8}};
 const normal=normalizarTrabajoTUS(d,{
  meta:{...meta},opcionesKey:JSON.stringify({
   formato:'a4',caras:'simple',copias:1,anillado:'ninguno',
   paginasSeleccionadas:'1-3,5',paginasPorHoja:1,materialColor:'obra70'
  })
 });
 assert.equal(normal.opciones.paginasSeleccionadas,'1-3,5');
 assert.equal(normal.meta.pages,8);
 assert.throws(()=>normalizarTrabajoTUS(d,{
  meta:{...meta},opcionesKey:JSON.stringify({
   formato:'a4',caras:'simple',copias:1,anillado:'ninguno',
   paginasSeleccionadas:'a'.repeat(501),paginasPorHoja:1,materialColor:'obra70'
  })
 }),/Opciones TUS incompatibles/);
});
