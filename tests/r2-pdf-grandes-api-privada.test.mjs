import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {manejarR2GrandePrivado} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-api-privada.mjs';

const ORIGIN='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const BASE=ORIGIN+'/prueba-v2/api/ensayo-r2/';
const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const sec='clave-R2-unicamente-para-tests-clave-de-64-caracteres-falsa';
const meta={fileId:'pdf200',name:'Plano 200 MiB.pdf',mode:'bn',
 bytes:200*1024*1024,pages:15,sha256:'f'.repeat(64)};
const now=()=>1793970000;
const objectUUID='12345678-1234-4123-8123-123456789abc';
const options={now,subtle:webcrypto.subtle,uuid:()=>objectUUID,
 reserve:async({orderId:oid,meta:m,objectUUID:id})=>({reserved:true,
  orderId:oid,bytes:m.bytes,objectUUID:id,paymentAuthorized:false})};
function jsonRequest(action,data,{origin=ORIGIN,method='POST'}={}){
 return new Request(BASE+action,{method,
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify(data)});
}
function fixtures(){
 const calls={start:0,parts:0,finish:0};
 const bucket={
  createMultipartUpload:async()=>{calls.start++;return {uploadId:'upload-r2-privado-001'}},
  resumeMultipartUpload:()=>({
   uploadPart:async(n,body)=>{
    calls.parts++;assert.equal(typeof body.getReader,'function');
    return {partNumber:n,etag:'etag-'+n};
   },
   complete:async parts=>{calls.finish++;return {parts}}
  }),
  head:async()=>({size:meta.bytes})
 };
 const env={DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',DOCS_R2_RECEIPT_KEY:sec,
  SABER_R2_GRANDES:bucket};
 return {calls,env};
}
test('sin R2 habilitado no crea carga ni expone pedidos',async()=>{
 const {calls,env}=fixtures();
 const r=await manejarR2GrandePrivado(jsonRequest('iniciar',{orderId,meta}),
  {...env,DOCS_R2_BIG_ENABLED:'false'},{autorizadoIniciar:async()=>true,...options});
 assert.equal(r.status,503);
 assert.equal((await r.json()).paymentAuthorized,false);
 assert.equal(calls.start,0);
});
test('R2 no inicia sin permiso comprador, ni desde origen ajeno',async()=>{
 const {calls,env}=fixtures();
 const input={orderId,meta};
 let r=await manejarR2GrandePrivado(jsonRequest('iniciar',input),env,
  {autorizadoIniciar:async()=>false,...options});
 assert.equal(r.status,403);
 r=await manejarR2GrandePrivado(jsonRequest('iniciar',input,{origin:'https://otro.tld'}),env,
  {autorizadoIniciar:async()=>true,...options});
 assert.equal(r.status,403);
 assert.equal(calls.start,0);
});
test('R2 200 MiB: iniciar, vincular orden, impedir parte ajena y completar sin acreditar pedido',async()=>{
 const {calls,env}=fixtures();
 const input={orderId,meta};
 const start=await manejarR2GrandePrivado(jsonRequest('iniciar',input),env,{
  autorizadoIniciar:async value=>value===orderId,
  vincularOrden:async()=> 'saber_pedido_orden_v1=test; Path=/; HttpOnly; Secure',
  ...options
 });
 assert.equal(start.status,200);
 assert.match(start.headers.get('Set-Cookie'),/saber_pedido_orden_v1=/);
 const data=await start.json();assert.equal(data.paymentAuthorized,false);
 assert.equal(data.session.parts,25);
 assert.equal(calls.start,1);
 const partReq=()=>new Request(BASE+'parte?n=1',{
  method:'PUT',headers:{Origin:ORIGIN,'X-Saber-R2-Proof':data.session.proof,
   'Content-Length':String(8*1024*1024)},
  body:'contenido simulado'});
 const denied=await manejarR2GrandePrivado(partReq(),env,{autorizadoOrden:async()=>false,...options});
 assert.equal(denied.status,403);assert.equal(calls.parts,0);
 const part=await manejarR2GrandePrivado(partReq(),env,{autorizadoOrden:async id=>id===orderId,...options});
 assert.equal(part.status,200);assert.equal((await part.json()).bytes,8*1024*1024);
 assert.equal(calls.parts,1);
 const uploadedParts=Array.from({length:25},(_,i)=>({partNumber:i+1,etag:'etag-'+(i+1)}));
 const completeReq=()=>jsonRequest('completar',{proof:data.session.proof,uploadedParts});
 const refused=await manejarR2GrandePrivado(completeReq(),env,{autorizadoOrden:async()=>false,...options});
 assert.equal(refused.status,403);assert.equal(calls.finish,0);
 const complete=await manejarR2GrandePrivado(completeReq(),env,{autorizadoOrden:async()=>true,...options});
 assert.equal(complete.status,200);
 const final=await complete.json();
 assert.equal(final.paymentAuthorized,false);
 assert.equal(final.registeredInD1,false);
 assert.equal(final.listoParaProducir,false);
 assert.equal(final.result.sha256Verificado,false);
 assert.equal(final.result.contenidoPdfVerificado,false);
 assert.equal(calls.finish,1);
});

test('con bucket R2 activo pero cupo D1 apagado no se crea multipart',async()=>{
 const {calls,env}=fixtures();
 const result=await manejarR2GrandePrivado(jsonRequest('iniciar',{orderId,meta}),
  {...env,DOCS_R2_QUOTA_ENABLED:'OFF'},{
   autorizadoIniciar:async()=>true,...options,
   reserve:async()=>{throw Error('No se consulta cupo cuando el flag está apagado')}
  });
 assert.equal(result.status,503);
 assert.equal((await result.json()).paymentAuthorized,false);
 assert.equal(calls.start,0);
});
test('si D1 no concede cuota, nunca se llama a createMultipartUpload',async()=>{
 const {calls,env}=fixtures();
 const response=await manejarR2GrandePrivado(jsonRequest('iniciar',{orderId,meta}),env,{
  autorizadoIniciar:async()=>true,...options,
  reserve:async()=>({reserved:false})
 });
 assert.equal(response.status,422);
 assert.equal(calls.start,0);
 assert.equal((await response.json()).paymentAuthorized,false);
});
