import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {consultarSeguimientoR2PrevioPreprensa}
 from '../integraciones/mercadopago/pruebas/r2-prepago-seguimiento-central.mjs';
const id='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const sha='a'.repeat(64);
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE central_r2_prepaid_intents(web_order_id TEXT,file_id TEXT,"+
  "commercial_order_id TEXT,bytes INTEGER,sha256 TEXT,declared_pages INTEGER,state TEXT);"+
  "CREATE TABLE orders(id TEXT,status TEXT,paid_at TEXT,amount_ars INTEGER,deposit_ars INTEGER);"+
  "CREATE TABLE payment_reviews(order_id TEXT,state TEXT);"+
  "CREATE TABLE central_r2_large_pending(web_order_id TEXT,file_id TEXT,receipt_id TEXT,"+
  "bytes INTEGER,sha256 TEXT,pages_claimed INTEGER,status TEXT);");
 sql.prepare('INSERT INTO central_r2_prepaid_intents VALUES(?,?,?,?,?,?,?)')
  .run(web,'planoA1',id,62915011,sha,1,'awaiting_upload_after_payment');
 sql.prepare('INSERT INTO orders VALUES(?,?,?,?,?)')
  .run(id,'paid','2026-11-09 12:00:00',4400,4400);
 sql.prepare('INSERT INTO payment_reviews VALUES(?,?)').run(id,'verified');
 const env={CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DB:{prepare:s=>{const st=sql.prepare(s);return {
   params:[],
   bind(...params){this.params=params;return this},
   all:async function(){return {results:st.all(...this.params)}},
   first:async function(){return st.get(...this.params)}
  }}}};
 const receipt=()=>sql.prepare('INSERT INTO central_r2_large_pending VALUES(?,?,?,?,?,?,?)')
  .run(web,'planoA1','DOC-12345678-1234-4123-8123-123456789abc',
   62915011,sha,1,'awaiting_pdf_analysis');
 return {sql,env,receipt,call:async()=>consultarSeguimientoR2PrevioPreprensa(env,id)};
}
test('pago verificado sin R2 muestra espera, nunca hora ni impresión',async()=>{
 const f=fixture();try{
  const r=await f.call(),x=await r.json();
  assert.equal(r.status,200);
  assert.equal(x.payment,'pagado');
  assert.equal(x.stage,'pendiente');
  assert.equal(x.phase,'Pago confirmado · esperando archivo');
  assert.equal(x.deliveryPlan,'por_confirmar');
  assert.equal(x.estimate,null);
  assert.equal(x.productionAuthorized,false);
 }finally{f.sql.close()}
});
test('original R2 con SHA y bytes correctos muestra preprensa sin ETA',async()=>{
 const f=fixture();try{
  f.receipt();const x=await (await f.call()).json();
  assert.equal(x.phase,'Archivo recibido · revisión de preprensa');
  assert.equal(x.readyForPrinting,false);
  assert.equal(x.prepressPending,true);
  assert.equal(x.productionAuthorized,false);
  assert.ok(!JSON.stringify(x).includes(sha));
 }finally{f.sql.close()}
});
test('recibo discordante o pago revocado no habilita producción',async()=>{
 const f=fixture();try{
  f.receipt();f.sql.prepare('UPDATE central_r2_large_pending SET bytes=?').run(62915012);
  let x=await (await f.call()).json();
  assert.match(x.phase,/diferencias/);
  assert.equal(x.estimate,null);
  f.sql.prepare('UPDATE payment_reviews SET state=?').run('revoked');
  x=await (await f.call()).json();
  assert.equal(x.payment,'requiere_revision');
  assert.equal(x.stage,null);
  assert.equal(x.productionAuthorized,false);
 }finally{f.sql.close()}
});
test('orden ajena, flags apagados y tabla ausente no filtran pedido',async()=>{
 const f=fixture();try{
  let r=await consultarSeguimientoR2PrevioPreprensa(f.env,'12345678-1234-4123-8123-123456789abc');
  assert.equal(r.status,404);
  f.env.CENTRAL_R2_STAGING_ENABLED='OFF';
  r=await f.call();assert.equal(r.status,503);
  f.env.CENTRAL_R2_STAGING_ENABLED='PRIVATE_TEST_ONLY';
  f.sql.exec('DROP TABLE central_r2_large_pending');
  r=await f.call();assert.equal(r.status,404);
 }finally{f.sql.close()}
});
