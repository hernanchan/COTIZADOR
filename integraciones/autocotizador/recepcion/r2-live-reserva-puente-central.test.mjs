import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {reservarCapacidadR2Live} from './r2-live-reserva-puente-central.mjs';
const ON='GO_COMERCIAL_CONFIRMADO',WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const KEY='CENTRAL_LIVE_HMAC_SECRET_R2_RESERVE_SEPARATE_123';
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:ON,DOCS_LIVE_RECEPCION_GATE:ON,DOCS_LIVE_R2_GATE:ON,
 CENTRAL_BRIDGE_KEY:KEY};
const p={orderId:WEB,fileId:'pdf_0',name:'Panel A1.pdf',
 sha256:'a'.repeat(64),bytes:60*1048576,pages:1,
 objectKey:'r2-v1/'+WEB+'/'+UUID+'.pdf'};
function mock(status=200,answer={ok:true,reserved:true,idempotent:false,
 webOrderId:WEB,fileId:'pdf_0',objectKey:p.objectKey,
 paymentAuthorized:false,uploadAuthorized:false,productionAuthorized:false}){
 const calls=[];
 return {calls,opts:{subtle:webcrypto.subtle,now:()=>1794320000,
  nonce:()=> '123e4567-e89b-42d3-a456-426614174001',
  service:{fetch:async req=>{calls.push(req);return Response.json(answer,{status})}}}};
}
test('sin permisos ni cuenta productiva no reserva ni invoca Central',async()=>{
 for(const patch of [{DOCS_LIVE_R2_GATE:'NO_GO'},
  {DOCS_LIVE_RECEPCION_GATE:'NO_GO'}, {SABER_ENTORNO:'preparacion'},
  {CENTRAL_DB_ENV:'pruebas'}]){
  const m=mock();
  await assert.rejects(reservarCapacidadR2Live({...env,...patch},p,m.opts),
   /LIVE_R2_RESERVA_OFF/);
  assert.equal(m.calls.length,0);
 }
});
test('reserva HMAC solo metadatos sin origin, token, ni archivo PDF',async()=>{
 const m=mock();
 const result=await reservarCapacidadR2Live(env,p,m.opts);
 assert.equal(result.uploadAuthorized,false);
 assert.equal(m.calls.length,1);
 const req=m.calls[0];
 assert.equal(req.url,'https://pagos.libreriasaber.com.ar/internal/central/live/r2-reserve');
 assert.equal(req.headers.has('Origin'),false);
 const data=await req.text();
 assert.deepEqual(JSON.parse(data),{schema:'saber-central-r2-universal-live-reserve-v1',...p});
 assert.equal(req.headers.get('x-saber-signature'),createHmac('sha256',KEY)
  .update(req.headers.get('x-saber-ts')+'\n'+req.headers.get('x-saber-request-id')+'\n'+data)
  .digest('hex'));
 assert.equal(data.includes('%PDF'),false);
});
test('objectKey y confirmación ajena no crean reserva',async()=>{
 const m=mock();
 await assert.rejects(reservarCapacidadR2Live(env,{
  ...p,objectKey:'r2-v1/'+WEB+'/not-a-uuid.pdf'},m.opts),/LIVE_R2_RESERVA_META/);
 assert.equal(m.calls.length,0);
 const bad=mock(200,{ok:true,reserved:true,idempotent:false,
  webOrderId:WEB,fileId:'pdf_0',objectKey:'r2-v1/'+WEB+'/other.pdf',
  paymentAuthorized:false,uploadAuthorized:false,productionAuthorized:false});
 await assert.rejects(reservarCapacidadR2Live(env,p,bad.opts),
  /LIVE_R2_RESERVA_INCONSISTENTE/);
});
test('rechaza cupo agotado en Central sin emitir permiso de upload',async()=>{
 const m=mock(429,{ok:false,error:'LIVE_R2_QUOTA_AGOTADA'});
 await assert.rejects(reservarCapacidadR2Live(env,p,m.opts),/LIVE_R2_CUPO_AGOTADO/);
});
