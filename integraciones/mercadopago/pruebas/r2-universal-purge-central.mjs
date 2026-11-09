/**
 * Private D1 purge of all ORIGINALS of an already delivered paid universal order.
 * One durable row per PDF, retries safe, R2 deletion central, TUS deletion
 * through the Documents service binding. No browser-supplied keys.
 */
import {comprobarPreprensaUniversal} from './r2-universal-preprensa-central.mjs';
import {TUS_RECEIPT_TABLE} from './r2-universal-tus-central.mjs';
const ON='PRIVATE_TEST_ONLY',LIMIT=10,CUTOFF='2026-11-09 00:00:00';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const RECEIPT=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const R2KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const TUSKEY=/^v2\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store,private'}});
export const UNIVERSAL_PURGE_SQL="CREATE TABLE IF NOT EXISTS central_r2_universal_purge_files ("+
 "order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,"+
 "web_order_id TEXT NOT NULL,file_id TEXT NOT NULL,"+
 "transport TEXT NOT NULL CHECK(transport IN ('tus','r2')),"+
 "receipt_id TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,etag TEXT,"+
 "sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,production_version INTEGER NOT NULL,"+
 "state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','deleted','error')),"+
 "attempts INTEGER NOT NULL DEFAULT 0,last_try TEXT,deleted_at TEXT,"+
 "PRIMARY KEY(order_id,file_id))";
export const UNIVERSAL_PURGE_AUDIT_SQL="CREATE TABLE IF NOT EXISTS central_r2_universal_purge_audit ("+
 "id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,file_id TEXT NOT NULL,"+
 "phase TEXT NOT NULL CHECK(phase IN ('queued','attempt','deleted','error')),"+
 "production_version INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const validPath=(row,web)=>{
 if(!row||!SHA.test(row.sha256||'')||!RECEIPT.test(row.receipt_id||'')||
    row.web_order_id!==web||
    !Number.isSafeInteger(row.bytes)||row.bytes<5||
    !['r2','tus'].includes(row.transport))return false;
 const m=row.transport==='r2'?R2KEY.exec(row.object_key||''):
  TUSKEY.exec(row.object_key||'');
 if(row.transport==='r2'&&(!row.etag||typeof row.etag!=='string'||row.etag.length<8))return false;
 const min=row.transport==='r2'?40*1048576:5;
 const max=row.transport==='r2'?200*1048576:40*1048576;
 return Boolean(m&&m[1]===web&&('DOC-'+m[2]).toLowerCase()===row.receipt_id.toLowerCase()&&
  row.bytes>=min&&row.bytes<=max);
};
const feature=env=>env?.CENTRAL_R2_UNIVERSAL_PURGE_ENABLED===ON&&
 env?.CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED===ON&&
 env?.CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED===ON&&env?.DB?.prepare;
const scope=(env,web,at)=>WEB.test(web||'')&&
 typeof at==='string'&&at>=CUTOFF&&
 (env?.CENTRAL_R2_UNIVERSAL_PURGE_SCOPE==='NEW_ORDERS_ONLY'||
  env?.CENTRAL_R2_UNIVERSAL_PURGE_CANARY_ORDER===web);
