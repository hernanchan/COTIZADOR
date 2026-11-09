import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {encolarBorradoR2Entregado,ejecutarBorradoR2Entregado,reintentarBorradosR2}
 from '../integraciones/mercadopago/pruebas/r2-borrado-entregado-central.mjs';
const id='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const receipt='DOC-12345678-1234-4123-8123-123456789abc';
const key='r2-v1/'+web+'/12345678-1234-4123-8123-123456789abc.pdf';
const sha='a'.repeat(64),etag='abc1234efgh567890';
function fixture({delivered=true,paid=true,receiptBytes=62915011,bucketBytes=62915011}={}){
 const sql=new DatabaseSync(':memory:');
 sql.exec("PRAGMA foreign_keys=OFF;"+
  "CREATE TABLE orders(id TEXT,status TEXT,paid_at TEXT,amount_ars INTEGER,deposit_ars INTEGER);"+
  "CREATE TABLE central_production_status(order_id TEXT,state TEXT,version INTEGER);"+
  "CREATE TABLE payment_reviews(order_id TEXT,state TEXT);"+
  "CREATE TABLE central_r2_prepress_approvals(order_id TEXT,receipt_id TEXT,sha256 TEXT,bytes INTEGER,amount_ars INTEGER);"+
  "CREATE TABLE central_r2_prepaid_intents(commercial_order_id TEXT,web_order_id TEXT,file_id TEXT,created_at TEXT);"+
  "CREATE TABLE central_r2_large_pending(web_order_id TEXT,file_id TEXT,receipt_id TEXT,object_key TEXT,sha256 TEXT,bytes INTEGER,etag TEXT);");
 sql.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(id,paid?'paid':'awaiting_payment',paid?'2026-11-09 14:00:00':null,4400,4400);
 sql.prepare('INSERT INTO central_production_status VALUES(?,?,?)').run(id,delivered?'entregado':'listo',3);
 sql.prepare('INSERT INTO payment_reviews VALUES(?,?)').run(id,paid?'verified':'pending');
 sql.prepare('INSERT INTO central_r2_prepress_approvals VALUES(?,?,?,?,?)').run(id,receipt,sha,62915011,4400);
 sql.prepare('INSERT INTO central_r2_prepaid_intents VALUES(?,?,?,?)').run(id,web,'planoA1','2026-11-09 13:00:00');
 sql.prepare('INSERT INTO central_r2_large_pending VALUES(?,?,?,?,?,?,?)').run(web,'planoA1',receipt,key,sha,receiptBytes,etag);
 const db={prepare:q=>({st:sql.prepare(q),params:[],
  bind(...args){this.params=args;return this},
  run:async function(){return {meta:{changes:this.st.run(...this.params).changes}}},
  first:async function(){return this.st.get(...this.params)},
  all:async function(){return {results:this.st.all(...this.params)}}
 })};
 let present=true,deleted=0;
 const bucket={head:async k=>k===key&&present?{size:bucketBytes,etag}:null,
  delete:async k=>{assert.equal(k,key);deleted++;present=false}};
 const env={DB:db,SABER_R2_GRANDES:bucket,
  CENTRAL_R2_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_PURGE_EXECUTE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_PURGE_CANARY_ORDER:web};
 return {sql,env,db,bucket,get deleted(){return deleted},get present(){return present}};
}
test('Entregado + pago verificado + preprensa aprobada: elimina original exacto una sola vez',async()=>{
 const f=fixture();try{
  const q=await encolarBorradoR2Entregado(f.env,id,3);
  assert.equal(q.state,'pending');
  const d=await ejecutarBorradoR2Entregado(f.env,id);
  assert.equal(d.state,'deleted');assert.equal(d.filesDeleted,1);
  assert.equal(f.deleted,1);assert.equal(f.present,false);
  assert.equal((await ejecutarBorradoR2Entregado(f.env,id)).state,'deleted');
  assert.equal(f.deleted,1);
  const audit=f.sql.prepare('SELECT phase FROM central_r2_purge_audit ORDER BY id').all().map(x=>x.phase);
  assert.deepEqual(audit,['queued','attempt','deleted']);
  assert.equal((await reintentarBorradosR2(f.env)).checked,0);
 }finally{f.sql.close()}
});
test('Sin entrega, sin pago, sin preprensa coincidente o con R2 diferente nunca borra',async()=>{
 for(const v of [{delivered:false},{paid:false},{receiptBytes:62915012},
  {bucketBytes:62915012}]){
  const f=fixture(v);try{
   const q=await encolarBorradoR2Entregado(f.env,id,3);
   if(v.bucketBytes){
    assert.equal(q.state,'pending');
    assert.equal((await ejecutarBorradoR2Entregado(f.env,id)).state,'error');
   }else assert.equal(q.state,'no_elegible');
   assert.equal(f.deleted,0);
   assert.equal(f.present,true);
  }finally{f.sql.close()}
 }
});
test('Flags apagados, ausencia de bucket y scope incorrecto mantienen originales',async()=>{
 const f=fixture();try{
  f.env.CENTRAL_R2_PURGE_QUEUE_ENABLED='OFF';
  assert.equal((await encolarBorradoR2Entregado(f.env,id,3)).state,'desactivado');
  f.env.CENTRAL_R2_PURGE_QUEUE_ENABLED='PRIVATE_TEST_ONLY';
  assert.equal((await encolarBorradoR2Entregado(f.env,id,3)).state,'pending');
  f.env.CENTRAL_R2_PURGE_EXECUTE_ENABLED='OFF';
  assert.equal((await ejecutarBorradoR2Entregado(f.env,id)).state,'desactivado');
  f.env.CENTRAL_R2_PURGE_EXECUTE_ENABLED='PRIVATE_TEST_ONLY';
  delete f.env.SABER_R2_GRANDES;
  assert.equal((await ejecutarBorradoR2Entregado(f.env,id)).state,'desactivado');
  assert.equal(f.deleted,0);
 }finally{f.sql.close()}
});
