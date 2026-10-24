import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {prepararMixtoCentralFirmado} from '../integraciones/autocotizador/recepcion/preparar-mixto-central.mjs';
const key='private-documentos-central-bridge-for-tests-2026';
const doc='WEB-ENSAYO-MIXTO-20261024';
const pol='POL-'+'B'.repeat(24);
const id=randomUUID(),order=randomUUID();
const url='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/prepare-mixed-order';
const request={webOrderId:doc,polaroidReference:pol,clientOrderId:id,
 items:[{code:'ABC-1',qty:2}],subtle:webcrypto.subtle,requestId:randomUUID};
function backend({status=201,checkoutEnabled=false,enabled=true}={}){
 let calls=0;const env={DOCS_MIXED_PREPARE_ENABLED:enabled?'PRIVATE_TEST_ONLY':'',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:key,DOCS_CENTRAL_ADMIN_KEY:'different-admin-secret',
  DOCS_RELAY_KEY:'different-google-secret',
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
  SABER_CENTRAL:{async fetch(req){
   calls++;
   assert.equal(req.url,url);
   assert.equal(req.method,'POST');
   assert.equal(req.headers.get('Origin'),null);
   const ts=req.headers.get('x-saber-ts'),nonce=req.headers.get('x-saber-request-id');
   const body=await req.text();
   assert.equal(req.headers.get('x-saber-signature'),
    createHmac('sha256',key).update(ts+'\n'+nonce+'\n'+body).digest('hex'));
   assert.deepEqual(JSON.parse(body),{clientOrderId:id,webOrderId:doc,
    polaroidReference:pol,items:[{code:'ABC-1',qty:2}]});
   return Response.json({created:true,idempotent:false,
    commercial_order_id:order,amount_ars:31000,state:'awaiting_payment',
    checkoutEnabled,paymentAuthorized:false},{status});
  }}};
 return {env,calls:()=>calls};
}
test('compra mixta usa únicamente Service Binding y firma HMAC sin checkout',async()=>{
 const s=backend();
 const result=await prepararMixtoCentralFirmado({...request,env:s.env});
 assert.equal(result.created,true);
 assert.equal(result.amountArs,31000);
 assert.equal(result.checkoutEnabled,false);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.commercialOrderId,order);
 assert.equal(s.calls(),1);
});
test('sin permiso exclusivo o sin binding rechaza sin transmitir',async()=>{
 const s=backend({enabled:false});
 await assert.rejects(()=>prepararMixtoCentralFirmado({...request,env:s.env}),/deshabilitada/);
 await assert.rejects(()=>prepararMixtoCentralFirmado({...request,
  env:{...s.env,DOCS_MIXED_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',SABER_CENTRAL:null}}),/deshabilitada/);
 assert.equal(s.calls(),0);
});
test('referencias, catálogo o destino maliciosos no invocan Central',async()=>{
 const s=backend();
 for(const args of [
  {...request,webOrderId:'random'},
  {...request,polaroidReference:'POL-O'},
  {...request,items:[{code:'ABC-1',qty:1},{code:'ABC-1',qty:2}]},
  {...request,clientOrderId:'wrong'},
  {...request,env:{...s.env,CENTRAL_TEST_URL:'https://evil.example/internal/central/stage'}}
 ]){
  await assert.rejects(()=>prepararMixtoCentralFirmado({env:s.env,...args}));
 }
 assert.equal(s.calls(),0);
});
test('no acepta que Central habilite pago o dé una respuesta inesperada',async()=>{
 const bad=backend({checkoutEnabled:true});
 await assert.rejects(()=>prepararMixtoCentralFirmado({...request,env:bad.env}),/cobro/);
 const conflict=backend({status:409});
 await assert.rejects(()=>prepararMixtoCentralFirmado({...request,env:conflict.env}),/no confirmó/);
});
