import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const code=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='8c0ff1b5-414c-4f19-8d45-c774f22989b0';
const fakeUrl='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=789';
const response=j=>new Response(JSON.stringify(j),{status:200,headers:{'Content-Type':'application/json'}});
function setup(remote){
 const order={id,description:'Pedido ficticio de prueba',amount_ars:8332,deposit_ars:8332,status:'awaiting_payment',
  preference_id:null,created_at:new Date().toISOString().slice(0,19).replace('T',' ')};
 const calls=[];
 const DB={prepare(sql){
  let args=[];
  const q={bind(...v){args=v;return q},
   async first(){
    if(sql.includes("FROM sqlite_master WHERE type='table' AND name='transfer_requests'"))return null;
    if(sql.includes('SELECT * FROM orders WHERE id=?'))return order;
    if(sql.includes('SELECT sku FROM order_items WHERE order_id=?'))return null;
    if(sql.includes('SELECT preference_id,status FROM orders WHERE id=?'))return order;
    throw Error('Unknown D1 first: '+sql);
   },
   async run(){
    if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
    if(sql.startsWith('INSERT INTO checkout_locks'))return {meta:{changes:1}};
    if(sql.startsWith('INSERT OR IGNORE INTO checkout_attempts'))return {meta:{changes:1}};
    if(sql.startsWith('DELETE FROM checkout_locks'))return {meta:{changes:1}};
    if(sql.startsWith('UPDATE orders SET preference_id=?')){
     if(order.preference_id)return {meta:{changes:0}};
     order.preference_id=args[0];return {meta:{changes:1}};
    }
    throw Error('Unknown D1 run: '+sql);
   }};
  return q;
 }};
 const sandbox={AbortSignal,Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
  fetch:async(url,init={})=>{
   const u=String(url);calls.push({url:u,method:init.method||'GET'});
   if(!u.includes('/checkout/preferences'))throw Error('Unexpected network: '+u);
   return response(init.method==='POST'?{id:'789',init_point:'https://www.mercadopago.com.ar/live'}:remote);
  }};
 sandbox.globalThis=sandbox;vm.createContext(sandbox);
 vm.runInContext(code.replace('export default {','globalThis.worker = {'),sandbox,{filename:'worker.js'});
 const env={DB,DEMO_ADMIN_KEY:'test-local',MP_TEST_ACCESS_TOKEN:'fake-test',
  MP_TEST_SELLER_ID:'123',MP_WEBHOOK_SECRET:'test',TEST_WEBHOOK_URL:'https://private.invalid/webhooks/mercadopago'};
 const call=async()=>{
  const res=await sandbox.worker.fetch(new Request('https://private.invalid/demo/checkout',{
   method:'POST',headers:{Authorization:'Bearer test-local','Content-Type':'application/json'},
   body:JSON.stringify({order_id:id})}),env);
  return {status:res.status,body:await res.json()};
 };
 return {call,calls,order};
}
const preference=()=>({id:'789',external_reference:id,
 items:[{currency_id:'ARS',quantity:1,unit_price:8332}],sandbox_init_point:fakeUrl});
test('new sandbox preference is re-read and verified against D1 before redirect',async()=>{
 const x=setup(preference());const result=await x.call();
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.checkout_url,fakeUrl);
 assert.equal(result.body.reused,false);
 assert.equal(x.order.preference_id,'789');
 assert.equal(x.calls.filter(x=>x.method==='POST').length,1);
 assert.equal(x.calls.filter(x=>x.method==='GET').length,1);
});
test('new preference refuses live-only, invalid amount or external checkout URL',async()=>{
 for(const mutate of [
  p=>{delete p.sandbox_init_point;p.init_point='https://www.mercadopago.com.ar/live'},
  p=>{p.items[0].unit_price=1},
  p=>{p.sandbox_init_point='https://attacker.invalid/pay'}
 ]){
  const p=preference();mutate(p);const x=setup(p);const result=await x.call();
  assert.ok(result.status>=400,JSON.stringify(result.body));
  assert.equal(result.body.checkout_url,undefined);
  assert.equal(x.calls.filter(x=>x.method==='POST').length,1);
 }
});
