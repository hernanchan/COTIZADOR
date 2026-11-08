/**
 * Verificación byte a byte de PDF grande en R2, sin cargarlo en RAM.
 * Usa crypto.DigestStream('SHA-256') de Cloudflare Workers.
 * Esta verificación acredita SOLO bytes/identidad/formato básico; NO páginas,
 * clasificación, importe, registro en Central ni autorización de pago.
 */
import {leerReciboR2} from './r2-pdf-grandes-privado.mjs';
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const PDF_MAGIC=new TextEncoder().encode('%PDF-');

const RANGE_BYTES=8*1024*1024;
/**
 * Lectura real R2 en ventanas acotadas: probada con 200 MiB en Cloudflare.
 * Mantiene UNA sola cadena SHA256, no hashes independientes por trozo.
 * Con 256 MiB hace 32 GET + head (<50 subrequests del plan Free).
 * ETag fijo evita aceptar una mutacion entre rangos.
 */
async function verificarIntegridadConRangos(bucket,c,digestFactory){
 const head=await bucket.head(c.key);
 if(!head||head.size!==c.bytes||typeof head.etag!=='string'||
    head.etag.length<8||head.etag.length>256)
  throw Error('R2_OBJETO_INCOMPLETO');
 const digest=digestFactory('SHA-256');
 if(!digest||typeof digest.getWriter!=='function'||!digest.digest)
  throw Error('R2_DIGEST_NO_DISPONIBLE');
 const writer=digest.getWriter();
 // El rechazo del digest tras abort() debe observarse, no quedar sin manejar.
 void Promise.resolve(digest.digest).catch(()=>{});
 let bytes=0,headerLength=0;
 const header=new Uint8Array(5);
 try{
  for(let offset=0;offset<c.bytes;offset+=RANGE_BYTES){
   const len=Math.min(RANGE_BYTES,c.bytes-offset);
   const part=await bucket.get(c.key,{
    range:{offset,length:len},
    onlyIf:{etagMatches:head.etag}
   });
   if(!part||typeof part.arrayBuffer!=='function')
    throw Error('R2_ETAG_O_RANGO_INCORRECTO');
   const chunk=new Uint8Array(await part.arrayBuffer());
   if(chunk.byteLength!==len)throw Error('R2_LONGITUD_INCORRECTA');
   if(headerLength<5){
    const take=Math.min(5-headerLength,chunk.byteLength);
    header.set(chunk.subarray(0,take),headerLength);
    headerLength+=take;
   }
   await writer.write(chunk);
   bytes+=chunk.byteLength;
  }
  await writer.close();
 }catch(error){
  try{await writer.abort(error)}catch{}
  throw error;
 }
 if(bytes!==c.bytes)throw Error('R2_LONGITUD_INCORRECTA');
 if(headerLength!==5||header.some((x,i)=>x!==PDF_MAGIC[i]))
  throw Error('R2_NO_ES_PDF');
 let sha;
 try{
  const result=new Uint8Array(await digest.digest);
  if(result.length!==32)throw Error('hash');
  sha=hex(result);
 }catch{throw Error('R2_DIGEST_NO_DISPONIBLE')}
 if(sha!==c.sha256)throw Error('R2_SHA256_NO_COINCIDE');
 return Object.freeze({objectKey:c.key,bytes,sha256:sha,etag:head.etag,
  storageReady:true,sha256Verificado:true,contenidoPdfVerificado:false,
  registeredInD1:false,listoParaProducir:false,checkoutEnabled:false,
  paymentAuthorized:false});
}
export async function verificarIntegridadR2Grande({
 bucket,proof,secret,now,subtle,
 digestFactory=algorithm=>new crypto.DigestStream(algorithm),
}={}){
 const c=await leerReciboR2(proof,{secret,now,subtle});
 if(!bucket||typeof bucket.get!=='function')
  throw Error('R2_BUCKET_NO_CONECTADO');
 // Cloudflare real usa head+lecturas por rango para no abrir 200 MiB a la vez.
 // El fallback de flujo continuo mantiene la compatibilidad de mocks sin head.
 if(typeof bucket.head==='function')
  return verificarIntegridadConRangos(bucket,c,digestFactory);
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


/**
 * Recuperación postpago sin proof transitorio: la identidad del objeto
 * procede exclusivamente de la reserva D1 consultada por HMAC. No acepta
 * rutas de R2 del comprador. Reutiliza la misma verificación real SHA-256.
 */
export async function verificarObjetoR2Reservado({
 bucket,reserva,digestFactory=algorithm=>new crypto.DigestStream(algorithm)
}={}){
 const key=reserva?.objectKey;
 if(!reserva||reserva.found!==true||
    typeof key!=='string'||
    !/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.pdf$/i.test(key)||
    !key.startsWith('r2-v1/'+reserva.orderId+'/')||
    typeof reserva.fileId!=='string'||reserva.fileId.length<1||
    !/^[a-f0-9]{64}$/.test(reserva.sha256||'')||
    !Number.isSafeInteger(reserva.bytes)||
    reserva.bytes<=40*1024*1024||reserva.bytes>256*1024*1024||
    typeof bucket?.head!=='function'||typeof bucket?.get!=='function')
  throw Error('R2_RESERVA_NO_CONFIABLE');
 return verificarIntegridadConRangos(bucket,{
  key,bytes:reserva.bytes,sha256:reserva.sha256
 },digestFactory);
}
