import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {iniciarTUSUniversalLive,confirmarTUSUniversalLive} from './tus-live-recepcion-documentos.mjs';
const LIVE='GO_COMERCIAL_CONFIRMADO';
const HOST='https://pedidos.libreriasaber.com.ar';
const ORDER='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const BYTES=new TextEncoder().encode('%PDF-1.7 small original');
const SHA=createHash('sha256').update(BYTES).digest('hex');
const meta={fileId:'pdf_0',name:'Apunte.pdf',mode:'bn',bytes:BYTES.length,sha256:SHA,pages:1};
const valid={...meta};
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:LIVE,DOCS_LIVE_RECEPCION_GATE:LIVE,DOCS_LIVE_TUS_GATE:LIVE,
 DOCS_LIVE_TUS_PROJECT_URL:'https://abcdefghijklmnop.storage.supabase.co/',
 DOCS_LIVE_TUS_BUCKET:'saber-tus-live',
 DOCS_LIVE_TUS_SERVICE_KEY:'LIVE_SERVICE_ROLE_DEMONSTRATION_NOT_REAL_123456789',
 DOCS_LIVE_TUS_PUBLISHABLE_KEY:'LIVE_PUBLIC_KEY_DEMO_NOT_REAL_1234567890',
 DOCS_LIVE_TUS_RECEIPT_KEY:'LIVE_RECEIPT_HMAC_NOT_REAL_SECRET_123456789',
 CENTRAL_BRIDGE_KEY:'LIVE_CENTRAL_HMAC_SEPARATE_NOT_REAL_123456789'
};
const request=(type,data)=>new Request(HOST+'/api/pedido/live/tus/'+type,{
 method:'POST',headers:{Origin:HOST,'Content-Type':'application/json'},
 body:JSON.stringify(data)
});
const gate=async(_env,action,data)=>{
 if(action==='received')return {ok:true,webOrderId:ORDER,fileId:meta.fileId,
  saved:true,idempotent:false,productionAuthorized:false};
 return {ok:true,webOrderId:ORDER,fileId:meta.fileId,
  uploadAuthorized:true,productionAuthorized:false,mode:'bn',
  name:meta.name,bytes:meta.bytes,sha256:meta.sha256,pages:1,
  expectedMetrics:[{anchoCm:21,altoCm:29.7}]};
};
const opts={
 authorized:true,subtle:webcrypto.subtle,
 uuid:()=>UUID,now:()=>1794320000,gate
};
const signUrl=env.DOCS_LIVE_TUS_PROJECT_URL+'storage/v1/object/upload/sign/'+env.DOCS_LIVE_TUS_BUCKET;
test('TUS LIVE falla antes de consultar Storage si falta permiso o se usa bucket de ensayo',async()=>{
 for(const [patch,auth] of [[{DOCS_LIVE_TUS_GATE:'NO_GO'},true],
  [{SABER_ENTORNO:'preparacion'},true],
  [{DOCS_LIVE_TUS_BUCKET:'saber-tus-lab'},true],[{},false],
  [{DOCS_LIVE_TUS_PROJECT_URL:'https://qkbbqzbannyhuanngjpw.storage.supabase.co/'},true],
  [{DOCS_LIVE_TUS_RECEIPT_KEY:env.CENTRAL_BRIDGE_KEY},true]]){
  let calls=0;
  const r=await iniciarTUSUniversalLive(request('iniciar',{orderId:ORDER,metas:[meta]}),
   {...env,...patch},{...opts,authorized:auth,
    fetcher:async()=>{calls++;throw Error('FORBIDDEN')}});
  assert.equal(r.status,503);
  assert.equal(calls,0);
 }
});
test('iniciar TUS solo tras gate de pago y firma para el bucket productivo propio',async()=>{
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push({url,init});
  return Response.json({token:'SIGNED_PRIVATE_TUS_TOKEN_12345'});
 };
 const r=await iniciarTUSUniversalLive(request('iniciar',{orderId:ORDER,metas:[meta]}),
  env,{...opts,fetcher});
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 const result=await r.json();
 assert.equal(result.ok,true);
 assert.equal(result.sessions.length,1);
 assert.equal(result.sessions[0].fileId,meta.fileId);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(calls.length,1);
 assert.ok(calls[0].url.startsWith(signUrl));
 assert.equal(calls[0].init.headers.apikey,env.DOCS_LIVE_TUS_SERVICE_KEY);
 assert.equal(result.projectRef,'abcdefghijklmnop');
 assert.equal(result.bucket,'saber-tus-live');
 assert.notEqual(result.projectRef,'qkbbqzbannyhuanngjpw');
});
test('pedido impago no emite token ni consulta Storage',async()=>{
 let storage=0;
 const r=await iniciarTUSUniversalLive(request('iniciar',{orderId:ORDER,metas:[meta]}),
  env,{...opts,gate:async()=>{throw Error('NO_PAYMENT')},
   fetcher:async()=>{storage++;throw Error('NO_UPLOAD')}});
 assert.equal(r.status,402);
 assert.equal(storage,0);
});
test('confirmar solo con prueba HMAC, SHA, medidas y recibo D1',async()=>{
 let proof;const fetcher=async(url,init)=>{
  if(url.includes('/upload/sign/'))return Response.json({token:'SIGNED_PRIVATE_TUS_TOKEN_12345'});
  assert.ok(url.includes('/storage/v1/object/'));
  assert.ok(url.includes('/saber-tus-live/v2/'));
  return new Response(BYTES,{headers:{'Content-Length':String(BYTES.length)}});
 };
 const signed=await iniciarTUSUniversalLive(request('iniciar',{orderId:ORDER,metas:[meta]}),
  env,{...opts,fetcher});
 proof=(await signed.json()).sessions[0].proof;
 const r=await confirmarTUSUniversalLive(request('confirmar',{orderId:ORDER,
  entries:[{proof}]}),env,{...opts,fetcher,measure:async()=>({
   pageCount:1,pageMetrics:[{anchoCm:21,altoCm:29.7}]
  })});
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 const data=await r.json();
 assert.equal(data.savedFiles,1);
 assert.equal(data.productionAuthorized,false);
});
test('confirmar rechaza PDF alterado sin registrar D1',async()=>{
 const fetcher=async(url)=>{
  if(url.includes('/upload/sign/'))return Response.json({token:'SIGNED_PRIVATE_TUS_TOKEN_12345'});
  return new Response(new TextEncoder().encode('%PDF-1.7 other file'));
 };
 const signed=await iniciarTUSUniversalLive(request('iniciar',{orderId:ORDER,metas:[meta]}),
  env,{...opts,fetcher});
 const proof=(await signed.json()).sessions[0].proof;
 let saved=0;
 const r=await confirmarTUSUniversalLive(request('confirmar',{orderId:ORDER,
  entries:[{proof}]}),env,{...opts,fetcher,gate:async(_env,action,data)=>{
   if(action==='received')saved++;
   return gate(_env,action,data);
  },measure:async()=>({pageCount:1,pageMetrics:[{anchoCm:21,altoCm:29.7}]})});
 assert.equal(r.status,409);
 assert.equal(saved,0);
});
