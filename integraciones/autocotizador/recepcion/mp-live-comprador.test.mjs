import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {pagoMPLiveComprador} from './mp-live-comprador.mjs';
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+ 'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const body=(action='start')=>JSON.stringify({action,webOrderId:WEB,commercialOrderId:UUID});
const request=(action='start',origin=ORIGIN)=>new Request(ORIGIN+'/api/pedido/live/checkout',{
 method:'POST',headers:{'Origin':origin,'Content-Type':'application/json',
  'Sec-Fetch-Site':'same-origin'},body:body(action)});
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
 CENTRAL_LIVE_URL:'https://pagos.libreriasaber.com.ar/internal/central/live/checkout',
 CENTRAL_BRIDGE_KEY:'bridge-secret-very-long-for-testing-2026'
};
const NOW=1794320000, NONCE='123e4567-e89b-42d3-a456-426614174001';
const resultStart={ok:true,orderId:UUID,amountArs:24500,fileCount:1,
 checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=a'};
const resultStatus={ok:true,webOrderId:WEB,commercialOrderId:UUID,amountArs:24500,
 estado:'pagado_esperando_archivos',fileCount:1,pendingFiles:1,receivedFileIds:[],
 uploadAuthorized:true,productionAuthorized:false};
const run=async(req,environment=env,{authorized=true,out=resultStart,upstreamStatus=200}={})=>{
 const calls=[];
 const service={async fetch(request){
  const sent=await request.text();calls.push({url:request.url,
   headers:request.headers,body:JSON.parse(sent)});
  return Response.json(out,{status:upstreamStatus});
 }};
 const response=await pagoMPLiveComprador(req,environment,{
  authorized,service,now:()=>NOW,nonce:()=>NONCE,subtle:webcrypto.subtle
 });
 return {response,data:await response.json(),calls};
};
test('no hay ninguna llamada a Central con gate apagado, sin cookie o desde host no autorizado',async()=>{
 for(const patch of [
  {SABER_ENTORNO:'pruebas'},{CENTRAL_DB_ENV:'pruebas'},
  {DOCS_MP_LIVE_GATE:'NO_GO'},{CENTRAL_LIVE_URL:'https://saber-pagos-pruebas.workers.dev/internal/central/live/checkout'},
  {CENTRAL_BRIDGE_KEY:'short'}
 ]){
  const r=await run(request(),{...env,...patch});
  assert.equal(r.response.status,503);
  assert.equal(r.calls.length,0);
 }
 const withoutCookie=await run(request(),env,{authorized:false});
 assert.equal(withoutCookie.response.status,401);
 assert.equal(withoutCookie.calls.length,0);
 const cross=await run(request('start','https://site-malicioso.example'));
 assert.equal(cross.response.status,403);
 assert.equal(cross.calls.length,0);
});
test('start solo devuelve URL MP validada y envía firma HMAC para la misma orden',async()=>{
 const r=await run(request());
 assert.equal(r.response.status,200);
 assert.equal(r.data.commercialOrderId,UUID);
 assert.equal(r.data.amountArs,24500);
 assert.equal(r.data.fileCount,1);
 assert.equal(r.data.uploadAuthorized,false);
 assert.equal(r.calls.length,1);
 assert.equal(r.calls[0].url,'https://pagos.libreriasaber.com.ar/internal/central/live/checkout');
 assert.equal(r.calls[0].body.schema,'saber-mp-live-checkout-v1');
 assert.equal(r.calls[0].body.webOrderId,WEB);
 const message=NOW+'\n'+NONCE+'\n'+JSON.stringify(r.calls[0].body);
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hex=Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))).toString('hex');
 assert.equal(r.calls[0].headers.get('x-saber-signature'),hex);
 assert.equal(r.calls[0].headers.get('Authorization'),null);
});
test('status solo permite subida cuando Central LIVE conciliada responde paid',async()=>{
 const r=await run(request('status'),env,{out:resultStatus});
 assert.equal(r.response.status,200);
 assert.equal(r.data.estado,'pagado_esperando_archivos');
 assert.equal(r.data.uploadAuthorized,true);
 assert.equal(r.calls[0].body.schema,'saber-mp-live-status-v1');
 assert.equal(r.calls[0].url,'https://pagos.libreriasaber.com.ar/internal/central/live/status');
 for(const out of [
  {...resultStatus,uploadAuthorized:false},
  {...resultStatus,estado:'pendiente'},
  {...resultStatus,receivedFileIds:['pdf_a']},
  {...resultStatus,webOrderId:'WEB-ENSAYO-'+ 'B'.repeat(32)},
  {...resultStatus,productionAuthorized:true}
 ]){
  const response=await run(request('status'),env,{out});
  assert.equal(response.response.status,502);
 }
});
test('rechaza URL MP extraña, respuesta de otra orden y errores Central',async()=>{
 for(const bad of [
  {...resultStart,checkoutUrl:'https://evil.example/checkout'},
  {...resultStart,checkoutUrl:'http://www.mercadopago.com.ar/'},
  {...resultStart,orderId:'123e4567-e89b-42d3-a456-426614174099'},
  {...resultStart,fileCount:undefined},
  {...resultStart,fileCount:11}
 ]){
  const r=await run(request(),env,{out:bad});
  assert.equal(r.response.status,502);
 }
 const rejected=await run(request(),env,{upstreamStatus:409,out:{ok:false,error:'order'}});
 assert.equal(rejected.response.status,409);
 assert.equal(rejected.data.ok,false);
});
