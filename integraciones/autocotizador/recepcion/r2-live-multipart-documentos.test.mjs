import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {manejarR2MultipartLive} from './r2-live-multipart-documentos.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',HOST='https://pedidos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const meta={fileId:'pdf_0',name:'Panel.pdf',mode:'bn',
 bytes:60*1048576,pages:1,sha256:'a'.repeat(64)};
function fixture(){
 const calls=[];
 const bucket={
  async createMultipartUpload(key){calls.push({type:'create',key});return {
   uploadId:'MOCK_CLOUDFLARE_R2_MULTIPART_UPLOAD_ID_12345',
   abort:async()=>{calls.push({type:'abort'})}};},
  resumeMultipartUpload(key,id){calls.push({type:'resume',key,id});return {
   uploadPart:async()=>{calls.push({type:'part'});return {partNumber:1,etag:'etag_123456'}},
   complete:async()=>{calls.push({type:'complete'});return {ok:true}}
  }},
  async head(){calls.push({type:'head'});return {size:meta.bytes}},
  async get(){calls.push({type:'get'});return null}
 };
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_RECEPCION_GATE:GO,
  DOCS_LIVE_R2_GATE:GO,DOCS_LIVE_R2_UPLOAD_GATE:GO,
  DOCS_LIVE_R2_STAGING_GATE:GO,
  DOCS_LIVE_R2_RECEIPT_KEY:'LIVE_R2_SECRET_INDEPENDENT_123456789_ABCD',
  CENTRAL_BRIDGE_KEY:'LIVE_CENTRAL_HMAC_SEPARATE_NOT_REAL_123456789',
  SABER_R2_GRANDES_LIVE:bucket};
 const trusted={ok:true,paymentVerified:true,
  mode:'bn',expectedMetrics:[{anchoCm:59.4,altoCm:84.1}],
  uploadAuthorized:false};
 const opts={
  authorized:true,buyer:async()=>true,subtle:webcrypto.subtle,
  now:()=>1794320000,uuid:()=>UUID,
  verify:async()=>trusted,
  reserve:async(_env,p)=>{calls.push({type:'reserve',key:p.objectKey});
   return {ok:true,reserved:true,objectKey:p.objectKey}}
 };
 const request=(action,p,method='POST')=>new Request(
  HOST+'/api/pedido/live/r2/'+action,{method,
   headers:{Origin:HOST,'Content-Type':'application/json'},
   body:JSON.stringify(p)});
 return {calls,env,opts,request};
}
test('R2 jamás usa bucket si pago, sesión, gate o binding son inválidos',async()=>{
 for(const [patch,auth] of [[{DOCS_LIVE_R2_UPLOAD_GATE:'NO_GO'},true],
  [{DOCS_MP_LIVE_GATE:'NO_GO'},true],
  [{SABER_ENTORNO:'preparacion'},true],
  [{},false]]){
  const f=fixture();let checked=0;
  const r=await manejarR2MultipartLive(f.request('iniciar',{orderId:WEB,meta}),
   {...f.env,...patch},{...f.opts,authorized:auth,
    verify:async()=>{checked++;throw Error('not allowed')}});
  assert.equal(r.status,503);assert.equal(f.calls.length,0);assert.equal(checked,0);
 }
});
test('sin pago D1 o identidad de comprador no se reserva ni se crea multipart',async()=>{
 const f=fixture();
 const r=await manejarR2MultipartLive(f.request('iniciar',{orderId:WEB,meta}),
  f.env,{...f.opts,verify:async()=>{throw Error('NO_PAYMENT')}});
 assert.equal(r.status,409);assert.equal(f.calls.length,0);
 const buyer=fixture();
 const denial=await manejarR2MultipartLive(buyer.request('iniciar',{orderId:WEB,meta}),
  buyer.env,{...buyer.opts,buyer:async()=>false});
 assert.equal(denial.status,403);assert.equal(buyer.calls.length,0);
});
test('reserva D1 atómica sucede antes de crear multipart privado',async()=>{
 const f=fixture();
 const r=await manejarR2MultipartLive(f.request('iniciar',{orderId:WEB,meta}),
  f.env,f.opts);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 const data=await r.json();
 assert.equal(data.ok,true);assert.equal(data.quotaReserved,true);
 assert.equal(data.storageReady,false);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(data.productionAuthorized,false);
 assert.deepEqual(f.calls.map(x=>x.type),['reserve','create']);
 assert.equal(f.calls[0].key,'r2-v1/'+WEB+'/'+UUID+'.pdf');
 assert.equal(f.calls[1].key,f.calls[0].key);
 assert.match(data.session.proof,/^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$/);
});
test('reservar cupo fallido nunca crea carga en R2',async()=>{
 const f=fixture();
 const r=await manejarR2MultipartLive(f.request('iniciar',{orderId:WEB,meta}),
  f.env,{...f.opts,reserve:async()=>{throw Error('LIVE_R2_CUPO_AGOTADO')}});
 assert.equal(r.status,429);assert.equal(f.calls.length,0);
});
test('una sesión firmada no evita reválida de pago en cada operación',async()=>{
 const f=fixture();
 const started=await manejarR2MultipartLive(f.request('iniciar',{orderId:WEB,meta}),
  f.env,f.opts);
 const proof=(await started.json()).session.proof;
 f.calls.length=0;
 const r=await manejarR2MultipartLive(f.request('completar',{proof,uploadedParts:[]}),
  f.env,{...f.opts,verify:async()=>{throw Error('NO_PAYMENT')}});
 assert.equal(r.status,409);
 assert.equal(f.calls.length,0);
});
