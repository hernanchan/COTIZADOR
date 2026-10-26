import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararManifiestoDocumentalV2} from '../integraciones/autocotizador/recepcion/preparar-manifiesto-v2-documental.mjs';
import {conciliarManifiestoV2ConServidor,registrarManifiestoV2EnCentral} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';
const orderId='WEB-ENSAYO-CIERRE-CARRITO-V2';
function trabajo(n){
 return {vinculo:{
  schema:'saber-v2-pdf-conciliado-privado-v1',
  localRef:'12345678-1234-4234-8234-'+String(n).padStart(12,'0'),
  receiptId:'DOC-12345678-1234-4234-8234-'+String(n).padStart(12,'0'),
  orderId,sha256:String(n).padStart(64,'a'),pages:3,
  estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
  reciboGoogleVerificado:true,precioRecalculado:false,
  paymentAuthorized:false,listoParaProducir:false,
  cotizacionServidor:{estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
   totalArs:9000+n,priceVersion:'local-referencia',
   paginasOriginales:3,formato:'a4',caras:'simple',copias:2,
   anillado:'ninguno',materialColor:'obra70',paymentAuthorized:false}
 }};
}
const manifiesto=prepararManifiestoDocumentalV2({orderId,trabajos:[trabajo(1),trabajo(2)]});
function server(){
 return {schema:'saber-central-recepcion-verificada-v1',
  orderId,filesReceived:true,pagoConfirmado:false,paymentAuthorized:false,
  listoParaProducir:false,importeVerificado:15750,
  recibos:manifiesto.items.map((x,i)=>({
   receiptId:x.reciboPrivado,sha256:x.sha256,pages:x.paginas,
   bytes:1200,fileId:'file-'+i})),
  ficha:{schema:'ficha-simulada-servidor',trabajos:[]}}
}
test('conciliar PDF 1 y 2 en cualquier orden con precio del servidor, no del cliente',()=>{
 const v=server();v.recibos.reverse();
 const c=conciliarManifiestoV2ConServidor({manifiesto,verificacion:v});
 assert.equal(c.importeServidor,15750);
 assert.notEqual(c.importeServidor,manifiesto.totalOrientativo);
 assert.equal(c.cantidadArchivos,2);
 assert.equal(c.registeredInD1,false);
 assert.equal(c.checkoutEnabled,false);
 assert.equal(c.paymentAuthorized,false);
});
test('rechazar un PDF faltante, cambiado, duplicado, ajeno o sin verificación',()=>{
 const s=server();
 const variations=[
  {...s,recibos:s.recibos.slice(0,1)},
  {...s,recibos:[s.recibos[0],s.recibos[0]]},
  {...s,recibos:[s.recibos[0],{...s.recibos[1],sha256:'b'.repeat(64)}]},
  {...s,recibos:[s.recibos[0],{...s.recibos[1],pages:4}]},
  {...s,orderId:'WEB-PEDIDO-AJENO'},
  {...s,paymentAuthorized:true},
  {...s,importeVerificado:0},
  {...s,pagoConfirmado:true}
 ];
 for(const v of variations)assert.throws(()=>
  conciliarManifiestoV2ConServidor({manifiesto,verificacion:v}));
});
test('la compuerta OFF no hace llamadas ni inscripciones en D1',async()=>{
 let calls=0;
 await assert.rejects(registrarManifiestoV2EnCentral({
  manifiesto,verificacion:server(),env:{DOCS_CENTRAL_SYNC_ENABLED:'OFF'},
  enviar:async()=>{calls++;return {};}
 }),/apagado/);
 assert.equal(calls,0);
});
test('envío firmado simulado de ficha verificada: no cobrar y reconocer reintento idempotente',async()=>{
 let calls=0;
 const envio=async arg=>{
  calls++;
  assert.equal(arg.verificacion.importeVerificado,15750);
  assert.equal(arg.verificacion.orderId,orderId);
  assert.equal(arg.habilitado,'PRIVATE_TEST_ONLY');
  return {ok:true,webOrderId:orderId,guardado:true,
   existia:calls>1,paymentAuthorized:false,listoParaProducir:false};
 };
 const env={DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_TEST_URL:'https://test',
  CENTRAL_BRIDGE_KEY:'test-key',SABER_CENTRAL:{fetch(){}}};
 const a=await registrarManifiestoV2EnCentral({manifiesto,verificacion:server(),env,enviar:envio});
 const b=await registrarManifiestoV2EnCentral({manifiesto,verificacion:server(),env,enviar:envio});
 assert.equal(a.registeredInD1,true);assert.equal(a.idempotent,false);
 assert.equal(b.idempotent,true);assert.equal(calls,2);
 assert.equal(a.checkoutEnabled,false);assert.equal(b.paymentAuthorized,false);
});
test('rechaza respuesta de Central sin registro o si habilita producción',async()=>{
 for(const response of [{ok:false},{ok:true,webOrderId:orderId,guardado:true,paymentAuthorized:true,listoParaProducir:false},
  {ok:true,webOrderId:orderId,guardado:true,paymentAuthorized:false,listoParaProducir:true}]){
  await assert.rejects(registrarManifiestoV2EnCentral({
   manifiesto,verificacion:server(),env:{DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY'},
   enviar:async()=>response
  }));
 }
});
