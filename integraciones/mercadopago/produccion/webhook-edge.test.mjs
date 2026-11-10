import test from 'node:test';
import assert from 'node:assert/strict';
import {manejarWebhookPublico} from './webhook-edge.mjs';
const URL='https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live?type=payment&data.id=123456';
const req=(url=URL,method='POST',headers={})=>new Request(url,{
 method,headers:{'Content-Type':'application/json','x-signature':'ts=123,v1=firma',
  'x-request-id':'referencia-unica',...headers},...(method==='POST'?{body:JSON.stringify({type:'payment',data:{id:'123456'}})}:{})
});
const config=(overrides={})=>({
 SABER_ENTORNO:'produccion',WEBHOOK_EDGE_GATE:'GO_COMERCIAL_CONFIRMADO',
 ...overrides
});
test('webhook cerrado: ninguna solicitud cruza al Worker Central',async()=>{
 let count=0;
 const service={async fetch(){count++;return new Response(null,{status:200})}};
 for(const env of [config({SABER_ENTORNO:'preparacion'}),config({WEBHOOK_EDGE_GATE:'NO_GO'}),config({WEBHOOK_EDGE_GATE:undefined})]){
  const r=await manejarWebhookPublico(req(),env,{service});
  assert.equal(r.status,503);
 }
 assert.equal(count,0);
});
test('solo dominio y ruta de webhook; no se expone admin, checkout ni health',async()=>{
 let count=0;const service={fetch:async()=>{count++;return new Response(null,{status:200})}};
 for(const url of [
  'https://pagos.libreriasaber.com.ar/admin',
  'https://pagos.libreriasaber.com.ar/internal/central/live/checkout',
  'https://pagos.libreriasaber.com.ar/health',
  'https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live?type=payment&data.id=0',
  'https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live?type=merchant_order&data.id=123456',
  'https://otro.example/webhooks/mercadopago-live?type=payment&data.id=123456'
 ])assert.equal((await manejarWebhookPublico(req(url),config(),{service})).status,404);
 assert.equal(count,0);
});
test('webhook válido retransmite solo al servicio privado; central verifica la firma',async()=>{
 const calls=[];
 const service={async fetch(request){calls.push({url:request.url,method:request.method,
  sig:request.headers.get('x-signature')});return new Response(null,{status:200})}};
 const r=await manejarWebhookPublico(req(),config(),{service});
 assert.equal(r.status,200);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,URL);
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].sig,'ts=123,v1=firma');
});
test('firma o método faltante, origin ajeno y errores de Central se rechazan',async()=>{
 let count=0;
 const service={async fetch(){count++;return new Response(null,{status:401})}};
 assert.equal((await manejarWebhookPublico(req(),config(),{service})).status,401);
 assert.equal(count,1);
 assert.equal((await manejarWebhookPublico(req(URL,'GET'),config(),{service})).status,403);
 assert.equal((await manejarWebhookPublico(req(URL,'POST',{Origin:'https://evil.example'}),config(),{service})).status,403);
 assert.equal((await manejarWebhookPublico(req(URL,'POST',{'x-signature':''}),config(),{service})).status,401);
 assert.equal(count,2);
});
