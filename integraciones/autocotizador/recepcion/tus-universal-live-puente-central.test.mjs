import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {llamarTUSUniversalCentralLive} from './tus-universal-live-puente-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const KEY='live-docs-central-separate-hmac-key-20261110';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const gate={schema:'saber-central-r2-universal-tus-gate-v1',
 action:'start',orderId:WEB,fileId:'pdf_0',name:'Apunte.pdf',
 sha256:'a'.repeat(64),bytes:3200,pages:1};
const valid={ok:true,webOrderId:WEB,fileId:'pdf_0',productionAuthorized:false,
 uploadAuthorized:true,mode:'bn',bytes:3200,sha256:'a'.repeat(64),
 name:'Apunte.pdf',pages:1,expectedMetrics:[{anchoCm:21,altoCm:29.7}]};
const base={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_LIVE_RECEPCION_GATE:GO,DOCS_LIVE_TUS_GATE:GO,
 DOCS_MP_LIVE_GATE:GO,CENTRAL_BRIDGE_KEY:KEY};
function mock(payload=valid,status=200){
 const calls=[];
 const service={fetch:async request=>{
  calls.push(request);
  return Response.json(payload,{status});
 }};
 return {calls,service,opts:{service,subtle:webcrypto.subtle,
  now:()=>1794320000,nonce:()=> '123e4567-e89b-42d3-a456-426614174001'}};
}
test('sin GO o sandbox, no invoca Central ni intenta subida',async()=>{
 for(const patch of [{SABER_ENTORNO:'preparacion'},
  {DOCS_MP_LIVE_GATE:'NO_GO'},{DOCS_LIVE_TUS_GATE:'NO_GO'},
  {DOCS_LIVE_RECEPCION_GATE:'NO_GO'},{CENTRAL_BRIDGE_KEY:'short'}]){
  const m=mock();
  await assert.rejects(llamarTUSUniversalCentralLive({...base,...patch},'gate',gate,m.opts),
   /LIVE_TUS_PUENTE_OFF/);
  assert.equal(m.calls.length,0);
 }
});
test('firma metadatos de pedido propio hacia Central LIVE, sin URLs de Sandbox',async()=>{
 const m=mock();
 const output=await llamarTUSUniversalCentralLive(base,'gate',gate,m.opts);
 assert.equal(output.uploadAuthorized,true);
 assert.equal(m.calls.length,1);
 const req=m.calls[0];
 assert.equal(req.url,'https://pagos.libreriasaber.com.ar/internal/central/live/tus-gate');
 assert.equal(req.headers.get('Origin'),null);
 const raw=await req.text();
 const expected=createHmac('sha256',KEY).update(
  req.headers.get('x-saber-ts')+'\n'+req.headers.get('x-saber-request-id')+'\n'+raw
 ).digest('hex');
 assert.equal(req.headers.get('x-saber-signature'),expected);
 assert.deepEqual(JSON.parse(raw),gate);
});
test('payload ajeno o confirmación sin pago no autoriza subir',async()=>{
 const mismatch=mock({...valid,webOrderId:'WEB-ENSAYO-'+'B'.repeat(32)});
 await assert.rejects(llamarTUSUniversalCentralLive(base,'gate',gate,mismatch.opts),
  /RESPUESTA_AJENA/);
 const unpaid=mock({ok:false,error:'PAGO_NO_VERIFICADO'},402);
 await assert.rejects(llamarTUSUniversalCentralLive(base,'gate',gate,unpaid.opts),
  /PAGO_NO_CONFIRMADO/);
 const out=mock();
 await assert.rejects(llamarTUSUniversalCentralLive(base,'gate',
  {...gate,pagoConfirmado:true},out.opts),/PUENTE_INPUT/);
 assert.equal(out.calls.length,0);
});
test('recibo LIVE conserva objeto verificado y no admite métricas arbitrarias',async()=>{
 const uuid='123e4567-e89b-42d3-a456-426614174000';
 const receipt={schema:'saber-central-r2-universal-tus-received-v1',
  orderId:WEB,fileId:'pdf_0',receiptId:'DOC-'+uuid,
  objectName:'v2/'+WEB+'/'+uuid+'.pdf',
  name:'Apunte.pdf',sha256:'a'.repeat(64),bytes:3200,pages:1,
  metrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]};
 const m=mock({ok:true,webOrderId:WEB,fileId:'pdf_0',
  productionAuthorized:false,saved:true,idempotent:false});
 const result=await llamarTUSUniversalCentralLive(base,'received',receipt,m.opts);
 assert.equal(result.saved,true);
 assert.equal(m.calls[0].url,
  'https://pagos.libreriasaber.com.ar/internal/central/live/tus-received');
 const changed=mock();
 await assert.rejects(llamarTUSUniversalCentralLive(base,'received',
  {...receipt,objectName:'v2/otra-orden/123.pdf'},changed.opts),/PUENTE_INPUT/);
 assert.equal(changed.calls.length,0);
});
