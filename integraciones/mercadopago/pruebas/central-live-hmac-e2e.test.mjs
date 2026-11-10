import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {pagoMPLiveComprador} from '../../autocotizador/recepcion/mp-live-comprador.mjs';
import {leerFirmaInternaLive} from './central-live-bridge.mjs';

const UUID='123e4567-e89b-42d3-a456-426614174000';
const NONCE='123e4567-e89b-42d3-a456-426614174001';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const TS=1794320000;
const KEY='qa-nonproduction-only-unique-hmac-secret-with-48-bytes';
const GATE='GO_COMERCIAL_CONFIRMADO';
const common={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 CENTRAL_BRIDGE_KEY:KEY,MP_LIVE_GATE:GATE};
function buyerRequest(action){
 return new Request('https://pedidos.libreriasaber.com.ar/api/pedido/live/checkout',{
  method:'POST',headers:{Origin:'https://pedidos.libreriasaber.com.ar',
   'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},
  body:JSON.stringify({action,webOrderId:WEB,commercialOrderId:UUID})
 });
}
function bridge({centralKey=KEY,centralGate=GATE}={}){
 const hits=[];
 const centralEnv={...common,CENTRAL_BRIDGE_KEY:centralKey,
   MP_LIVE_WEBHOOK_SECRET:'secret-unrelated-to-internal-bridge',
   CENTRAL_LIVE_BRIDGE_ENABLED:centralGate};
 const service={async fetch(req){
  const signed=await leerFirmaInternaLive(req,centralEnv,{now:()=>TS,subtle:webcrypto.subtle});
  hits.push(signed);
  if(signed.error)return Response.json({ok:false},{status:signed.status});
  const {schema,webOrderId,commercialOrderId}=signed.payload;
  if(schema==='saber-mp-live-checkout-v1')
   return Response.json({ok:true,orderId:commercialOrderId,
    fileCount:1,amountArs:24500,checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=qa'});
  return Response.json({ok:true,webOrderId,commercialOrderId,
   fileCount:1,amountArs:24500,estado:'pagado_esperando_archivos',pendingFiles:1,
   receivedFileIds:[],uploadAuthorized:true,productionAuthorized:false});
 }};
 return {service,hits};
}
async function call(action,params={}){
 const {service,hits}=bridge(params);
 const env={...common,DOCS_MP_LIVE_GATE:params.buyerGate??GATE,
  CENTRAL_LIVE_URL:'https://pagos.libreriasaber.com.ar/internal/central/live/checkout',
  SABER_CENTRAL:service};
 const response=await pagoMPLiveComprador(buyerRequest(action),env,{
  authorized:true,service,now:()=>TS,nonce:()=>NONCE,subtle:webcrypto.subtle});
 return {response,body:await response.json(),hits};
}
test('e2e dos Workers: HMAC auténtico para checkout + número de archivos, sin pagos',async()=>{
 const {response,body,hits}=await call('start');
 assert.equal(response.status,200);
 assert.equal(hits.length,1);
 assert.deepEqual(hits[0].payload,
  {schema:'saber-mp-live-checkout-v1',webOrderId:WEB,commercialOrderId:UUID});
 assert.equal(body.fileCount,1);
 assert.equal(body.uploadAuthorized,false);
 assert.equal(body.productionAuthorized,false);
 assert.match(body.checkoutUrl,/mercadopago.com.ar/);
});
test('e2e estado HMAC firmado desde Documentos sin permitir producción',async()=>{
 const {response,body,hits}=await call('status');
 assert.equal(response.status,200);
 assert.equal(hits[0].payload.schema,'saber-mp-live-status-v1');
 assert.equal(body.fileCount,1);
 assert.equal(body.estado,'pagado_esperando_archivos');
 assert.equal(body.uploadAuthorized,true);
 assert.equal(body.productionAuthorized,false);
});
test('claves diferentes o gate de Central cerrada niegan el acceso, no hay aprobación',async()=>{
 for(const p of [{centralKey:'wrong-bridge-key-but-also-long-enough'},
   {centralGate:'NO_GO'}]){
  const {response,hits,body}=await call('status',p);
  assert.equal(hits.length,1);
  assert.ok(hits[0].error);
  assert.equal(response.status,503);
  assert.equal(body.ok,false);
 }
});
test('gate del comprador apagado no genera solicitud firmada ni envía datos a Central',async()=>{
 const {response,hits}=await call('start',{buyerGate:'NO_GO'});
 assert.equal(response.status,503);
 assert.equal(hits.length,0);
});
