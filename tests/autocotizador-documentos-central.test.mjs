import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {prepararDocumentosCentralFirmado} from '../integraciones/autocotizador/recepcion/preparar-documentos-central.mjs';
const key='Saber-Bridge-Documents-Internal-Test-Key-2026';
const webOrderId='WEB-ENSAYO-COMPRA-DOCS-20261024';
const clientOrderId=randomUUID(),commercialOrderId=randomUUID();
const env={
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_ADMIN_KEY:'private-admin-different',DOCS_RELAY_KEY:'private-GAS-different',
 CENTRAL_BRIDGE_KEY:key,
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'
};
const input={webOrderId,clientOrderId,items:[{code:'ABC-1',qty:2}],subtle:webcrypto.subtle,requestId:randomUUID};
function mock({status=201,checkoutEnabled=false}={}){
 let count=0;
 const binding={async fetch(req){
  count++;
  assert.equal(req.url,'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/prepare-order');
  assert.equal(req.headers.get('Origin'),null);
  const body=await req.text(),ts=req.headers.get('x-saber-ts'),nonce=req.headers.get('x-saber-request-id');
  const hash=createHmac('sha256',key).update(ts+'\n'+nonce+'\n'+body).digest('hex');
  assert.equal(req.headers.get('x-saber-signature'),hash);
  assert.deepEqual(JSON.parse(body),{clientOrderId,webOrderId,items:[{code:'ABC-1',qty:2}]});
  return Response.json({created:true,idempotent:false,
   commercial_order_id:commercialOrderId,amount_ars:28000,
   state:'awaiting_payment',checkoutEnabled,paymentAuthorized:false},{status});
 }};
 return {binding,calls:()=>count};
}
test('documentos más productos sin Polaroids: HMAC y binding privado, cobro desactivado',async()=>{
 const x=mock();
 const r=await prepararDocumentosCentralFirmado({...input,env:{...env,SABER_CENTRAL:x.binding}});
 assert.equal(r.created,true);
 assert.equal(r.amountArs,28000);
 assert.equal(r.commercialOrderId,commercialOrderId);
 assert.equal(r.checkoutEnabled,false);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(x.calls(),1);
});
test('sin interruptor interno o sin Service Binding no se crea pedido',async()=>{
 const x=mock();
 for(const overrides of [
  {DOCS_ORDER_PREPARE_ENABLED:''},
  {DOCS_CENTRAL_SYNC_ENABLED:''},
  {SABER_CENTRAL:null},
  {CENTRAL_BRIDGE_KEY:'secret'},
  {DOCS_CENTRAL_ADMIN_KEY:key}
 ]){
  await assert.rejects(prepararDocumentosCentralFirmado({...input,
   env:{...env,SABER_CENTRAL:x.binding,...overrides}}),/deshabilitada/);
 }
 assert.equal(x.calls(),0);
});
test('rechaza SKU repetido, cantidades invalidas, URL ajena y compra sin idempotencia',async()=>{
 const x=mock();
 for(const arg of [
  {items:[{code:'ABC-1',qty:1},{code:'ABC-1',qty:2}]},
  {items:[{code:'ABC-1',qty:0}]},
  {clientOrderId:'bad-id'},
  {webOrderId:'fake'},
  {env:{...env,SABER_CENTRAL:x.binding,CENTRAL_TEST_URL:'https://unknown.example/internal/central/stage'}}
 ]){
  await assert.rejects(prepararDocumentosCentralFirmado({
   ...input,env:{...env,SABER_CENTRAL:x.binding},...arg
  }));
 }
 assert.equal(x.calls(),0);
});
test('rechaza respuesta de Central que pretende habilitar cobro o confirmar sin pedido',async()=>{
 const a=mock({checkoutEnabled:true});
 await assert.rejects(prepararDocumentosCentralFirmado({
  ...input,env:{...env,SABER_CENTRAL:a.binding}
 }),/cobro/);
 const b=mock({status:409});
 await assert.rejects(prepararDocumentosCentralFirmado({
  ...input,env:{...env,SABER_CENTRAL:b.binding}
 }),/no confirmó/);
});
