import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='0c61bcb0-aa32-4e92-85bd-56bbf0a04494';
let row=null, saved=null, writes=0, network=0;
const DB={prepare(sql){
 let args=[];
 const q={bind(...a){args=a;return q},async first(){
  if(sql.includes('SELECT id,amount_ars,deposit_ars,status,preference_id FROM orders WHERE id=?'))return args[0]===id?row:null;
  if(sql.includes('SELECT amount_ars,status FROM transfer_requests WHERE order_id=?'))return saved;
  throw Error('unexpected D1 read '+sql);
 },async run(){
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS transfer_requests'))return {success:true};
  if(sql.startsWith('INSERT OR IGNORE INTO transfer_requests')){
   if(!saved){saved={amount_ars:args[1],status:'awaiting_bank_verification'};writes++}
   return {success:true};
  }
  throw Error('unexpected D1 write '+sql);
 }};return q;
}};
const scope={AbortSignal,Response,Request,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
 fetch:async()=>{network++;throw Error('No external network in transfer tests')}};
scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),scope);
const env={DB,DEMO_ADMIN_KEY:'test-secret',TRANSFER_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',TRANSFER_ALIAS:'saber.pruebas',MP_TEST_ACCESS_TOKEN:'offline',MP_TEST_SELLER_ID:'123456',MP_WEBHOOK_SECRET:'offline-hmac',TEST_WEBHOOK_URL:'https://localhost.invalid/webhook'};
async function call(body={},overrides={}){
 const result=await scope.worker.fetch(new Request('https://private.example/demo/transfer-request',{method:'POST',headers:{Authorization:'Bearer test-secret','Content-Type':'application/json'},body:JSON.stringify(body)}),{...env,...overrides});
 return {code:result.status,data:await result.json()};
}
test('confirmed document total becomes only a pending transfer, retries are idempotent',async()=>{
 row={id,amount_ars:8332,deposit_ars:8332,status:'awaiting_payment',preference_id:null};
 saved=null;writes=0;network=0;
 let r=await call({order_id:id});
 assert.equal(r.code,200);
 assert.deepEqual([r.data.order_id,r.data.amount_ars,r.data.alias,r.data.state],[id,8332,'saber.pruebas','awaiting_bank_verification']);
 assert.equal(r.data.payment_confirmed,false);
 assert.equal(r.data.production_enabled,false);
 r=await call({order_id:id});
 assert.equal(r.code,200);assert.equal(writes,1);assert.equal(network,0);
});
test('previous MP preference, paid state, missing alias or disabled flag fail closed',async()=>{
 row={id,amount_ars:8332,deposit_ars:8332,status:'awaiting_payment',preference_id:'mp-old'};
 saved=null;writes=0;
 assert.equal((await call({order_id:id})).code,409);
 row.preference_id=null;row.status='paid';
 assert.equal((await call({order_id:id})).code,409);
 row.status='awaiting_payment';
 assert.equal((await call({order_id:id},{TRANSFER_ALIAS:''})).code,503);
 assert.equal((await call({order_id:id},{TRANSFER_PRIVATE_ENABLED:'OFF'})).code,503);
 assert.equal(writes,0);
});
test('tampered amount and unknown order are never approved',async()=>{
 row={id,amount_ars:8332,deposit_ars:8332,status:'awaiting_payment',preference_id:null};
 saved=null;writes=0;
 const tamper=await call({order_id:id,amount_ars:1,payment_confirmed:true});
 assert.equal(tamper.code,200);assert.equal(tamper.data.amount_ars,8332);
 assert.equal(tamper.data.payment_confirmed,false);
 assert.equal((await call({order_id:'00000000-0000-4000-8000-000000000000'})).code,404);
 assert.equal(network,0);
});
