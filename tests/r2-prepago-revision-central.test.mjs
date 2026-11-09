import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {listarR2PagadosRevision} from '../integraciones/mercadopago/pruebas/r2-prepago-revision-central.mjs';

const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const id='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const bytes=62915011;
const sha='a'.repeat(64);
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`
 CREATE TABLE central_r2_prepaid_intents(
  web_order_id TEXT,file_id TEXT,commercial_order_id TEXT,
  amount_ars INTEGER,bytes INTEGER,sha256 TEXT,declared_pages INTEGER,
  state TEXT,created_at TEXT);
 CREATE TABLE central_r2_large_pending(
  web_order_id TEXT,file_id TEXT,receipt_id TEXT,name TEXT,
  bytes INTEGER,sha256 TEXT,pages_claimed INTEGER,status TEXT);
 CREATE TABLE orders(id TEXT,status TEXT,paid_at TEXT,deposit_ars INTEGER,amount_ars INTEGER);
 CREATE TABLE payment_reviews(order_id TEXT,state TEXT);
 CREATE TABLE order_items(order_id TEXT,line_number INTEGER,sku TEXT,detail_json TEXT);`);
 sqlite.prepare('INSERT INTO orders VALUES(?,?,?,?,?)')
  .run(id,'paid','2026-11-09 13:13:00',4400,4400);
 sqlite.prepare('INSERT INTO payment_reviews VALUES(?,?)').run(id,'verified');
 sqlite.prepare('INSERT INTO central_r2_prepaid_intents VALUES(?,?,?,?,?,?,?,?,?)')
  .run(web,'planoA1',id,4400,bytes,sha,1,'awaiting_upload_after_payment','2026-11-09 12:40:00');
 const driver={prepare(sql){const st=sqlite.prepare(sql);return {
  all:async()=>({results:st.all()})
 }}};
 const env={CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',DB:driver};
 const request=new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev/admin/api/central/r2-paid-review');
 const call=async authorized=>listarR2PagadosRevision(request,env,{authorized});
 const receipt=()=>sqlite.prepare('INSERT INTO central_r2_large_pending VALUES(?,?,?,?,?,?,?,?)')
  .run(web,'planoA1','DOC-12345678-1234-4123-8123-123456789abc','ENSAYO-A1.pdf',
   bytes,sha,1,'awaiting_pdf_analysis');
 return {sqlite,env,request,call,receipt};
}
test('Sólo personal autorizado ve orden R2 pagada y todavía sin original',async()=>{
 const f=fixture();
 try{
  const no=await f.call(false);assert.equal(no.status,401);
  const yes=await f.call(true),j=await yes.json();
  assert.equal(yes.status,200);
  assert.equal(j.count,1);
  const o=j.orders[0];
  assert.equal(o.webOrderId,web);
  assert.equal(o.amountArs,4400);
  assert.equal(o.estado,'PAGADO_ESPERANDO_ARCHIVO');
  assert.equal(o.receiptId,null);
  assert.equal(o.productionAuthorized,false);
  assert.equal(o.readyForPrinting,false);
  assert.equal(o.measuredPages,null);
  assert.equal(o.priceFinalVerified,false);
  assert.ok(!JSON.stringify(o).includes(sha));
 }finally{f.sqlite.close()}
});
test('Recibo con bytes/SHA/páginas esperados se ve para revisión, nunca listo para imprimir',async()=>{
 const f=fixture();
 try{
  f.receipt();
  const r=await f.call(true),data=await r.json();
  assert.equal(data.orders[0].estado,'RECIBIDO_PENDIENTE_PREPRENSA');
  assert.equal(data.orders[0].verifiedReceipt,true);
  assert.equal(data.orders[0].receiptId,'DOC-12345678-1234-4123-8123-123456789abc');
  assert.equal(data.orders[0].readyForPrinting,false);
  assert.equal(data.productionAuthorized,false);
 }finally{f.sqlite.close()}
});
test('Recibo que difiere en SHA no se valida para producción',async()=>{
 const f=fixture();
 try{
  f.receipt();
  f.sqlite.prepare('UPDATE central_r2_large_pending SET sha256=?').run('b'.repeat(64));
  const x=await (await f.call(true)).json();
  assert.equal(x.orders[0].estado,'RECEPCION_A_REVISAR');
  assert.equal(x.orders[0].verifiedReceipt,false);
  assert.equal(x.orders[0].productionAuthorized,false);
 }finally{f.sqlite.close()}
});
test('Pago revocado o no conciliado nunca aparece como acreditado',async()=>{
 const f=fixture();
 try{
  f.receipt();
  f.sqlite.prepare('UPDATE payment_reviews SET state=?').run('revoked');
  const x=await (await f.call(true)).json();
  assert.equal(x.count,0);
  f.sqlite.prepare('UPDATE payment_reviews SET state=?').run('verified');
  f.sqlite.prepare('UPDATE orders SET status=?').run('awaiting_payment');
  const y=await (await f.call(true)).json();
  assert.equal(y.count,0);
 }finally{f.sqlite.close()}
});
test('No crea tablas ausentes ni realiza consultas sin flags de pruebas',async()=>{
 const f=fixture();
 try{
  f.env.CENTRAL_R2_STAGING_ENABLED='OFF';
  assert.equal((await f.call(true)).status,503);
  f.env.CENTRAL_R2_STAGING_ENABLED='PRIVATE_TEST_ONLY';
  f.sqlite.exec('DROP TABLE central_r2_large_pending');
  const r=await f.call(true);assert.equal(r.status,200);
  assert.equal((await r.json()).count,0);
  const found=f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_r2_large_pending'").all();
  assert.equal(found.length,0);
 }finally{f.sqlite.close()}
});

test('Conserva parámetros completos de ploteo para comparar preprensa sin habilitar impresión',async()=>{
 const f=fixture();
 try{
  f.receipt();
  const q={schema:'saber-r2-cotizacion-firmada-v1',nombre:'A1.pdf',
   seleccion:'original',modoImpresion:'bn',copias:2,papelPoster:'obra80',
   rolloBase:'rollo60',importeArs:4400,paginas:[[59.4,84.1,'cad','rollo60','obra80']]};
  f.sqlite.prepare('INSERT INTO order_items VALUES(?,?,?,?)').run(
   id,1,'R2_PREPAID_PLOT',JSON.stringify({quoteSnapshot:q}));
  const j=await (await f.call(true)).json();
  assert.deepEqual(j.orders[0].quoteSnapshot,q);
  assert.equal(j.orders[0].quotedParametersAvailable,true);
  assert.equal(j.orders[0].requiresCommercialReview,true);
  assert.equal(j.orders[0].productionAuthorized,false);
  assert.ok(!JSON.stringify(j).includes(sha));
 }finally{f.sqlite.close()}
});
test('Intención histórica sin detalle permanece bloqueada para revisión',async()=>{
 const f=fixture();try{
  f.receipt();
  const j=await (await f.call(true)).json();
  assert.equal(j.orders[0].quoteSnapshot,null);
  assert.equal(j.orders[0].quotedParametersAvailable,false);
  assert.equal(j.orders[0].productionAuthorized,false);
 }finally{f.sqlite.close()}
});
