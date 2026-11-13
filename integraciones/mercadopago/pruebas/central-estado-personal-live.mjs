/** Registro de estados LIVE con auditoría y concurrencia optimista.
 * Solo invocable por HMAC del Worker documental, nunca desde Internet.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const STATE_SQL="CREATE TABLE IF NOT EXISTS central_live_production_states ("+
 "order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "state TEXT NOT NULL CHECK(state IN ('pendiente','en_preparacion','en_espera','listo','entregado')),"+
 "version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),"+
 "operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')))";
const AUDIT_SQL="CREATE TABLE IF NOT EXISTS central_live_production_audit ("+
 "id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,"+
 "from_state TEXT NOT NULL,to_state TEXT NOT NULL,"+
 "from_version INTEGER NOT NULL,to_version INTEGER NOT NULL,"+
 "operator TEXT NOT NULL,reason TEXT NOT NULL,prepress_confirmed INTEGER NOT NULL,"+
 "created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const nextState={
 pendiente:['en_preparacion'],
 en_preparacion:['en_espera','listo'],
 en_espera:['en_preparacion'],
 listo:['entregado'],
 entregado:[]
};
export async function cambiarEstadoCentralPersonalLive(request,env,{readSigned}={}){
 if(!readSigned)return reply({ok:false,error:'NO_HMAC'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'ESTADO_FIRMA'},signed.status||401);
 if(request.method!=='POST'||new URL(request.url).pathname!=='/internal/central/live/staff-status'||
   env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
   env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
   env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==GO||!env?.DB?.prepare||!env.DB.batch)
  return reply({ok:false,error:'ESTADO_OFF'},503);
 const p=signed.payload;
 if(!p||p.schema!=='saber-central-live-staff-status-v1'||
   !ID.test(p.orderId||'')||!Object.hasOwn(nextState,p.from)||
   !nextState[p.from].includes(p.to)||p.confirmed!==true||
   !Number.isSafeInteger(p.version)||p.version<0||p.version>1000||
   typeof p.operator!=='string'||p.operator.trim().length<2||p.operator.trim().length>60||
   typeof p.reason!=='string'||p.reason.length>180||
   (p.to==='en_espera'&&p.reason.trim().length<5))
  return reply({ok:false,error:'ESTADO_PARAMETROS'},422);
 // Preparar cola inmutable ANTES de marcar entregado: si falla D1, no se
 // cambia el estado. Si la transición falla, la cola no puede borrar nada,
 // porque el procesador exige estado='entregado' y versión exacta.
 let purge=null;
 if(p.to==='entregado'){
  if(env.CENTRAL_LIVE_PURGE_GATE!==GO||
     env.CENTRAL_LIVE_PURGE_EXECUTE_GATE!==GO)
   return reply({ok:false,error:'ESTADO_ENTREGA_PURGA_DESACTIVADA'},503);
  try{
   const {encolarEntregaLive}=await import('./central-entrega-purga-live.mjs');
   purge=await encolarEntregaLive(env,p.orderId,p.version+1,{preflight:true});
  }catch{return reply({ok:false,error:'ESTADO_ENTREGA_PURGA_NO_PREPARADA'},503)}
  if(!['pending','deleted'].includes(purge?.state)||
    !Number.isSafeInteger(purge.totalFiles)||purge.totalFiles<1)
   return reply({ok:false,error:'ESTADO_ENTREGA_PURGA_NO_PREPARADA'},409);
 }
 const db=env.DB;
 try{
  const paid=await db.prepare(
   'SELECT o.id,l.web_order_id,d.file_count,'+
   '(SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.web_order_id=l.web_order_id AND f.received=1) AS received_count,'+
   // R2 se recibe con SHA, ETag y reserva ligados al archivo. La
   // inspección visual antigua fue reemplazada por cotejo humano del ZIP
   // cuando el operador inicia la preparación, nunca por cliente.
   '(SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.web_order_id=l.web_order_id '+
   "AND f.transport='r2' AND NOT EXISTS ("+
   'SELECT 1 FROM central_r2_large_pending r JOIN central_r2_large_reservations q '+
   'ON q.object_key=r.object_key AND q.web_order_id=r.web_order_id '+
   'AND q.file_id=r.file_id AND q.sha256=r.sha256 AND q.bytes=r.bytes '+
   'WHERE r.web_order_id=f.web_order_id AND r.file_id=f.file_id '+
   'AND r.sha256=f.sha256 AND r.bytes=f.bytes '+
   "AND r.status='awaiting_pdf_analysis' AND q.state='reserved' "+
   'AND length(r.etag)>=8 AND length(r.receipt_id)=40)) AS pending_r2_receipts '+
   'FROM orders o JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id '+
   'JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id '+
   "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
   'AND o.amount_ars=l.amount_ars AND EXISTS (SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state=\'verified\') LIMIT 1'
  ).bind(p.orderId).first();
  if(!paid||!Number.isSafeInteger(paid.file_count)||paid.file_count<1||paid.file_count>10)
    return reply({ok:false,error:'ESTADO_ORDEN_NO_PAGADA'},409);
  if(p.to==='en_preparacion'&&
    (paid.received_count!==paid.file_count||paid.pending_r2_receipts!==0))
    return reply({ok:false,error:'ESTADO_ORIGINALES_SIN_REVISAR'},409);
  await db.prepare(STATE_SQL).run();await db.prepare(AUDIT_SQL).run();
  await db.prepare("INSERT OR IGNORE INTO central_live_production_states(order_id,state,version,operator) VALUES(?,'pendiente',0,'sistema')").bind(p.orderId).run();
  const current=await db.prepare('SELECT state,version FROM central_live_production_states WHERE order_id=?').bind(p.orderId).first();
  if(current?.state!==p.from||current.version!==p.version)
    return reply({ok:false,error:'ESTADO_CAMBIO_CONCURRENTE'},409);
  const results=await db.batch([
    db.prepare("UPDATE central_live_production_states SET state=?,version=version+1,operator=?,updated_at=datetime('now') WHERE order_id=? AND state=? AND version=?")
     .bind(p.to,p.operator.trim(),p.orderId,p.from,p.version),
    db.prepare('INSERT INTO central_live_production_audit(order_id,from_state,to_state,from_version,to_version,operator,reason,prepress_confirmed) '+
      'SELECT ?,?,?,?,?,?,?,? FROM central_live_production_states WHERE order_id=? AND state=? AND version=?')
     .bind(p.orderId,p.from,p.to,p.version,p.version+1,p.operator.trim(),p.reason.trim(),p.to==='en_preparacion'?1:0,p.orderId,p.to,p.version+1)
  ]);
  if(results?.[0]?.meta?.changes!==1||results?.[1]?.meta?.changes!==1)
    return reply({ok:false,error:'ESTADO_D1_CONCURRENCIA'},409);
  if(p.to==='entregado'){
   // Entregado es definitivo; si Storage falla se conserva la cola para cron.
   // No se promete borrado hasta verificar la ausencia de todos los objetos.
   let cleanup;
   try{
    const {procesarEntregaLive}=await import('./central-entrega-purga-live.mjs');
    cleanup=await procesarEntregaLive(env,p.orderId);
   }catch{cleanup={state:'pending_retry',deleted:0}}
   return reply({ok:true,orderId:p.orderId,from:p.from,to:p.to,
    version:p.version+1,operator:p.operator.trim(),
    purge:cleanup?.state||'pending_retry',
    originalsDeleted:cleanup?.state==='deleted'});
  }
  return reply({ok:true,orderId:p.orderId,from:p.from,to:p.to,version:p.version+1,operator:p.operator.trim()});
 }catch{return reply({ok:false,error:'ESTADO_D1_NO_DISPONIBLE'},503)}
}
