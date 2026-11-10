import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {leerFirmaInternaLive} from './central-live-bridge.mjs';
const host='https://pagos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const ORDER='123e4567-e89b-42d3-a456-426614174000';
const ID='123e4567-e89b-42d3-a456-426614174001';
const TS=1794320000;
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
 CENTRAL_LIVE_BRIDGE_ENABLED:'GO_COMERCIAL_CONFIRMADO',
 CENTRAL_BRIDGE_KEY:'this-is-an-independent-hmac-key-should-not-be-in-logs',
 MP_LIVE_WEBHOOK_SECRET:'a'.repeat(48),
 MP_LIVE_ACCESS_TOKEN:'APP_USR-'+'x'.repeat(60)
};
const sign=async(raw,secret=env.CENTRAL_BRIDGE_KEY,ts=TS,id=ID)=>{
 const k=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Buffer.from(await webcrypto.subtle.sign('HMAC',k,
  new TextEncoder().encode(ts+'\n'+id+'\n'+raw))).toString('hex');
};
const make=async(path='/internal/central/live/checkout',payload={
 schema:'saber-mp-live-checkout-v1',commercialOrderId:ORDER,webOrderId:WEB
},opts={})=>{
 const raw=JSON.stringify(payload);
 const headers={
  'Content-Type':'application/json','x-saber-ts':String(TS),
  'x-saber-request-id':ID,
  'x-saber-signature':await sign(raw)
 };
 Object.assign(headers,opts.headers||{});
 return new Request((opts.host||host)+path,{method:'POST',headers,
  body:opts.raw||raw});
};
const read=(r,e=env)=>leerFirmaInternaLive(r,e,{now:()=>TS,subtle:webcrypto.subtle});
test('LIVE cerrado no consulta HMAC ni acepta un token de sandbox',async()=>{
 for(const patch of [
  {SABER_ENTORNO:'preparacion'},{SABER_ENTORNO:'pruebas'},
  {CENTRAL_DB_ENV:'pruebas'},{MP_LIVE_GATE:'NO_GO'},
  {CENTRAL_LIVE_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY'},
  {CENTRAL_LIVE_BRIDGE_ENABLED:undefined},
  {CENTRAL_BRIDGE_KEY:'x'},
  {CENTRAL_BRIDGE_KEY:env.MP_LIVE_WEBHOOK_SECRET},
  {CENTRAL_BRIDGE_KEY:env.MP_LIVE_ACCESS_TOKEN}
 ]){
  assert.equal((await read(await make(),{...env,...patch})).status,503);
 }
});
test('checkout LIVE valida cuerpo, orden y firma HMAC, sin alterar sandbox',async()=>{
 const req=await make();
 const r=await read(req);
 assert.equal(r.payload.commercialOrderId,ORDER);
 assert.equal(r.payload.webOrderId,WEB);
 assert.equal(r.payload.schema,'saber-mp-live-checkout-v1');
 assert.equal(r.requestId,ID);
 assert.equal(r.error,undefined);
});
test('estado LIVE usa otra firma schema; no admite cruzar rutas',async()=>{
 const payload={schema:'saber-mp-live-status-v1',commercialOrderId:ORDER,webOrderId:WEB};
 assert.equal((await read(await make('/internal/central/live/status',payload))).error,undefined);
 assert.equal((await read(await make('/internal/central/live/checkout',payload))).status,422);
});
test('identidad ajena, replay y firmas incorrectas rechazan',async()=>{
 const a=await make(undefined,undefined,{headers:{'x-saber-ts':String(TS-301)}});
 assert.equal((await read(a)).status,401);
 const b=await make(undefined,undefined,{headers:{'x-saber-signature':'a'.repeat(64)}});
 assert.equal((await read(b)).status,401);
 const c=await make(undefined,undefined,{headers:{'x-saber-request-id':'BAD'}}); 
 assert.equal((await read(c)).status,401);
 const d=await make(undefined,undefined,{raw:JSON.stringify({schema:'saber-mp-live-checkout-v1',
  commercialOrderId:ORDER,webOrderId:'WEB-ENSAYO-'+'B'.repeat(32)})});
 assert.equal((await read(d)).status,401);
});
test('solo origen service binding; navegador, GET y puerto alternativo no habilitan',async()=>{
 const cross=await make(undefined,undefined,{host:'https://pagos.malicioso.example'});
 assert.equal((await read(cross)).status,403);
 const origin=await make(undefined,undefined,{headers:{Origin:'https://pedidos.libreriasaber.com.ar'}});
 assert.equal((await read(origin)).status,403);
 const port=await make(undefined,undefined,{host:'https://pagos.libreriasaber.com.ar:444'});
 assert.equal((await read(port)).status,403);
});

test('orden productiva exige firma propia y rechaza mezclar checkout o payloads extra',async()=>{
 const payload={schema:'saber-central-r2-universal-create-order-v1',
  webOrderId:WEB,draftId:ORDER,quoteHash:'a'.repeat(64),
  telefono:'351 1234567'};
 const accepted=await read(await make('/internal/central/live/order',payload));
 assert.equal(accepted.error,undefined);
 assert.equal(accepted.payload.webOrderId,WEB);
 assert.equal((await read(await make('/internal/central/live/checkout',payload))).status,422);
 assert.equal((await read(await make('/internal/central/live/order',
  {...payload,amountArs:100}))).status,422);
 assert.equal((await read(await make('/internal/central/live/order',
  {...payload,telefono:'abc'}))).status,422);
 assert.equal((await read(await make('/internal/central/live/order',
  {...payload,quoteHash:'z'.repeat(64)}))).status,422);
 assert.equal((await read(await make('/internal/central/live/order',payload),
  {...env,MP_LIVE_GATE:'NO_GO'})).status,503);
});

test('TUS LIVE HMAC firma gate y recibo de la orden, sin mezclar rutas ni campos',async()=>{
 const gate={schema:'saber-central-r2-universal-tus-gate-v1',
  action:'start',orderId:WEB,fileId:'pdf_0',name:'Apuntes.pdf',
  sha256:'a'.repeat(64),bytes:2000,pages:2};
 const accepted=await read(await make('/internal/central/live/tus-gate',gate));
 assert.equal(accepted.error,undefined);
 assert.equal(accepted.payload.orderId,WEB);
 assert.equal((await read(await make('/internal/central/live/checkout',gate))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-gate',
   {...gate,paymentVerified:true}))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-gate',
   {...gate,orderId:'WEB-ENSAYO-'+'B'.repeat(31)}))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-gate',
   {...gate,bytes:41*1048576}))).status,422);
 const proof={schema:'saber-central-r2-universal-tus-received-v1',
  orderId:WEB,fileId:'pdf_0',receiptId:'DOC-'+ORDER,
  objectName:'v2/'+WEB+'/'+ORDER+'.pdf',name:'Apuntes.pdf',
  sha256:'a'.repeat(64),bytes:2000,pages:2,
  metrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'},
   {anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]};
 assert.equal((await read(await make('/internal/central/live/tus-received',proof))).error,undefined);
 assert.equal((await read(await make('/internal/central/live/tus-gate',proof))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-received',
  {...proof,metrics:[proof.metrics[0]]}))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-received',
  {...proof,metrics:[{...proof.metrics[0],modo:'poster'},proof.metrics[1]]}))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-received',
  {...proof,uploadAuthorized:true}))).status,422);
 assert.equal((await read(await make('/internal/central/live/tus-received',proof),
  {...env,MP_LIVE_GATE:'NO_GO'})).status,503);
});
