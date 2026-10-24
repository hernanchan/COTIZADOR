import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {onRequestGet,onRequestPost} from '../integraciones/polaroids/express/worker-order.mjs';

const hostname='saber-polaroids-express-pruebas.pages.dev',origin='https://'+hostname;
const reference='POL-'+'E'.repeat(24);
const commercialId=randomUUID(),clientOrderId=randomUUID();
const key='test-central-bridge-separate-secret-123456789';
const config={enabled:true,rollout:'APROBADO',delivery:'express-pdf-only',
  maxSheetsForRealUploads:4,allowedHost:hostname,turnstileSiteKey:'0xTEST_ONLY'};
function env(){
 let centralCalls=0;
 const state={EXPRESS_ALLOWED_HOST:hostname,
  EXPRESS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_RECEPTION_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_PDF_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_TURNSTILE_SECRET:'turnstile-test-private-secret-123456',
  EXPRESS_PDF_HMAC_KEY:'different-pdf-key-private-12345678',
  CENTRAL_BRIDGE_KEY:key,
  CENTRAL_EXPRESS_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage',
  ASSETS:{fetch:async()=>Response.json(config)},
  SABER_CENTRAL:{async fetch(req){
   centralCalls++;
   assert.equal(req.url,'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-prepare-order');
   assert.equal(req.headers.get('Origin'),null);
   const ts=req.headers.get('x-saber-ts'),id=req.headers.get('x-saber-request-id'),body=await req.text();
   assert.equal(req.headers.get('x-saber-signature'),
    createHmac('sha256',key).update(ts+'\n'+id+'\n'+body).digest('hex'));
   assert.deepEqual(JSON.parse(body),{clientOrderId,referencia:reference,items:[]});
   return Response.json({created:true,idempotent:false,commercial_order_id:commercialId,
     amount_ars:3000,state:'awaiting_payment',checkoutEnabled:false,paymentAuthorized:false},{status:201});
  }}};
 return {state,calls:()=>centralCalls};
}
const body=()=>({clientOrderId,referencia:reference,items:[],turnstileToken:'verified-turnstile'});
const request=(payload=body(),headers={})=>new Request(origin+'/api/polaroids-order',{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin',...headers},
 body:JSON.stringify(payload)});
const validChallenge=async url=>{
 assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
 return Response.json({success:true,hostname,action:'polaroids-express'});
};
test('nueva ruta comercial permanece bloqueada con interruptores apagados por defecto',async()=>{
 const h=env();
 const result=await onRequestPost({request:request(),env:{...h.state,EXPRESS_ORDER_PREPARE_ENABLED:''},fetcher:validChallenge});
 assert.equal(result.status,503);
 assert.equal(h.calls(),0);
 assert.equal((await onRequestGet()).status,405);
});
test('recibe pedido verificado pero nunca activa checkout ni entrega PDF',async()=>{
 const h=env();
 const response=await onRequestPost({request:request(),env:h.state,fetcher:validChallenge});
 assert.equal(response.status,201);
 const result=await response.json();
 assert.deepEqual(result,{ok:true,orderId:commercialId,amountArs:3000,
  created:true,idempotent:false,checkoutEnabled:false,paymentAuthorized:false});
 assert.equal(h.calls(),1);
});
test('no consulta Central con origen incorrecto o Turnstile fallido',async()=>{
 const h=env();
 const bad=await onRequestPost({request:request(body(),{Origin:'https://attacker.example'}),
  env:h.state,fetcher:validChallenge});
 assert.equal(bad.status,403);
 const failed=await onRequestPost({request:request(),env:h.state,
  fetcher:async()=>Response.json({success:false})});
 assert.equal(failed.status,403);
 assert.equal(h.calls(),0);
});
test('rechaza solicitudes incompletas y recepción todavía cerrada',async()=>{
 const h=env();
 const invalid=await onRequestPost({request:request({...body(),pdfBase64:'bad'}),
   env:h.state,fetcher:validChallenge});
 assert.equal(invalid.status,400);
 const closed=await onRequestPost({request:request(),env:{...h.state,ASSETS:{
   fetch:async()=>Response.json({...config,enabled:false})}},fetcher:validChallenge});
 assert.equal(closed.status,503);
 assert.equal(h.calls(),0);
});
