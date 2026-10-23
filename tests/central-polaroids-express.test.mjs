import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
db.exec(readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8'));
const DB={
 prepare(sql){let args=[];const statement={
  bind(...p){args=p;return statement},
  async first(){return db.prepare(sql).get(...args)||null},
  async all(){return {results:db.prepare(sql).all(...args)}},
  async run(){const res=db.prepare(sql).run(...args);return {meta:{changes:Number(res.changes)}}}
 };return statement;},
 async batch(steps){
  db.exec('BEGIN');try{
   const result=[];for(const s of steps)result.push(await s.run());
   db.exec('COMMIT');return result;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
};
const c=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,
 crypto:webcrypto,console,fetch:async()=>{throw Error('Network disabled')}});
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
vm.runInContext(src.replace('export default {','globalThis.worker = {'),c);
const env={DB,MP_TEST_ACCESS_TOKEN:'TEST-100',DEMO_ADMIN_KEY:'private-admin-value',
 MP_TEST_SELLER_ID:'111',TEST_WEBHOOK_URL:'https://localhost.invalid/webhook',
 MP_WEBHOOK_SECRET:'different-mp-key',
 CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'independent-central-express-hmac-key-01234567890',
 CENTRAL_EXPRESS_ENABLED:'PRIVATE_TEST_ONLY'};
const url='https://saber-pagos-pruebas.test.workers.dev';
const ref='POL-'+'A'.repeat(24),different='POL-'+'B'.repeat(24);
const proof={schema:'saber-polaroids-express-central-v1',referencia:ref,
 fotos:24,hojas:4,sha256:'a'.repeat(64),bytes:4857000,importeArs:12000,
 pdfPrivadoVerificado:true,pagoConfirmado:false,listoParaProducir:false};
function signed(body,extra={}){
 const text=JSON.stringify(body);
 const ts=extra.ts??Math.floor(Date.now()/1000),id=randomUUID();
 const hmac=createHmac('sha256',extra.key||env.CENTRAL_BRIDGE_KEY)
  .update(ts+'\n'+id+'\n'+text).digest('hex');
 return new Request(url+'/internal/central/polaroid-stage',{
  method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':hmac,
   ...(extra.origin?{Origin:'https://bad.test'}:{})},body:text});
}
async function stage(p,opts){
 const response=await c.worker.fetch(signed(p,opts),env);
 return {status:response.status,body:await response.json()};
}
async function admin(path,authenticated=true){
 const request=new Request(url+path,{headers:authenticated?
  {Authorization:'Bearer '+env.DEMO_ADMIN_KEY}:{}});
 const res=await c.worker.fetch(request,env);
 return {status:res.status,body:await res.json()};
}
test('rechaza sin configuración, firma, tiempo o clave admin',async()=>{
 const old=env.CENTRAL_EXPRESS_ENABLED;env.CENTRAL_EXPRESS_ENABLED='';
 assert.equal((await stage(proof)).status,503);env.CENTRAL_EXPRESS_ENABLED=old;
 assert.equal((await stage(proof,{key:'otro-secreto-largo-012345678901234567890'})).status,401);
 assert.equal((await stage(proof,{origin:true})).status,403);
 assert.equal((await stage(proof,{ts:Math.floor(Date.now()/1000)-900})).status,401);
 assert.equal((await admin('/admin/api/central/polaroids',false)).status,401);
 assert.equal(db.prepare('SELECT COUNT(*) total FROM central_polaroids_express').get().total,0);
});
test('registra un PDF final verificado por referencia sin fotos ni archivos',async()=>{
 const reply=await stage(proof);
 assert.equal(reply.status,201,JSON.stringify(reply.body));
 assert.equal(reply.body.saved,true);
 assert.equal(reply.body.paymentAuthorized,false);
 const row=db.prepare('SELECT * FROM central_polaroids_express').get();
 assert.equal(row.reference,ref);assert.equal(row.photos,24);
 assert.equal(row.sheets,4);assert.equal(row.amount_ars,12000);
 assert.equal(row.commercial_order_id,null);
 assert.equal(row.sha256,proof.sha256);
 const adminView=await admin('/admin/api/central/polaroids');
 assert.equal(adminView.status,200);
 assert.equal(adminView.body.manifests.length,1);
 assert.equal(adminView.body.manifests[0].fotos,24);
 assert.equal(adminView.body.manifests[0].importe,12000);
 assert.equal(adminView.body.paymentAuthorized,false);
 assert.equal(adminView.body.listoParaProducir,false);
 assert.equal(JSON.stringify(adminView.body).includes(proof.sha256),false);
 const retry=await stage(proof);assert.equal(retry.status,200);
 assert.equal(retry.body.idempotent,true);
 assert.equal(db.prepare('SELECT COUNT(*) total FROM central_polaroids_express').get().total,1);
});
test('rechaza la reutilización de referencia para otro PDF, precio, imágenes y campos extras',async()=>{
 assert.equal((await stage({...proof,sha256:'f'.repeat(64)})).status,409);
 assert.equal((await stage({...proof,importeArs:25000})).status,422);
 assert.equal((await stage({...proof,fotos:25})).status,422);
 assert.equal((await stage({...proof,fotos:23,hojas:3})).status,422);
 assert.equal((await stage({...proof,pdfBase64:'secret data'})).status,422);
 assert.equal((await stage({...proof,pagoConfirmado:true})).status,422);
 assert.equal((await stage({...proof,listoParaProducir:true})).status,422);
 const other=await stage({...proof,referencia:different,fotos:6,hojas:1,importeArs:3000});
 assert.equal(other.status,201);
 assert.equal(db.prepare('SELECT COUNT(*) total FROM central_polaroids_express').get().total,2);
});
test('panel muestra recepciones Express separadas de pagos aprobados',async()=>{
 const response=await c.worker.fetch(new Request(url+'/admin'),env);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Polaroids Express · PDF privado único/);
 assert.match(html,/Consultar PDF recibidos/);
 assert.match(html,/api\/central\/polaroids/);
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(js));
 assert.equal(html.includes(env.CENTRAL_BRIDGE_KEY),false);
 const paid=await admin('/admin/api/orders');
 assert.deepEqual([...paid.body.orders],[]);
});
