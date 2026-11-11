import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {guardarBorradorUniversalLive,crearOrdenUniversalLive} from './ordenes-universales-live-documentos.mjs';
const origin='https://pedidos.libreriasaber.com.ar';
const gate='GO_COMERCIAL_CONFIRMADO';
const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const draftId='123e4567-e89b-42d3-a456-426614174000';
const commercialOrderId='123e4567-e89b-42d3-a456-426614174010';
const hash='a'.repeat(64);
const key='LIVE_SECRET_SEPARATE_FROM_THE_OTHER_SERVICES_123';
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
 DOCS_LIVE_ORDER_GATE:gate,CENTRAL_BRIDGE_KEY:key};
const draftFixture={webOrderId,archivos:[],manifiestos:[]};
const orderFixture={webOrderId,draftId,quoteHash:hash,telefono:'351 5554444',
 nombre:'Ana Pérez',direccion:'Poeta Lugones 123, Córdoba'};
function request(path,payload,host=origin){
 return new Request(host+path,{method:'POST',headers:{
  Origin:host,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
function opts(answer,records){
 return {authorized:true,subtle:webcrypto.subtle,
  now:()=>1794320000,nonce:()=> '123e4567-e89b-42d3-a456-426614174001',
  priceLoader:async()=>({prices:{schema:'saber-web-prices-v1'}}),
  quoteBuilder:()=>({schema:'saber-r2-universal-draft-v1',
   webOrderId,archivos:[{fileId:'f-1'}],totalArs:24500,
   priceRevision:'d1-approved-revision-1',pagoAutorizado:false,
   subidaAutorizada:false,produccionAutorizada:false,
   estado:'PRELIMINAR_SIN_ORIGINALES',armados:[]}),
  service:{fetch:async req=>{
   records.push(req);
   return Response.json(answer,{status:200});
  }}};
}
test('cierra borradores sin sesión, por sandbox o sin gates y sin contactar Central',async()=>{
 for(const [patch,authorized,url] of [
  [{},false,origin],
  [{SABER_ENTORNO:'preparacion'},true,origin],
  [{DOCS_LIVE_ORDER_GATE:'NO_GO'},true,origin],
  [{DOCS_LIVE_PRICING_GATE:'NO_GO'},true,origin],
  [{},true,'https://saber-documentos-pruebas.workers.dev']
 ]){
  const calls=[],o=opts({},calls);
  o.authorized=authorized;
  const response=await guardarBorradorUniversalLive(
   request('/api/pedido/live/borrador',draftFixture,url),{...env,...patch},o);
  assert.equal(response.status,503);
  assert.equal(calls.length,0);
 }
});
test('borrador envía SHA de ficha al servidor HMAC, sin autorizar pago',async()=>{
 const calls=[],o=opts({ok:true,webOrderId,draftId,totalArs:24500,
  fileCount:1,checkoutEnabled:false,paymentAuthorized:false,
  filesUploaded:false,productionAuthorized:false},calls);
 const r=await guardarBorradorUniversalLive(request('/api/pedido/live/borrador',draftFixture),env,o);
 assert.equal(r.status,201);
 const b=await r.json();
 assert.equal(b.paymentAuthorized,false);
 assert.equal(b.checkoutEnabled,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://pagos.libreriasaber.com.ar/internal/central/live/draft');
 assert.equal(calls[0].headers.get('Origin'),null);
 const signed=await calls[0].json();
 assert.equal(signed.schema,'saber-r2-universal-draft-v1');
 assert.match(signed.quoteHash,/^[a-f0-9]{64}$/);
 assert.equal(signed.webOrderId,webOrderId);
});
test('orden LIVE no acepta datos extra y exige sesión vinculada',async()=>{
 const calls=[],o=opts({},calls);
 assert.equal((await crearOrdenUniversalLive(
  request('/api/pedido/live/orden',orderFixture),env,{...o,authorized:false})).status,503);
 assert.equal((await crearOrdenUniversalLive(
  request('/api/pedido/live/orden',{...orderFixture,precio:1}),env,o)).status,422);
 assert.equal(calls.length,0);
});
test('orden produce contrato HMAC exacto, numeración y no habilita archivos',async()=>{
 const calls=[],o=opts({ok:true,webOrderId,commercialOrderId,
  numeroOrden:'018',totalArs:24500,fileCount:1,
  checkoutEnabled:false,paymentAuthorized:false,uploadAuthorized:false,
  filesUploaded:false,productionAuthorized:false},calls);
 const r=await crearOrdenUniversalLive(request('/api/pedido/live/orden',orderFixture),env,o);
 assert.equal(r.status,201);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://pagos.libreriasaber.com.ar/internal/central/live/order');
 const signed=await calls[0].json();
 assert.deepEqual(signed,{schema:'saber-central-r2-universal-create-order-v1',...orderFixture});
});


test('orden LIVE protege contactos y conserva compatibilidad con órdenes anteriores',async()=>{
 const calls=[],response={ok:true,webOrderId,commercialOrderId,
  numeroOrden:'018',totalArs:24500,fileCount:1,
  checkoutEnabled:false,paymentAuthorized:false,uploadAuthorized:false,
  filesUploaded:false,productionAuthorized:false};
 for(const patch of [
  {nombre:'A'},{nombre:'  '},{nombre:'<script>'},{direccion:'x'.repeat(181)},
  {nombre:undefined,direccion:'Calle 123'}
 ]){
  const input={...orderFixture,...patch};
  if(patch.nombre===undefined)delete input.nombre;
  const result=await crearOrdenUniversalLive(request('/api/pedido/live/orden',input),env,opts(response,calls));
  assert.equal(result.status,422,JSON.stringify(patch));
  assert.equal(calls.length,0);
 }
 const legacy={webOrderId,draftId,quoteHash:hash,telefono:'351 5554444'};
 const previous=await crearOrdenUniversalLive(request('/api/pedido/live/orden',legacy),env,opts(response,calls));
 assert.equal(previous.status,201,'No bloquear recuperación de órdenes creadas antes de agregar nombre');
 assert.equal(calls.length,1);
 assert.deepEqual(await calls[0].json(),{schema:'saber-central-r2-universal-create-order-v1',...legacy});
});
