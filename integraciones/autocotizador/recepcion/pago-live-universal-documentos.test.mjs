import test from 'node:test';
import assert from 'node:assert/strict';
import {pagoLiveUniversalDocumentos} from './pago-live-universal-documentos.mjs';
const ORDER='123e4567-e89b-42d3-a456-426614174000';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const BASE='https://pedidos.libreriasaber.com.ar/api/pedido/mp-live';
const mockRequest=(action='start',origin=new URL(BASE).origin)=>new Request(BASE,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({action,webOrderId:WEB,commercialOrderId:ORDER})
});
function setup(){
 const captured=[];
 const env={
  SABER_ENTORNO:'produccion',DOCS_LIVE_CHECKOUT_GATE:'GO_COMERCIAL_CONFIRMADO',
  MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',DOCS_CENTRAL_LIVE_DB_ENV:'produccion',
  DOCS_LIVE_BRIDGE_KEY:'live-'+ 'X'.repeat(45),
  CENTRAL_BRIDGE_KEY:'test-'+ 'Y'.repeat(45),
  DOCS_TURNSTILE_SECRET:'turnstile-'+ 'Z'.repeat(45),
  SABER_CENTRAL:{fetch:async()=>{throw Error('sandbox must never be invoked')}}
 };
 const live={fetch:async request=>{
  const url=new URL(request.url),body=await request.text();
  captured.push({path:url.pathname,body:JSON.parse(body),
   headers:Object.fromEntries(request.headers)});
  return Response.json({
   ok:true,webOrderId:WEB,commercialOrderId:ORDER,amountArs:4400,
   ...(url.pathname.endsWith('checkout')?
    {checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=LIVE-001'}:
    {fileCount:1,estado:'pagado_esperando_archivos',pendingFiles:1,
     receivedFileIds:[],uploadAuthorized:true,productionAuthorized:false})
  });
 }};
 env.SABER_CENTRAL_LIVE=live;
 return {env,captured};
}
test('sin sesión vinculada devuelve 401 sin llamar a Central',async()=>{
 const {env,captured}=setup();
 const r=await pagoLiveUniversalDocumentos(mockRequest(),env);
 assert.equal(r.status,401);assert.equal(captured.length,0);
});
test('ninguna bandera de ensayo habilita checkout LIVE',async()=>{
 const {env,captured}=setup();
 const r=await pagoLiveUniversalDocumentos(mockRequest(),
  {...env,SABER_ENTORNO:'ensayo'},{authorized:true});
 assert.equal(r.status,503);assert.equal(captured.length,0);
 const s=await pagoLiveUniversalDocumentos(mockRequest(),
  {...env,DOCS_LIVE_BRIDGE_KEY:env.CENTRAL_BRIDGE_KEY},{authorized:true});
 assert.equal(s.status,503);assert.equal(captured.length,0);
});
test('checkout requiere origen propio y firma de servicio independiente',async()=>{
 const {env,captured}=setup();
 const wrong=await pagoLiveUniversalDocumentos(mockRequest('start','https://evil.example'),env,{authorized:true});
 assert.equal(wrong.status,403);assert.equal(captured.length,0);
 const good=await pagoLiveUniversalDocumentos(mockRequest(),env,{
  authorized:true,now:()=>1762800000,nonce:()=>ORDER});
 assert.equal(good.status,200);
 const d=await good.json();assert.match(d.checkoutUrl,/mercadopago.com.ar/);
 assert.equal(d.uploadAuthorized,false);
 assert.equal(captured.length,1);
 assert.equal(captured[0].path,'/internal/central/live/checkout');
 assert.equal(captured[0].body.schema,'saber-mp-live-checkout-v1');
 assert.ok(/^[a-f0-9]{64}$/.test(captured[0].headers['x-saber-signature']));
 assert.equal(captured[0].headers.authorization,undefined);
});
test('consulta estado verificado en D1 sin autorizar producción',async()=>{
 const {env,captured}=setup();
 const r=await pagoLiveUniversalDocumentos(mockRequest('status'),env,{
  authorized:true,now:()=>1762800000,nonce:()=>ORDER});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.estado,'pagado_esperando_archivos');
 assert.equal(d.uploadAuthorized,true);assert.equal(d.productionAuthorized,false);
 assert.equal(captured[0].body.schema,'saber-mp-live-status-v1');
 assert.equal(captured[0].path,'/internal/central/live/status');
});
test('un resultado incoherente de Central nunca se acepta',async()=>{
 const {env}=setup();
 env.SABER_CENTRAL_LIVE={fetch:async()=>Response.json({
  ok:true,webOrderId:WEB,commercialOrderId:ORDER,amountArs:4400,
  fileCount:1,estado:'pendiente',pendingFiles:1,receivedFileIds:[],
  uploadAuthorized:true,productionAuthorized:false
 })};
 const r=await pagoLiveUniversalDocumentos(mockRequest('status'),env,{authorized:true});
 assert.equal(r.status,502);
});
