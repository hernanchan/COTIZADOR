/**
 * Recuperar referencia de una subida R2 iniciada, sin proof ni sessionStorage.
 * Consulta D1 Central firmada por HMAC; sólo metadatos, nunca bytes,
 * enlaces de descarga, uploadIds, autorización de cobro o producción.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const OBJECT=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.pdf$/i;
const hex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
export async function consultarReservaR2Documentos({
 env,orderId,meta,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_QUOTA_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function'||!ORDER.test(orderId||'')||
    !FILE.test(meta?.fileId||'')||!SHA.test(meta?.sha256||'')||
    !Number.isSafeInteger(meta?.bytes)||meta.bytes<=40*1024*1024||
    meta.bytes>256*1024*1024)
  throw Error('R2_RESERVA_CONSULTA_NO_CONFIGURADA');
 let url;
 try{url=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!url||url.protocol!=='https:'||!HOST.test(url.hostname)||
   url.port||url.username||url.password||url.search||url.hash||
   url.pathname!=='/internal/central/stage')
  throw Error('R2_RESERVA_DESTINO_INVALIDO');
 url.pathname='/internal/central/r2-reservation-lookup';
 const payload={schema:'saber-central-r2-reservation-lookup-v1',
  webOrderId:orderId,fileId:meta.fileId,sha256:meta.sha256,bytes:meta.bytes};
 const body=JSON.stringify(payload),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!/^[a-f0-9-]{36}$/i.test(id))
  throw Error('R2_RESERVA_FIRMA_INVALIDA');
 const key=await subtle.importKey('raw',
  new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const r=await service.fetch(new Request(url.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig
 },body}));
 if(!r.ok)throw Error('R2_RESERVA_NO_CONSULTABLE');
 const raw=await r.text();
 if(raw.length>1800)throw Error('R2_RESERVA_RESPUESTA_EXTENSA');
 let d;try{d=JSON.parse(raw)}catch{throw Error('R2_RESERVA_RESPUESTA_INVALIDA')}
 if(d?.ok!==true||d.webOrderId!==orderId||
    d.paymentAuthorized!==false||d.registeredInD1!==false||
    d.productionAuthorized!==false)
  throw Error('R2_RESERVA_RESPUESTA_INVALIDA');
 if(d.found===false&&d.state==='not_started')
  return Object.freeze({found:false,state:'not_started'});
 if(d.found!==true||d.state!=='reserved'||d.fileId!==meta.fileId||
    d.sha256!==meta.sha256||d.bytes!==meta.bytes||
    !OBJECT.test(d.objectKey||'')||!d.objectKey.startsWith('r2-v1/'+orderId+'/'))
  throw Error('R2_RESERVA_IDENTIDAD_INCONSISTENTE');
 return Object.freeze({found:true,state:'reserved',objectKey:d.objectKey,
  orderId,fileId:meta.fileId,sha256:meta.sha256,bytes:meta.bytes});
}
