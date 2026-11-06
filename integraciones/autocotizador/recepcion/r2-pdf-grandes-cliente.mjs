/**
 * Transporte R2 alternativo para archivos grandes de Saber.
 *
 * NO invocado por el cotizador hasta habilitar R2, crear endpoints autenticados,
 * agregar binding y validar PDF del servidor. Guarda progreso solo por pestaña
 * para reintentar partes (sin originales en sessionStorage ni reducir calidad).
 */
import {R2_BIG_LIMITS} from './r2-pdf-grandes-privado.mjs';
const BASE='/prueba-v2/api/ensayo-r2';
const pattern=/^WEB-[A-Za-z0-9_-]{5,80}$/;
function keyFor(orderId,m){return 'saber-r2-test-v1:'+orderId+':'+m.fileId+':'+m.sha256+':'+m.bytes}
function bytesFor(total,partNo,partSize){return Math.min(partSize,total-(partNo-1)*partSize)}
function safeRead(storage,key){
 try{
  const json=JSON.parse(storage?.getItem(key)||'null');
  if(!json||json.v!==1||!json.session||typeof json.session.proof!=='string'||
   !Number.isSafeInteger(json.session.expiresAt)||json.session.expiresAt<Math.floor(Date.now()/1000)+60||
   !json.parts||typeof json.parts!=='object'||Array.isArray(json.parts))return null;
  return json;
 }catch{return null}
}
function store(storage,key,value){
 if(storage)storage.setItem(key,JSON.stringify(value));
}
function validateSession(s,m){
 if(!s||s.fileId!==m.fileId||s.bytes!==m.bytes||
  s.partBytes!==R2_BIG_LIMITS.partBytes||
  s.parts!==Math.ceil(m.bytes/R2_BIG_LIMITS.partBytes)||
  typeof s.proof!=='string'||s.proof.length<40||s.proof.length>4096||
  !Number.isSafeInteger(s.expiresAt)||
  s.paymentAuthorized!==false||s.checkoutEnabled!==false)
  throw Error('R2_SESION_NO_CONFIABLE');
 return s;
}
async function post(fetcher,route,data,signal){
 const r=await fetcher(BASE+route,{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(data),signal,redirect:'error'});
 const json=await r.json().catch(()=>null);
 if(!r.ok||json?.ok!==true)throw Error(json?.error||'No se pudo completar la recepción R2.');
 return json;
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/**
 * El Worker debe exponer rutas protegidas /iniciar, /parte?n=, /completar.
 * Las respuestas de completar NO pueden autorizar pago ni acreditar precio.
 * apiEndpoint se mantiene fijo por diseño para impedir exfiltración.
 */
export async function enviarArchivoR2Grande({
 file,orderId,meta,fetcher=fetch,
 storage=typeof sessionStorage==='undefined'?null:sessionStorage,
 onProgress=()=>{},signal,retries=2,concurrency=3
}={}){
 if(!pattern.test(orderId||'')||!file||typeof file.slice!=='function'||
  !Number.isSafeInteger(file.size)||!meta||meta.bytes!==file.size||
  file.size<=R2_BIG_LIMITS.minExclusiveBytes||
  file.size>R2_BIG_LIMITS.maxFileBytes||
  !Number.isInteger(concurrency)||concurrency<1||concurrency>4||
  !Number.isInteger(retries)||retries<0||retries>4||
  typeof onProgress!=='function')throw Error('R2_ARCHIVO_NO_ADMITIDO');
 const key=keyFor(orderId,meta);
 let state=safeRead(storage,key);
 if(!state){
  onProgress({phase:'autorizacion',percent:0});
  const started=await post(fetcher,'/iniciar',{orderId,meta},signal);
  const session=validateSession(started.session,meta);
  state={v:1,session,parts:{}};
  store(storage,key,state);
 }
 const session=validateSession(state.session,meta);
 // Estado persistido no es autoridad: el servidor verifica ETags contra R2.
 for(const k of Object.keys(state.parts)){
  const n=Number(k),etag=state.parts[k];
  if(!Number.isInteger(n)||n<1||n>session.parts||
   !/^[a-zA-Z0-9:"_-]{3,256}$/.test(etag))delete state.parts[k];
 }
 const current=()=>Object.keys(state.parts).reduce((sum,n)=>
  sum+bytesFor(file.size,Number(n),session.partBytes),0);
 const progress=()=>onProgress({phase:'transferencia',totalBytes:file.size,
  bytesUploaded:current(),percent:Math.floor(current()*100/file.size)});
 progress();
 const queue=Array.from({length:session.parts},(_,i)=>i+1).filter(n=>!state.parts[n]);
 let cursor=0;
 async function worker(){
  while(cursor<queue.length){
   if(signal?.aborted)throw Error('R2_CARGA_CANCELADA');
   const n=queue[cursor++];
   const first=(n-1)*session.partBytes,len=bytesFor(file.size,n,session.partBytes);
   const chunk=file.slice(first,first+len,'application/octet-stream');
   if(chunk.size!==len)throw Error('R2_CORTE_INCORRECTO');
   let success=false,lastError=null;
   for(let attempt=0;attempt<=retries&&!success;attempt++){
    try{
     const r=await fetcher(BASE+'/parte?n='+n,{method:'PUT',credentials:'same-origin',
      headers:{'X-Saber-R2-Proof':session.proof},
      body:chunk,signal,redirect:'error'});
     const data=await r.json().catch(()=>null);
     if(!r.ok||data?.ok!==true||data.partNumber!==n||
      !/^[a-zA-Z0-9:"_-]{3,256}$/.test(data.etag||''))
      throw Error(data?.error||'R2_PARTE_NO_CONFIRMADA');
     state.parts[n]=data.etag;store(storage,key,state);progress();
     success=true;
    }catch(e){
     lastError=e;
     if(signal?.aborted)throw e;
     if(attempt<retries)await wait(300*(attempt+1));
    }
   }
   if(!success)throw lastError||Error('R2_TRANSFERENCIA_INCOMPLETA');
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},()=>worker()));
 const uploadedParts=Array.from({length:session.parts},(_,i)=>({
  partNumber:i+1,etag:state.parts[i+1]
 }));
 if(uploadedParts.some(p=>typeof p.etag!=='string'))
  throw Error('R2_PARTES_NO_CONFIRMADAS');
 onProgress({phase:'verificacion-almacenamiento',bytesUploaded:file.size,
  totalBytes:file.size,percent:100});
 if(state.completed!==true){
  const finalized=await post(fetcher,'/completar',{proof:session.proof,uploadedParts},signal);
  if(finalized.result?.storageReady!==true||
   finalized.result.sha256Verificado!==false||
   finalized.result.paymentAuthorized!==false||
   finalized.result.bytes!==file.size)
   throw Error('R2_RESPUESTA_INCONSISTENTE');
  // Completar multipart consume uploadId: guardar el estado antes de verificar.
  // Si la verificación de bytes falla por red, no completar de nuevo.
  state.completed=true;
  store(storage,key,state);
 }
 onProgress({phase:'verificando-integridad',bytesUploaded:file.size,
  totalBytes:file.size,percent:100});
 const verified=await post(fetcher,'/verificar',{proof:session.proof},signal);
 if(verified.result?.sha256Verificado!==true||
  verified.result?.contenidoPdfVerificado!==false||
  verified.result?.paymentAuthorized!==false||
  verified.result?.registeredInD1!==false||
  verified.result?.bytes!==file.size||
  verified.result?.sha256!==meta.sha256)
  throw Error('R2_SHA256_SIN_VERIFICAR');
 storage?.removeItem(key);
 return verified.result;
}
