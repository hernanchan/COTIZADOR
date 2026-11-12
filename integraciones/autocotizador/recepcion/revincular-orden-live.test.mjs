import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {revincularOrdenLive} from './revincular-orden-live.mjs';
import {iniciarSesionCompradorLive,autorizadoCompradorLive,autorizadoOrdenLive}
 from './sesion-comprador-live.mjs';
const HOST='https://pedidos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const OTHER='WEB-ENSAYO-'+'B'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const GO='GO_COMERCIAL_CONFIRMADO';
const ts=1794480000;
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_LIVE_SESSION_GATE:GO,DOCS_MP_LIVE_GATE:GO,
 DOCS_LIVE_SESSION_KEY:'LIVE-BUYER-COOKIE-KEY-DO-NOT-USE-IN-PRODUCTION-123',
 DOCS_LIVE_TURNSTILE_SECRET:'TEST-CLOUDFLARE-TURNSTILE-KEY-123456789',
 CENTRAL_BRIDGE_KEY:'TEST-PRIVATE-CENTRAL-HMAC-KEY-EXACT-MOCK-123456789'
};
const request=(refs={webOrderId:WEB,commercialOrderId:UUID},origin=HOST)=>{
 const h={Origin:origin,'Content-Type':'application/json'};
 return new Request(HOST+'/api/pedido/live/revincular',{method:'POST',
  headers:h,body:JSON.stringify(refs)});
};
function mock(expected=WEB){
 let calls=0;
 const service={async fetch(req){
  calls++;
  assert.equal(new URL(req.url).pathname,'/internal/central/live/status');
  assert.equal(req.method,'POST');
  const payload=await req.json();
  assert.deepEqual(Object.keys(payload).sort(),['commercialOrderId','schema','webOrderId']);
  assert.equal(payload.schema,'saber-mp-live-status-v1');
  const key=env.CENTRAL_BRIDGE_KEY;
  const t=req.headers.get('x-saber-ts'),rid=req.headers.get('x-saber-request-id');
  const data=JSON.stringify(payload);
  const expectedSig=createHmac('sha256',key).update(t+'\n'+rid+'\n'+data).digest('hex');
  assert.equal(req.headers.get('x-saber-signature'),expectedSig);
  if(payload.webOrderId!==expected||payload.commercialOrderId!==UUID)
   return Response.json({ok:false,error:'MP_LIVE_STATUS_ORDEN_AJENA'},{status:404});
  return Response.json({ok:true,webOrderId:expected,commercialOrderId:UUID,
   estado:'pendiente',amountArs:7524,fileCount:1,pendingFiles:1,
   productionAuthorized:false,uploadAuthorized:false});
 }};
 return {service,get calls(){return calls}};
}
const options={now:()=>ts,nonce:()=>UUID,subtle:webcrypto.subtle};
test('renueva vínculo sólo si la Central HMAC valida las dos referencias existentes',async()=>{
 const m=mock();const linked=[];
 const res=await revincularOrdenLive(request(),env,{authorized:true,
  service:m.service,...options,link:async(req,e,id)=>{
   linked.push(id);
   return 'saber_pedido_live_order_v1=SAFE; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict';
  }});
 assert.equal(res.status,200);
 assert.equal(m.calls,1);assert.deepEqual(linked,[WEB]);
 assert.match(res.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);
 const j=await res.json();assert.equal(j.recuperada,true);
 assert.equal(j.uploadAuthorized,false);assert.equal(j.productionAuthorized,false);
});
test('orden ajena no recibe cookie ni información sensible',async()=>{
 const m=mock();let linkCalls=0;
 const res=await revincularOrdenLive(request({webOrderId:OTHER,commercialOrderId:UUID}),
  env,{authorized:true,service:m.service,...options,
   link:async()=>{linkCalls++;return 'SECURITY_FAIL'}});
 assert.equal(res.status,404);assert.equal(linkCalls,0);
 assert.equal(res.headers.has('Set-Cookie'),false);
 assert.equal(m.calls,1);
 assert.doesNotMatch(JSON.stringify(await res.json()),/7524|WEB-ENSAYO/);
});
test('sin sesión comprador reciente, origen o referencias válidas no consulta Central',async()=>{
 const m=mock();
 const variants=[
  {req:request(),authorized:false,expect:401},
  {req:request({},'https://evil.example'),authorized:true,expect:403},
  {req:request({webOrderId:WEB,commercialOrderId:'000000'}),authorized:true,expect:422},
  {req:new Request(HOST+'/api/pedido/live/revincular',{method:'GET'}),authorized:true,expect:403}
 ];
 for(const v of variants){
  const r=await revincularOrdenLive(v.req,env,{...options,
   service:m.service,authorized:v.authorized});
  assert.equal(r.status,v.expect);
  assert.equal(r.headers.has('Set-Cookie'),false);
 }
 assert.equal(m.calls,0);
});
test('integración: Turnstile nuevo + vínculo firmado recuperado, sin reutilizar cookie vencida',async()=>{
 const login=new Request(HOST+'/api/pedido/live/sesion',{method:'POST',
  headers:{Origin:HOST,'Content-Type':'application/json'},
  body:JSON.stringify({token:'token-legitimo-de-prueba'})});
 const fresh=await iniciarSesionCompradorLive(login,env,{
  now:ts*1000,subtle:webcrypto.subtle,
  random:()=>Uint8Array.from({length:16},(_,i)=>i),
  fetcher:async()=>Response.json({success:true,hostname:'pedidos.libreriasaber.com.ar',
   action:'saber_pedido_live'})
 });
 assert.equal(fresh.status,200);
 const buyer=fresh.headers.get('Set-Cookie').split(';')[0];
 const req=request();
 req.headers.set('Cookie',buyer);
 assert.equal(await autorizadoCompradorLive(req,env,{
  now:ts*1000,subtle:webcrypto.subtle}),true);
 const m=mock();
 const res=await revincularOrdenLive(req,env,{authorized:true,
  service:m.service,...options,
  link:(request,e,orderId)=>import('./sesion-comprador-live.mjs').then(mod=>
   mod.vinculoOrdenLive(request,e,orderId,{now:ts*1000,subtle:webcrypto.subtle}))});
 assert.equal(res.status,200);
 const link=res.headers.get('Set-Cookie');
 assert.ok(link);
 const check=new Request(HOST+'/api/pedido/live/checkout',{
  headers:{Cookie:buyer+'; '+link.split(';')[0]}});
 assert.equal(await autorizadoOrdenLive(check,env,WEB,{
  now:ts*1000,subtle:webcrypto.subtle}),true);
 assert.equal(await autorizadoOrdenLive(check,env,OTHER,{
  now:ts*1000,subtle:webcrypto.subtle}),false);
});
