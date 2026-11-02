import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='5ad01300-f40a-43f2-a455-56616a8a9e04';
const pref='3770562685-fef2f7ee-f36b-4076-8d41-f1812998f2b4';
let reads=0,network=0,writes=0;
const DB={prepare(sql){
 let bound=[];
 const q={bind(...args){bound=args;return q},async first(){
  reads++;if(sql.startsWith('SELECT id,amount_ars,status,preference_id FROM orders WHERE id=?'))
   return bound[0]===id?{id,amount_ars:4730,status:'awaiting_payment',preference_id:pref}:null;
  throw Error('Unexpected SQL: '+sql);
 },async run(){writes++;throw Error('Read-only diagnostic attempted to write D1');}};
 return q;
}};
const responses={
 preference:{id:pref,external_reference:id,expiration_date_to:'2030-12-31T00:00:00.000Z',
  init_point:'https://www.mercadopago.com.ar/checkout',payer:{email:'private@example.invalid'}},
 payments:{results:[{external_reference:id,preference_id:pref,status:'rejected',status_detail:'cc_rejected_other_reason',
  transaction_amount:4730,payer:{email:'private@example.invalid'}},
  {external_reference:'unrelated',status:'approved',transaction_amount:999999}]},
 merchant:{elements:[{preference_id:pref,status:'opened',
  payments:[{status:'rejected',status_detail:'cc_rejected_other_reason',payer:{email:'private@example.invalid'}}]}]}
};
const scope={Request,Response,URL,URLSearchParams,AbortSignal,TextEncoder,crypto:webcrypto,console,
 fetch:async(url)=>{
  network++;const value=String(url);
  const payload=value.includes('/v1/payments/search?')?responses.payments:
   value.includes('/merchant_orders/search?')?responses.merchant:
   value.includes('/checkout/preferences/')?responses.preference:null;
  assert.ok(payload,'Unexpected network URL: '+value);
  return new Response(JSON.stringify(payload),{status:200});
 }};
scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(src.replace('export default {','globalThis.worker = {'),scope);
const env={DB,DEMO_ADMIN_KEY:'private-admin-only-test',MP_TEST_ACCESS_TOKEN:'dummy',
 MP_TEST_SELLER_ID:'999',MP_WEBHOOK_SECRET:'dummy',TEST_WEBHOOK_URL:'https://private.invalid/webhook'};
const call=(body,key='private-admin-only-test')=>scope.worker.fetch(new Request('https://private.invalid/admin/api/central/payment-diagnostic',{
 method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
 body:JSON.stringify(body)}),env);

test('diagnostic denies unauthenticated access without D1 or MP calls',async()=>{
 reads=0;network=0;writes=0;
 const response=await call({order_id:id},'wrong-key');
 assert.equal(response.status,401);assert.equal(reads,0);assert.equal(network,0);assert.equal(writes,0);
});
test('diagnostic rejects malformed order id before querying D1',async()=>{
 reads=0;network=0;writes=0;
 const response=await call({order_id:'not-an-id'});
 assert.equal(response.status,400);assert.equal(reads,0);assert.equal(network,0);assert.equal(writes,0);
});
test('diagnostic reads real MP status, filters unrelated payments and never modifies an order',async()=>{
 reads=0;network=0;writes=0;
 const response=await call({order_id:id});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.order_state,'awaiting_payment');
 assert.equal(result.preference_matches,true);
 assert.equal(result.payment_search_ok,true);
 assert.equal(result.merchant_order_search_ok,true);
 assert.equal(result.payment_attempts.length,1);
 assert.equal(result.payment_attempts[0].status,'rejected');
 assert.equal(result.payment_attempts[0].status_detail,'cc_rejected_other_reason');
 assert.equal(result.payment_attempts[0].amount_matches,true);
 assert.equal(result.productionAuthorized,false);
 assert.equal(writes,0);
 assert.equal(network,3);
 assert.ok(!JSON.stringify(result).includes('private@example.invalid'));
 assert.ok(!JSON.stringify(result).includes('999999'));
});
test('Central displays protected diagnostic action',()=>{
 assert.match(src,/Diagnosticar intento de pago/);
 assert.match(src,/apiPost\("\/admin\/api\/central\/payment-diagnostic"/);
});
