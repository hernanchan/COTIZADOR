import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {aprobarPreprensaR2} from '../integraciones/mercadopago/pruebas/r2-prepago-aprobacion-central.mjs';
const id='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const receipt='DOC-12345678-1234-4123-8123-123456789abc';
const sha='a'.repeat(64),qsha='b'.repeat(64);
const quote={schema:'saber-r2-cotizacion-firmada-v1',seleccion:'original',
 modoImpresion:'bn',copias:1,importeArs:4400,
 paginas:[[59.4,84.1,'cad','rollo60','obra80']]};
const approved={schema:'saber-r2-preprensa-aprobacion-v1',orderId:id,
 receiptId:receipt,medidasCm:[[59.4,84.1]],
 operator:'Operador',notes:'Revisado en Acrobat; contenido coincide.',
 confirmed:{contenido:true,clasificacion:true,papel:true,rollo:true,copias:true,precio:true}};
function fixture({paid=true,quoteSnapshot=quote,actual=62915011}={}){
 const sql=new DatabaseSync(':memory:');
 sql.exec("PRAGMA foreign_keys=OFF;CREATE TABLE orders(id TEXT,status TEXT,paid_at TEXT,amount_ars INTEGER,deposit_ars INTEGER);"+
 "CREATE TABLE central_work_order_numbers(number INTEGER PRIMARY KEY AUTOINCREMENT,commercial_order_id TEXT UNIQUE);"+
 "CREATE TABLE central_r2_prepaid_intents(commercial_order_id TEXT,web_order_id TEXT,file_id TEXT,amount_ars INTEGER,declared_pages INTEGER,quote_sha256 TEXT,sha256 TEXT,bytes INTEGER,state TEXT);"+
 "CREATE TABLE payment_reviews(order_id TEXT,state TEXT);"+
 "CREATE TABLE central_r2_large_pending(receipt_id TEXT,web_order_id TEXT,file_id TEXT,sha256 TEXT,bytes INTEGER,pages_claimed INTEGER,status TEXT);"+
 "CREATE TABLE order_items(order_id TEXT,sku TEXT,line_number INTEGER,detail_json TEXT)");
 sql.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(id,paid?'paid':'awaiting_payment',paid?'2026-11-09 12:00:00':null,4400,4400);
 sql.prepare('INSERT INTO central_r2_prepaid_intents VALUES(?,?,?,?,?,?,?,?,?)').run(id,web,'planoA1',4400,1,qsha,sha,62915011,'awaiting_upload_after_payment');
 sql.prepare('INSERT INTO payment_reviews VALUES(?,?)').run(id,paid?'verified':'pending');
 sql.prepare('INSERT INTO central_r2_large_pending VALUES(?,?,?,?,?,?,?)').run(receipt,web,'planoA1',sha,actual,1,'awaiting_pdf_analysis');
 sql.prepare('INSERT INTO order_items VALUES(?,?,?,?)').run(id,'R2_PREPAID_PLOT',1,JSON.stringify({
  sha256:sha,bytes:62915011,quoteSha256:qsha,quoteSnapshot}));
 const db={prepare:s=>({stmt:sql.prepare(s),args:[],
  bind(...args){this.args=args;return this},
  first:async function(){return this.stmt.get(...this.args)},
  run:async function(){return {meta:{changes:this.stmt.run(...this.args).changes}}}
 }),batch:async statements=>{
  sql.exec('BEGIN');const out=[];
  try{for(const st of statements)out.push(await st.run());sql.exec('COMMIT');return out}
  catch(e){sql.exec('ROLLBACK');throw e}
 }};
 const env={DB:db,CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY'};
 const call=async(body=approved,authorized=true)=>aprobarPreprensaR2(
  new Request('https://central.example/admin/api/central/r2-prepress-approve',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }),env,{authorized});
 return {sql,env,call};
}
test('preprensa R2 se registra una vez con hash, medida, operador y número de orden',async()=>{
 const f=fixture();try{
  let r=await f.call();assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
  assert.equal((await r.json()).productionAuthorized,false);
  const approval=f.sql.prepare('SELECT * FROM central_r2_prepress_approvals').get();
  assert.equal(approval.sha256,sha);
  assert.equal(approval.receipt_id,receipt);
  assert.equal(approval.amount_ars,4400);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM central_work_order_numbers').get().n,1);
  r=await f.call();assert.equal(r.status,200);
  assert.equal((await r.json()).idempotent,true);
 }finally{f.sql.close()}
});
test('sin pago, sin ficha v2 o con cambio de medidas/hash no aprueba ni numera',async()=>{
 for(const opt of [{paid:false},{quoteSnapshot:null},{actual:62915012},
  {body:{...approved,receiptId:'DOC-00000000-0000-4000-8000-000000000000'}},
  {body:{...approved,medidasCm:[[60,84.1]]}},
  {body:{...approved,confirmed:{...approved.confirmed,precio:false}}}
 ]){
  const f=fixture(opt);try{
   const r=await f.call(opt.body||approved);assert.notEqual(r.status,201);
   assert.equal(f.sql.prepare('SELECT count(*) AS n FROM central_work_order_numbers').get().n,0);
  }finally{f.sql.close()}
 }
});
test('sin token de operador o flags privados no cambia D1',async()=>{
 const f=fixture();try{
  assert.equal((await f.call(approved,false)).status,401);
  f.env.CENTRAL_R2_STAGING_ENABLED='OFF';
  assert.equal((await f.call()).status,503);
 }finally{f.sql.close()}
});
