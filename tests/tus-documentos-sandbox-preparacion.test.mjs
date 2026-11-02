import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='5ad01300-f40a-43f2-a455-56616a8a9e04';
const fakeUrl='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=789';
let order,manifest,lines,transfer,network,preferencePosts,attempted,locks;
function reset(){
 order={id,description:'Librería Saber · documentos verificados y tienda',
  amount_ars:9000,deposit_ars:9000,status:'awaiting_payment',preference_id:null,
  created_at:new Date().toISOString().slice(0,19).replace('T',' ')};
 manifest={amount_ars:8000,file_count:2,manifest_json:JSON.stringify({schema:'saber-central-documentos-d1-v1',importe:8000,trabajos:[{},{}]})};
 lines=[{sku:'DOCS_VERIFIED',line_total_ars:8000,unit_price_ars:8000,quantity:1},
  {sku:'PAPEL',line_total_ars:1000,unit_price_ars:1000,quantity:1}];
 transfer=false;network=0;preferencePosts=0;attempted=false;locks=false;
}
reset();
const DB={prepare(sql){
 let args=[];const q={bind(...values){args=values;return q},
 async first(){
  if(sql.startsWith('SELECT id,amount_ars,deposit_ars,status,created_at,preference_id FROM orders'))return args[0]===id?order:null;
  if(sql.startsWith('SELECT amount_ars,file_count,manifest_json FROM central_document_manifests'))return args[0]===id?manifest:null;
  if(sql.startsWith('SELECT * FROM orders WHERE id='))return args[0]===id?order:null;
  if(sql.startsWith('SELECT sku FROM order_items WHERE order_id='))return lines.find(x=>x.sku==='POLAROID_EXPRESS_A4')||lines.find(x=>x.sku==='DOCS_VERIFIED')||null;
  if(sql.includes("FROM sqlite_master WHERE type='table' AND name='transfer_requests'"))return transfer?{name:'transfer_requests'}:null;
  if(sql.startsWith('SELECT order_id FROM transfer_requests'))return transfer?{order_id:id}:null;
  if(sql.startsWith('SELECT preference_id,status FROM orders'))return {preference_id:order.preference_id,status:order.status};
  throw Error('Unexpected first: '+sql);
 },
 async all(){
  if(sql.startsWith('SELECT sku,line_total_ars,quantity,unit_price_ars FROM order_items'))return {results:lines};
  throw Error('Unexpected all: '+sql);
 },
 async run(){
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS')||sql.startsWith('CREATE INDEX IF NOT EXISTS'))return {success:true};
  if(sql.startsWith('INSERT INTO checkout_locks')){if(locks)return {meta:{changes:0}};locks=true;return {meta:{changes:1}}}
  if(sql.startsWith('INSERT OR IGNORE INTO checkout_attempts')){if(attempted)return {meta:{changes:0}};attempted=true;return {meta:{changes:1}}}
  if(sql.startsWith('DELETE FROM checkout_locks')){locks=false;return {meta:{changes:1}}}
  if(sql.startsWith('UPDATE orders SET preference_id=')){if(order.preference_id)return {meta:{changes:0}};order.preference_id=args[0];return {meta:{changes:1}}}
  throw Error('Unexpected write: '+sql);
 }};return q;
}};
const scope={Request,Response,URL,URLSearchParams,AbortSignal,TextEncoder,crypto:webcrypto,console,fetch:async(url,opts)=>{
 network++;const u=String(url);
 if(u.endsWith('/checkout/preferences')&&opts.method==='POST'){
  preferencePosts++;const body=JSON.parse(opts.body);
  assert.equal(body.items[0].unit_price,9000);
  assert.equal(body.external_reference,id);
  return new Response(JSON.stringify({id:'789'}),{status:200});
 }
 if(u.endsWith('/users/me'))return new Response(JSON.stringify({id:999,tags:['test_user']}),{status:200});
 if(u.endsWith('/checkout/preferences/789'))
  return new Response(JSON.stringify({id:'789',external_reference:id,collector_id:999,items:[{currency_id:'ARS',quantity:1,unit_price:9000}],init_point:fakeUrl}),{status:200});
 throw Error('Unexpected network: '+u);
}};
scope.globalThis=scope;vm.createContext(scope);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),scope);
const env={DB,DEMO_ADMIN_KEY:'test-admin',MP_TEST_ACCESS_TOKEN:'fake',MP_TEST_SELLER_ID:'999',TEST_WEBHOOK_URL:'https://private.invalid/webhook',MP_WEBHOOK_SECRET:'test-only'};
async function call(path='/admin/api/central/payment-sandbox-prepare'){
 const response=await scope.worker.fetch(new Request('https://test.invalid'+path,{method:'POST',
  headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify({order_id:id,amount_ars:1})}),env);
 return {status:response.status,data:await response.json()};
}
test('private sandbox preparation is disabled by default with no network calls',async()=>{
 reset();delete env.DOCS_SANDBOX_CHECKOUT_ENABLED;
 const x=await call();assert.equal(x.status,503);assert.equal(network,0);
});
test('admin preflight requires exact contract and never calls MP',async()=>{
 reset();env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 const x=await call('/admin/api/central/payment-preflight');
 assert.equal(x.status,400);assert.equal(network,0);
});
test('document sandbox preparation rejects tampered request',async()=>{
 reset();env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 const x=await call();assert.equal(x.status,400);assert.equal(network,0);
});
test('invalid manifest, amount or transfer block sandbox preference',async()=>{
 env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 for(const tweak of [()=>{manifest=null},()=>{lines[1].line_total_ars=1001},()=>{transfer=true},()=>{order.status='paid'}]){
  reset();tweak();const response=await scope.worker.fetch(new Request('https://test.invalid/admin/api/central/payment-sandbox-prepare',{method:'POST',
   headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify({order_id:id})}),env);
  assert.equal(response.status,409);assert.equal(network,0);
 }
});
test('validated D1-only amount creates one sandbox preference and safely reuses it',async()=>{
 reset();env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 const run=async()=>{const r=await scope.worker.fetch(new Request('https://test.invalid/admin/api/central/payment-sandbox-prepare',{method:'POST',
  headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify({order_id:id})}),env);return {status:r.status,data:await r.json()}};
 const first=await run();assert.equal(first.status,200,JSON.stringify(first.data));
 assert.equal(first.data.checkout_url,fakeUrl);assert.equal(preferencePosts,1);
 // Reuse is only permitted via the already validated preference ID.
 const again=await run();assert.equal(again.status,200,JSON.stringify(again.data));assert.equal(again.data.reused,true);assert.equal(again.data.checkout_url,fakeUrl);assert.equal(preferencePosts,1);
});

