/**
 * Lookup de archivo R2 de prueba en D1 por HMAC y Service Binding.
 * No requiere el proof transitorio, no acepta URLs ni tokens del comprador.
 * Su respuesta es metadata PENDIENTE, no autorización de producir o cobrar.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const RECEIPT=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const KEY=/^r2-v1\/(WEB-[A-Za-z0-9_-]{5,80})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function validarLookupR2Pendiente(entry,{orderId,receiptId}={}){
 if(!entry||entry.ok!==true||entry.found!==true||
  entry.schema!=='saber-central-r2-pending-lookup-v1'||
  entry.webOrderId!==orderId||entry.receiptId!==receiptId||
  entry.status!=='awaiting_pdf_analysis'||entry.contenidoPdfVerificado!==false||
  entry.registeredInD1!==false||entry.paymentAuthorized!==false||
  entry.listoParaProducir!==false||!/^[A-Za-z0-9_-]{1,80}$/.test(entry.fileId||'')||
  !SHA.test(entry.sha256||'')||
  !Number.isSafeInteger(entry.bytes)||entry.bytes<=40*1024*1024||
  entry.bytes>256*1024*1024||
  !Number.isSafeInteger(entry.pagesDeclared)||entry.pagesDeclared<1||
  entry.pagesDeclared>2000||typeof entry.etag!=='string'||
  !/^[a-zA-Z0-9:"_-]{8,256}$/.test(entry.etag)||
  typeof entry.name!=='string'||entry.name.length<1||
  entry.name.length>120||!/.pdf$/i.test(entry.name))
  throw Error('R2_LOOKUP_NO_VALIDO');
 const m=KEY.exec(entry.objectKey||'');
 if(!m||m[1]!==orderId||('DOC-'+m[2]).toLowerCase()!==receiptId.toLowerCase())
  throw Error('R2_LOOKUP_OBJETO_AJENO');
 return Object.freeze({
  webOrderId:orderId,receiptId,fileId:entry.fileId,
  objectKey:entry.objectKey,sha256:entry.sha256,etag:entry.etag,
  bytes:entry.bytes,pagesDeclared:entry.pagesDeclared,name:entry.name,
  status:'awaiting_pdf_analysis',
  contenidoPdfVerificado:false,registeredInD1:false,paymentAuthorized:false
 });
}
export async function consultarR2PendienteCentral(env,{orderId,receiptId},{
 service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),
 uuid=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')
  throw Error('R2_LOOKUP_APAGADO');
 if(!ORDER.test(orderId||'')||!RECEIPT.test(receiptId||''))
  throw Error('R2_LOOKUP_IDS_INVALIDOS');
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{throw Error('R2_LOOKUP_DESTINO_INVALIDO')}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
  target.username||target.password||target.search||target.hash||
  target.pathname!=='/internal/central/stage')
  throw Error('R2_LOOKUP_DESTINO_INVALIDO');
 target.pathname='/internal/central/r2-pending-lookup';
 const body=JSON.stringify({schema:'saber-central-r2-pending-lookup-v1',
  webOrderId:orderId,receiptId});
 const id=uuid(),timestamp=now();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(timestamp))
  throw Error('R2_LOOKUP_IDENTIFICADOR_INVALIDO');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(timestamp+'\n'+id+'\n'+body))));
 const req=new Request(target.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(timestamp),
  'x-saber-request-id':id,'x-saber-signature':signature
 },body});
 const resp=await service.fetch(req);
 if(!resp.ok)throw Error('R2_LOOKUP_NO_AUTORIZADO_O_AUSENTE');
 const raw=await resp.text();
 if(raw.length>4096)throw Error('R2_LOOKUP_RESPUESTA_EXTENSA');
 let data;try{data=JSON.parse(raw)}catch{throw Error('R2_LOOKUP_RESPUESTA_NO_VALIDO')}
 return validarLookupR2Pendiente(data,{orderId,receiptId});
}
