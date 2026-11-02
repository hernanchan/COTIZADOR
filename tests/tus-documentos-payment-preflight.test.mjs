import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const id='5ad01300-f40a-43f2-a455-56616a8a9e04';
let network=0,writes=[],manifest,order,lines;
const db={prepare(sql){
 let values=[];
 const q={bind(...v){values=v;return q},async run(){
  writes.push(sql);
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS'))return {success:true};
  throw Error('Unexpected D1 write '+sql);
 },async first(){
  if(sql.startsWith('SELECT id,amount_ars,deposit_ars,status,created_at,preference_id FROM orders'))return values[0]===id?order:null;
  if(sql.startsWith('SELECT amount_ars,file_count,manifest_json FROM central_document_manifests'))return values[0]===id?manifest:null;
  throw Error('Unexpected D1 first '+sql);
 },async all(){
  if(sql.startsWith('SELECT sku,line_total_ars,quantity,unit_price_ars FROM order_items'))return {results:values[0]===id?lines:[]};
  throw Error('Unexpected D1 all '+sql);
 }};return q;
}};
const scope={Request,Response,URL,URLSearchParams,AbortSignal,TextEncoder,crypto:webcrypto,console,fetch:async()=>{network++;throw Error('External calls prohibited')}};
scope.globalThis=scope;vm.createContext(scope);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),scope);
const env={DB:db,DEMO_ADMIN_KEY:'test-admin',MP_TEST_ACCESS_TOKEN:'fake',MP_TEST_SELLER_ID:'999',TEST_WEBHOOK_URL:'https://localhost.invalid/hook',MP_WEBHOOK_SECRET:'test-only'};
function reset(){
 order={id,amount_ars:9000,deposit_ars:9000,status:'awaiting_payment',preference_id:null,created_at:new Date().toISOString().slice(0,19).replace('T',' ')};
 manifest={amount_ars:8000,file_count:2,manifest_json:JSON.stringify({schema:'saber-central-documentos-d1-v1',importe:8000,trabajos:[{},{}]})};
 lines=[{sku:'DOCS_VERIFIED',line_total_ars:8000,unit_price_ars:8000,quantity:1},{sku:'PAPEL',line_total_ars:1000,unit_price_ars:1000,quantity:1}];
 writes=[];network=0;
}
async function call(auth=true){
 const r=await scope.worker.fetch(new Request('https://test.invalid/admin/api/central/payment-preflight',{method:'POST',
 headers:{'Content-Type':'application/json',Authorization:'Bearer '+(auth?'test-admin':'wrong')},body:JSON.stringify({order_id:id})}),env);
 return {status:r.status,data:await r.json()};
}
test('valid paid-in-full document + mixed order is eligible only for sandbox testing',async()=>{
 reset();
 const {status,data}=await call();
 assert.equal(status,200);
 assert.equal(data.ready_for_sandbox_test,true);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(data.productionAuthorized,false);
 assert.equal(data.createsMercadoPagoPreference,false);
 assert.equal(data.amount_ars,9000);
 assert.equal(data.documents_ars,8000);
 assert.equal(network,0);
 assert.ok(writes.every(x=>x.startsWith('CREATE TABLE IF NOT EXISTS')));
});
test('unverified D1 manifest and mismatched amount are not eligible',async()=>{
 reset();manifest=null;
 assert.equal((await call()).data.ready_for_sandbox_test,undefined);
 manifest={amount_ars:8000,file_count:2,manifest_json:'not json'};
 assert.equal((await call()).data.reason,'MANIFIESTO_INVALIDO');
 reset();lines[1].line_total_ars=2000;
 assert.equal((await call()).data.reason,'IMPORTE_NO_COINCIDE');
 reset();order.deposit_ars=4500;
 assert.equal((await call()).data.reason,'PAGO_TOTAL_INVALIDO');
});
test('paid, preference initiated, expired and unauthorized do not qualify',async()=>{
 reset();order.status='paid';assert.equal((await call()).data.reason,'PEDIDO_NO_PENDIENTE');
 reset();order.preference_id='sandbox-pref';assert.equal((await call()).data.reason,'PAGO_YA_INICIADO');
 reset();order.created_at='2026-01-01 00:00:00';assert.equal((await call()).data.reason,'COTIZACION_VENCIDA');
 reset();assert.equal((await call(false)).status,401);
 assert.equal(network,0);
});
