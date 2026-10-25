import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararPresupuestoDocumentos} from '../integraciones/autocotizador/pruebas/cotizacion-desde-recibos-servidor.mjs';
import {verificarVinculoCotizadorV2} from '../integraciones/autocotizador/recepcion/verificar-vinculo-cotizador-v2.mjs';

const sha='a'.repeat(64);
const original={
 schema:'saber-pdf-local-pendiente-v1',
 localRef:'12345678-1234-4234-8234-1234567890ab',
 nombre:'archivo.pdf',bytes:59001,paginas:7,sha256:sha,
 estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false
};
const orderId='WEB-ENSAYO-12345678901234567890123456789012';
const receiptId='DOC-33333333-1234-4234-8234-1234567890ab';
const good={
 ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',paymentAuthorized:false,
 receiptId,orderId,fileId:'pdf-'+sha.slice(0,24),
 name:'pdf-'+sha.slice(0,24)+'__archivo.pdf',
 mode:'bn',bytes:59001,sha256:sha,pages:7
};
function verify(r=original,v=good,more={}){
 return verificarVinculoCotizadorV2({
  referencia:r,recibo:v,sessionId:receiptId,
  expectedOrderId:orderId,expectedMode:'bn',...more
 });
}
test('el enlace sólo confirma identidad exacta entre PDF local y Google verificado',()=>{
 const v=verify();
 assert.equal(v.schema,'saber-v2-pdf-conciliado-privado-v1');
 assert.equal(v.localRef,original.localRef);
 assert.equal(v.receiptId,receiptId);
 assert.equal(v.orderId,orderId);
 assert.equal(v.pages,7);
 assert.equal(v.sha256,sha);
 assert.equal(v.reciboGoogleVerificado,true);
 assert.equal(v.precioRecalculado,false);
 assert.equal(v.ingresadoEnCentral,false);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(v.descargaPrivadaHabilitada,false);
 assert.equal(v.listoParaProducir,false);
 assert.equal(v.estado,'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO');
 assert.doesNotMatch(JSON.stringify(v),/token|dataBase64|driveFileId|https?:/);
 assert.equal(Object.isFrozen(v),true);
});
test('restringir huella y metadatos de archivo: mismo nombre no basta',()=>{
 for(const v of [
  {...good,sha256:'b'.repeat(64)},
  {...good,bytes:59002},{...good,pages:8},
  {...good,fileId:'pdf-'+'f'.repeat(24)},
  {...good,name:'pdf-'+sha.slice(0,24)+'__otro.pdf'},
  {...good,mode:'color'},
  {...good,orderId:'WEB-OTRO-PEDIDO-1234'},
  {...good,receiptId:'DOC-44444444-1234-4234-8234-1234567890ab'}
 ])assert.throws(()=>verify(original,v),/coincide|Recibo/);
});
test('rechazar recibo sin autenticidad o con falsos permisos de cobro',()=>{
 for(const v of [
  {...good,ok:false},{...good,status:'received'},
  {...good,verified:false},{...good,storageVerified:false},
  {...good,pageVerification:'browser'},{...good,paymentAuthorized:true},
  {...good,receiptId:null}
 ])assert.throws(()=>verify(original,v));
});
test('rechazar PDF local marcado falsamente como recibido o sin SHA',()=>{
 for(const r of [
  {...original,sha256:'ab'},
  {...original,recibido:true},
  {...original,verificadoServidor:true},
  {...original,estado:'LISTO_PARA_PRODUCIR'},
  {...original,bytes:0},
  {...original,paginas:0},
  {...original,token:'secreto-que-no-debe-estar'},
  {...original,nombre:'otra.png'}
 ])assert.throws(()=>verify(r));
});
test('ruta privada del Worker cerrada por defecto y sin posibilidad de cobro',()=>{
 const src=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 const i=src.indexOf('async function v2VincularPdf(');
 const j=src.indexOf('async function fase4Quote(',i);
 assert.ok(i>=0&&j>i);
 const fn=src.slice(i,j);
 assert.match(src,/page==='\/api\/ensayo-vincular-pdf-v2'/);
 assert.match(fn,/DOCS_V2_RECEIPT_LINK_ENABLED!=='PRIVATE_TEST_ONLY'/);
 assert.match(fn,/DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY'/);
 assert.match(fn,/!allowed\(request,env\)/);
 assert.match(fn,/await fase4PrivateVerified\(env,input.sesion,null,false,DOCS_MAX\)/);
 assert.match(fn,/verificarVinculoCotizadorV2\(/);
 assert.doesNotMatch(fn,/paymentAuthorized:true|checkoutEnabled:true/);
 assert.doesNotMatch(fn,/dataBase64|pdfBytes|DriveApp/);
});

test('el vínculo V2 permite presupuesto de servidor opcional sin habilitar checkout',()=>{
 const src=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 const i=src.indexOf('async function v2VincularPdf(');
 const j=src.indexOf('async function fase4Quote(',i);
 assert.ok(i>=0&&j>i);
 const handler=src.slice(i,j);
 assert.match(handler,/prepararPresupuestoDocumentos\(/);
 assert.match(handler,/recibosConfiables:\[recibo\]/);
 assert.match(handler,/tarifasServidor:preciosPiloto/);
 assert.match(handler,/PRELIMINAR_VERIFICADA_SIN_PEDIDO/);
 assert.match(handler,/checkoutEnabled:false/);
 assert.match(handler,/paymentAuthorized:false/);
 assert.match(handler,/input\.opciones!==undefined/);
 assert.doesNotMatch(handler,/prepararDocumentosCentralFirmado|prepararMixtoCentralFirmado/);
});

test('cotización comprobada A3 color usa el material real; papel A4 no puede presupuestarse como A3',()=>{
 const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 const recibo={...good,mode:'color'};
 const req={orderId,archivos:[{id:recibo.fileId,nombre:recibo.name,modo:'color',orden:1}],
  formato:'a3',caras:'simple',copias:1,anillado:'ninguno',
  materialColor:'a3_color_obra80'};
 const result=prepararPresupuestoDocumentos({solicitud:req,
  recibosConfiables:[recibo],tarifasServidor:precios});
 assert.equal(result.quote.total,7000);
 assert.equal(result.quote.papelColor,'Color A3 · Obra 80 g');
 assert.equal(result.paymentAuthorized,false);
 assert.throws(()=>prepararPresupuestoDocumentos({
  solicitud:{...req,materialColor:'obra70'},
  recibosConfiables:[recibo],tarifasServidor:precios
 }),/papel/i);
});
