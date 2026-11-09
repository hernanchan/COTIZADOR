import test from 'node:test';
import assert from 'node:assert/strict';
import {cotejarPagoRealMP,compuertaMPProduccion} from '../integraciones/publicacion/mercadopago-live-preflight.mjs';

const orderId='018d7fbc-32b4-43e2-9eb3-d333848dc9ca';
const base=()=>({
 sellerId:'12345678',
 seller:{id:12345678,tags:['normal_seller']},
 order:{id:orderId,status:'awaiting_payment',amount_ars:4400,deposit_ars:4400,preference_id:'123pref',review_state:'verified'},
 payment:{id:123456789,live_mode:true,status:'approved',currency_id:'ARS',
  collector_id:12345678,transaction_amount:4400,transaction_amount_refunded:0,
  external_reference:orderId,preference_id:'123pref',order:{id:234567890}},
 merchantOrder:{id:234567890,preference_id:'123pref',external_reference:orderId,
  payments:[{id:123456789,status:'approved'}]}
});
test('La compuerta comercial de MP nunca se abre con valores ausentes o Sandbox',()=>{
 assert.equal(compuertaMPProduccion({}),false);
 const candidate={SABER_ENTORNO:'produccion',MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
  CENTRAL_DB_ENV:'produccion',MP_LIVE_ACCESS_TOKEN:'APP_USR-'.padEnd(30,'A'),
  MP_LIVE_SELLER_ID:'12345678',MP_TEST_SELLER_ID:'23456789',
  MP_LIVE_WEBHOOK_SECRET:'x'.repeat(40)};
 assert.equal(compuertaMPProduccion(candidate),true,'solo fixture estructural, no hay servicio live');
 assert.equal(compuertaMPProduccion({...candidate,MP_LIVE_GATE:'PRIVATE_TEST_ONLY'}),false);
 assert.equal(compuertaMPProduccion({...candidate,MP_LIVE_ACCESS_TOKEN:'TEST-'.padEnd(30,'A')}),false);
 assert.equal(compuertaMPProduccion({...candidate,CENTRAL_DB_ENV:'pruebas'}),false);
 assert.equal(compuertaMPProduccion({...candidate,MP_TEST_SELLER_ID:'12345678'}),false);
});
test('Comprobación offline positiva necesita 3 fuentes autenticadas consistentes',()=>{
 assert.deepEqual(cotejarPagoRealMP(base()),{verified:true,orderId,paymentId:'123456789'});
});
test('Nunca aceptar pago sandbox aunque anuncie approved',()=>{
 for(const variant of [
  a=>{a.payment.live_mode=false},
  a=>{a.payment.live_mode=undefined},
  a=>{a.seller.tags=['test_user']},
  a=>{a.payment.collector_id=99},
  a=>{a.seller.id=99},
  a=>{a.payment.status='pending'},
  a=>{a.payment.transaction_amount_refunded=100},
  a=>{a.payment.currency_id='USD'}
 ]){const data=base();variant(data);assert.equal(cotejarPagoRealMP(data).verified,false);}
});
test('Rechaza precio alterado, seña, pedido ajeno, preferencia o merchant order falsas',()=>{
 for(const variant of [
  a=>{a.payment.transaction_amount=4399},
  a=>{a.order.deposit_ars=2000},
  a=>{a.order.id='WEB-ENSAYO-123'},
  a=>{a.order.status='cancelled'},
  a=>{a.order.review_state='revoked'},
  a=>{a.payment.external_reference='otra-orden'},
  a=>{a.payment.preference_id='otra-preferencia'},
  a=>{a.merchantOrder.preference_id='otra-preferencia'},
  a=>{a.merchantOrder.external_reference='otra-orden'},
  a=>{a.merchantOrder.payments=[]},
  a=>{a.merchantOrder.payments[0].status='rejected'}
 ]){const data=base();variant(data);assert.equal(cotejarPagoRealMP(data).verified,false);}
});
test('Un pedido ya pagado sólo se considera verificable con el MISMO ID de pago',()=>{
 const a=base();a.order.status='paid';a.order.payment_id='123456789';
 assert.equal(cotejarPagoRealMP(a).verified,true);
 a.order.payment_id='123456788';
 assert.equal(cotejarPagoRealMP(a).verified,false);
});
test('No acepta comprobación sin consultar API del vendedor y merchant order',()=>{
 for(const missing of ['seller','merchantOrder','payment','order']){
  const a=base();a[missing]=null;assert.equal(cotejarPagoRealMP(a).verified,false);
 }
});
