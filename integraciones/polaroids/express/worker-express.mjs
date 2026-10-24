/**
 * Cloudflare Pages: POST /api/polaroids-express
 * Sólo recortes JPEG optimizados en tránsito; crea PDF en Worker y lo guarda
 * por HMAC en Apps Script. No R2, KV, D1 ni carpeta de originales.
 * Tres interruptores obligatorios: config aprobada, Worker habilitado,
 * y recepción PDF de GAS habilitada, todos APAGADOS por defecto.
 */
import * as pdfLib from 'pdf-lib';
import {EXPRESS,guardarPedidoPdfExpress} from './motor-pdf.mjs';
import {guardarPdfPrivadoEnGAS} from './guardar-pdf-privado.mjs';
import {enviarPolaroidsACentral} from './enviar-central-express.mjs';
const REF=/^POL-[A-F0-9]{24}$/;
const B64=/^[A-Za-z0-9+/]+={0,2}$/;
const BODY_LIMIT=18*1024*1024;
const TURNSTILE_API='https://challenges.cloudflare.com/turnstile/v0/siteverify';
function json(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
 }});
}
export function originMatches(request,env){
 const host=String(env?.EXPRESS_ALLOWED_HOST||'');
 if(!/^[a-z0-9.-]{4,120}$/.test(host))return false;
 const url=new URL(request.url);
 return url.protocol==='https:'&&url.hostname===host&&
   url.port===''&&request.headers.get('Origin')===url.origin&&
   (!request.headers.get('Sec-Fetch-Site')||
    request.headers.get('Sec-Fetch-Site')==='same-origin');
}
export async function privateConfig(request,env){
 if(env?.EXPRESS_RECEPTION_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.EXPRESS_PDF_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.EXPRESS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof env?.EXPRESS_PDF_HMAC_KEY!=='string'||env.EXPRESS_PDF_HMAC_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.EXPRESS_PDF_HMAC_KEY||
    !env?.ASSETS?.fetch)
  return false;
 try{
  const url=new URL('/polaroids/recepcion-config.json',request.url);
  const response=await env.ASSETS.fetch(new Request(url.href,{cache:'no-store'}));
  if(!response.ok)return false;
  const text=await response.text();
  if(text.length>4096)return false;
  const data=JSON.parse(text);
  return data?.enabled===true&&data.rollout==='APROBADO'&&
   data.delivery==='express-pdf-only'&&
   data.maxSheetsForRealUploads===4&&
   data.allowedHost===new URL(request.url).hostname&&
   typeof data.turnstileSiteKey==='string'&&data.turnstileSiteKey.startsWith('0x');
 }catch(_){return false}
}
async function readJsonLimited(request){
 if(!request.body)throw Error('No hay fotos para enviar.');
 const known=Number(request.headers.get('Content-Length'));
 if(Number.isFinite(known)&&known>BODY_LIMIT)throw Error('Límite de transmisión excedido.');
 const reader=request.body.getReader();
 let parts=[],size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>BODY_LIMIT){await reader.cancel();throw Error('Límite de transmisión excedido.');}
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 const joined=new Uint8Array(size);let offset=0;
 for(const part of parts){joined.set(part,offset);offset+=part.length;}
 parts=[];
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined));
}
function parsePayload(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).sort().join(',')!=='hojas,reference,turnstileToken'||
    !REF.test(payload.reference||'')||
    typeof payload.turnstileToken!=='string'||payload.turnstileToken.length<8||
    payload.turnstileToken.length>2048||
    !Array.isArray(payload.hojas)||payload.hojas.length<1||payload.hojas.length>4)
  throw Error('Pedido Express no válido.');
 let count=0,photos=[];
 for(let i=0;i<payload.hojas.length;i++){
  const sheet=payload.hojas[i];
  if(!Array.isArray(sheet)||sheet.length<1||sheet.length>6||
     (i<payload.hojas.length-1&&sheet.length!==6))
   throw Error('El pedido debe contener hasta seis fotos por hoja.');
  const frames=[];
  for(const data of sheet){
   if(typeof data!=='string'||data.length<110||
      data.length>Math.ceil(EXPRESS.maxRecorteBytes/3)*4+4||
      !B64.test(data)||data.length%4!==0)
    throw Error('Fotografía optimizada inválida.');
   let raw;
   try{raw=atob(data)}catch(_){throw Error('Foto JPEG inválida.')}
   if(raw.length<80||raw.length>EXPRESS.maxRecorteBytes)
    throw Error('Fotografía fuera del límite.');
   const buffer=Uint8Array.from(raw,x=>x.charCodeAt(0));
   if(buffer[0]!==255||buffer[1]!==216||buffer[2]!==255)
    throw Error('La foto no está en JPEG.');
   frames.push(buffer);count++;
  }
  photos.push(frames);
 }
 if(count>24)throw Error('Máximo 24 fotografías.');
 return {reference:payload.reference,turnstileToken:payload.turnstileToken,
  hojas:photos,fotos:count};
}
export async function validateChallenge(token,request,env,fetcher){
 if(typeof env?.EXPRESS_TURNSTILE_SECRET!=='string'||
    env.EXPRESS_TURNSTILE_SECRET.length<16)throw Error('Turnstile no disponible.');
 const url=new URL(request.url);
 const data=new URLSearchParams({secret:env.EXPRESS_TURNSTILE_SECRET,response:token});
 const remote=request.headers.get('CF-Connecting-IP');
 if(remote&&remote.length<80)data.set('remoteip',remote);
 const response=await fetcher(TURNSTILE_API,{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:data.toString(),redirect:'error',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error('No se pudo verificar seguridad.');
 const text=await response.text();
 if(text.length>2500)throw Error('Verificación de seguridad inválida.');
 let result;try{result=JSON.parse(text)}catch(_){throw Error('Respuesta Turnstile inválida.')}
 if(result?.success!==true||result.hostname!==url.hostname||
    result.action!=='polaroids-express')
  throw Error('El control de seguridad fue rechazado.');
}
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 const trustedHost=url.protocol==='https:'&&url.hostname===env?.EXPRESS_ALLOWED_HOST&&
   url.port===''&&await privateConfig(request,env);
 const enabled=Boolean(trustedHost);
 return json({ok:true,service:'polaroids-express',
  enabled,photosPerSheet:6,maxPhotos:24,pdfForClient:false});
}
export async function onRequestPost({request,env,fetcher=fetch}){
 if(!originMatches(request,env))
  return json({ok:false,error:'Origen no autorizado.'},403);
 if(!await privateConfig(request,env))
  return json({ok:false,error:'Polaroids Express todavía no está habilitado.'},503);
 if(request.method!=='POST'||!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return json({ok:false,error:'Formato no permitido.'},415);
 let order;
 try{order=parsePayload(await readJsonLimited(request));}
 catch(_){return json({ok:false,error:'Revisá la cantidad o tamaño de las fotos.'},413);}
 try{await validateChallenge(order.turnstileToken,request,env,fetcher);}
 catch(_){return json({ok:false,error:'Completá de nuevo la verificación de seguridad.'},403);}
 try{
  const receipt=await guardarPedidoPdfExpress({
   referencia:order.reference,hojas:order.hojas,pdfLib,
   guardarPdfPrivado:x=>guardarPdfPrivadoEnGAS({...x,env,fetcher})
  });
  // Fail closed: un PDF en Drive no constituye pedido hasta registrarlo en
  // la Central. Reintentar la misma referencia es idempotente en ambos lados.
  const central=await enviarPolaroidsACentral({recibo:receipt,env,fetcher});
  if(central.registrado!==true||central.referencia!==receipt.referencia)
   throw Error('La Central no confirmó la recepción.');
  return json({ok:true,verified:true,reference:receipt.referencia,
   sheets:receipt.hojas,photos:receipt.fotos,
   pdfPrivateConfirmed:true,priceReference:receipt.precioOrientativo,
   pdfForClient:false,checkoutAuthorized:false});
 }catch(_){
  // Puede existir PDF en Google tras un timeout. Reintentar con el mismo
  // reference y nuevas credenciales Turnstile; GAS garantiza idempotencia.
  return json({ok:false,verified:false,
   error:'No se pudo confirmar el PDF privado. Conservá esta pantalla para reintentar.',
   checkoutAuthorized:false},502);
 }
}
