/**
 * E2E híbrido de SOLO LECTURA:
 * - Origen: 60 MiB PDF real, R2 privado de PRUEBAS ya pagado en sandbox, sin nueva subida.
 * - Destino: función EXACTA del personal LIVE, con HMAC/central mock aislado.
 * - Nunca toca D1 producción, MP, config Cloudflare ni guarda archivos.
 * No equivale a un pedido R2 de producción: NO habilitar checkout R2 por este test.
 */
import assert from 'node:assert/strict';
import {createHmac,createHash,timingSafeEqual,webcrypto} from 'node:crypto';
import {inspeccionR2PersonalLive} from '../autocotizador/recepcion/r2-inspeccion-personal-live.mjs';
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const dest='https://pedidos.libreriasaber.com.ar';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const commercial='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const bytes=62915011;
const sha='68efbfed36babb0b76d3cf98d547d94b2af00af4dcbbd619d04f1c9f7fa13ee5';
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;
assert.ok(typeof pass==='string'&&pass.length>5,'PRIVATE_TEST_OPERATOR_SECRET_REQUIRED');
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const headers={Authorization:auth,Origin:base,'Content-Type':'application/json'};
const GO='GO_COMERCIAL_CONFIRMADO';
const bridgeKey='test-only-central-bridge-key-never-for-live-1234';
async function privatePost(path,body,{timeout=200000}={}){
 return fetch(base+path,{method:'POST',headers,body:JSON.stringify(body),
  redirect:'manual',signal:AbortSignal.timeout(timeout)});
}
const health=await fetch('https://saber-pagos-pruebas.libreriasaber.workers.dev/health',
 {signal:AbortSignal.timeout(20000)}).then(r=>r.json());
assert.equal(health?.ok,true);
assert.equal(health?.databaseReady,true);
assert.equal(health?.paymentsEnabled,false,'Private environment must never charge');
const payment=await privatePost('/prueba-v2/api/ensayo-r2-prepago-checkout',
 {action:'status',webOrderId:web,commercialOrderId:commercial});
const state=await payment.json();
assert.equal(payment.status,200,'EXISTING_SANDBOX_PAYMENT_UNVERIFIED');
assert.equal(state?.estado,'pagado_esperando_archivo');
assert.equal(state?.amountArs,4400);
const input={webOrderId:web,fileId:'planoA1',sha256:sha,bytes};
const refResponse=await privatePost('/prueba-v2/api/ensayo-r2-referencia-personal',input);
const ref=await refResponse.json();
assert.equal(refResponse.status,200,'EXISTING_PRIVATE_R2_REFERENCE_NOT_AVAILABLE');
assert.equal(ref?.ok,true);
assert.equal(ref?.paidVerified,true);
assert.equal(ref?.received,true);
assert.equal(ref?.sha256,sha);
assert.equal(ref?.bytes,bytes);
assert.match(ref?.receiptId||'',/^DOC-[0-9a-f-]{36}$/i);
const key='r2-v1/'+web+'/'+ref.receiptId.slice(4)+'.pdf';
const valid={ok:true,schema:'saber-r2-staff-inspection-source-v1',
 webOrderId:web,fileId:'planoA1',objectKey:key,sha256:sha,bytes,
 paginasDeclaradas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}],
 inspected:false,productionAuthorized:false};
let signedCalls=0,headCalls=0,getCalls=0;
const worker={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_RECEPCION_GATE:GO,DOCS_LIVE_STAFF_GATE:GO,
 DOCS_LIVE_R2_GATE:GO,DOCS_LIVE_R2_STAGING_GATE:GO,DOCS_LIVE_PACKAGE_GATE:GO,
 CENTRAL_BRIDGE_KEY:bridgeKey,
 SABER_CENTRAL:{async fetch(request){
  const json=await request.json(),ts=request.headers.get('x-saber-ts');
  const id=request.headers.get('x-saber-request-id');
  const signature=request.headers.get('x-saber-signature')||'';
  const hmac=createHmac('sha256',bridgeKey).update(ts+'\n'+id+'\n'+JSON.stringify(json)).digest('hex');
  assert.ok(/^[a-f0-9]{64}$/.test(signature));
  assert.ok(timingSafeEqual(Buffer.from(hmac,'hex'),Buffer.from(signature,'hex')),'HMAC_MISMATCH');
  assert.equal(json.schema,'saber-central-r2-inspection-source-v1');
  assert.equal(json.webOrderId,web);
  assert.equal(json.fileId,'planoA1');
  assert.equal(new URL(request.url).pathname,'/internal/central/live/r2-inspection-source');
  signedCalls++;
  return Response.json(valid);
 }},
 SABER_R2_GRANDES_LIVE:{
  async head(objectKey){
   assert.equal(objectKey,key);
   headCalls++;
   return {size:bytes};
  },
  async get(objectKey){
   assert.equal(objectKey,key);
   getCalls++;
   const res=await privatePost('/prueba-v2/api/ensayo-r2-descargar-d1-personal',
    {orderId:web,receiptId:ref.receiptId},{timeout:200000});
   assert.equal(res.status,200,'EXISTING_R2_PRIVATE_STREAM_UNAVAILABLE');
   assert.match(res.headers.get('content-type')||'',/^application\/pdf/);
   assert.equal(Number(res.headers.get('content-length')),bytes);
   assert.ok(res.body);
   return {size:bytes,body:res.body};
  }
 }
};
const query='?webOrderId='+web+'&fileId=planoA1';
const untrusted=await inspeccionR2PersonalLive(
 new Request(dest+'/personal/api/live-r2-inspection-original'+query),worker,
 {authorized:false});
assert.equal(untrusted.status,401,'Unauthorized access MUST fail');
assert.equal(headCalls+getCalls+signedCalls,0);
const source=await inspeccionR2PersonalLive(
 new Request(dest+'/personal/api/live-r2-inspection-source'+query),worker,
 {authorized:true});
assert.equal(source.status,200,'Read-only metadata over authenticated bridge');
const sourceData=await source.json();
assert.equal(sourceData.sha256,sha);
assert.equal(sourceData.bytes,bytes);
assert.equal(JSON.stringify(sourceData).includes(key),false,'R2 key must remain hidden');
const res=await inspeccionR2PersonalLive(
 new Request(dest+'/personal/api/live-r2-inspection-original'+query),worker,
 {authorized:true});
assert.equal(res.status,200,'Live staff handler rejected real 60MiB source');
assert.equal(Number(res.headers.get('content-length')),bytes);
assert.match(res.headers.get('content-disposition')||'',/^attachment;/);
const hash=createHash('sha256');
let total=0;
for await(const chunk of res.body){total+=chunk.byteLength;hash.update(chunk)}
const actualHash=hash.digest('hex');
assert.equal(total,bytes,'R2_STAFF_STREAM_TRUNCATED');
assert.equal(actualHash,sha,'R2_STAFF_STREAM_SHA256_FAILED');
assert.equal(signedCalls,2);
assert.equal(headCalls,1);
assert.equal(getCalls,1);
console.log('R2_PRIVATE_SOURCE_REAL_LIVE_HANDLER_SHA256_OK');
console.log('R2_STAFF_BINARY_STREAM_BYTES='+total);
console.log('R2_STAFF_SIGNED_BRIDGE_AUTH_AND_NO_KEY_LEAK_OK');
console.log('R2_NO_NEW_PAYMENT_NO_NEW_ORDER_NO_UPLOAD_NO_PRODUCTION_D1');
console.log('R2_PRODUCTION_E2E_STILL_NOT_VALIDATED');
