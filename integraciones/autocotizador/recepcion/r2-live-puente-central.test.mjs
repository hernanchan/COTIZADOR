import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {consultarPagoArchivoR2Live} from './r2-live-puente-central.mjs';
const ON='GO_COMERCIAL_CONFIRMADO',WEB='WEB-ENSAYO-'+'A'.repeat(32);
const KEY='LIVE_R2_HMAC_KEY_SEPARATE_FROM_OTHER_SECRETS_1234';
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:ON,DOCS_LIVE_RECEPCION_GATE:ON,
 DOCS_LIVE_R2_GATE:ON,CENTRAL_BRIDGE_KEY:KEY};
const meta={orderId:WEB,fileId:'pdf_0',name:'Panel.pdf',bytes:60*1048576,
 sha256:'a'.repeat(64),pages:1};
function fake(answer={ok:true,webOrderId:WEB,fileId:'pdf_0',
 sha256:'a'.repeat(64),bytes:60*1048576,pages:1,transport:'r2',
 paymentVerified:true,mode:'bn',expectedMetrics:[{anchoCm:59.4,altoCm:84.1}],
 uploadAuthorized:false,productionAuthorized:false},
 status=200){
 const calls=[];
 return {calls,opts:{subtle:webcrypto.subtle,now:()=>1794320000,
  nonce:()=> '123e4567-e89b-42d3-a456-426614174001',
  service:{fetch:async request=>{calls.push(request);return Response.json(answer,{status})}}}};
}
test('sin gates el Worker no contacta Central ni genera firma',async()=>{
 for(const patch of [{DOCS_LIVE_R2_GATE:'NO_GO'},
  {DOCS_LIVE_RECEPCION_GATE:'NO_GO'},
  {SABER_ENTORNO:'preparacion'},{CENTRAL_DB_ENV:'pruebas'}]){
  const {calls,opts}=fake();
  await assert.rejects(consultarPagoArchivoR2Live({...env,...patch},meta,opts),
   /LIVE_R2_NO_CONFIGURADO/);
  assert.equal(calls.length,0);
 }
});
test('HMAC R2 usa ruta LIVE, metadatos exactos y no envía originales',async()=>{
 const {calls,opts}=fake();
 const result=await consultarPagoArchivoR2Live(env,meta,opts);
 assert.equal(result.uploadAuthorized,false);
 assert.equal(calls.length,1);
 const req=calls[0];
 assert.equal(req.url,'https://pagos.libreriasaber.com.ar/internal/central/live/r2-gate');
 assert.equal(req.headers.has('Origin'),false);
 const body=await req.text();
 assert.deepEqual(JSON.parse(body),{schema:'saber-central-r2-universal-live-gate-v1',...meta});
 const expected=createHmac('sha256',KEY).update(
  req.headers.get('x-saber-ts')+'\n'+req.headers.get('x-saber-request-id')+'\n'+body
 ).digest('hex');
 assert.equal(req.headers.get('x-saber-signature'),expected);
 assert.equal(body.includes('%PDF'),false);
});
test('no acepta pago no conciliado ni respuesta de otra orden',async()=>{
 let f=fake({ok:false,error:'NO_PAID'},402);
 await assert.rejects(consultarPagoArchivoR2Live(env,meta,f.opts),
  /LIVE_R2_PAGO_NO_CONCILIADO/);
 f=fake({ok:true,webOrderId:'WEB-ENSAYO-'+'B'.repeat(32),
  fileId:'pdf_0',sha256:meta.sha256,bytes:meta.bytes,pages:1,
  transport:'r2',paymentVerified:true,uploadAuthorized:false,
  productionAuthorized:false});
 await assert.rejects(consultarPagoArchivoR2Live(env,meta,f.opts),
  /LIVE_R2_CENTRAL_NO_COINCIDE/);
});
test('no firma bytes fuera de R2 ni campos del comprador adicionales',async()=>{
 const {calls,opts}=fake();
 await assert.rejects(consultarPagoArchivoR2Live(env,
  {...meta,bytes:20*1048576},opts),/LIVE_R2_META_INVALIDA/);
 await assert.rejects(consultarPagoArchivoR2Live(env,
  {...meta,paid:true},opts),/LIVE_R2_META_INVALIDA/);
 assert.equal(calls.length,0);
});
