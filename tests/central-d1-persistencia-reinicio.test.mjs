import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';

const schema=readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8');
const workerSource=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const key='Central-D1-Persistence-Fake-Key-For-Testing-Only-0123456789';
const base='https://saber-pagos-pruebas.example';
const webId='WEB-REINICIO-REAL-D1-20261026';
const receipt='DOC-11111111-1234-4234-8234-1234567890ab';
const clientOrderId='12345678-1234-4234-8234-1234567890ab';
function dbAdapter(sqlite){
 return {
  prepare(sql){
   let args=[];
   const o={
    bind(...values){args=values;return o},
    async first(){return sqlite.prepare(sql).get(...args)||null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}
   };return o;
  },
  async batch(steps){
   sqlite.exec('BEGIN');
   try{
    const out=[];for(const step of steps)out.push(await step.run());
    sqlite.exec('COMMIT');return out;
   }catch(e){sqlite.exec('ROLLBACK');throw e}
  }
 };
}
function workerWith(sqlite){
 const context=vm.createContext({
  Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,
  crypto:webcrypto,console,
  fetch:async()=>{throw Error('No se permiten solicitudes externas durante el test D1')}
 });
 vm.runInContext(workerSource.replace('export default {','globalThis.worker = {'),
  context,{filename:'worker.js'});
 const env={
  DB:dbAdapter(sqlite),
  CENTRAL_BRIDGE_KEY:key,CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',MP_TEST_ACCESS_TOKEN:'FAKE',MP_TEST_SELLER_ID:'local-seller-only',
  DEMO_ADMIN_KEY:'local-only-admin-password',
  MP_WEBHOOK_SECRET:'local-mp-secret',
  TEST_WEBHOOK_URL:'https://test.example/webhook'
 };
 async function signed(path,packet){
  const body=JSON.stringify(packet),ts=Math.floor(Date.now()/1000),nonce=randomUUID();
  const signature=createHmac('sha256',key).update(ts+'\n'+nonce+'\n'+body).digest('hex');
  const req=new Request(base+path,{
   method:'POST',headers:{'Content-Type':'application/json',
    'x-saber-ts':String(ts),'x-saber-request-id':nonce,'x-saber-signature':signature},body
  });
  const res=await context.worker.fetch(req,env);
  return {status:res.status,data:await res.json()};
 }
 return {signed};
}
const packet={
 schema:'saber-central-recepcion-verificada-v1',orderId:webId,
 paymentAuthorized:false,filesReceived:true,listoParaProducir:false,
 importeVerificado:4500,
 recibos:[{fileId:'f1',receiptId:receipt,sha256:'a'.repeat(64),bytes:900,pages:1}],
 ficha:{
  schema:'saber-central-ficha-produccion-v1',orderId:webId,
  pagoConfirmado:false,listoParaProducir:false,totalVerificadoSinPago:4500,
  trabajos:[{
   orden:1,idTrabajo:'doc1',servicio:'documentos',fileId:'f1',
   nombreOriginal:'prueba.pdf',reciboPrivado:receipt,sha256:'a'.repeat(64),
   paginasOriginales:1,paginasElegidas:[1],copias:1,formatoFinal:'a4',
   carasPresupuestadas:'simple',paginasPorCaraPresupuestadas:1,
   pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false
  }]
 }
};
const order={clientOrderId,webOrderId:webId,items:[]};

test('D1 persistente: registrar, cerrar, reabrir, recuperar y reintentar sin duplicados ni pagos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'saber-d1-reinicio-'));
 const filename=join(dir,'solo-pruebas.sqlite');
 try{
  let db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON');db.exec(schema);
  let central=workerWith(db);
  const stage=await central.signed('/internal/central/stage',packet);
  assert.equal(stage.status,201,JSON.stringify(stage.data));
  const created=await central.signed('/internal/central/prepare-order',order);
  assert.equal(created.status,201,JSON.stringify(created.data));
  const id=created.data.commercial_order_id;
  assert.equal(created.data.amount_ars,4500);
  assert.equal(created.data.paymentAuthorized,false);
  assert.equal(created.data.checkoutEnabled,false);
  db.close();

  // Nueva conexión y nueva instancia de Worker: los datos no vienen de memoria JS.
  db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON');
  const stored=db.prepare('SELECT id,status,amount_ars,preference_id,payment_id FROM orders WHERE id=?').get(id);
  assert.equal(stored.id,id);assert.equal(stored.status,'awaiting_payment');
  assert.equal(stored.amount_ars,4500);
  assert.equal(stored.preference_id,null);assert.equal(stored.payment_id,null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM central_document_receipts').get().n,1);
  assert.equal(db.prepare('SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?').get(webId).commercial_order_id,id);
  central=workerWith(db);
  const again=await central.signed('/internal/central/prepare-order',order);
  assert.equal(again.status,200,JSON.stringify(again.data));
  assert.equal(again.data.idempotent,true);
  assert.equal(again.data.commercial_order_id,id);
  const sameStage=await central.signed('/internal/central/stage',packet);
  assert.equal(sameStage.status,200);
  assert.equal(sameStage.data.idempotent,true);
  const collision=await central.signed('/internal/central/prepare-order',{...order,items:[{code:'ABC-1',qty:1}]});
  assert.equal(collision.status,409);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cart_requests').get().n,1);
  db.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});
