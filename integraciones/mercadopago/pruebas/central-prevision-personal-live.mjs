/** Recuperación de previsión de entrega desde la Central anterior.
 * Mismas tablas auditadas central_delivery_plan y central_preparation_estimates.
 * No inventar horas: previsión general orientativa y hora individual del operador.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const VALID=['por_confirmar','hoy','hoy_tarde','proximo_dia'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SCHEMA='saber-central-live-staff-forecast-v1';
const reply=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const PLAN_SQL="CREATE TABLE IF NOT EXISTS central_delivery_plan (id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL CHECK(mode IN ('por_confirmar','hoy','hoy_tarde','proximo_dia')),revision INTEGER NOT NULL,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')))";
const PLAN_EVENT_SQL="CREATE TABLE IF NOT EXISTS central_delivery_plan_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,mode TEXT NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const EST_SQL="CREATE TABLE IF NOT EXISTS central_preparation_estimates (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,ready_at TEXT,version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),operator TEXT,reason TEXT,updated_at TEXT NOT NULL DEFAULT(datetime('now')))";
const EST_EVENT_SQL="CREATE TABLE IF NOT EXISTS central_preparation_estimate_events (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,version INTEGER NOT NULL,previous_at TEXT,ready_at TEXT,operator TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(order_id,version))";
const planDefault={mode:'por_confirmar',revision:0,operator:null,updated_at:null};
async function read(db){
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('central_delivery_plan','central_preparation_estimates')").all();
 const names=new Set((tables.results||[]).map(x=>x.name));
 const plan=names.has('central_delivery_plan')?await db.prepare('SELECT mode,revision,operator,updated_at FROM central_delivery_plan WHERE id=1').first():null;
 if(plan&&(!VALID.includes(plan.mode)||!Number.isSafeInteger(plan.revision)||plan.revision<1))
   throw Error('PLAN_INVALIDO');
 const estimates=names.has('central_preparation_estimates')?
  await db.prepare('SELECT e.order_id AS orderId,e.ready_at AS readyAt,e.version,e.operator,e.updated_at AS updatedAt FROM central_preparation_estimates e JOIN orders o ON o.id=e.order_id JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id WHERE o.status=\'paid\' AND o.paid_at IS NOT NULL AND o.amount_ars=o.deposit_ars AND EXISTS (SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state=\'verified\') ORDER BY o.paid_at DESC LIMIT 100').all():{results:[]};
 return {ok:true,settings:plan||planDefault,estimates:estimates.results||[],forecastSource:'operator-confirmed'};
}
function validRequest(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&p.schema===SCHEMA&&
  Object.keys(p).sort().join(',')==='action,expectedRevision,mode,operator,orderId,readyAt,reason,schema'&&
  ['read','global','order'].includes(p.action)&&
  Number.isSafeInteger(p.expectedRevision)&&p.expectedRevision>=0&&p.expectedRevision<=10000&&
  (p.mode===null||VALID.includes(p.mode))&&
  (p.orderId===null||UUID.test(p.orderId||''))&&
  (p.readyAt===null||typeof p.readyAt==='string')&&
  typeof p.operator==='string'&&p.operator.length<=60&&
  typeof p.reason==='string'&&p.reason.length<=240;
}
export async function previsionCentralPersonalLive(request,env,{readSigned}={}){
 if(typeof readSigned!=='function')return reply({ok:false,error:'PREVISION_NO_FIRMADA'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'PREVISION_FIRMA'},signed.status||401);
 if(request.method!=='POST'||new URL(request.url).pathname!=='/internal/central/live/staff-forecast'||
   env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
   env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
   env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==GO||
   !env?.DB?.prepare||!env.DB.batch)
  return reply({ok:false,error:'PREVISION_OFF'},503);
 const p=signed.payload;
 if(!validRequest(p))return reply({ok:false,error:'PREVISION_PARAMETROS'},422);
 const db=env.DB;
 try{
  if(p.action==='read'){
   if(p.mode!==null||p.orderId!==null||p.readyAt!==null||p.expectedRevision!==0||
     p.operator!==''||p.reason!=='')return reply({ok:false,error:'PREVISION_LECTURA_PARAMETROS'},422);
   return reply(await read(db));
  }
  if(p.operator.trim().length<2)return reply({ok:false,error:'PREVISION_OPERADOR'},422);
  if(p.action==='global'){
   if(!VALID.includes(p.mode)||p.orderId!==null||p.readyAt!==null||p.reason!=='')
     return reply({ok:false,error:'PREVISION_GLOBAL_PARAMETROS'},422);
   await db.prepare(PLAN_SQL).run();await db.prepare(PLAN_EVENT_SQL).run();
   const current=await db.prepare('SELECT mode,revision FROM central_delivery_plan WHERE id=1').first()||planDefault;
   if(current.revision!==p.expectedRevision)return reply({ok:false,error:'PREVISION_CAMBIO_CONCURRENTE'},409);
   if(current.mode===p.mode)return reply({ok:false,error:'PREVISION_SIN_CAMBIO'},409);
   const next=current.revision+1;
   const updates=current.revision===0?[
    db.prepare('INSERT INTO central_delivery_plan(id,mode,revision,operator) VALUES(1,?,1,?)').bind(p.mode,p.operator.trim()),
    db.prepare('INSERT INTO central_delivery_plan_events(revision,mode,operator) SELECT 1,?,? WHERE EXISTS(SELECT 1 FROM central_delivery_plan WHERE id=1 AND revision=1)').bind(p.mode,p.operator.trim())
   ]:[
    db.prepare("UPDATE central_delivery_plan SET mode=?,revision=revision+1,operator=?,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(p.mode,p.operator.trim(),p.expectedRevision),
    db.prepare('INSERT INTO central_delivery_plan_events(revision,mode,operator) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM central_delivery_plan WHERE id=1 AND revision=?)').bind(next,p.mode,p.operator.trim(),next)
   ];
   const applied=await db.batch(updates);
   if(applied?.length!==2||applied.some(x=>x?.meta?.changes!==1))
    return reply({ok:false,error:'PREVISION_GLOBAL_NO_CONFIRMADA'},409);
   return reply({ok:true,settings:{mode:p.mode,revision:next},saved:true});
  }
  if(p.mode!==null||!UUID.test(p.orderId||''))
    return reply({ok:false,error:'PREVISION_ORDEN_PARAMETROS'},422);
  const when=p.readyAt===null?null:Date.parse(p.readyAt),now=Date.now();
  if(p.readyAt!==null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.readyAt)||
    !Number.isFinite(when)||new Date(when).toISOString()!==p.readyAt||
    when<now+5*60000||when>now+45*24*3600000))
   return reply({ok:false,error:'PREVISION_HORA_INVALIDA'},422);
  const order=await db.prepare(
   'SELECT o.id FROM orders o JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id '+
   "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL AND o.amount_ars=o.deposit_ars "+
   "AND EXISTS(SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state='verified') LIMIT 1"
  ).bind(p.orderId).first();
  if(!order)return reply({ok:false,error:'PREVISION_ORDEN_NO_PAGADA'},409);
  const stateTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_live_production_states'").first();
  if(stateTable){
   const state=await db.prepare('SELECT state FROM central_live_production_states WHERE order_id=?').bind(p.orderId).first();
   if(['listo','entregado'].includes(state?.state))return reply({ok:false,error:'PREVISION_ORDEN_CERRADA'},409);
  }
  await db.prepare(EST_SQL).run();await db.prepare(EST_EVENT_SQL).run();
  await db.prepare('INSERT OR IGNORE INTO central_preparation_estimates(order_id) VALUES(?)').bind(p.orderId).run();
  const current=await db.prepare('SELECT ready_at,version FROM central_preparation_estimates WHERE order_id=?').bind(p.orderId).first();
  if(!current||current.version!==p.expectedRevision)
   return reply({ok:false,error:'PREVISION_CAMBIO_CONCURRENTE'},409);
  if(current.ready_at===p.readyAt)return reply({ok:false,error:'PREVISION_SIN_CAMBIO'},409);
  if(current.ready_at&&(p.readyAt===null||Date.parse(p.readyAt)>Date.parse(current.ready_at))&&p.reason.trim().length<5)
   return reply({ok:false,error:'PREVISION_MOTIVO_REQUERIDO'},422);
  const next=current.version+1;
  const change=await db.batch([
   db.prepare("UPDATE central_preparation_estimates SET ready_at=?,version=version+1,operator=?,reason=?,updated_at=datetime('now') WHERE order_id=? AND version=?").bind(p.readyAt,p.operator.trim(),p.reason.trim(),p.orderId,current.version),
   db.prepare('INSERT INTO central_preparation_estimate_events(order_id,version,previous_at,ready_at,operator,reason) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM central_preparation_estimates WHERE order_id=? AND version=? AND ready_at IS ?)').bind(p.orderId,next,current.ready_at,p.readyAt,p.operator.trim(),p.reason.trim(),p.orderId,next,p.readyAt)
  ]);
  if(change?.length!==2||change.some(x=>x?.meta?.changes!==1))
   return reply({ok:false,error:'PREVISION_ORDEN_NO_CONFIRMADA'},409);
  return reply({ok:true,saved:true,orderId:p.orderId,readyAt:p.readyAt,version:next});
 }catch{return reply({ok:false,error:'PREVISION_D1_NO_DISPONIBLE'},503)}
}
