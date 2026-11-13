import test from 'node:test';
import assert from 'node:assert/strict';
import {rescatePersonalMPLive} from './rescate-personal-mp-live.mjs';
const HOST='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const make=({origin=HOST,method='POST',body='{}'}={})=>
 new Request(HOST+'/personal/api/live-reconcile',{method,
 headers:{Origin:origin,'Content-Type':'application/json'},
 ...(method==='POST'?{body}: {})});
test('personal no autorizado no puede iniciar reconciliación',async()=>{
 const r=await rescatePersonalMPLive(make(),{}, {authorized:false});
 assert.equal(r.status,401);
});
test('no admite origen ajeno, datos extras ni GET',async()=>{
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_STAFF_GATE:GO,CENTRAL_BRIDGE_KEY:'x'.repeat(40),
  SABER_CENTRAL:{fetch:async()=>{throw Error('NUNCA')}}};
 for(const r of [make({origin:'https://evil.invalid'}),make({body:'{"paymentId":"123"}'}),make({method:'GET'})]){
  const v=await rescatePersonalMPLive(r,env,{authorized:true});
  assert.notEqual(v.status,200);
 }
});
test('personal autorizado firma la solicitud y retorna solo contadores',async()=>{
 let calls=0;
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_STAFF_GATE:GO,CENTRAL_BRIDGE_KEY:'x'.repeat(40),
  SABER_CENTRAL:{fetch:async req=>{
   calls++;
   assert.equal(req.url,'https://pagos.libreriasaber.com.ar/internal/central/live/staff-reconcile');
   assert.match(req.headers.get('x-saber-signature'),/^[a-f0-9]{64}$/);
   const b=await req.json();
   assert.deepEqual(b,{schema:'saber-central-live-staff-reconcile-v1',purpose:'revisar-cobros-pendientes'});
   return Response.json({ok:true,revisados:1,recuperados:1,pendientes:0,enRevision:0,errores:0,yaConciliados:0})
  }}
 };
 const r=await rescatePersonalMPLive(make(),env,{authorized:true});
 assert.equal(r.status,200);
 assert.equal((await r.json()).recuperados,1);
 assert.equal(calls,1);
});
