import test from 'node:test';
import assert from 'node:assert/strict';
import {listarRecepcionUniversalLive} from './central-recepcion-live.mjs';
const gate='GO_COMERCIAL_CONFIRMADO';
const url='https://pagos.libreriasaber.com.ar/admin/api/central/live-recepcion';
const web='WEB-ENSAYO-'+'A'.repeat(32);
const order='123e4567-e89b-42d3-a456-426614174000';
const rows=[
 {order_id:order,web_order_id:web,work_number:18,file_count:2,total_ars:4700,
  paid_at:'2026-11-10 18:30:00',received_count:1,pending_count:1,tus_count:1,r2_count:1},
 {order_id:'123e4567-e89b-42d3-a456-426614174001',
  web_order_id:'WEB-ENSAYO-'+'B'.repeat(32),work_number:19,file_count:1,total_ars:1000,
  paid_at:'2026-11-10 18:40:00',received_count:1,pending_count:0,tus_count:1,r2_count:0}
];
const envWith=(items=rows)=>{
 const queries=[];
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  CENTRAL_LIVE_BOARD_GATE:gate,MP_LIVE_GATE:gate,
  CENTRAL_LIVE_BRIDGE_ENABLED:gate,
  DB:{prepare(sql){queries.push(sql);return {all:async()=>({results:items})}}}};
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
  'PAGADO_ESPERANDO_ORIGINALES','ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE']);
 assert.ok(body.orders.every(x=>x.readyForProduction===false&&x.zipEnabled===false));
 assert.equal(body.productionAuthorized,false);
 assert.equal(queries.length,1);
 assert.match(queries[0],/p\.state='verified'/);
 assert.match(queries[0],/o\.status='paid'/);
 assert.match(queries[0],/o\.payment_id IS NOT NULL/);
 assert.doesNotMatch(queries[0],/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\b/i);
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
