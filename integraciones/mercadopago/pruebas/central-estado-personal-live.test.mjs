import test from 'node:test';
import assert from 'node:assert/strict';
import {cambiarEstadoCentralPersonalLive} from './central-estado-personal-live.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const orderId='123e4567-e89b-42d3-a456-426614174000';
const url='https://pagos.libreriasaber.com.ar/internal/central/live/staff-status';
const payload={schema:'saber-central-live-staff-status-v1',orderId,from:'pendiente',
 to:'en_preparacion',version:0,operator:'Operador Saber',reason:'',confirmed:true};
const req=()=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
function fixture(options={}){
 const statements=[];
 const db={prepare(sql){const q={sql,values:[],bind(...v){this.values=v;return this},
  async first(){
   if(sql.startsWith('SELECT o.id,l.web_order_id'))return {id:orderId,file_count:2,received_count:options.received??2,pending_r2_receipts:options.r2Pending??0};
   if(sql.startsWith('SELECT state,version'))return {state:'pendiente',version:0};
   throw Error('unexpected SELECT '+sql);
  },async run(){return {meta:{changes:1}}}};
  statements.push(q);return q;
 },async batch(queries){return queries.map(()=>({meta:{changes:1}}))}};
 const env={DB:db,SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',MP_LIVE_GATE:GO,
 CENTRAL_LIVE_BRIDGE_ENABLED:GO,CENTRAL_LIVE_R2_INSPECTION_GATE:GO};
 return {env,statements};
}
const signed=async()=>({payload});
test('rechaza acceso directo y sin firma antes de tocar D1',async()=>{
 const {env,statements}=fixture();
 const a=await cambiarEstadoCentralPersonalLive(req(),env,{});
 assert.equal(a.status,403);assert.equal(statements.length,0);
 const b=await cambiarEstadoCentralPersonalLive(req(),{...env,CENTRAL_LIVE_R2_INSPECTION_GATE:'NO_GO'},{readSigned:signed});
 assert.equal(b.status,503);assert.equal(statements.length,0);
});
test('rechaza órdenes incompletas o con R2 sin recibo SHA/reserva íntegros',async()=>{
 for(const options of [{received:1},{r2Pending:1}]){
  const {env,statements}=fixture(options);
  const res=await cambiarEstadoCentralPersonalLive(req(),env,{readSigned:signed});
  assert.equal(res.status,409);
  assert.equal(statements.filter(x=>/CREATE TABLE|UPDATE /.test(x.sql)).length,0);
 }
});
test('estado listo exige pasos previos; entregado bloqueado sin gates de purga LIVE',async()=>{
 const {env,statements}=fixture();
 for(const p of [{...payload,to:'listo'},{...payload,from:'listo',to:'entregado',version:3}]){
  const response=await cambiarEstadoCentralPersonalLive(req(),env,{readSigned:async()=>({payload:p})});
  assert.equal(response.status,p.to==='entregado'?503:422);
 }
 assert.equal(statements.length,0);
});
test('inicio tras archivos validados escribe estado y auditoría sin modificar pagos',async()=>{
 const {env,statements}=fixture();
 const res=await cambiarEstadoCentralPersonalLive(req(),env,{readSigned:signed});
 assert.equal(res.status,200,await res.clone().text());
 const data=await res.json();
 assert.equal(data.to,'en_preparacion');assert.equal(data.version,1);
 assert.ok(statements.some(x=>x.sql.includes('CREATE TABLE IF NOT EXISTS central_live_production_states')));
 assert.ok(statements.some(x=>x.sql.includes('CREATE TABLE IF NOT EXISTS central_live_production_audit')));
 assert.ok(statements.some(x=>x.sql.startsWith('UPDATE central_live_production_states')));
 assert.ok(statements.some(x=>x.sql.startsWith('INSERT INTO central_live_production_audit')));
 assert.equal(statements.some(x=>/UPDATE orders|UPDATE payment_reviews/.test(x.sql)),false);
});

test('orden 014: pagada, R2 recibido 1/1 y con reserva válida puede iniciar sin inspección manual retirada',async()=>{
 const {env,statements}=fixture({received:2,r2Pending:0});
 const res=await cambiarEstadoCentralPersonalLive(req(),env,{readSigned:signed});
 assert.equal(res.status,200);
 const sql=statements.find(x=>x.sql.startsWith('SELECT o.id,l.web_order_id'))?.sql;
 assert.ok(sql);
 assert.match(sql,/central_r2_large_pending r JOIN central_r2_large_reservations q/);
 assert.match(sql,/r.sha256=f.sha256 AND r.bytes=f.bytes/);
 assert.match(sql,/q.state='reserved'/);
 assert.match(sql,/length\(r.etag\)>=8/);
 assert.doesNotMatch(sql,/central_r2_live_inspections/);
 assert.equal((await res.json()).to,'en_preparacion');
});
