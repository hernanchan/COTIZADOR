import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
 AbortSignal,fetch:()=>{throw Error('Prueba sin red externa')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const handler=vm.runInContext('centralTUSDeliveryPurgePlan',ctx);
const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const commercial='b69f8ef5-63eb-4728-a967-584c63f39c41';
const receipt='DOC-a69f8ef5-63eb-4728-a967-584c63f39c41';
const secret='B'.repeat(48),hash='c'.repeat(64);
const order={
 web_order_id:webOrderId,commercial_order_id:commercial,file_count:1,
 production_version:3,production_state:'entregado',
 paid_at:'2026-11-05 15:20:00',payment_status:'paid',amount_ars:2000,deposit_ars:2000,
 delivered_at:'2026-11-05 17:12:00',
 manifest_json:JSON.stringify({schema:'saber-central-documentos-d1-v1',
  webOrderId,trabajos:[{reciboPrivado:receipt,fileId:'FILE001',sha256:hash,bytes:140000}]})
};
const rows=[{receipt_id:receipt,file_id:'FILE001',sha256:hash}];
let readCount=0,writes=0;
const db={
 prepare(sql){
  const obj={
   params:[],
   bind(...params){this.params=params;return this},
   async run(){
    if(!sql.startsWith('CREATE TABLE')&&!sql.startsWith('CREATE INDEX'))
     throw Error('Escritura no permitida: '+sql);
    writes++;
    return {meta:{changes:0}}
   },
   async first(){
    readCount++;
    if(sql.includes('FROM central_document_manifests m JOIN orders o')){
     assert.match(sql,/p\.state='entregado'/);
     assert.match(sql,/o\.status='paid'/);
     assert.match(sql,/r\.state='verified'/);
     assert.equal(this.params[0],webOrderId);
     return order.production_state==='entregado'?order:null;
    }
    throw Error('Consulta inesperada: '+sql)
   },
   async all(){
    readCount++;
    if(sql.includes('FROM central_document_receipts r')){
     assert.equal(this.params[0],webOrderId);
     return {results:rows}
    }
    throw Error('Consulta inesperada: '+sql)
   }
  };
  return obj
 }
};
const env={DB:db,CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:secret,
 DEMO_ADMIN_KEY:'DIFFERENT_SECRET',MP_WEBHOOK_SECRET:'DIFFERENT_WEBHOOK'};
async function signed(body,override={}){
 const ts=String(Math.floor(Date.now()/1000));
 const id=webcrypto.randomUUID();
 const raw=JSON.stringify(body);
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await webcrypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+raw))).toString('hex');
 return new Request('https://saber-pagos-pruebas.workers.dev/internal/central/tus-purge-plan',{
 method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':ts,
  'x-saber-request-id':id,'x-saber-signature':sig,...override},body:raw});
}
test('Puente firmado: solo leído, entrega y pago, recibos exactos',async()=>{
 readCount=0;writes=0;order.production_state='entregado';
 const req=await signed({schema:'saber-central-tus-purge-plan-v1',webOrderId});
 const answer=await handler(req,env);
 assert.equal(answer.status,200);
 const d=await answer.json();
 assert.equal(d.ok,true);
 assert.equal(d.productionState,'entregado');
 assert.equal(d.paymentVerified,true);
 assert.equal(d.files.length,1);
 assert.equal(d.files[0].receiptId,receipt);
 assert.equal(d.files[0].sha256,hash);
 assert.equal(d.deletionExecuted,false);
 assert.equal(d.retentionDays,0);
 assert.ok(readCount>=2);
 assert.ok(writes>=1,'solo CREATE IF NOT EXISTS de tablas existentes');
 assert.equal(JSON.stringify(d).includes('service_role'),false);
});
test('Nunca produce plan si aún está listo y no entregado',async()=>{
 order.production_state='listo';
 const req=await signed({schema:'saber-central-tus-purge-plan-v1',webOrderId});
 const answer=await handler(req,env);
 assert.equal(answer.status,409);
 order.production_state='entregado';
});
test('Recibo incongruente bloquea la limpieza del pedido',async()=>{
 rows[0].sha256='a'.repeat(64);
 const req=await signed({schema:'saber-central-tus-purge-plan-v1',webOrderId});
 const answer=await handler(req,env);
 assert.equal(answer.status,409);
 rows[0].sha256=hash;
});
test('Sin firma válida no se consulta ningún pedido',async()=>{
 const before=readCount;
 const req=await signed({schema:'saber-central-tus-purge-plan-v1',webOrderId},{
  'x-saber-signature':'0'.repeat(64)});
 const answer=await handler(req,env);
 assert.equal(answer.status,401);
 assert.equal(readCount,before);
});
test('Ruta privada no puede crear pagos ni eliminar archivos',()=>{
 assert.match(source,/\/internal\/central\/tus-purge-plan/);
 assert.match(source,/async function centralTUSDeliveryPurgePlan/);
 const block=source.slice(source.indexOf('async function centralTUSDeliveryPurgePlan'),
  source.indexOf('async function centralTUSPackageManifest'));
 assert.doesNotMatch(block,/fetch\(|method:\s*'DELETE'|\.batch\(|remove\(/);
 assert.match(block,/state='entregado'/);
});