/** Build from paid receipt joins, never from browser keys. */
export async function planBorradoUniversalD1(env,orderId,version){
 if(!feature(env)||!UUID.test(orderId||'')||
    !Number.isSafeInteger(version)||version<1)return null;
 const db=env.DB;
 const base=await db.prepare('SELECT l.web_order_id,d.file_count,d.created_at,'+
  'o.status,o.paid_at,o.amount_ars,o.deposit_ars,rv.state AS review_state,'+
  's.state AS production_state,s.version AS production_version '+
  'FROM central_r2_universal_order_links l '+
  'JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id '+
  'JOIN orders o ON o.id=l.commercial_order_id '+
  'JOIN payment_reviews rv ON rv.order_id=o.id '+
  'JOIN central_production_status s ON s.order_id=o.id '+
  'WHERE o.id=? AND l.amount_ars=o.amount_ars LIMIT 1').bind(orderId).first();
 if(!base||!scope(env,base.web_order_id,base.created_at)||
    base.status!=='paid'||!base.paid_at||
    base.deposit_ars!==base.amount_ars||base.review_state!=='verified'||
    base.production_state!=='entregado'||base.production_version!==version||
    !Number.isSafeInteger(base.file_count)||base.file_count<1||
    base.file_count>LIMIT||!(await comprobarPreprensaUniversal(env,orderId)))
  return null;
 // An all-R2 batch may never have initialized the TUS table.
 // Creating the empty receipt table cannot authorize any file for deletion.
 await db.prepare(TUS_RECEIPT_TABLE).run();
 const rows=await db.prepare(
  'SELECT f.file_id,f.transport,f.sha256,f.bytes,f.received,'+
  'f.web_order_id,f.name,t.receipt_id AS tus_receipt,t.object_name AS tus_key,'+
  't.sha256 AS tus_sha,t.bytes AS tus_bytes,'+
  'p.receipt_id AS r2_receipt,p.object_key AS r2_key,p.etag AS r2_etag,'+
  'p.sha256 AS r2_sha,p.bytes AS r2_bytes,p.status AS r2_status,'+
  'q.state AS r2_reservation '+
  'FROM central_r2_universal_files f '+
  'LEFT JOIN central_r2_universal_tus_receipts t '+
  'ON t.web_order_id=f.web_order_id AND t.file_id=f.file_id '+
  'LEFT JOIN central_r2_large_pending p '+
  'ON p.web_order_id=f.web_order_id AND p.file_id=f.file_id '+
  'AND p.sha256=f.sha256 AND p.bytes=f.bytes '+
  'LEFT JOIN central_r2_large_reservations q ON q.object_key=p.object_key '+
  'AND q.web_order_id=p.web_order_id AND q.file_id=p.file_id '+
  'WHERE f.web_order_id=? ORDER BY f.ordinal').bind(base.web_order_id).all();
 const src=rows.results||[];
 if(src.length!==base.file_count||src.some(x=>x.received!==1))return null;
 const entries=src.map(x=>{
  const isR2=x.transport==='r2';
  if(isR2&&(x.r2_status!=='awaiting_pdf_analysis'||x.r2_reservation!=='reserved'))
   return null;
  const row={web_order_id:base.web_order_id,file_id:x.file_id,transport:x.transport,
   sha256:x.sha256,bytes:x.bytes,
   receipt_id:isR2?x.r2_receipt:x.tus_receipt,
   object_key:isR2?x.r2_key:x.tus_key,etag:isR2?x.r2_etag:null};
  if(!validPath(row,base.web_order_id)||
     (isR2?(x.r2_sha!==x.sha256||x.r2_bytes!==x.bytes):
      (x.tus_sha!==x.sha256||x.tus_bytes!==x.bytes)))
   return null;
  return row;
 });
 if(entries.some(x=>!x)||new Set(entries.map(x=>x.file_id)).size!==entries.length||
    new Set(entries.map(x=>x.object_key)).size!==entries.length)
  return null;
 return {commercialOrderId:orderId,webOrderId:base.web_order_id,
  productionVersion:version,files:entries};
}
async function tables(db){
 await db.prepare(UNIVERSAL_PURGE_SQL).run();
 await db.prepare(UNIVERSAL_PURGE_AUDIT_SQL).run();
}
/** Queue immutable file identity after the transition to delivered. */
export async function encolarBorradoUniversalEntregado(env,orderId,version){
 if(!feature(env)||!env?.DB?.batch)return {state:'off',filesDeleted:0};
 let plan;try{plan=await planBorradoUniversalD1(env,orderId,version)}catch{}
 if(!plan)return {state:'not_eligible',filesDeleted:0};
 const db=env.DB;
 await tables(db);
 const statements=plan.files.map(x=>db.prepare('INSERT OR IGNORE INTO '+
  'central_r2_universal_purge_files '+
  '(order_id,web_order_id,file_id,transport,receipt_id,object_key,etag,sha256,bytes,production_version) '+
  'VALUES(?,?,?,?,?,?,?,?,?,?)').bind(orderId,plan.webOrderId,x.file_id,
   x.transport,x.receipt_id,x.object_key,x.etag,x.sha256,x.bytes,version));
 try{await db.batch(statements)}catch{return {state:'d1_error',filesDeleted:0}}
 const state=await db.prepare('SELECT web_order_id,file_id,transport,receipt_id,'+
  'object_key,etag,sha256,bytes,production_version,state FROM central_r2_universal_purge_files '+
  'WHERE order_id=?').bind(orderId).all();
 const registered=state.results||[];
 if(registered.length!==plan.files.length||plan.files.some(x=>!registered.some(y=>
    y.web_order_id===plan.webOrderId&&y.file_id===x.file_id&&
    y.transport===x.transport&&y.receipt_id===x.receipt_id&&
    y.object_key===x.object_key&&y.etag===x.etag&&y.sha256===x.sha256&&
    y.bytes===x.bytes&&y.production_version===version)))
  return {state:'conflict',filesDeleted:0};
 return {state:registered.every(x=>x.state==='deleted')?'deleted':'pending',
  totalFiles:registered.length,filesDeleted:registered.filter(x=>x.state==='deleted').length};
}
const signed=async(env,orderId,row,{
 bridge=env?.SABER_DOCUMENTOS,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={})=>{
 if(typeof bridge?.fetch!=='function'||typeof env?.CENTRAL_BRIDGE_KEY!=='string'||
    env.CENTRAL_BRIDGE_KEY.length<32)
  throw Error('UNIVERSAL_PURGE_NO_BRIDGE');
 const p={schema:'saber-docs-r2-universal-purge-file-v1',webOrderId:row.web_order_id,
  commercialOrderId:orderId,fileId:row.file_id,transport:row.transport,
  receiptId:row.receipt_id,objectKey:row.object_key,sha256:row.sha256,
  bytes:row.bytes,productionVersion:row.production_version};
 const body=JSON.stringify(p),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !UUID.test(id))throw Error('UNIVERSAL_PURGE_NONCE');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),b=>b.toString(16).padStart(2,'0')).join('');
 const r=await bridge.fetch(new Request(
  'https://saber-documentos-pruebas.libreriasaber.workers.dev/internal/r2-universal-purge-delivered',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sig},body
  }));
 if(!r.ok)throw Error('UNIVERSAL_PURGE_DOCUMENTOS_INCOMPLETO');
 const answer=await r.json();
 if(answer?.ok!==true||answer.verifiedAbsent!==true||
    answer.webOrderId!==row.web_order_id||answer.fileId!==row.file_id)
  throw Error('UNIVERSAL_PURGE_DOCUMENTOS_NO_VERIFICA');
 return true;
};
/** R2 is deleted directly through private binding, TUS by signed Worker. */
export async function procesarBorradoUniversalEntregado(env,orderId,{
 bucket=env?.SABER_R2_GRANDES,deleteTUS=signed
}={}){
 if(!feature(env)||!UUID.test(orderId||'')||
    env.CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED!==ON)
  return {state:'off',filesDeleted:0};
 const db=env.DB;
 await tables(db);
 const files=await db.prepare('SELECT * FROM central_r2_universal_purge_files WHERE order_id=? '+
  'AND (state IN (\'pending\',\'error\') OR (state=\'processing\' '+
  'AND last_try<datetime(\'now\',\'-3 minutes\'))) ORDER BY file_id')
  .bind(orderId).all();
 let deleted=0,failed=0;
 for(const r of files.results||[]){
  const plan=await planBorradoUniversalD1(env,orderId,r.production_version);
  const row=plan?.files.find(x=>x.file_id===r.file_id);
  if(!row||row.transport!==r.transport||row.object_key!==r.object_key||
     row.receipt_id!==r.receipt_id||row.etag!==r.etag||row.sha256!==r.sha256||row.bytes!==r.bytes){
   failed++;continue;
  }
  const claim=await db.prepare("UPDATE central_r2_universal_purge_files "+
   "SET state='processing',attempts=attempts+1,last_try=datetime('now') "+
   "WHERE order_id=? AND file_id=? AND (state IN ('pending','error') "+
   "OR (state='processing' AND last_try<datetime('now','-3 minutes')))")
   .bind(orderId,r.file_id).run();
  if(claim?.meta?.changes!==1)continue;
  await db.prepare("INSERT INTO central_r2_universal_purge_audit"+
   "(order_id,file_id,phase,production_version) VALUES(?,?,'attempt',?)")
   .bind(orderId,r.file_id,r.production_version).run();
  try{
   if(r.transport==='r2'){
    if(!bucket?.head||!bucket?.delete)throw Error('UNIVERSAL_PURGE_R2_OFF');
    const obj=await bucket.head(r.object_key);
    if(obj){
     if(obj.size!==r.bytes||typeof obj.etag!=='string'||
       obj.etag.replaceAll('"','')!==r.etag.replaceAll('"',''))
      throw Error('UNIVERSAL_PURGE_R2_OBJECT_CHANGED');
     await bucket.delete(r.object_key);
    }else if(r.attempts===0)
     throw Error('UNIVERSAL_PURGE_R2_ORIGINAL_UNEXPECTEDLY_MISSING');
    if(await bucket.head(r.object_key))
     throw Error('UNIVERSAL_PURGE_R2_STILL_PRESENT');
   }else await deleteTUS(env,orderId,r);
   const done=await db.prepare("UPDATE central_r2_universal_purge_files "+
    "SET state='deleted',deleted_at=datetime('now') "+
    "WHERE order_id=? AND file_id=? AND state='processing' AND production_version=?")
    .bind(orderId,r.file_id,r.production_version).run();
   if(done?.meta?.changes!==1)throw Error('UNIVERSAL_PURGE_D1_MISMATCH');
   await db.prepare("INSERT INTO central_r2_universal_purge_audit"+
    "(order_id,file_id,phase,production_version) VALUES(?,?,'deleted',?)")
    .bind(orderId,r.file_id,r.production_version).run();
   deleted++;
  }catch{
   await db.prepare("UPDATE central_r2_universal_purge_files SET state='error' "+
    "WHERE order_id=? AND file_id=? AND state='processing'")
    .bind(orderId,r.file_id).run();
   await db.prepare("INSERT INTO central_r2_universal_purge_audit"+
    "(order_id,file_id,phase,production_version) VALUES(?,?,'error',?)")
    .bind(orderId,r.file_id,r.production_version).run();
   failed++;
  }
 }
 return {state:failed?'error':'processed',filesDeleted:deleted,failed};
}

/** Cron only for existing pending rows. Flags OFF means no Storage access. */
export async function reintentarBorradosUniversal(env,{limit=3}={}){
 if(!feature(env)||env.CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED!==ON||
    !Number.isSafeInteger(limit)||limit<1||limit>5)
  return {enabled:false,attempted:0,deleted:0};
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
  "AND name='central_r2_universal_purge_files'").first();
 if(!exists)return {enabled:true,attempted:0,deleted:0};
 const rows=await env.DB.prepare("SELECT DISTINCT order_id FROM "+
  "central_r2_universal_purge_files WHERE state IN ('pending','error') "+
  "OR (state='processing' AND last_try<datetime('now','-3 minutes')) "+
  "ORDER BY order_id LIMIT ?").bind(limit).all();
 let deleted=0,errors=0;
 for(const entry of rows.results||[]){
  try{const r=await procesarBorradoUniversalEntregado(env,entry.order_id);
   deleted+=r.filesDeleted;
   errors+=r.failed;
  }catch{errors++}
 }
 return {enabled:true,attempted:(rows.results||[]).length,deleted,errors};
}
