/**
 * Libreria Saber — R2 multipart para originales grandes.
 * Modulo aislado SIN rutas publicas, SIN despliegue y SIN cobros.
 *
 * Requiere que la ruta que lo invoque autentique al comprador, compruebe
 * el pedido y aplique limites por cliente. El proof es un recibo temporal:
 * NO representa verificacion de SHA, paginas o precio.
 *
 * Cloudflare Workers R2: createMultipartUpload, resumeMultipartUpload,
 * uploadPart, complete. Los bytes viajan como Request.body, sin arrayBuffer.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PART=8*1024*1024;
const LOWER=40*1024*1024;
const UPPER=256*1024*1024;
const TTL=2*60*60;
export const R2_BIG_LIMITS=Object.freeze({minExclusiveBytes:LOWER,maxFileBytes:UPPER,
 partBytes:PART,maxFiles:10,maxBatchBytes:1024*1024*1024,receiptLifetimeSeconds:TTL});
const validString=(v,max=256)=>typeof v==='string'&&v.length>0&&v.length<=max;
const base64url=(data)=>{
 const bytes=data instanceof Uint8Array?data:new TextEncoder().encode(data);
 let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const decode=(str)=>{
 if(!/^[A-Za-z0-9_-]+$/.test(str))throw Error('RECIBO_R2_NO_VALIDO');
 const s=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4));
 return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(s,c=>c.charCodeAt(0)));
};
async function hmac(text,secret,subtle){
 if(!validString(secret,2048)||secret.length<32)throw Error('R2_SIN_CLAVE_DE_FIRMA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return base64url(new Uint8Array(await subtle.sign('HMAC',key,new TextEncoder().encode(text))));
}
function validarMeta(m){
 if(!m||typeof m!=='object'||Object.keys(m).sort().join(',')!==
  ['fileId','name','mode','bytes','sha256','pages'].sort().join(',')||
  !FILE.test(m.fileId||'')||!validString(m.name,120)||!/\.pdf$/i.test(m.name)||
  !['bn','color'].includes(m.mode)||
  !Number.isSafeInteger(m.bytes)||m.bytes<=LOWER||m.bytes>UPPER||
  !SHA.test(m.sha256||'')||
  !Number.isInteger(m.pages)||m.pages<1||m.pages>2000)
  throw Error('R2_METADATOS_NO_VALIDOS');
 return m;
}
function validarClaim(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||
  Object.keys(c).sort().join(',')!==
  ['v','orderId','fileId','name','mode','bytes','sha256','pages','key','uploadId','partBytes','parts','issuedAt','expiresAt'].sort().join(',')||
  c.v!==1||!ORDER.test(c.orderId||'')||!FILE.test(c.fileId||'')||
  !validString(c.name,120)||!/\.pdf$/i.test(c.name)||!['bn','color'].includes(c.mode)||
  !SHA.test(c.sha256||'')||!Number.isSafeInteger(c.bytes)||c.bytes<=LOWER||c.bytes>UPPER||
  !Number.isInteger(c.pages)||c.pages<1||c.pages>2000||
  c.partBytes!==PART||c.parts!==Math.ceil(c.bytes/PART)||
  !validString(c.uploadId,256)||!Number.isSafeInteger(c.issuedAt)||
  !Number.isSafeInteger(c.expiresAt)||c.expiresAt-c.issuedAt!==TTL||
  typeof c.key!=='string'||!new RegExp('^r2-v1/'+c.orderId.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+
  '/[a-f0-9-]{36}\\.pdf$','i').test(c.key))
  throw Error('R2_COMPROBANTE_INVALIDO');
 return c;
}
async function firmar(c,secret,subtle){
 const raw=base64url(JSON.stringify(c));
 return raw+'.'+await hmac('saber-r2-grande-v1\n'+raw,secret,subtle);
}
export async function leerReciboR2(proof,{secret,now=()=>Math.floor(Date.now()/1000),
 subtle=crypto.subtle}={}){
 if(!validString(proof,4096)||proof.split('.').length!==2)throw Error('R2_RECIBO_FALTANTE');
 const [raw,signature]=proof.split('.');
 let c;
 try{c=JSON.parse(decode(raw));}catch{throw Error('R2_RECIBO_ILEGIBLE');}
 validarClaim(c);
 if(base64url(JSON.stringify(c))!==raw)throw Error('R2_RECIBO_NO_CANONICO');
 const expected=await hmac('saber-r2-grande-v1\n'+raw,secret,subtle);
 let diff=expected.length^signature.length;
 for(let i=0;i<Math.max(expected.length,signature.length);i++)
  diff|=(expected.charCodeAt(i)||0)^(signature.charCodeAt(i)||0);
 if(diff)throw Error('R2_FIRMA_INCORRECTA');
 const t=now();
 if(!Number.isSafeInteger(t)||t<c.issuedAt-60||t>c.expiresAt)throw Error('R2_RECIBO_VENCIDO');
 return Object.freeze(c);
}
export function bytesParteR2(c,number){
 if(!Number.isInteger(number)||number<1||number>c.parts)throw Error('R2_PARTE_INCORRECTA');
 return number===c.parts?c.bytes-PART*(number-1):PART;
}
export async function iniciarR2Grande({bucket,orderId,meta,secret,uuid=()=>crypto.randomUUID(),
 now=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle}={}){
 if(!ORDER.test(orderId||''))throw Error('R2_ORDEN_INCORRECTA');
 validarMeta(meta);
 if(!bucket||typeof bucket.createMultipartUpload!=='function')throw Error('R2_BUCKET_NO_CONECTADO');
 const id=uuid();
 if(!UUID.test(id))throw Error('R2_IDENTIFICADOR_INCORRECTO');
 const issuedAt=now();
 if(!Number.isSafeInteger(issuedAt))throw Error('R2_RELOJ_INCORRECTO');
 const key='r2-v1/'+orderId+'/'+id+'.pdf';
 // Comprobar clave ANTES de crear carga temporal.
 await hmac('preflight',secret,subtle);
 const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'application/pdf'}});
 const c=validarClaim({v:1,orderId,fileId:meta.fileId,name:meta.name,
  mode:meta.mode,bytes:meta.bytes,sha256:meta.sha256,pages:meta.pages,
  key,uploadId:upload.uploadId,partBytes:PART,parts:Math.ceil(meta.bytes/PART),
  issuedAt,expiresAt:issuedAt+TTL});
 return Object.freeze({proof:await firmar(c,secret,subtle),
  fileId:c.fileId,bytes:c.bytes,partBytes:c.partBytes,parts:c.parts,
  expiresAt:c.expiresAt,checkoutEnabled:false,paymentAuthorized:false});
}
/** Endpoints deben exigir autenticacion del pedido ANTES de llamar esta funcion. */
export async function subirParteR2Grande({bucket,proof,partNumber,request,secret,now,subtle}={}){
 const c=await leerReciboR2(proof,{secret,now,subtle});
 if(!bucket||typeof bucket.resumeMultipartUpload!=='function')
  throw Error('R2_BUCKET_NO_CONECTADO');
 if(!(request instanceof Request)||request.method!=='PUT'||!request.body)
  throw Error('R2_SOLICITUD_INCORRECTA');
 const origin=new URL(request.url).origin;
 if(new URL(request.url).protocol!=='https:'||request.headers.get('Origin')!==origin||
  (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  throw Error('R2_ORIGEN_NO_AUTORIZADO');
 const expected=bytesParteR2(c,partNumber);
 if(Number(request.headers.get('Content-Length'))!==expected||
  !request.headers.has('Content-Length'))throw Error('R2_TAMANO_PARTE_INCORRECTO');
 const multipart=bucket.resumeMultipartUpload(c.key,c.uploadId);
 // R2 admite Request.body con longitud conocida: no copiar PDF en memoria Worker.
 const uploaded=await multipart.uploadPart(partNumber,request.body);
 if(uploaded?.partNumber!==partNumber||!validString(uploaded.etag,256))
  throw Error('R2_PARTE_SIN_CONFIRMACION');
 return Object.freeze({partNumber,etag:uploaded.etag,bytes:expected,
  paymentAuthorized:false});
}
/** No acredita trabajo ni habilita cobro: faltan hash y analisis PDF en servidor. */
export async function completarR2Grande({bucket,proof,uploadedParts,secret,now,subtle}={}){
 const c=await leerReciboR2(proof,{secret,now,subtle});
 if(!bucket||typeof bucket.resumeMultipartUpload!=='function'||typeof bucket.head!=='function')
  throw Error('R2_BUCKET_NO_CONECTADO');
 if(!Array.isArray(uploadedParts)||uploadedParts.length!==c.parts)
  throw Error('R2_PARTES_INCOMPLETAS');
 const parts=uploadedParts.map((p,i)=>{
  if(!p||Object.keys(p).sort().join(',')!=='etag,partNumber'||
   p.partNumber!==i+1||!validString(p.etag,256)||
   !/^[a-zA-Z0-9:"_-]{3,256}$/.test(p.etag))
   throw Error('R2_PARTES_NO_VALIDAS');
  return {partNumber:p.partNumber,etag:p.etag};
 });
 const multipart=bucket.resumeMultipartUpload(c.key,c.uploadId);
 const result=await multipart.complete(parts);
 const stored=await bucket.head(c.key);
 if(!result||!stored||stored.size!==c.bytes)
  throw Error('R2_OBJETO_INCOMPLETO');
 return Object.freeze({objectKey:c.key,bytes:stored.size,sha256:c.sha256,
  storageReady:true,sha256Verificado:false,contenidoPdfVerificado:false,
  checkoutEnabled:false,paymentAuthorized:false});
}
