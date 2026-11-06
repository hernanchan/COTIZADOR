/**
 * Verificación byte a byte de PDF grande en R2, sin cargarlo en RAM.
 * Usa crypto.DigestStream('SHA-256') de Cloudflare Workers.
 * Esta verificación acredita SOLO bytes/identidad/formato básico; NO páginas,
 * clasificación, importe, registro en Central ni autorización de pago.
 */
import {leerReciboR2} from './r2-pdf-grandes-privado.mjs';
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const PDF_MAGIC=new TextEncoder().encode('%PDF-');
export async function verificarIntegridadR2Grande({
 bucket,proof,secret,now,subtle,
 digestFactory=algorithm=>new crypto.DigestStream(algorithm),
}={}){
 const c=await leerReciboR2(proof,{secret,now,subtle});
 if(!bucket||typeof bucket.get!=='function')
  throw Error('R2_BUCKET_NO_CONECTADO');
 const obj=await bucket.get(c.key);
 if(!obj||obj.size!==c.bytes||!(obj.body instanceof ReadableStream))
  throw Error('R2_OBJETO_INCOMPLETO');
 const digest=digestFactory('SHA-256');
 if(!digest||typeof digest.getWriter!=='function'||!digest.digest)
  throw Error('R2_DIGEST_NO_DISPONIBLE');
 let bytes=0,headerLength=0;
 const header=new Uint8Array(5);
 const counter=new TransformStream({
  transform(chunk,controller){
   if(!(chunk instanceof Uint8Array)||!chunk.byteLength)
    throw Error('R2_CHUNK_INVALIDO');
   if(bytes+chunk.byteLength>c.bytes)
    throw Error('R2_LONGITUD_INCORRECTA');
   const take=Math.min(5-headerLength,chunk.byteLength);
   if(take>0){
    header.set(chunk.subarray(0,take),headerLength);
    headerLength+=take;
   }
   bytes+=chunk.byteLength;
   controller.enqueue(chunk);
  }
 });
 try{await obj.body.pipeThrough(counter).pipeTo(digest)}
 catch{throw Error('R2_LECTURA_INCOMPLETA')}
 if(bytes!==c.bytes)throw Error('R2_LONGITUD_INCORRECTA');
 if(headerLength!==5||header.some((x,i)=>x!==PDF_MAGIC[i]))
  throw Error('R2_NO_ES_PDF');
 let sha;
 try{
  const digestBytes=new Uint8Array(await digest.digest);
  if(digestBytes.length!==32)throw Error('hash');
  sha=hex(digestBytes);
 }catch{throw Error('R2_DIGEST_NO_DISPONIBLE')}
 if(sha!==c.sha256)throw Error('R2_SHA256_NO_COINCIDE');
 return Object.freeze({objectKey:c.key,bytes,sha256:sha,
  // ETag del OBJETO leído, para bloquear cambios entre SHA y descarga.
  etag:typeof obj.etag==='string'&&obj.etag.length>=8&&obj.etag.length<=256
   ?obj.etag:null,
  storageReady:true,sha256Verificado:true,contenidoPdfVerificado:false,
  registeredInD1:false,listoParaProducir:false,checkoutEnabled:false,
  paymentAuthorized:false});
}
