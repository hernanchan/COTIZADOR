import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 R2_BIG_LIMITS,iniciarR2Grande,leerReciboR2,bytesParteR2,
 subirParteR2Grande,completarR2Grande,
} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs';

const secret='saber-pruebas-clave-ficticia-64-caracteres-solamente-para-tests';
const now=()=>1793970000;
const uuid=()=> '12345678-1234-4123-8123-123456789abc';
const orderId='WEB-PRUEBA-R2-000123';
const meta={fileId:'PDF200',name:'Original 200 megas.pdf',mode:'bn',
 bytes:200*1024*1024,pages:36,sha256:'a'.repeat(64)};
function fixture(){
 const calls={created:[],uploads:[],complete:[],head:[]};
 const bucket={
  createMultipartUpload:async(key,opts)=>{
   calls.created.push({key,opts});return {uploadId:'multipart-example-200mb'};
  },
  resumeMultipartUpload:(key,uploadId)=>{
   assert.equal(key,'r2-v1/'+orderId+'/'+uuid()+'.pdf');
   assert.equal(uploadId,'multipart-example-200mb');
   return {
    uploadPart:async(n,stream)=>{
     calls.uploads.push({n,stream});
     return {partNumber:n,etag:'etag-'+n};
    },
    complete:async(parts)=>{
     calls.complete.push(parts);return {key,size:meta.bytes};
    }
   };
  },
  head:async(key)=>{calls.head.push(key);return {key,size:meta.bytes}}
 };
 return {bucket,calls};
}
async function start(bucket){
 return iniciarR2Grande({bucket,orderId,meta,secret,uuid,now,subtle:webcrypto.subtle});
}
test('R2 200 MiB: inicia multipart privado sin billing ni alterar TUS',async()=>{
 const {bucket,calls}=fixture();
 const session=await start(bucket);
 assert.equal(session.parts,25);
 assert.equal(session.bytes,200*1024*1024);
 assert.equal(session.partBytes,8*1024*1024);
 assert.equal(session.paymentAuthorized,false);
 assert.equal(session.checkoutEnabled,false);
 assert.equal(calls.created.length,1);
 assert.equal(calls.created[0].opts.httpMetadata.contentType,'application/pdf');
 assert.equal(calls.created[0].key,'r2-v1/'+orderId+'/'+uuid()+'.pdf');
 const claim=await leerReciboR2(session.proof,{secret,now,subtle:webcrypto.subtle});
 assert.equal(claim.name,meta.name);
 assert.equal(claim.sha256,meta.sha256);
 assert.equal(bytesParteR2(claim,25),8*1024*1024);
 assert.throws(()=>bytesParteR2(claim,0),/PARTE_INCORRECTA/);
 assert.throws(()=>bytesParteR2(claim,26),/PARTE_INCORRECTA/);
});
test('rechaza tamaños no autorizados y recibos falsificados o vencidos',async()=>{
 const {bucket}=fixture();
 for(const size of [5,40*1024*1024,257*1024*1024,1.5]){
  await assert.rejects(iniciarR2Grande({bucket,orderId,meta:{...meta,bytes:size},
   secret,uuid,now,subtle:webcrypto.subtle}),/METADATOS_NO_VALIDOS/);
 }
 const session=await start(bucket);
 const [body,tag]=session.proof.split('.');
 await assert.rejects(leerReciboR2(body+'.'+tag.slice(0,-1)+(tag.at(-1)==='A'?'B':'A'),
  {secret,now,subtle:webcrypto.subtle}),/FIRMA_INCORRECTA/);
 await assert.rejects(leerReciboR2(session.proof,{secret,now:()=>now()+7201,
  subtle:webcrypto.subtle}),/RECIBO_VENCIDO/);
 await assert.rejects(leerReciboR2(session.proof,{secret:'x'.repeat(40),now,
  subtle:webcrypto.subtle}),/FIRMA_INCORRECTA/);
});
test('verifica el tamaño exacto de cada parte antes de abrir stream; nunca acepta origen externo',async()=>{
 const {bucket,calls}=fixture();
 const session=await start(bucket);
 const send=(n,len,origin='https://saber.example')=>{
  const request=new Request('https://saber.example/prueba-v2/api/r2-parte',{
   method:'PUT',headers:{Origin:origin,'Content-Length':String(len)},
   body:'contenido simulado'});
  return subirParteR2Grande({bucket,proof:session.proof,partNumber:n,request,
   secret,now,subtle:webcrypto.subtle});
 };
 await assert.rejects(send(1,7),/TAMANO_PARTE_INCORRECTO/);
 await assert.rejects(send(1,8*1024*1024,'https://malicioso.example'),/ORIGEN_NO_AUTORIZADO/);
 assert.equal(calls.uploads.length,0);
 const p=await send(1,8*1024*1024);
 assert.deepEqual({partNumber:p.partNumber,bytes:p.bytes},{partNumber:1,bytes:8*1024*1024});
 assert.equal(calls.uploads.length,1);
 assert.equal(typeof calls.uploads[0].stream.getReader,'function');
});
test('multipart 200 MiB completo NO se marca como PDF verificado ni habilita pago',async()=>{
 const {bucket,calls}=fixture();
 const session=await start(bucket);
 const parts=Array.from({length:25},(_,i)=>({partNumber:i+1,etag:'etag-'+(i+1)}));
 await assert.rejects(completarR2Grande({bucket,proof:session.proof,
  uploadedParts:parts.slice(0,-1),secret,now,subtle:webcrypto.subtle}),/PARTES_INCOMPLETAS/);
 await assert.rejects(completarR2Grande({bucket,proof:session.proof,
  uploadedParts:parts.toReversed().reverse().map((p,i)=>i===0?{...p,partNumber:2}:p),
  secret,now,subtle:webcrypto.subtle}),/PARTES_NO_VALIDAS/);
 assert.equal(calls.complete.length,0);
 const result=await completarR2Grande({bucket,proof:session.proof,
  uploadedParts:parts,secret,now,subtle:webcrypto.subtle});
 assert.equal(result.bytes,meta.bytes);
 assert.equal(result.storageReady,true);
 assert.equal(result.sha256Verificado,false);
 assert.equal(result.contenidoPdfVerificado,false);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.checkoutEnabled,false);
 assert.equal(calls.complete.length,1);
 assert.equal(calls.head.length,1);
});

test('admite uploadId R2 real de 343 caracteres en recibo HMAC sin abrir permisos de pago',async()=>{
 const {bucket}=fixture();
 bucket.createMultipartUpload=async()=>({uploadId:'R'.repeat(343)});
 const session=await start(bucket);
 const claim=await leerReciboR2(session.proof,{secret,now,subtle:webcrypto.subtle});
 assert.equal(claim.uploadId.length,343);
 assert.ok(session.proof.length<4096);
 assert.equal(session.paymentAuthorized,false);
 assert.equal(session.checkoutEnabled,false);
});
test('aborta multipart si Cloudflare entrega uploadId fuera del limite seguro',async()=>{
 const {bucket}=fixture();
 let aborted=0;
 bucket.createMultipartUpload=async()=>({
  uploadId:'Z'.repeat(1025),
  abort:async()=>{aborted++}
 });
 await assert.rejects(start(bucket),/R2_COMPROBANTE_INVALIDO/);
 assert.equal(aborted,1);
});
