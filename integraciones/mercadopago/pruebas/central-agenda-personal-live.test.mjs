import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCentralCalendar,agendaCentralPersonalLive} from './central-agenda-personal-live.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const WEEK={mon:'07:00-13:30,16:30-20:00',tue:'07:00-13:30,16:30-20:00',
 wed:'07:00-13:30,16:30-20:00',thu:'07:00-13:30,16:30-20:00',
 fri:'07:00-13:30,16:30-20:00',sat:'',sun:''};
const URL='https://pagos.libreriasaber.com.ar/internal/central/live/staff-calendar';
const read={schema:'saber-central-live-staff-calendar-v1',action:'read',weekly:null,closedDates:null,expectedRevision:0,operator:''};
const request=()=>new Request(URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(read)});
function mock({hasCalendar=true}={}){
 let row=hasCalendar?{weekly_json:JSON.stringify(WEEK),closed_json:'[]',revision:1,operator:'Sistema',updated_at:'2026-11-12'}:null;
 const used=[];
 const db={prepare(sql){
  const q={sql,values:[],bind(...v){this.values=v;return this},
   async first(){
    if(sql.includes('sqlite_master'))return row?{name:'central_eta_calendar'}:null;
    if(sql.startsWith('SELECT weekly_json'))return row;
    throw Error('UNEXPECTED_SQL:'+sql);
   },
   async run(){return {meta:{changes:1}}}};
  used.push(q);return q;
 },async batch(items){
  if(items[0]?.sql.startsWith('UPDATE central_eta_calendar')){
   row={weekly_json:items[0].values[0],closed_json:items[0].values[1],revision:row.revision+1,operator:items[0].values[2],updated_at:'2026-11-12'};
  }else if(items[0]?.sql.startsWith('INSERT OR IGNORE INTO central_eta_calendar')){
   row={weekly_json:items[0].values[0],closed_json:items[0].values[1],revision:1,operator:items[0].values[2],updated_at:'2026-11-12'};
  }else throw Error('Unexpected batch');
  return items.map(()=>({meta:{changes:1}}));
 }};
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',MP_LIVE_GATE:GO,
  CENTRAL_LIVE_BRIDGE_ENABLED:GO,CENTRAL_LIVE_R2_INSPECTION_GATE:GO,DB:db};
 return {env,used};
}
test('respeta jornada de doble turno, fines de semana cerrados y feriados manuales',()=>{
 const n=normalizeCentralCalendar(WEEK,['2026-12-25']);
 assert.deepEqual(n,{weekly:WEEK,closedDates:['2026-12-25']});
 for(const [day,v] of [['mon','07:00-13:30,13:00-20:00'],['sat','25:00-26:00'],['sun','10:00-10:00'],['fri','07:00-07:10']])
  assert.equal(normalizeCentralCalendar({...WEEK,[day]:v},[]),null);
 for(const dates of [['2026-02-30'],['2026-12-25','2026-12-25'],['2026-12-99']])
  assert.equal(normalizeCentralCalendar(WEEK,dates),null);
});
test('solo personal HMAC; sesión o entorno inactivo rechaza sin SQL',async()=>{
 const {env,used}=mock();
 assert.equal((await agendaCentralPersonalLive(request(),env)).status,403);
 assert.equal((await agendaCentralPersonalLive(request(),{...env,MP_LIVE_GATE:'NO_GO'},{readSigned:async()=>({payload:read})})).status,503);
 assert.equal(used.length,0);
});
test('consulta la misma tabla histórica de agenda en modo lectura',async()=>{
 const {env,used}=mock();
 const result=await agendaCentralPersonalLive(request(),env,{readSigned:async()=>({payload:read})});
 assert.equal(result.status,200);
 const data=await result.json();
 assert.deepEqual(data.calendar.weekly,WEEK);
 assert.equal(data.calendar.revision,1);
 assert.equal(data.calendar.configured,true);
 assert.ok(used.every(x=>x.sql.startsWith('SELECT')));
});
test('guarda cambios auditados sin tocar órdenes ni pagos',async()=>{
 const {env,used}=mock();
 const payload={...read,action:'save',weekly:{...WEEK,fri:'07:00-12:00'},
  closedDates:['2026-12-25'],expectedRevision:1,operator:'Operador Saber'};
 const result=await agendaCentralPersonalLive(request(),env,{readSigned:async()=>({payload})});
 assert.equal(result.status,200,await result.clone().text());
 const data=await result.json();assert.equal(data.saved,true);
 assert.equal(data.calendar.weekly.fri,'07:00-12:00');
 assert.deepEqual(data.calendar.closedDates,['2026-12-25']);
 assert.equal(data.calendar.revision,2);
 assert.ok(used.some(x=>x.sql.startsWith('INSERT INTO central_eta_calendar_events')));
 assert.ok(used.every(x=>!/UPDATE orders|UPDATE payment_reviews|DELETE FROM orders/.test(x.sql)));
});
test('versión vencida bloquea sobreescritura de agenda',async()=>{
 const {env}=mock();
 const payload={...read,action:'save',weekly:WEEK,closedDates:['2026-12-25'],
  expectedRevision:0,operator:'Operador Saber'};
 const result=await agendaCentralPersonalLive(request(),env,{readSigned:async()=>({payload})});
 assert.equal(result.status,409);
});
