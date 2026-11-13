/**
 * Purga de originales de pedidos LIVE.
 * D1 guarda el recibo inmutable de cada PDF. Ninguna clave de objeto
 * proviene del navegador. La operación es reanudable y deja auditoría.
 * Comp puertas independientes: no borrar en ensayos históricos.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const R2KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9-]{36})\.pdf$/i;
const TUSKEY=/^v2\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9-]{36})\.pdf$/i;
const CUTOFF='2026-11-13 00:00:00';
const Q="CREATE TABLE IF NOT EXISTS central_live_purge_files ("+
 "order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,"+
 "file_id TEXT NOT NULL,web_order_id TEXT NOT NULL,transport TEXT NOT NULL CHECK(transport IN ('tus','r2')),"+
 "object_key TEXT NOT NULL UNIQUE,receipt_id TEXT NOT NULL,sha256 TEXT NOT NULL,"+
 "bytes INTEGER NOT NULL,etag TEXT,production_version INTEGER NOT NULL,"+
 "state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','deleted','error')),"+
 "attempts INTEGER NOT NULL DEFAULT 0,last_try TEXT,deleted_at TEXT,"+
 "PRIMARY KEY(order_id,file_id))";
const A="CREATE TABLE IF NOT EXISTS central_live_purge_audit ("+
 "id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,file_id TEXT NOT NULL,"+
 "phase TEXT NOT NULL CHECK(phase IN ('queued','attempt','deleted','error')),"+
 "version INTEGER NOT NULL,at TEXT NOT NULL DEFAULT(datetime('now')))";
const active=e=>e?.SABER_ENTORNO==='produccion'&&e?.CENTRAL_DB_ENV==='produccion'&&
 e?.CENTRAL_LIVE_PURGE_GATE===GO&&e?.CENTRAL_LIVE_R2_INSPECTION_GATE===GO&&
 e?.DB?.prepare&&e?.DB?.batch;
function valid(r,web){
 if(!r||r.web_order_id!==web||!FILE.test(r.file_id||'')||
   !SHA.test(r.sha256||'')||!UUID.test((r.receipt_id||'').slice(4))||
   !String(r.receipt_id).startsWith('DOC-')||
   !Number.isSafeInteger(r.bytes)||r.bytes<5)return false;
 const key=r.transport==='r2'?R2KEY.exec(r.object_key||''):
  r.transport==='tus'?TUSKEY.exec(r.object_key||''):null;
 if(!key||key[1]!==web||('DOC-'+key[2]).toLowerCase()!==r.receipt_id.toLowerCase())return false;
 if(r.transport==='r2')return r.bytes>40*1048576&&r.bytes<=200*1048576&&
  typeof r.etag==='string'&&r.etag.length>=8&&
  r.r2_status==='awaiting_pdf_analysis'&&r.reservation_state==='reserved'&&
  Number.isSafeInteger(r.pages_claimed)&&r.pages_claimed>=1&&r.pages_claimed<=2000;
 return r.bytes<=40*1048576;
}
async function tables(db){await db.prepare(Q).run();await db.prepare(A).run()}
export async function planEntregaLive(env,orderId,{state='listo',version}={}){
 if(!active(env)||!UUID.test(orderId||'')||!Number.isSafeInteger(version)||version<0)return null;
 const db=env.DB;
 const order=await db.prepare(
  "SELECT o.id,o.status,o.paid_at,o.amount_ars,o.deposit_ars,l.amount_ars AS link_amount,"+
  "l.web_order_id,d.file_count,d.created_at,s.state,s.version "+
  "FROM orders o JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id "+
  "JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id "+
  "JOIN central_live_production_states s ON s.order_id=o.id "+
  "WHERE o.id=? AND EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified') LIMIT 1"
 ).bind(orderId).first();
 if(!order||!WEB.test(order.web_order_id||'')||order.created_at<CUTOFF||
   order.status!=='paid'||!order.paid_at||order.amount_ars!==order.deposit_ars||
   order.amount_ars!==order.link_amount||order.state!==state||order.version!==version||
   !Number.isSafeInteger(order.file_count)||order.file_count<1||order.file_count>10)return null;
 // La ruta comercial obtiene el ZIP y coteja sus originales al iniciar
 // preparación. Para borrar al entregar no exigir una inspección manual de
 // R2 que ya no está disponible; verificar en cambio su recibo inmutable,
 // la reserva y el SHA/ETag y tamaño de la recepción aprobada.
 const rows=await db.prepare(
  "SELECT f.file_id,f.transport,f.web_order_id,f.sha256,f.bytes,f.received,"+
  "t.receipt_id AS tus_receipt,t.object_name AS tus_key,t.sha256 AS tus_sha,t.bytes AS tus_bytes,"+
  "r.receipt_id AS r2_receipt,r.object_key AS r2_key,r.etag AS r2_etag,"+
  "r.sha256 AS r2_sha,r.bytes AS r2_bytes,r.status AS r2_status,"+
  "r.pages_claimed, q.state AS reservation_state "+
  "FROM central_r2_universal_files f "+
  "LEFT JOIN central_r2_universal_tus_receipts t ON t.web_order_id=f.web_order_id AND t.file_id=f.file_id "+
  "LEFT JOIN central_r2_large_pending r ON r.web_order_id=f.web_order_id AND r.file_id=f.file_id "+
  "AND r.sha256=f.sha256 AND r.bytes=f.bytes "+
  "LEFT JOIN central_r2_large_reservations q ON q.object_key=r.object_key "+
  "AND q.web_order_id=f.web_order_id AND q.file_id=f.file_id "+
  "AND q.sha256=f.sha256 AND q.bytes=f.bytes "+
  "WHERE f.web_order_id=? ORDER BY f.ordinal"
 ).bind(order.web_order_id).all();
 const source=rows.results||[];
 if(source.length!==order.file_count||source.some(x=>x.received!==1))return null;
 const files=source.map(x=>{
  const r2=x.transport==='r2';
  return {file_id:x.file_id,web_order_id:x.web_order_id,transport:x.transport,
   sha256:x.sha256,bytes:x.bytes,
   receipt_id:r2?x.r2_receipt:x.tus_receipt,
   object_key:r2?x.r2_key:x.tus_key,etag:r2?x.r2_etag:null,
   r2_status:x.r2_status,reservation_state:x.reservation_state,
   pages_claimed:x.pages_claimed,
   matched:r2?x.r2_sha===x.sha256&&x.r2_bytes===x.bytes:
    x.tus_sha===x.sha256&&x.tus_bytes===x.bytes};
 });
 if(files.some(x=>!x.matched||!valid(x,order.web_order_id))||
   new Set(files.map(x=>x.file_id)).size!==files.length||
   new Set(files.map(x=>x.object_key)).size!==files.length)return null;
 return {orderId,webOrderId:order.web_order_id,version,files};
}
export async function encolarEntregaLive(env,orderId,version,{preflight=false}={}){
 if(!active(env))return {state:'off'};
 const plan=await planEntregaLive(env,orderId,preflight?
  {state:'listo',version:version-1}:{state:'entregado',version});
 if(!plan)return {state:'not_eligible'};
 const db=env.DB;await tables(db);
 const entries=plan.files.map(f=>db.prepare(
  'INSERT OR IGNORE INTO central_live_purge_files '+
  '(order_id,file_id,web_order_id,transport,object_key,receipt_id,sha256,bytes,etag,production_version) '+
  'VALUES(?,?,?,?,?,?,?,?,?,?)'
 ).bind(orderId,f.file_id,f.web_order_id,f.transport,f.object_key,
  f.receipt_id,f.sha256,f.bytes,f.etag,version));
 await db.batch(entries);
 const existing=(await db.prepare('SELECT * FROM central_live_purge_files WHERE order_id=?')
  .bind(orderId).all()).results||[];
 if(existing.length!==plan.files.length||plan.files.some(f=>!existing.some(x=>
  x.file_id===f.file_id&&x.object_key===f.object_key&&
  x.sha256===f.sha256&&x.bytes===f.bytes&&x.receipt_id===f.receipt_id&&
  x.production_version===version&&x.transport===f.transport&&x.etag===f.etag)))
  return {state:'conflict'};
 return {state:existing.every(x=>x.state==='deleted')?'deleted':'pending',totalFiles:existing.length,
  filesDeleted:existing.filter(x=>x.state==='deleted').length};
}
async function deleteRemote(env,orderId,f){
 if(typeof env.SABER_DOCUMENTOS?.fetch!=='function'||typeof env.CENTRAL_BRIDGE_KEY!=='string'||
  env.CENTRAL_BRIDGE_KEY.length<32)throw Error('NO_TUS_BRIDGE');
 const body=JSON.stringify({schema:'saber-docs-live-purge-file-v1',
  webOrderId:f.web_order_id,commercialOrderId:orderId,fileId:f.file_id,
  transport:f.transport,receiptId:f.receipt_id,objectKey:f.object_key,etag:f.etag,
  sha256:f.sha256,bytes:f.bytes,productionVersion:f.production_version});
 const ts=Math.floor(Date.now()/1000),id=crypto.randomUUID();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),b=>b.toString(16).padStart(2,'0')).join('');
 const response=await env.SABER_DOCUMENTOS.fetch(new Request(
  'https://saber-documentos-produccion.libreriasaber.workers.dev/internal/live/purge-file',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sig},body}));
 if(!response.ok)throw Error('STORAGE_DELETE_UNCONFIRMED');
 const data=await response.json();
 if(data?.ok!==true||data.verifiedAbsent!==true||
   data.webOrderId!==f.web_order_id||data.fileId!==f.file_id)
  throw Error('STORAGE_DELETE_NO_PROOF');
}
export async function procesarEntregaLive(env,orderId,{deleteFile=deleteRemote}={}){
 if(!active(env)||!UUID.test(orderId||'')||env.CENTRAL_LIVE_PURGE_EXECUTE_GATE!==GO)
  return {state:'off',deleted:0};
 const db=env.DB;await tables(db);
 const jobs=(await db.prepare(
  "SELECT * FROM central_live_purge_files WHERE order_id=? AND ("+
  "state IN ('pending','error') OR (state='processing' AND last_try<datetime('now','-3 minutes'))) "+
  "ORDER BY file_id"
 ).bind(orderId).all()).results||[];
 let deleted=0,failed=0;
 for(const job of jobs){
  const plan=await planEntregaLive(env,orderId,{state:'entregado',version:job.production_version});
  const original=plan?.files.find(x=>x.file_id===job.file_id);
  if(!original||original.object_key!==job.object_key||original.sha256!==job.sha256||
   original.bytes!==job.bytes||original.etag!==job.etag||original.receipt_id!==job.receipt_id){
   failed++;continue;
  }
  const claimed=await db.prepare(
   "UPDATE central_live_purge_files SET state='processing',attempts=attempts+1,last_try=datetime('now') "+
   "WHERE order_id=? AND file_id=? AND (state IN ('pending','error') OR "+
   "(state='processing' AND last_try<datetime('now','-3 minutes')))"
  ).bind(orderId,job.file_id).run();
  if(claimed?.meta?.changes!==1)continue;
  await db.prepare("INSERT INTO central_live_purge_audit(order_id,file_id,phase,version) VALUES(?,?,'attempt',?)")
   .bind(orderId,job.file_id,job.production_version).run();
  try{
   await deleteFile(env,orderId,job);
   const done=await db.prepare(
    "UPDATE central_live_purge_files SET state='deleted',deleted_at=datetime('now') "+
    "WHERE order_id=? AND file_id=? AND state='processing' AND production_version=?"
   ).bind(orderId,job.file_id,job.production_version).run();
   if(done?.meta?.changes!==1)throw Error('D1_PURGE_CONFLICT');
   await db.prepare("INSERT INTO central_live_purge_audit(order_id,file_id,phase,version) VALUES(?,?,'deleted',?)")
    .bind(orderId,job.file_id,job.production_version).run();
   deleted++;
  }catch{
   failed++;
   await db.prepare("UPDATE central_live_purge_files SET state='error' WHERE order_id=? AND file_id=? AND state='processing'")
    .bind(orderId,job.file_id).run();
   await db.prepare("INSERT INTO central_live_purge_audit(order_id,file_id,phase,version) VALUES(?,?,'error',?)")
    .bind(orderId,job.file_id,job.production_version).run();
  }
 }
 const summary=await db.prepare(
  "SELECT COUNT(*) AS total,SUM(CASE WHEN state='deleted' THEN 1 ELSE 0 END) AS deleted "+
  "FROM central_live_purge_files WHERE order_id=?"
 ).bind(orderId).first();
 return {state:failed?'pending_retry':summary?.total>0&&summary.total===summary.deleted?'deleted':'pending',
  deleted,failed,total:summary?.total||0,verifiedDeleted:summary?.deleted||0};
}
export async function reintentarEntregasLive(env){
 if(!active(env)||env.CENTRAL_LIVE_PURGE_EXECUTE_GATE!==GO)return {enabled:false};
 const exists=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='central_live_purge_files'").first();
 if(!exists)return {enabled:true,checked:0};
 const rows=(await env.DB.prepare(
  "SELECT DISTINCT order_id FROM central_live_purge_files WHERE state IN ('pending','error') "+
  "OR (state='processing' AND last_try<datetime('now','-3 minutes')) LIMIT 3").all()).results||[];
 for(const x of rows)await procesarEntregaLive(env,x.order_id).catch(()=>null);
 return {enabled:true,checked:rows.length};
}
