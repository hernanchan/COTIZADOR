/**
 * Descarga experimental de R2 por referencia D1: no depende del proof de 2h.
 * TODO: vincular a pedido comercial y ZIP solo despues de paginas+precio.
 * Esta version permite a personal autentico descargar ORIGINALES PENDIENTES
 * para evaluar recepcion, nunca declara el trabajo listo ni pagado.
 */
import {consultarR2PendienteCentral} from './r2-grandes-lookup-central.mjs';
import {verificarObjetoR2Reservado} from './r2-pdf-integridad-stream.mjs';
const ROUTE='/prueba-v2/api/ensayo-r2-descargar-d1-personal';
const respond=(error,status)=>new Response(JSON.stringify({
 ok:false,error,paymentAuthorized:false,registeredInD1:false,
}),{status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const PDF_MAGIC=new TextEncoder().encode('%PDF-');
export async function verificarObjetoR2Pendiente({
 bucket,entry,digestFactory=algo=>new crypto.DigestStream(algo)
}={}){
 if(!bucket||typeof bucket.get!=='function'||!entry||
  entry.status!=='awaiting_pdf_analysis'||entry.contenidoPdfVerificado!==false||
  entry.registeredInD1!==false||entry.paymentAuthorized!==false||
  !/^r2-v1\/WEB-[A-Za-z0-9_-]{5,80}\/[a-f0-9-]{36}\.pdf$/i.test(entry.objectKey||'')||
  !/^[a-f0-9]{64}$/.test(entry.sha256||'')||
  !Number.isSafeInteger(entry.bytes)||entry.bytes<=40*1024*1024||
  entry.bytes>256*1024*1024||
  typeof entry.etag!=='string'||entry.etag.length<8)
  throw Error('R2_REFERENCIA_NO_VERIFICADA');
 // La referencia proviene EXCLUSIVAMENTE de lookup HMAC en D1.
 // Usar la verificación R2 POR RANGOS que ya pasó la prueba real de 60MiB.
 // Evita una única cadena pipeThrough sobre 60-200MiB dentro del Worker.
 if(typeof bucket.head==='function'){
  const orderId=entry.webOrderId;
  if(!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(orderId||'')||
     !entry.objectKey.startsWith('r2-v1/'+orderId+'/')||
     !/^[A-Za-z0-9_-]{1,80}$/.test(entry.fileId||''))
   throw Error('R2_REFERENCIA_NO_VERIFICADA');
  const verified=await verificarObjetoR2Reservado({bucket,reserva:{
   found:true,objectKey:entry.objectKey,orderId,
   fileId:entry.fileId,sha256:entry.sha256,bytes:entry.bytes
  },...(digestFactory?{digestFactory}:{})});
  if(verified.sha256Verificado!==true||
     verified.bytes!==entry.bytes||verified.sha256!==entry.sha256||
     verified.etag!==entry.etag)
   throw Error('R2_REFERENCIA_SHA_ETAG_NO_COINCIDE');
  return Object.freeze({objectKey:entry.objectKey,etag:verified.etag,
   bytes:entry.bytes,sha256:verified.sha256,sha256Verificado:true,
   contenidoPdfVerificado:false,paymentAuthorized:false});
 }

 const object=await bucket.get(entry.objectKey);
 if(!object||object.size!==entry.bytes||object.etag!==entry.etag||
  !(object.body instanceof ReadableStream))
  throw Error('R2_OBJETO_DISTINTO_DE_D1');
 const digest=digestFactory('SHA-256');
 if(!digest||typeof digest.getWriter!=='function'||!digest.digest)
  throw Error('R2_DIGEST_NO_DISPONIBLE');
 let read=0,magicRead=0;const magic=new Uint8Array(5);
 const counter=new TransformStream({transform(chunk,controller){
  if(!(chunk instanceof Uint8Array)||chunk.byteLength===0||
   read+chunk.byteLength>entry.bytes)throw Error('R2_LONGITUD_INCORRECTA');
  const n=Math.min(5-magicRead,chunk.byteLength);
  if(n>0){magic.set(chunk.subarray(0,n),magicRead);magicRead+=n}
  read+=chunk.byteLength;
  controller.enqueue(chunk);
 }});
 try{await object.body.pipeThrough(counter).pipeTo(digest)}
 catch{throw Error('R2_LECTURA_INCOMPLETA')}
 if(read!==entry.bytes)throw Error('R2_LONGITUD_INCORRECTA');
 if(magicRead!==5||magic.some((x,i)=>x!==PDF_MAGIC[i]))
  throw Error('R2_CABECERA_INCORRECTA');
 const hash=hex(new Uint8Array(await digest.digest));
 if(hash!==entry.sha256)throw Error('R2_SHA256_NO_COINCIDE');
 return Object.freeze({objectKey:entry.objectKey,etag:entry.etag,
  bytes:entry.bytes,sha256:hash,sha256Verificado:true,
  contenidoPdfVerificado:false,paymentAuthorized:false});
}
export async function descargarR2PendientePorD1Personal(request,env,{
 authorized=false,lookup=consultarR2PendienteCentral,
 digestFactory,verify=verificarObjetoR2Pendiente
}={}){
 if(!authorized)return respond('Acceso exclusivo del personal.',403);
 if(env?.DOCS_R2_BIG_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env?.SABER_R2_GRANDES?.get!=='function')
  return respond('Descarga R2 deshabilitada.',503);
 const url=new URL(request.url);
 if(request.method!=='POST'||url.protocol!=='https:'||url.pathname!==ROUTE||
  url.search||url.hash||request.headers.get('Origin')!==url.origin||
  (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return respond('Solicitud no autorizada.',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return respond('Solicitud inválida.',415);
 try{
  if(Number(request.headers.get('Content-Length')||'0')>2000)
   return respond('Solicitud demasiado extensa.',413);
  const raw=await request.text();
  if(raw.length>2000)return respond('Solicitud demasiado extensa.',413);
  const input=JSON.parse(raw);
  if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).sort().join(',')!=='orderId,receiptId')
   return respond('Referencia de PDF incorrecta.',422);
  // La función lookup firma con HMAC y la Central confirma el recibo.
  // No aceptar rutas de objetos ni SHA enviados por el navegador.
  const entry=await lookup(env,input);
  if(!entry||entry.webOrderId!==input.orderId||
   entry.receiptId!==input.receiptId)
   return respond('El archivo no pertenece al pedido.',409);
  const checked=await verify({bucket:env.SABER_R2_GRANDES,entry,
   ...(digestFactory?{digestFactory}:{})});
  if(!checked||checked.sha256Verificado!==true||
   checked.sha256!==entry.sha256||checked.bytes!==entry.bytes||
   checked.etag!==entry.etag)
   return respond('No se verificó el PDF.',409);
  const download=await env.SABER_R2_GRANDES.get(entry.objectKey,{
   onlyIf:{etagMatches:entry.etag}
  });
  if(!download||download.etag!==entry.etag||download.size!==entry.bytes||
   !(download.body instanceof ReadableStream))
   return respond('El archivo cambió luego de verificarlo.',409);
  const name=entry.receiptId+'.pdf';
  return new Response(download.body,{status:200,headers:{
   'Content-Type':'application/pdf','Content-Length':String(entry.bytes),
   'Content-Disposition':'attachment; filename="'+name+'"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'
  }});
 }catch{
  return respond('El archivo R2 no está disponible o no está autorizado.',422);
 }
}
