/** Agenda staff LIVE. Reutiliza exactamente el esquema histórico central_eta_calendar.
 * No modifica pagos, órdenes ni documentos. Lectura y edición HMAC auditada.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const DAYS=['mon','tue','wed','thu','fri','sat','sun'];
const EMPTY=Object.fromEntries(DAYS.map(d=>[d,'']));
const SCHEMA='saber-central-live-staff-calendar-v1';
const TABLE="CREATE TABLE IF NOT EXISTS central_eta_calendar (id INTEGER PRIMARY KEY CHECK(id=1),weekly_json TEXT NOT NULL,closed_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')))";
const AUDIT="CREATE TABLE IF NOT EXISTS central_eta_calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,weekly_json TEXT NOT NULL,closed_json TEXT NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export function normalizeCentralCalendar(weekly,closedDates){
 if(!weekly||typeof weekly!=='object'||Array.isArray(weekly)||
   Object.keys(weekly).sort().join(',')!==[...DAYS].sort().join(',')||
   !Array.isArray(closedDates)||closedDates.length>180)return null;
 const normalized={};
 for(const day of DAYS){
  const value=weekly[day];
  if(typeof value!=='string'||value.length>120)return null;
  if(!value.trim()){normalized[day]='';continue;}
  const slots=value.split(',');
  if(slots.length>4)return null;
  let last=0;const canonical=[];
  for(const text of slots){
   const m=text.trim().match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]|24):([0-5]\d)$/);
   if(!m||(m[3]==='24'&&m[4]!=='00'))return null;
   const from=Number(m[1])*60+Number(m[2]),to=Number(m[3])*60+Number(m[4]);
   if(from>=to||to-from<15||from<last||to>1440)return null;
   last=to;
   const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
   canonical.push(fmt(from)+'-'+fmt(to));
  }
  normalized[day]=canonical.join(',');
 }
 if(closedDates.some(date=>{
   if(typeof date!=='string'||!/^(20\d\d|2100)-\d{2}-\d{2}$/.test(date))return true;
   const d=new Date(date+'T00:00:00Z');
   return !Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date;
 })||new Set(closedDates).size!==closedDates.length)return null;
 return {weekly:normalized,closedDates:[...closedDates].sort()};
}
async function read(db){
 const t=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_eta_calendar'").first();
 if(!t)return {weekly:{...EMPTY},closedDates:[],configured:false,revision:0,operator:null,updated_at:null};
 const row=await db.prepare('SELECT weekly_json,closed_json,revision,operator,updated_at FROM central_eta_calendar WHERE id=1').first();
 if(!row)return {weekly:{...EMPTY},closedDates:[],configured:false,revision:0,operator:null,updated_at:null};
 const v=normalizeCentralCalendar(JSON.parse(row.weekly_json),JSON.parse(row.closed_json));
 if(!v||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('CALENDAR_DATA');
 return {...v,configured:DAYS.some(day=>Boolean(v.weekly[day])),revision:row.revision,
  operator:row.operator,updated_at:row.updated_at};
}
export async function agendaCentralPersonalLive(request,env,{readSigned}={}){
 if(typeof readSigned!=='function')return respond({ok:false,error:'AGENDA_FIRMA_FALTANTE'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'AGENDA_FIRMA_INVALIDA'},signed.status||401);
 if(request.method!=='POST'||new URL(request.url).pathname!=='/internal/central/live/staff-calendar'||
   env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
   env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
   env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==GO||!env?.DB?.prepare||!env?.DB?.batch)
  return respond({ok:false,error:'AGENDA_OFF'},503);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='action,closedDates,expectedRevision,operator,schema,weekly'||
    p.schema!==SCHEMA||!['read','save'].includes(p.action)||
    !Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||p.expectedRevision>100000||
    typeof p.operator!=='string'||p.operator.length>60)
  return respond({ok:false,error:'AGENDA_PARAMETROS'},422);
 const db=env.DB;
 try{
  if(p.action==='read'){
   if(p.weekly!==null||p.closedDates!==null||p.expectedRevision!==0||p.operator!=='')
    return respond({ok:false,error:'AGENDA_LECTURA_PARAMETROS'},422);
   return respond({ok:true,calendar:await read(db)});
  }
  if(p.operator.trim().length<2)return respond({ok:false,error:'AGENDA_OPERADOR'},422);
  const normalized=normalizeCentralCalendar(p.weekly,p.closedDates);
  if(!normalized)return respond({ok:false,error:'AGENDA_HORARIOS_INVALIDOS'},422);
  const before=await read(db);
  if(before.revision!==p.expectedRevision)return respond({ok:false,error:'AGENDA_VERSION_DESACTUALIZADA'},409);
  if(JSON.stringify(normalized.weekly)===JSON.stringify(before.weekly)&&
    JSON.stringify(normalized.closedDates)===JSON.stringify(before.closedDates))
   return respond({ok:false,error:'AGENDA_SIN_CAMBIO'},409);
  await db.prepare(TABLE).run();await db.prepare(AUDIT).run();
  const week=JSON.stringify(normalized.weekly),closed=JSON.stringify(normalized.closedDates);
  const operator=p.operator.trim(),next=before.revision+1;
  const updates=before.revision===0?[
   db.prepare("INSERT OR IGNORE INTO central_eta_calendar(id,weekly_json,closed_json,revision,operator) VALUES(1,?,?,1,?)").bind(week,closed,operator),
   db.prepare("INSERT INTO central_eta_calendar_events(revision,weekly_json,closed_json,operator) SELECT 1,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_calendar WHERE id=1 AND revision=1)").bind(week,closed,operator)
  ]:[
   db.prepare("UPDATE central_eta_calendar SET weekly_json=?,closed_json=?,revision=revision+1,operator=?,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(week,closed,operator,before.revision),
   db.prepare("INSERT INTO central_eta_calendar_events(revision,weekly_json,closed_json,operator) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_calendar WHERE id=1 AND revision=?)").bind(next,week,closed,operator,next)
  ];
  const applied=await db.batch(updates);
  if(applied?.length!==2||applied.some(r=>Number(r?.meta?.changes)!==1))
   return respond({ok:false,error:'AGENDA_GUARDADO_NO_CONFIRMADO'},409);
  return respond({ok:true,saved:true,calendar:await read(db)});
 }catch{return respond({ok:false,error:'AGENDA_D1_NO_DISPONIBLE'},503)}
}