test('direct checkout rechecks D1 despite an untrusted preflight header',async()=>{
 reset();env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 manifest=null;
 const r=await scope.worker.fetch(new Request('https://test.invalid/demo/checkout',{method:'POST',
  headers:{Authorization:'Bearer test-admin','Content-Type':'application/json','x-docs-sandbox-preflight':'PRIVATE_TEST_ONLY'},
  body:JSON.stringify({order_id:id})}),env);
 assert.equal(r.status,409);
 assert.equal(network,0);
});
test('mixed document and Polaroids Express order is blocked without payment call',async()=>{
 reset();env.DOCS_SANDBOX_CHECKOUT_ENABLED='PRIVATE_TEST_ONLY';
 lines.push({sku:'POLAROID_EXPRESS_A4',line_total_ars:1,unit_price_ars:1,quantity:1});
 assert.match(source,/ORDER BY CASE WHEN sku='POLAROID_EXPRESS_A4' THEN 0 ELSE 1 END LIMIT 1/);
 const r=await scope.worker.fetch(new Request('https://test.invalid/demo/checkout',{method:'POST',
  headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},
  body:JSON.stringify({order_id:id})}),env);
 assert.equal(r.status,503);
 assert.equal(network,0);
});

test('private Central exposes the operator-only sandbox preparation action',()=>{
 assert.match(source,/Preparar enlace Mercado Pago \(ensayo\)/);
 assert.match(source,/apiPost\("\/admin\/api\/central\/payment-preflight"/);
 assert.match(source,/apiPost\("\/admin\/api\/central\/payment-sandbox-prepare"/);
 assert.match(source,/PRUEBA CON CUENTA COMPRADORA DE ENSAYO/);
});
