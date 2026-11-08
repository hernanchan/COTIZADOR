import test from 'node:test';
import assert from 'node:assert/strict';
import {manejarR2GrandePrivado}
 from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-api-privada.mjs';
const origin='https://saber-documentos-pruebas.workers.dev';
const orderId='WEB-ENSAYO-'+'A'.repeat(32);
const meta={fileId:'planoA1',name:'Plano A1 original.pdf',mode:'bn',
 bytes:100*1024*1024,sha256:'f'.repeat(64),pages:1};
const objectKey='r2-v1/'+orderId+'/12345678-1234-4123-8123-123456789abc.pdf';
const paid={source:'CENTRAL_D1_RECONCILED',orderId,method:'mercadopago',
 authority:'MERCADOPAGO_API_RECONCILED',paymentState:'PAID_CONFIRMED',
 providerVerified:true,reversed:false,refunded:false,currency:'ARS',
 amountArs:20000,paymentReference:'MP-TEST-123456',
 verifiedAt:1793970000-10};
function req(id=orderId,m=meta){
 return new Request(origin+'/prueba-v2/api/ensayo-r2/recuperar',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({orderId:id,meta:m})
 });
}
function fixture(){
 const called={head:0,create:0,lookup:0,verify:0,stage:0,payment:0};
 let object={size:meta.bytes},found=true,authorized=true,payment=true;
 let wrongHash=false;
 const bucket={
  createMultipartUpload:async()=>{called.create++;throw Error('NO_UPLOAD')},
  resumeMultipartUpload:()=>{throw Error('NO_MULTIPART')},
  head:async key=>{called.head++;assert.equal(key,objectKey);return object}
 };
 const env={DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY',
  DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_RECEIPT_KEY:'test-R2-secret-32bytes-minimum-not-real',
  SABER_R2_GRANDES:bucket};
 const reserva={found:true,state:'reserved',orderId,
  fileId:meta.fileId,sha256:meta.sha256,bytes:meta.bytes,objectKey};
 const deps={
  now:()=>1793970000,
  autorizadoIniciar:async()=>authorized,
  comprobarPagoCentral:async()=>{called.payment++;return payment?paid:null},
  consultaReserva:async()=>{called.lookup++;return found?reserva:{found:false,state:'not_started'}},
  verificarReserva:async()=>{called.verify++;return {
   objectKey,storageReady:true,sha256Verificado:true,
   sha256:wrongHash?'0'.repeat(64):meta.sha256,
   bytes:meta.bytes,contenidoPdfVerificado:false,etag:'etag123456789'
  }},
  stage:async()=>{called.stage++;return {stagedForCentral:true}}
 };
 const run=async request=>manejarR2GrandePrivado(request||req(),env,deps);
 return {run,env,deps,called,setObject:v=>{object=v},
  setFound:v=>{found=v},setAuthorized:v=>{authorized=v},
  setPayment:v=>{payment=v},setWrongHash:v=>{wrongHash=v}};
}
test('sin reserva sólo autoriza el comienzo normal; cero objetos nuevos',async()=>{
 const f=fixture();f.setFound(false);
 const r=await f.run();assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.state,'not_started');assert.equal(d.uploadPossible,true);
 assert.equal(f.called.create,0);assert.equal(f.called.head,0);
 assert.equal(f.called.stage,0);
});
test('objeto pagado completo se recupera y registra sin reenviar',async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.state,'stored_and_staged');
 assert.equal(d.result.sha256Verificado,true);
 assert.equal(d.result.stagedForCentral,true);
 assert.equal(d.result.contenidoPdfVerificado,false);
 assert.equal(d.result.productionAuthorized,false);
 assert.equal(f.called.head,1);assert.equal(f.called.verify,1);
 assert.equal(f.called.stage,1);assert.equal(f.called.create,0);
});
test('multipart incompleto jamás inicia otra carga',async()=>{
 const f=fixture();f.setObject(null);
 const r=await f.run();const d=await r.json();
 assert.equal(d.state,'multipart_incomplete');
 assert.equal(d.uploadPossible,false);assert.equal(f.called.create,0);
 assert.equal(f.called.stage,0);assert.equal(f.called.verify,0);
});
test('pedido ajeno, pago no confirmado y SHA distinto cierran acceso',async()=>{
 const f=fixture();f.setAuthorized(false);
 assert.equal((await f.run()).status,403);
 assert.equal(f.called.lookup,0);assert.equal(f.called.payment,0);
 f.setAuthorized(true);f.setPayment(false);
 assert.equal((await f.run()).status,402);
 assert.equal(f.called.lookup,0);
 f.setPayment(true);f.setWrongHash(true);
 assert.equal((await f.run()).status,422);
 assert.equal(f.called.stage,0);assert.equal(f.called.create,0);
});
test('si no existe habilitación Central, no consulta ni crea objetos',async()=>{
 const f=fixture();f.env.DOCS_R2_STAGING_ENABLED='OFF';
 const r=await f.run();assert.equal(r.status,503);
 assert.equal(f.called.lookup,0);assert.equal(f.called.create,0);
});
