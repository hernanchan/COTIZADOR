import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararManifiestoDocumentalV2} from '../integraciones/autocotizador/recepcion/preparar-manifiesto-v2-documental.mjs';
const orderId='WEB-ENSAYO-V2-MULTI-20261026';
function trabajo(n=1){
 return {vinculo:{
  schema:'saber-v2-pdf-conciliado-privado-v1',
  localRef:'12345678-1234-4234-8234-'+String(n).padStart(12,'0'),
  receiptId:'DOC-12345678-1234-4234-8234-'+String(n).padStart(12,'0'),
  orderId,sha256:String(n).padStart(64,'a'),pages:3,
  estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
  reciboGoogleVerificado:true,precioRecalculado:false,
  paymentAuthorized:false,listoParaProducir:false,
  cotizacionServidor:{
   estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',totalArs:3000+n,
   priceVersion:'ensayo-v1',paginasOriginales:3,
   formato:'a4',caras:'simple',copias:2,anillado:'ninguno',
   materialColor:'obra70',paymentAuthorized:false
  }
 }};
}
test('consolida 3 PDFs verificados sin exponer token ni habilitar D1 o pago',()=>{
 const r=prepararManifiestoDocumentalV2({orderId,trabajos:[trabajo(1),trabajo(2),trabajo(3)]});
 assert.equal(r.items.length,3);
 assert.equal(r.totalOrientativo,9006);
 assert.equal(r.registeredInD1,false);
 assert.equal(r.checkoutEnabled,false);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.receiptsRecheckedByBackend,false);
 assert.equal(r.pricesRecalculatedByBackend,false);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.isFrozen(r.items),true);
 assert.doesNotMatch(JSON.stringify(r),/token|driveFileId|dataBase64/);
});
test('impide recibos repetidos, PDF no verificado y pedidos de otro carrito',()=>{
 const a=trabajo(1),b=trabajo(2);
 for(const changed of [
  {...b,vinculo:{...b.vinculo,receiptId:a.vinculo.receiptId}},
  {...b,vinculo:{...b.vinculo,sha256:a.vinculo.sha256}},
  {...b,vinculo:{...b.vinculo,localRef:a.vinculo.localRef}},
  {...b,vinculo:{...b.vinculo,orderId:'WEB-OTRO-PEDIDO'}},
  {...b,vinculo:{...b.vinculo,reciboGoogleVerificado:false}},
  {...b,vinculo:{...b.vinculo,paymentAuthorized:true}},
  {...b,vinculo:{...b.vinculo,cotizacionServidor:{...b.vinculo.cotizacionServidor,totalArs:-1}}},
  {...b,vinculo:{...b.vinculo,cotizacionServidor:{...b.vinculo.cotizacionServidor,paginasOriginales:5}}}
 ])assert.throws(()=>prepararManifiestoDocumentalV2({orderId,trabajos:[a,changed]}),/duplicado|confirmado/);
});
test('sin trabajo o con más de 30 trabajos se bloquea antes de crear manifiesto',()=>{
 for(const trabajos of [[],Array.from({length:31},(_,i)=>trabajo(i+1))])
  assert.throws(()=>prepararManifiestoDocumentalV2({orderId,trabajos}),/verificables/);
});
