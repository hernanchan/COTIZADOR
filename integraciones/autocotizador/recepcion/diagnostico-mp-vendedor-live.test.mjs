import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticarVendedorMPLive} from '../../mercadopago/pruebas/mercadopago-live-central.mjs';
import {leerFirmaInternaLive} from '../../mercadopago/pruebas/central-live-bridge.mjs';
import {diagnosticarVendedorMPDesdeDocs} from './diagnostico-mp-vendedor-live.mjs';
const secret='1'.repeat(64);
const docEnv={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
 DOCS_LIVE_MP_DIAG_TOKEN:secret,CENTRAL_BRIDGE_KEY:'B'.repeat(50)};
const url='https://pedidos.libreriasaber.com.ar/api/pedido/live/diagnostico-mp';
test('sin secreto temporal o con token ajeno nunca consulta Central',async()=>{
 let calls=0;const service={fetch:async()=>{calls++;throw Error('UNEXPECTED')}};
 for(const [env,token,status] of [
  [{...docEnv,DOCS_LIVE_MP_DIAG_TOKEN:null},secret,404],
  [docEnv,'a'.repeat(64),401],
  [docEnv,undefined,401]
 ]){
  const r=await diagnosticarVendedorMPDesdeDocs(new Request(url,{method:'POST',headers:token?{'x-saber-mp-diag':token}:{}}),env,{service});
  assert.equal(r.status,status);
 }
 assert.equal(calls,0);
});
test('diagnóstico autenticado usa un único GET interno, sin pedido ni cobro',async()=>{
 const seen=[];
 const service={fetch:async r=>{seen.push(r);return Response.json({ok:false,code:'MP_LIVE_RED_FETCH_FALLO'},{status:503})}};
 const r=await diagnosticarVendedorMPDesdeDocs(new Request(url,{
  method:'POST',headers:{'x-saber-mp-diag':secret}
 }),docEnv,{service});
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{ok:false,code:'MP_LIVE_RED_FETCH_FALLO'});
 assert.equal(seen.length,1);
 const internal=seen[0];assert.equal(new URL(internal.url).pathname,'/internal/central/live/diag-seller');
 assert.equal(internal.method,'POST');
 assert.match(internal.headers.get('x-saber-signature'),/^[a-f0-9]{64}$/);
 const body=await internal.json();
 assert.equal(body.schema,'saber-mp-live-seller-diagnostic-v1');
 assert.equal(body.purpose,'verificar-cuenta-solo-lectura');
});
test('diagnóstico Central no puede consultar MP sin firmar ni crear pedidos',async()=>{
 const env={SABER_ENTORNO:'preparacion'};
 let called=0;
 const r=await diagnosticarVendedorMPLive(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/diag-seller',{method:'POST'}),env,{
  readSigned:async()=>{called++;return{payload:{schema:'saber-mp-live-seller-diagnostic-v1',purpose:'verificar-cuenta-solo-lectura'}}},
  fetcher:async()=>{called++;throw Error('never')}
 });
 assert.equal(r.status,503);assert.equal(called,0);
});

test('puente HMAC real firma petición temporal hasta /users/me, nunca crea preferencia',async()=>{
 const urls=[];
 const central={
  SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
  CENTRAL_LIVE_BRIDGE_ENABLED:'GO_COMERCIAL_CONFIRMADO',
  CENTRAL_BRIDGE_KEY:docEnv.CENTRAL_BRIDGE_KEY,
  MP_LIVE_ACCESS_TOKEN:'APP_USR-'+'x'.repeat(64),
  MP_LIVE_SELLER_ID:'123456789',MP_LIVE_WEBHOOK_SECRET:'w'.repeat(48),
  MP_LIVE_WEBHOOK_URL:'https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live',
  MP_LIVE_RETURN_URL:'https://pedidos.libreriasaber.com.ar/pedido/estado',
  DB:{prepare:()=>({})}
 };
 const service={fetch:async request=>diagnosticarVendedorMPLive(request,central,{
  readSigned:leerFirmaInternaLive,
  fetcher:async(url,options)=>{
   urls.push({path:new URL(url).pathname,method:options?.method||'GET'});
   return Response.json({id:'123456789',test_user:false,tags:[]});
  }
 })};
 const res=await diagnosticarVendedorMPDesdeDocs(new Request(url,{
  method:'POST',headers:{'x-saber-mp-diag':secret}
 }),docEnv,{service});
 assert.equal(res.status,200,JSON.stringify(await res.clone().json()));
 assert.deepEqual(await res.json(),{ok:true,code:'MP_LIVE_VENDEDOR_VALIDADO'});
 assert.deepEqual(urls,[{path:'/users/me',method:'GET'}]);
});
