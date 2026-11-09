/**
 * Borrado de un PDF R2 al entregar una orden preprensa-aprobada.
 * Misma D1 de pagos/producción + R2 privado. Banderas separadas, OFF por defecto.
 * El registro de órdenes/importes se conserva; los bytes PDF no.
 */
const ENABLED='PRIVATE_TEST_ONLY';
const CUTOFF='2026-11-09 00:00:00';
const respondError=code=>{throw Error(code)};
export const PURGE_QUEUE_SQL="CREATE TABLE IF NOT EXISTS central_r2_purge_queue ("+
 "order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "receipt_id TEXT NOT NULL UNIQUE,object_key TEXT NOT NULL UNIQUE,"+
 "etag TEXT NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,"+
 "production_version INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending' "+
 "CHECK(state IN ('pending','deleting','deleted','error')),"+
 "attempts INTEGER NOT NULL DEFAULT 0,last_try TEXT,finished_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')))";
export const PURGE_LOG_SQL="CREATE TABLE IF NOT EXISTS central_r2_purge_audit ("+
 "id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,receipt_id TEXT NOT NULL,"+
 "phase TEXT NOT NULL CHECK(phase IN ('queued','attempt','deleted','error')),"+
 "production_version INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))";
function scopeAllowed(env,web,created){
 if(!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(web||''))return false;
 if(env?.CENTRAL_R2_PURGE_SCOPE==='NEW_ORDERS_ONLY')
  return typeof created==='string'&&created>=CUTOFF;
 return env?.CENTRAL_R2_PURGE_CANARY_ORDER===web;
}
async function tables(db){
 await db.prepare(PURGE_QUEUE_SQL).run();
 await db.prepare(PURGE_LOG_SQL).run();
}
function valid(row,version){
 return Boolean(row&&row.production_state==='entregado'&&
  row.production_version===version&&row.payment_status==='paid'&&
  row.review_state==='verified'&&row.paid_at&&row.deposit_ars===row.amount_ars&&
  row.amount_ars===row.approved_amount&&row.sha256===row.approved_sha&&
  row.bytes===row.approved_bytes&&row.receipt_id===row.approved_receipt&&
  /^[a-f0-9]{64}$/.test(row.sha256||'')&&
  /^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9-]{36}\.pdf$/i.test(row.object_key||'')&&
  row.object_key.startsWith('r2-v1/'+row.web_order_id+'/')&&
  typeof row.etag==='string'&&row.etag.length>=8&&
  Number.isSafeInteger(row.bytes)&&row.bytes>40*1048576&&row.bytes<=200*1048576);
}
const ELIGIBLE_SQL='SELECT o.id AS order_id,o.status AS payment_status,o.paid_at,'+
 'o.amount_ars,o.deposit_ars,v.state AS review_state,'+
 's.state AS production_state,s.version AS production_version,'+
 'i.web_order_id,i.created_at AS intent_created,'+
 'p.receipt_id,p.object_key,p.sha256,p.bytes,p.etag,'+
 'a.receipt_id AS approved_receipt,a.sha256 AS approved_sha,'+
 'a.bytes AS approved_bytes,a.amount_ars AS approved_amount '+
 'FROM orders o JOIN central_production_status s ON s.order_id=o.id '+
 'JOIN payment_reviews v ON v.order_id=o.id '+
 'JOIN central_r2_prepress_approvals a ON a.order_id=o.id '+
 'JOIN central_r2_prepaid_intents i ON i.commercial_order_id=o.id '+
 'JOIN central_r2_large_pending p ON p.web_order_id=i.web_order_id AND p.file_id=i.file_id '+
 'WHERE o.id=? LIMIT 1';
