import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {pagoAprobadoParaR2} from '../integraciones/autocotizador/recepcion/r2-recepcion-solo-pagada.mjs';
import {manejarR2GrandePrivado} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-api-privada.mjs';
const ORIGIN='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const now=()=>1793970000;
const base={
 source:'CENTRAL_D1_RECONCILED',orderId,method:'mercadopago',
 authority:'MERCADOPAGO_API_RECONCILED',paymentState:'PAID_CONFIRMED',
 providerVerified:true,reversed:false,refunded:false,currency:'ARS',
 amountArs:15500,paymentReference:'MP-PRUEBA-123456',verifiedAt:now()-10
};
const sec='clave-R2-unicamente-para-tests-clave-de-64-caracteres-falsa';
const meta={fileId:'pdf100',name:'Plano A1 100 MiB.pdf',mode:'bn',
 bytes:100*1024*1024,pages:1,sha256:'f'.repeat(64)};
function req(action,data,method='POST',proof=''){
 const url=ORIGIN+'/prueba-v2/api/ensayo-r2/'+action;
 return new Request(url,{method,headers:{Origin:ORIGIN,'Content-Type':'application/json',
  ...(proof?{'X-Saber-R2-Proof':proof}:{}),
  ...(method==='PUT'?{'Content-Length':String(8*1024*1024)}:{})},
  body:method==='PUT'?'fake-payload':JSON.stringify(data)
 });
}
function fixtures(){
 const calls={start:0,part:0,head:0,stage:0,reserve:0};
 const bucket={
  createMultipartUpload:async()=>{calls.start++;return {uploadId:'multipart-upload-001'};},
  resumeMultipartUpload:()=>({
   uploadPart:async n=>{calls.part++;return {partNumber:n,etag:'etag-'+n}},
   complete:async()=>{throw Error('complete should not be called');}
  }),
  head:async()=>{calls.head++;return {size:meta.bytes}}
 };
 const env={DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY',
  DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',DOCS_R2_RECEIPT_KEY:sec,
  SABER_R2_GRANDES:bucket};
 const deps={now,subtle:webcrypto.subtle,
  autorizadoIniciar:async()=>true,autorizadoOrden:async()=>true,
  uuid:()=> '12345678-1234-4123-8123-123456789abc',
  reserve:async()=>{calls.reserve++;return {reserved:true,
   orderId,objectUUID:'12345678-1234-4123-8123-123456789abc',
   bytes:meta.bytes,paymentAuthorized:false}},
  stage:async()=>{calls.stage++;return {stagedForCentral:false}}
 };
 return {calls,env,deps};
}
test('D1 conciliado: exige pago real aprobado en ARS y orden exacta',()=>{
 assert.equal(pagoAprobadoParaR2(base,orderId,now()),true);
 const bank={...base,method:'transferencia',
  authority:'BANK_CREDIT_CONFIRMED_BY_STAFF'};
 assert.equal(pagoAprobadoParaR2(bank,orderId,now()),true);
 for(const bad of [
  null,undefined,true,'paid',{...base,orderId:'WEB-OTRA-ORDEN'},
  {...base,paymentState:'pending'},
  {...base,source:'CLIENT_REDIRECT'},{...base,providerVerified:false},
  {...base,reversed:true},{...base,refunded:true},
  {...base,currency:'USD'},{...base,amountArs:0},
  {...base,verifiedAt:now()-301},{...base,verifiedAt:now()+31},
  {...base,method:'transferencia',authority:'MERCADOPAGO_API_RECONCILED'},
  {...base,source:'CENTRAL_D1_RECONCILED',paymentReference:'ok'}
 ])assert.equal(pagoAprobadoParaR2(bad,orderId,now()),false);
});
test('sin nuevo interruptor de pago, aunque R2 esté ON no crea nada',async()=>{
 const f=fixtures();
 const r=await manejarR2GrandePrivado(req('iniciar',{orderId,meta}),
  {...f.env,DOCS_R2_POSTPAY_REQUIRED:'OFF'},
  {...f.deps,comprobarPagoCentral:async()=>base});
 assert.equal(r.status,503);
 assert.deepEqual(f.calls,{start:0,part:0,head:0,stage:0,reserve:0});
});
test('no basta login, cupo ni una preferencia de pago sin aprobar',async()=>{
 const f=fixtures();
 for(const receipt of [null,{...base,paymentState:'pending'},{
  ...base,source:'CLIENT_REDIRECT'
 }]){
  const r=await manejarR2GrandePrivado(req('iniciar',{orderId,meta}),
   f.env,{...f.deps,comprobarPagoCentral:async()=>receipt});
  assert.equal(r.status,402);
  assert.equal((await r.json()).error,'R2_PAGO_NO_CONFIRMADO');
 }
 assert.deepEqual(f.calls,{start:0,part:0,head:0,stage:0,reserve:0});
});
test('si falta conexión real a Central, gate predeterminada falla cerrada',async()=>{
 const f=fixtures();
 const r=await manejarR2GrandePrivado(req('iniciar',{orderId,meta}),
  f.env,f.deps);
 assert.equal(r.status,402);
 assert.equal(f.calls.start,0);
 assert.equal(f.calls.reserve,0);
});
test('pago confirmado permite iniciar una única vez y revalida antes de subir una parte',async()=>{
 const f=fixtures();
 let paid=true;
 const check=async()=>paid?base:null;
 const start=await manejarR2GrandePrivado(req('iniciar',{orderId,meta}),
  f.env,{...f.deps,comprobarPagoCentral:check});
 assert.equal(start.status,200);
 assert.equal(f.calls.start,1);
 assert.equal(f.calls.reserve,1);
 const data=await start.json();
 paid=false;
 const part=await manejarR2GrandePrivado(req('parte?n=1',null,'PUT',
  data.session.proof),f.env,{...f.deps,comprobarPagoCentral:check});
 assert.equal(part.status,402);
 assert.equal(f.calls.part,0);
 assert.equal(f.calls.head,0);
 assert.equal(f.calls.stage,0);
});
