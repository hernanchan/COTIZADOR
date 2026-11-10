import test from 'node:test';
import assert from 'node:assert/strict';
import {reservarR2Live} from './r2-universal-live-reserve-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const p={schema:'saber-central-r2-universal-live-reserve-v1',
 orderId:WEB,fileId:'pdf_0',name:'Panel A1.pdf',
 sha256:'a'.repeat(64),bytes:60*1048576,pages:1,
 objectKey:'r2-v1/'+WEB+'/'+UUID+'.pdf'};
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:GO,CENTRAL_LIVE_BRIDGE_ENABLED:GO,
 CENTRAL_LIVE_POSTPAY_GATE:GO,CENTRAL_LIVE_R2_GATE:GO,
 CENTRAL_LIVE_R2_QUOTA_GATE:GO,
 CENTRAL_LIVE_ORDER_GATE:GO,CENTRAL_LIVE_PRICING_GATE:GO};
function fake(){
 const calls=[];
 return {calls,prepare(sql){
  calls.push(sql);let args=[];
  return {bind(...v){args=v;return this},
   async first(){return null},
   async run(){return {meta:{changes:1}}},
   get args(){return args}};
 }};
}
const accepted=async(req,env,{readSigned})=>{
 const signed=await readSigned(req,env);
 return Response.json({ok:true,paymentVerified:true,
  webOrderId:signed.payload.orderId,fileId:signed.payload.fileId,
  sha256:signed.payload.sha256,bytes:signed.payload.bytes});
};
const signed=async()=>({payload:p});
const request=()=>new Request('https://pagos.libreriasaber.com.ar/internal/central/live/r2-reserve',{
 method:'POST'});
test('sin gates no lee DB ni validación de pago',async()=>{
 for(const patch of [{CENTRAL_LIVE_R2_QUOTA_GATE:'NO_GO'},
  {CENTRAL_LIVE_R2_GATE:'NO_GO'},{MP_LIVE_GATE:'NO_GO'},
  {CENTRAL_DB_ENV:'pruebas'},{CENTRAL_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY'}]){
  const db=fake();let checks=0;
  const result=await reservarR2Live(request(),{...env,...patch,DB:db},{
   readSigned:signed,verify:async()=>{checks++;throw Error('must not call')}});
  assert.equal(result.status,503);assert.equal(db.calls.length,0);assert.equal(checks,0);
 }
});
test('si el pago no está confirmado no reserva bytes',async()=>{
 const db=fake();
 const r=await reservarR2Live(request(),{...env,DB:db},{
  readSigned:signed,verify:async()=>Response.json({ok:false}, {status:402})});
 assert.equal(r.status,402);assert.equal(db.calls.length,0);
});
test('firma distinta o objectKey ajeno se rechazan sin reservar',async()=>{
 const db=fake();let checks=0;
 const r=await reservarR2Live(request(),{...env,DB:db},{
  readSigned:async()=>({payload:{...p,objectKey:'r2-v1/otra-orden/'+UUID+'.pdf'}}),
  verify:async()=>{checks++;return accepted()}});
 assert.equal(r.status,422);assert.equal(checks,0);assert.equal(db.calls.length,0);
});
test('reserva productiva: verifica pago antes de INSERT y limita 2GiB, 1GiB y 10 PDF',async()=>{
 const db=fake();let checkCalls=0;
 const r=await reservarR2Live(request(),{...env,DB:db},{
  readSigned:signed,verify:async(...args)=>{checkCalls++;return accepted(...args)}});
 assert.equal(r.status,201);
 const res=await r.json();
 assert.equal(res.reserved,true);assert.equal(res.uploadAuthorized,false);
 assert.equal(checkCalls,1);assert.equal(db.calls.length,2);
 const sql=db.calls[1];
 assert.match(sql,/INSERT INTO central_r2_large_reservations/);
 assert.match(sql,/SUM\(bytes\)/);
 assert.match(sql,/COUNT\(\*\)/);
 assert.doesNotMatch(sql,/CREATE TABLE|DROP TABLE|UPDATE orders|DELETE FROM/);
});
test('sin cupo no reserva, falla con 429',async()=>{
 const db=fake();const original=db.prepare.bind(db);
 db.prepare=sql=>{
  const q=original(sql);
  if(sql.startsWith('INSERT'))q.run=async()=>({meta:{changes:0}});
  return q;
 };
 const r=await reservarR2Live(request(),{...env,DB:db},{
  readSigned:signed,verify:accepted});
 assert.equal(r.status,429);
 assert.equal((await r.json()).ok,false);
});
