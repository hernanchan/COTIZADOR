/** Enlace HMAC del recibo R2 ya verificado hacia un PDF del lote universal.
 * El endpoint D1 valida pago conciliado + reserva + objeto + cotización.
 */
import {prepararPreRecepcionR2} from './r2-grandes-enviar-central.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
export async function registrarOriginalUniversalR2({
 env,claim,verified,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY')
  return {universal:false,saved:false};
 if(env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  throw Error('R2_CENTRAL_UNIVERSAL_NO_CONFIGURADA');
 const proven=prepararPreRecepcionR2(claim,verified);
 let uri;try{uri=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!uri||uri.protocol!=='https:'||!HOST.test(uri.hostname)||
    uri.pathname!=='/internal/central/stage'||uri.username||uri.password||
    uri.port||uri.hash||uri.search)
  throw Error('R2_CENTRAL_UNIVERSAL_URL');
 uri.pathname='/internal/central/r2-universal-received';
 const data={schema:'saber-central-r2-universal-received-v1',
  orderId:proven.orderId,fileId:proven.fileId,receiptId:proven.receiptId,
  name:proven.name,sha256:proven.sha256,bytes:proven.bytes,
  objectKey:proven.objectKey,pages:proven.pagesDeclaradas};
 const body=JSON.stringify(data),ts=now(),id=nonce();
 if(body.length>3000||!Number.isSafeInteger(ts)||
    !/^[a-f0-9-]{36}$/i.test(id))
  throw Error('R2_CENTRAL_UNIVERSAL_FIRMA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let response;try{response=await service.fetch(new Request(uri.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':sig},body
 }))}catch{throw Error('R2_CENTRAL_UNIVERSAL_NO_RESPONDE')}
 if(response.status===404)return {universal:false,saved:false};
 if(!response.ok)throw Error('R2_CENTRAL_UNIVERSAL_PENDIENTE');
 const raw=await response.text();
 if(raw.length>1600)throw Error('R2_CENTRAL_UNIVERSAL_RESPUESTA');
 let answer;try{answer=JSON.parse(raw)}catch{throw Error('R2_CENTRAL_UNIVERSAL_RESPUESTA')}
 if(answer?.ok!==true||answer.saved!==true||
    answer.webOrderId!==proven.orderId||answer.fileId!==proven.fileId||
    answer.productionAuthorized!==false||
    !Number.isSafeInteger(answer.remainingFiles)||
    answer.remainingFiles<0||answer.remainingFiles>10)
  throw Error('R2_CENTRAL_UNIVERSAL_CONFIRMACION');
 return {universal:true,saved:true,idempotent:answer.idempotent,
  remainingFiles:answer.remainingFiles,receiptId:proven.receiptId};
}
