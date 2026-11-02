import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const uuid='8c0ff1b5-414c-4f19-8d45-c774f22989b0';
const rows=new Map();
let networkCalls=0,preferences=0;
const DB={
 prepare(sql){
  let bound=[];
  const q={
   bind(...v){bound=v;return q},
   async first(){
    if(sql.includes('SELECT * FROM orders WHERE id='))return rows.get(bound[0])?.order||null;
    if(sql.includes("SELECT sku FROM order_items WHERE order_id=")){
     const data=rows.get(bound[0]);
     const sku=data?.items.find(x=>x==='DOCS_VERIFIED'||x==='POLAROID_EXPRESS_A4');
     return sku?{sku}:null;
    }
    throw Error('Unexpected SQL read: '+sql);
   },
   async run(){
    if(/^CREATE TABLE IF NOT EXISTS order_items\b/.test(sql))return {success:true};
    throw Error('Unexpected D1 write: '+sql);
   }
  };
  return q;
 }
};
const sandbox={AbortSignal,Response,Request,URL,URLSearchParams,TextEncoder,
 crypto:webcrypto,console,fetch:async(url)=>{
  networkCalls++;
  if(String(url).includes('/checkout/preferences'))preferences++;
  throw Error('External network request prohibited by offline payment gate');
 }};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),sandbox,{filename:'worker.js'});
const env={
 DB,DEMO_ADMIN_KEY:'clave-falsa-solo-ensayo',
 MP_TEST_ACCESS_TOKEN:'sin-acceso-real',
 MP_TEST_SELLER_ID:'999111222',MP_WEBHOOK_SECRET:'fake-hmac-solo-pruebas',
 TEST_WEBHOOK_URL:'https://localhost.invalid/webhooks/mercadopago'
};
const call=(path,body)=>sandbox.worker.fetch(new Request('https://sandbox.example'+path,{
 method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,'Content-Type':'application/json'},
 body:JSON.stringify(body)
}),env);

test('pedido TUS con PDF verificado no genera preferencia Mercado Pago desde demo',async()=>{
 for(const [name,items,description] of [
  ['documento solo',['DOCS_VERIFIED'],'Pedido A4'],
  ['documento mixto',['PRODUCTO','DOCS_VERIFIED'],'Pedido con productos'],
  ['pedido documental sin sku',[],'Librería Saber · documentos verificados y tienda']
 ]){
  rows.set(uuid,{order:{
   id:uuid,amount_ars:8332,deposit_ars:8332,
   status:'awaiting_payment',description,
   created_at:new Date().toISOString().slice(0,19).replace('T',' ')
  },items});
  const response=await call('/demo/checkout',{order_id:uuid});
  assert.equal(response.status,503,name);
  assert.match((await response.json()).error,/deshabilitado|habilitado/i);
 }
 assert.equal(preferences,0);
 assert.equal(networkCalls,0);
});
test('ruta de compra comercial sigue apagada sin autorización de checkout',async()=>{
 const response=await call('/checkout/pay',{
  client_order_id:uuid,order_id:uuid
 });
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/todavía no habilitados/i);
 assert.equal(preferences,0);
 assert.equal(networkCalls,0);
});

test('preflight-only sandbox flag cannot enable commercial checkout',()=>{
 assert.match(source,/DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY"/);
 assert.match(source,/x-docs-sandbox-preflight/);
 assert.match(source,/payment-sandbox-prepare/);
});
