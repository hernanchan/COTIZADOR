import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const uuid='8c0ff1b5-414c-4f19-8d45-c774f22989b0';
let review=null;
const order={id:uuid,description:'Prueba privada',amount_ars:8332,deposit_ars:8332,status:'paid',paid_at:'2026-11-02 10:00:00',
 payment_id:'456',preference_id:'789',created_at:'2026-11-02 09:00:00'};
const DB={prepare(sql){
 let bound=[];
 const q={bind(...args){bound=args;return q},async run(){
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS payment_reviews')||sql.startsWith('CREATE TABLE IF NOT EXISTS order_items'))return {success:true};
  throw Error('Unexpected write: '+sql);
 },async first(){
  if(sql.includes('FROM orders WHERE id=? AND status=\'paid\'')){
   if(!sql.includes("state='verified'"))throw Error('Fail-closed verified review condition missing');
   return bound[0]===uuid&&review==='verified'?order:null;
  }
  throw Error('Unexpected read: '+sql);
 },async all(){
  if(sql.includes("FROM orders WHERE status='paid'")){
   if(!sql.includes("state='verified'"))throw Error('Fail-closed verified review condition missing');
   return {results:review==='verified'?[order]:[]};
  }
  throw Error('Unexpected query: '+sql);
 }};
 return q;
}};
const sandbox={AbortSignal,Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
 fetch:async()=>{throw Error('No network permitted')}};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),sandbox,{filename:'worker.js'});
const env={DB,DEMO_ADMIN_KEY:'private-test',MP_TEST_ACCESS_TOKEN:'fake',
 MP_TEST_SELLER_ID:'123',MP_WEBHOOK_SECRET:'fake',
 TEST_WEBHOOK_URL:'https://localhost.invalid/webhooks/mercadopago'};
async function request(path){
 const response=await sandbox.worker.fetch(new Request('https://private.example'+path,{headers:{Authorization:'Bearer private-test'}}),env);
 return {status:response.status,body:await response.json()};
}
test('paid order lists fail closed without a verified payment review',async()=>{
 for(const state of [null,'revoked']){
  review=state;
  for(const path of ['/admin/api/orders','/demo/paid-orders']){
   const r=await request(path);assert.equal(r.status,200,path);
   assert.equal(r.body.orders.length,0,path+' / '+state);
  }
  const detail=await request('/admin/api/order?id='+uuid);
  assert.equal(detail.status,404);
 }
 review='verified';
 const list=await request('/admin/api/orders');
 assert.equal(list.status,200);
 assert.equal(list.body.orders.length,1);
 // Detail needs additional D1 tables; list permission verifies the review gate.
});
test('Express private PDF download also requires explicit verified review',()=>{
 const section=source.slice(source.indexOf('async function centralPolaroidDownload'),source.indexOf('async function centralPolaroidDownload')+6500);
 assert.match(section,/EXISTS \(SELECT 1 FROM payment_reviews q WHERE q\.order_id=o\.id AND q\.state='verified'\)/);
});
