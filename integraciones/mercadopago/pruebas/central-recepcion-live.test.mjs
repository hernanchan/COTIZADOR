import test from 'node:test';
import assert from 'node:assert/strict';
import {listarRecepcionUniversalLive} from './central-recepcion-live.mjs';
const gate='GO_COMERCIAL_CONFIRMADO';
const url='https://pagos.libreriasaber.com.ar/admin/api/central/live-recepcion';
const web='WEB-ENSAYO-'+'A'.repeat(32);
const order='123e4567-e89b-42d3-a456-426614174000';
const rows=[
 {order_id:order,web_order_id:web,work_number:18,file_count:2,total_ars:4700,
  paid_at:'2026-11-10 18:30:00',received_count:1,pending_count:1,tus_count:1,r2_count:1,staged_r2_count:1},
 {order_id:'123e4567-e89b-42d3-a456-426614174001',
  web_order_id:'WEB-ENSAYO-'+'B'.repeat(32),work_number:19,file_count:1,total_ars:1000,
  paid_at:'2026-11-10 18:40:00',received_count:1,pending_count:0,tus_count:1,r2_count:0,staged_r2_count:0}
];
const envWith=(items=rows)=>{
 const queries=[];
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  CENTRAL_LIVE_BOARD_GATE:gate,MP_LIVE_GATE:gate,
  CENTRAL_LIVE_BRIDGE_ENABLED:gate,
  DB:{prepare(sql){queries.push(sql);return {all:async()=>({results:sql.includes('sqlite_master')?[]:items})}}}};
 return {env,queries};
};
test('Central LIVE sin autorización o gate no consulta ni modifica D1',async()=>{
 const {env,queries}=envWith();
 const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:false});
 assert.equal(r.status,401);assert.equal(queries.length,0);
 for(const patch of [{CENTRAL_LIVE_BOARD_GATE:'NO_GO'},
  {SABER_ENTORNO:'preparacion'},{MP_LIVE_GATE:'NO_GO'},
  {CENTRAL_DB_ENV:'pruebas'}]){
  const rr=await listarRecepcionUniversalLive(new Request(url),{...env,...patch},{authorized:true});
  assert.equal(rr.status,503);assert.equal(queries.length,0);
 }
});
test('solo pagos D1 verificados; Nuevos espera originales o preprensa sin descargar ZIP',async()=>{
 const {env,queries}=envWith();
 const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.source,'production-d1-verified-payments-only');
 assert.deepEqual(body.orders.map(x=>x.numeroOrden),['018','019']);
 assert.deepEqual(body.orders.map(x=>x.estado),[
  'R2_ALMACENADO_PENDIENTE_ANALISIS_PDF','ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE']);
 assert.ok(body.orders.every(x=>x.readyForProduction===false&&x.zipEnabled===false));
 assert.equal(body.productionAuthorized,false);
 assert.equal(body.orders[0].stagedR2Count,1);
 assert.match(queries[1],/FROM central_r2_large_pending r/);
 assert.equal(queries.length,2);
 assert.match(queries[1],/p\.state='verified'/);
 assert.match(queries[1],/o\.status='paid'/);
 assert.match(queries[1],/o\.payment_id IS NOT NULL/);
 assert.doesNotMatch(queries[1],/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\b/i);
});
test('inconsistencia de cantidad o numeración bloquea el listado completo',async()=>{
 for(const change of [{pending_count:5},{work_number:0},{total_ars:0}]){
  const {env}=envWith([{...rows[0],...change}]);
  const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
  assert.equal(r.status,409);
 }
});
test('consulta falla cerrada cuando D1 es inaccesible',async()=>{
 const {env}=envWith();
 env.DB.prepare=()=>{throw Error('D1 offline')};
 const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
 assert.equal(r.status,503);
});

test('R2 almacenado sigue bloqueado: si falta otro PDF no se declara preprensa',async()=>{
 const {env}=envWith([{
  ...rows[0],file_count:3,received_count:1,pending_count:2,
  tus_count:2,r2_count:1,staged_r2_count:1
 }]);
 const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
 assert.equal(r.status,200);
 const result=(await r.json()).orders[0];
 assert.equal(result.estado,'PAGADO_ESPERANDO_ORIGINALES');
 assert.equal(result.zipEnabled,false);
 assert.equal(result.readyForProduction,false);
});
test('Central falla cerrada ante recibos R2 imposibles o inconsistentes',async()=>{
 for(const change of [
  {staged_r2_count:2},{staged_r2_count:-1},
  {staged_r2_count:null},{staged_r2_count:1,pending_count:0}
 ]){
  const {env}=envWith([{...rows[0],...change}]);
  const r=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
  assert.equal(r.status,409);
 }
});

test('recepción LIVE admite pago bancario solo con asiento D1, no por comprobante cliente',async()=>{
 const {env,queries}=envWith();
 const old=env.DB.prepare;
 env.DB.prepare=(sql)=>{
  if(sql.includes('sqlite_master'))return {all:async()=>({results:[
   {name:'central_live_bank_accreditations'},
   {name:'central_order_contacts'},
   {name:'central_order_customer_details'}
  ]})};
  return old(sql);
 };
 const res=await listarRecepcionUniversalLive(new Request(url),env,{authorized:true});
 assert.equal(res.status,200);
 const sql=queries.find(q=>q.includes('FROM central_r2_universal_order_links l'));
 assert.match(sql,/EXISTS.*central_live_bank_accreditations b/);
 assert.match(sql,/b\.amount_ars=o\.amount_ars/);
 assert.match(sql,/c\.phone AS telefono_contacto/);
 assert.match(sql,/k\.name AS nombre_cliente/);
 assert.equal((await res.json()).orders[0].productionAuthorized,undefined);
});