async function rowFor(db,id){return db.prepare(ELIGIBLE_SQL).bind(id).first()}
export async function encolarBorradoR2Entregado(env,orderId,version){
 if(env?.CENTRAL_R2_PURGE_QUEUE_ENABLED!==ENABLED)
  return {state:'desactivado',filesDeleted:0};
 const db=env.DB;
 await tables(db);
 const row=await rowFor(db,orderId);
 if(!valid(row,version)||!scopeAllowed(env,row.web_order_id,row.intent_created))
  return {state:'no_elegible',filesDeleted:0};
 const result=await db.prepare(
  'INSERT OR IGNORE INTO central_r2_purge_queue '+
  '(order_id,receipt_id,object_key,etag,sha256,bytes,production_version) '+
  'VALUES(?,?,?,?,?,?,?)'
 ).bind(orderId,row.receipt_id,row.object_key,row.etag,row.sha256,row.bytes,version).run();
 if(Number(result?.meta?.changes)===1)
  await db.prepare('INSERT INTO central_r2_purge_audit(order_id,receipt_id,phase,production_version) VALUES(?,?,?,?)')
   .bind(orderId,row.receipt_id,'queued',version).run();
 const job=await db.prepare('SELECT state,receipt_id,production_version FROM central_r2_purge_queue WHERE order_id=?')
  .bind(orderId).first();
 return job&&job.receipt_id===row.receipt_id&&job.production_version===version?
  {state:job.state,filesDeleted:job.state==='deleted'?1:0}:
  {state:'conflicto',filesDeleted:0};
}
export async function ejecutarBorradoR2Entregado(env,orderId,{bucket=env?.SABER_R2_GRANDES}={}){
 if(env?.CENTRAL_R2_PURGE_QUEUE_ENABLED!==ENABLED||
    env?.CENTRAL_R2_PURGE_EXECUTE_ENABLED!==ENABLED||
    !bucket||typeof bucket.head!=='function'||typeof bucket.delete!=='function')
  return {state:'desactivado',filesDeleted:0};
 const db=env.DB;
 await tables(db);
 const job=await db.prepare('SELECT * FROM central_r2_purge_queue WHERE order_id=?')
  .bind(orderId).first();
 if(!job)return {state:'sin_cola',filesDeleted:0};
 if(job.state==='deleted')return {state:'deleted',filesDeleted:1};
 if(!['pending','error','deleting'].includes(job.state))return {state:'conflicto',filesDeleted:0};
 const row=await rowFor(db,orderId);
 if(!valid(row,job.production_version)||!scopeAllowed(env,row.web_order_id,row.intent_created)||
    row.object_key!==job.object_key||row.receipt_id!==job.receipt_id||
    row.sha256!==job.sha256||row.bytes!==job.bytes||row.etag!==job.etag)
  return {state:'no_elegible',filesDeleted:0};
 // Retries de una operación interrumpida, con bloqueo temporal.
 const claimed=await db.prepare(
  "UPDATE central_r2_purge_queue SET state='deleting',"+
  "last_try=datetime('now'),attempts=attempts+1 "+
  "WHERE order_id=? AND production_version=? AND ("+
  "state IN ('pending','error') OR (state='deleting' AND last_try<datetime('now','-3 minutes')))"
 ).bind(orderId,job.production_version).run();
 if(Number(claimed?.meta?.changes)!==1)return {state:'ocupado',filesDeleted:0};
 await db.prepare('INSERT INTO central_r2_purge_audit(order_id,receipt_id,phase,production_version) VALUES(?,?,?,?)')
  .bind(orderId,job.receipt_id,'attempt',job.production_version).run();
 try{
  const current=await bucket.head(job.object_key);
  if(current){
   if(current.size!==job.bytes||
     String(current.etag||'').replaceAll('"','')!==job.etag.replaceAll('"',''))
    respondError('OBJETO_R2_DIFERENTE_DEL_RECIBO');
   await bucket.delete(job.object_key);
  }else if(job.state==='pending'){
   respondError('ORIGINAL_R2_AUSENTE_SIN_INTENTO_ANTERIOR');
  }
  if(await bucket.head(job.object_key))respondError('BORRADO_R2_NO_CONFIRMADO');
  const done=await db.prepare(
   "UPDATE central_r2_purge_queue SET state='deleted',finished_at=datetime('now') "+
   "WHERE order_id=? AND state='deleting' AND production_version=?"
  ).bind(orderId,job.production_version).run();
  if(Number(done?.meta?.changes)!==1)respondError('D1_NO_CONFIRMÓ_BORRADO');
  await db.prepare('INSERT INTO central_r2_purge_audit(order_id,receipt_id,phase,production_version) VALUES(?,?,?,?)')
   .bind(orderId,job.receipt_id,'deleted',job.production_version).run();
  return {state:'deleted',filesDeleted:1};
 }catch{
  await db.prepare("UPDATE central_r2_purge_queue SET state='error' WHERE order_id=? AND state='deleting'")
   .bind(orderId).run();
  await db.prepare('INSERT INTO central_r2_purge_audit(order_id,receipt_id,phase,production_version) VALUES(?,?,?,?)')
   .bind(orderId,job.receipt_id,'error',job.production_version).run();
  return {state:'error',filesDeleted:0};
 }
}
