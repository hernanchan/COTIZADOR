import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='8c0ff1b5-414c-4f19-8d45-c774f22989b0';
const preferenceId='123456';
const sandboxUrl='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456';
const order={id,amount_ars:8332,deposit_ars:8332,status:'awaiting_payment',
 created_at:new Date().toISOString().slice(0,19).replace('T',' '),preference_id:preferenceId,
 description:'Pedido de prueba'};
const DB={prepare(sql){
 let args=[];
 const q={bind(...v){args=v;return q},async first(){
  if(sql.includes('SELECT * FROM orders WHERE id='))return args[0]===id?order:null;
  if(sql.includes('SELECT sku FROM order_items WHERE order_id='))return null;
  throw Error('Unexpected D1 read: '+sql);
 },async run(){if(sql.startsWith('CREATE TABLE IF NOT EXISTS order_items'))return {success:true};
  throw Error('Unexpected D1 write: '+sql);
 }};
 return q;
}};
let remote,requests;
const sandbox={AbortSignal,Response,Request,URL,URLSearchParams,TextEncoder,
 crypto:webcrypto,console,fetch:async url=>{
  requests++;
  assert.match(String(url),/api\\.mercadopago\\.com\\/checkout\\/preferences\\/123456$/);
  return new Response(JSON.stringify(remote),{status:200,headers:{'Content-Type':'application/json'}});
 }};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),sandbox,{filename:'worker.js'});
const env={DB,DEMO_ADMIN_KEY:'test-local-key',MP_TEST_ACCESS_TOKEN:'test-local-token',
 MP_TEST_SELLER_ID:'123',MP_WEBHOOK_SECRET:'test-only',TEST_WEBHOOK_URL:'https://localhost.invalid/webhooks/mercadopago'};
const call=()=>sandbox.worker.fetch(new Request('https://sandbox.example/demo/checkout',{
 method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({order_id:id,amount_ars:1})}),env);
const base=()=>({id:preferenceId,external_reference:id,
 items:[{currency_id:'ARS',quantity:1,unit_price:8332}],sandbox_init_point:sandboxUrl});
test('reused preference respects D1 amount, currency, ID and sandbox URL',async()=>{
 requests=0;
 for(const [description,change] of [
  ['wrong amount',p=>p.items[0].unit_price=1],
  ['wrong currency',p=>p.items[0].currency_id='USD'],
  ['wrong order',p=>p.external_reference='other'],
  ['wrong preference id',p=>p.id='different'],
  ['multiple line items',p=>p.items.push({currency_id:'ARS',quantity:1,unit_price:1})],
  ['non-sandbox URL',p=>{delete p.sandbox_init_point;p.init_point='https://www.mercadopago.com.ar/checkout/v1/redirect'}],
  ['external URL',p=>p.sandbox_init_point='https://evil.example/pay'],
 ]){
  remote=base();change(remote);
  const response=await call();
  assert.ok(response.status>=400,description);
  assert.ok(!(await response.json()).checkout_url,description);
 }
 remote=base();
 const response=await call();
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.checkout_url,sandboxUrl);
 assert.equal(data.reused,true);
 assert.equal(requests,8);
});
