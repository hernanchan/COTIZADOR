import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash,createHmac,randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(new URL('../integraciones/polaroids/express/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const book=await PDFDocument.create();book.addPage([595.28,841.89]);
const pdf=new Uint8Array(await book.save({useObjectStreams:true}));
const sha256=createHash('sha256').update(pdf).digest('hex');
const db=new DatabaseSync(':memory:');
db.exec("PRAGMA foreign_keys=ON");
db.exec(readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8'));
const DB={
 prepare(sql){let args=[];const q={
  bind(...v){args=v;return q},
  async first(){return db.prepare(sql).get(...args)||null},
  async all(){return {results:db.prepare(sql).all(...args)}},
  async run(){const x=db.prepare(sql).run(...args);return {meta:{changes:Number(x.changes)}}}
 };return q;},
 async batch(steps){db.exec('BEGIN');try{
  const result=[];for(const x of steps)result.push(await x.run());db.exec('COMMIT');return result;
 }catch(e){db.exec('ROLLBACK');throw e}}
};
const env={DB,MP_TEST_ACCESS_TOKEN:'TEST',DEMO_ADMIN_KEY:'test-administrative-key',
 MP_TEST_SELLER_ID:'111',TEST_WEBHOOK_URL:'https://test.invalid/webhooks',
 MP_WEBHOOK_SECRET:'webhook-secret-do-not-use',
 CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'independent-central-key-for-polar-0123456789',
 CENTRAL_EXPRESS_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_EXPRESS_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 EXPRESS_DOWNLOAD_HMAC_KEY:'GAS-private-download-secret-0123456789',
 EXPRESS_DOWNLOAD_SCRIPT_URL:'https://script.google.com/macros/s/AKfycbEXPRESSDOWNLOAD1234567890123456789/exec',
 CENTRAL_EXPRESS_DOWNLOAD_ENABLED:'PRIVATE_TEST_ONLY'};
const reference='POL-'+'F'.repeat(24),host='https://saber-pagos-pruebas.test.workers.dev';
let tamper=false,redirect=false,requests=0;
async function fakeFetch(url,opts){
 if(!url.startsWith('https://script.google.com/'))throw Error('Network unexpectedly used');
 requests++;
 assert.equal(opts.method,'POST');
 assert.equal(opts.redirect,'manual');
 const envelope=JSON.parse(opts.body);
 const expected=createHmac('sha256',env.EXPRESS_DOWNLOAD_HMAC_KEY)
  .update(envelope.timestamp+'\n'+envelope.nonce+'\n'+envelope.payloadJson).digest('hex');
 assert.equal(envelope.signature,expected);
 const payload=JSON.parse(envelope.payloadJson);
 assert.deepEqual(Object.keys(payload).sort(),['bytes','op','referencia','sha256']);
 assert.equal(payload.op,'leerPdfExpress');
 assert.equal(payload.referencia,reference);
 assert.equal(payload.sha256,sha256);
 assert.equal(payload.bytes,pdf.length);
 if(redirect)return new Response(null,{status:302,headers:{Location:'https://evil.invalid/receive'}});
 const altered=tamper?Uint8Array.from(pdf):pdf;
 if(tamper)altered[10]^=1;
 return Response.json({ok:true,verified:true,referencia:reference,
  sha256,bytes:pdf.length,pdfBase64:Buffer.from(altered).toString('base64')});
}
const context=vm.createContext({
 Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,
 atob,crypto:webcrypto,fetch:fakeFetch,console
});
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
vm.runInContext(src.replace('export default {','globalThis.worker = {'),context);
function signed(path,body){
 const text=JSON.stringify(body),ts=Math.floor(Date.now()/1000),nonce=randomUUID();
 const signature=createHmac('sha256',env.CENTRAL_BRIDGE_KEY)
  .update(ts+'\n'+nonce+'\n'+text).digest('hex');
 return new Request(host+path,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':nonce,'x-saber-signature':signature
 },body:text});
}
async function post(path,body){
 const res=await context.worker.fetch(signed(path,body),env);
 return {status:res.status,body:await res.json()};
}
async function download(auth=true){
 return context.worker.fetch(new Request(host+'/admin/api/central/polaroid-pdf?reference='+reference,{
  method:'GET',headers:auth?{Authorization:'Bearer '+env.DEMO_ADMIN_KEY}:{}
 }),env);
}
let id;
test('la Central exige PDF privado registrado y una compra antes de descargar',async()=>{
 assert.equal((await download(false)).status,401);
 const proof={schema:'saber-polaroids-express-central-v1',
  referencia:reference,sha256,bytes:pdf.length,fotos:6,hojas:1,
  importeArs:3000,pdfPrivadoVerificado:true,pagoConfirmado:false,listoParaProducir:false};
 assert.equal((await post('/internal/central/polaroid-stage',proof)).status,201);
 assert.equal((await download()).status,404);
 const result=await post('/internal/central/polaroid-prepare-order',{
  clientOrderId:randomUUID(),referencia:reference,items:[]});
 assert.equal(result.status,201,JSON.stringify(result.body));
 id=result.body.commercial_order_id;
 assert.equal((await download()).status,404);
 assert.equal(requests,0,'No se tocó Google sin pago completo');
});
test('sólo operador de pedido realmente pagado puede descargar UN PDF',async()=>{
 db.prepare("UPDATE orders SET status='paid',paid_at=datetime('now'),payment_id='MP-TEST-1',preference_id='MP-PREF-1' WHERE id=?").run(id);
 const listResponse=await context.worker.fetch(new Request(host+'/admin/api/central/polaroids',{
  headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY}
 }),env);
 assert.equal(listResponse.status,200);
 assert.equal((await listResponse.json()).manifests.find(x=>x.referencia===reference).estadoPago,'PAGADO');
 const res=await download();
 assert.equal(res.status,200,await res.clone().text().then(x=>x.slice(0,100)));
 assert.equal(res.headers.get('Content-Type'),'application/pdf');
 assert.match(res.headers.get('Content-Disposition'),/^attachment; filename="POL-/);
 assert.equal(res.headers.get('Cache-Control'),'private, no-store');
 const actual=new Uint8Array(await res.arrayBuffer());
 assert.deepEqual(actual,pdf);
 const loaded=await PDFDocument.load(actual);
 assert.equal(loaded.getPageCount(),1);
 assert.equal(requests,1);
});
test('rechaza PDF alterado, compra inconsistente y redirección ajena',async()=>{
 tamper=true;
 assert.equal((await download()).status,502);
 tamper=false;
 redirect=true;
 assert.equal((await download()).status,502);
 redirect=false;
 db.prepare("UPDATE order_items SET file_references_json=? WHERE order_id=? AND sku='POLAROID_EXPRESS_A4'")
  .run(JSON.stringify(['POL-'+'E'.repeat(24)]),id);
 assert.equal((await download()).status,409);
 db.prepare("UPDATE order_items SET file_references_json=? WHERE order_id=? AND sku='POLAROID_EXPRESS_A4'")
  .run(JSON.stringify([reference]),id);
 const previous=env.CENTRAL_EXPRESS_DOWNLOAD_ENABLED;
 env.CENTRAL_EXPRESS_DOWNLOAD_ENABLED='';
 assert.equal((await download()).status,503);
 env.CENTRAL_EXPRESS_DOWNLOAD_ENABLED=previous;
});
test('devolución o revocación retira el derecho a descargar',async()=>{
 db.prepare("INSERT INTO payment_reviews(order_id,state) VALUES(?,'revoked')").run(id);
 assert.equal((await download()).status,404);
 assert.equal((await download(false)).status,401);
});
