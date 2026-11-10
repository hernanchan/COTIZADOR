/** Staging R2: SHA verificado por Worker, aviso firmado a Central D1.
 * Nunca marca original recibido ni autoriza impresión.
 */
import {prepararPreRecepcionR2} from './r2-grandes-enviar-central.mjs';
const END='https://pagos.libreriasaber.com.ar/internal/central/live/r2-stage';
const GO='GO_COMERCIAL_CONFIRMADO';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function informarR2LivePendiente(env,claim,verified,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_RECEPCION_GATE!==GO||
  env?.DOCS_LIVE_R2_GATE!==GO||env?.DOCS_LIVE_R2_STAGING_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')throw Error('LIVE_R2_STAGE_NO_CONFIGURADO');
 const p=prepararPreRecepcionR2(claim,verified);
 if(p.bytes>200*1048576||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.orderId))
  throw Error('LIVE_R2_STAGE_ORIGINAL');
 const body=JSON.stringify(p),t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||
  !UUID.test(id)||body.length>2000)throw Error('LIVE_R2_STAGE_IDENTIDAD');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+body))));
 let result;
 try{result=await service.fetch(new Request(END,{method:'POST',
  headers:{'Content-Type':'application/json',
   'x-saber-ts':String(t),'x-saber-request-id':id,
   'x-saber-signature':signature},body}))}
 catch{throw Error('LIVE_R2_STAGE_CENTRAL_NO_RESPONDE')}
 if(!result.ok)throw Error('LIVE_R2_STAGE_CENTRAL_RECHAZO');
 const value=await result.json().catch(()=>null);
 if(value?.ok!==true||value.saved!==true||
  value.webOrderId!==p.orderId||value.fileId!==p.fileId||
  value.status!=='awaiting_pdf_analysis'||value.stagedForCentral!==true||
  value.registeredInD1!==false||value.productionAuthorized!==false)
  throw Error('LIVE_R2_STAGE_CENTRAL_INCONSISTENTE');
 return Object.freeze({stagedForCentral:true,receiptId:p.receiptId,
  fileId:p.fileId,orderId:p.orderId,productionAuthorized:false});
}
