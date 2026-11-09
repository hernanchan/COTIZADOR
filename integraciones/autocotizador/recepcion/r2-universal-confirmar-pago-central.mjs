/**
 * Comprobante R2 pagado: consulta Central por Service Binding, HMAC y
 * objetos EXACTOS de la cotización previa. No consulta MP desde navegador
 * ni acepta un pago de otro pedido / otro archivo.
 */
import {pagoAprobadoParaR2} from './r2-recepcion-solo-pagada.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const SHA=/^[a-f0-9]{64}$/;
const ID=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const toHex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
export async function comprobarPagoUniversalR2EnCentral({
 env,orderId,meta,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function'||!ID.test(orderId||'')||
    !FILE.test(meta?.fileId||'')||!SHA.test(meta?.sha256||'')||
    !Number.isSafeInteger(meta?.bytes)||meta.bytes<=40*1024*1024||
    meta.bytes>200*1024*1024)
  throw Error('R2_PAGO_CENTRAL_NO_CONFIGURADO');
 let url;try{url=new URL(env.CENTRAL_TEST_URL)}
 catch{throw Error('R2_PAGO_CENTRAL_DESTINO_INVALIDO')}
 if(url.protocol!=='https:'||!HOST.test(url.hostname)||url.port||
    url.username||url.password||url.search||url.hash||
    url.pathname!=='/internal/central/stage')
  throw Error('R2_PAGO_CENTRAL_DESTINO_INVALIDO');
 url.pathname='/internal/central/r2-universal-payment-lookup';
 const payload={schema:'saber-central-r2-universal-payment-lookup-v1',
  orderId,fileId:meta.fileId,sha256:meta.sha256,bytes:meta.bytes};
 const body=JSON.stringify(payload),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!/^[a-f0-9-]{36}$/i.test(id))
  throw Error('R2_PAGO_CENTRAL_FIRMA_INVALIDA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=toHex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const response=await service.fetch(new Request(url.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':id,
   'x-saber-signature':sig},body
 }));
 if(!response.ok)return null; // nunca caerse a permiso del cliente
 const raw=await response.text();
 if(raw.length>2400)throw Error('R2_PAGO_CENTRAL_RESPUESTA_INVALIDA');
 let answer;try{answer=JSON.parse(raw)}catch{throw Error('R2_PAGO_CENTRAL_RESPUESTA_INVALIDA')}
 const p=answer?.receipt;
 if(answer?.ok!==true||answer.paymentAuthorizedForR2!==true||
    answer.productionAuthorized!==false||
    !pagoAprobadoParaR2(p,orderId,ts)||
    p.fileId!==meta.fileId||p.sha256!==meta.sha256||p.bytes!==meta.bytes)
  throw Error('R2_PAGO_CENTRAL_CONFIRMACIÓN_NO_VÁLIDA');
 return p;
}
