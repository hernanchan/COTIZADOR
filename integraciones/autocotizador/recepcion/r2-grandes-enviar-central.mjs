/**
 * Enlace desde documentos a cola preliminar R2 de la Central D1.
 * No genera pedido, precio, numeracion ni checkout.
 * Solo acepta SHA calculado sobre R2 y ETag del objeto real.
 */
import {validarPreRecepcionR2} from '../../mercadopago/pruebas/r2-grandes-central-pendientes.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const HEX=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export function prepararPreRecepcionR2(claim,verified){
 if(!claim||!verified||verified.storageReady!==true||
  verified.sha256Verificado!==true||verified.contenidoPdfVerificado!==false||
  verified.objectKey!==claim.key||verified.sha256!==claim.sha256||
  verified.bytes!==claim.bytes||typeof verified.etag!=='string')
  throw Error('R2_NO_VERIFICADO_PARA_CENTRAL');
 const file=claim.key.split('/').at(-1);
 const receiptId='DOC-'+file.slice(0,-4);
 return validarPreRecepcionR2({
  schema:'saber-central-r2-grande-pendiente-v1',
  orderId:claim.orderId,fileId:claim.fileId,receiptId,
  name:claim.name,bytes:claim.bytes,sha256:verified.sha256,
  objectKey:claim.key,etag:verified.etag,pagesDeclaradas:claim.pages,
  sha256Verificado:true,contenidoPdfVerificado:false,
  registeredInD1:false,paymentAuthorized:false,listoParaProducir:false
 });
}
export async function enviarPreRecepcionR2Central({
 env,claim,verified,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),
 uuid=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY')
  return Object.freeze({stagedForCentral:false,paymentAuthorized:false,registeredInD1:false});
 if(env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')
  throw Error('R2_CENTRAL_NO_CONFIGURADA');
 const p=prepararPreRecepcionR2(claim,verified);
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{throw Error('R2_CENTRAL_URL_INVALIDA')}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
  target.username||target.password||target.search||target.hash||
  target.pathname!=='/internal/central/stage')
  throw Error('R2_CENTRAL_URL_INVALIDA');
 target.pathname='/internal/central/r2-pending-stage';
 const body=JSON.stringify(p),id=uuid(),time=now();
 if(body.length>4000||!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(time))
  throw Error('R2_CENTRAL_MANIFIESTO_INVALIDO');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=HEX(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(time+'\n'+id+'\n'+body))));
 const answer=await service.fetch(new Request(target.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(time),'x-saber-request-id':id,'x-saber-signature':sig},
  body
 }));
 if(!answer.ok)throw Error('R2_CENTRAL_RECHAZO_REGISTRO');
 const text=await answer.text();
 if(text.length>1600)throw Error('R2_CENTRAL_RESPUESTA_INVALIDA');
 let data;try{data=JSON.parse(text)}catch{throw Error('R2_CENTRAL_RESPUESTA_INVALIDA')}
 if(data?.ok!==true||data.saved!==true||data.webOrderId!==p.orderId||
  data.status!=='awaiting_pdf_analysis'||data.registeredInD1!==false||
  data.paymentAuthorized!==false)
  throw Error('R2_CENTRAL_CONFIRMACION_INVALIDA');
 return Object.freeze({stagedForCentral:true,paymentAuthorized:false,
  registeredInD1:false,receiptId:p.receiptId,orderId:p.orderId});
}
