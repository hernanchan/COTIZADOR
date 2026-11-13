/** Consulta D1 de reserva R2, HMAC, sin permisos de upload.
 * No permite que el navegador indique objectKey ni estado de pago.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const END='https://pagos.libreriasaber.com.ar/internal/central/live/r2-recover';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function consultarReservaR2Live(env,meta,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_RECEPCION_GATE!==GO||
  env?.DOCS_LIVE_R2_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')
  throw Error('LIVE_R2_RECOVERY_OFF');
 if(!meta||typeof meta!=='object'||Array.isArray(meta)||
   Object.keys(meta).sort().join(',')!=='bytes,fileId,name,orderId,pages,sha256'||
   !WEB.test(meta.orderId||'')||
   !/^[A-Za-z0-9_-]{1,80}$/.test(meta.fileId||'')||
   !SHA.test(meta.sha256||'')||
   typeof meta.name!=='string'||!meta.name.toLowerCase().endsWith('.pdf')||
   !Number.isSafeInteger(meta.bytes)||meta.bytes<=40*1048576||
   meta.bytes>200*1048576||
   !Number.isSafeInteger(meta.pages)||meta.pages<1||meta.pages>2000)
  throw Error('LIVE_R2_RECOVERY_META');
 const body=JSON.stringify({schema:'saber-central-r2-universal-recovery-v1',...meta});
 const t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||
    !UUID.test(id)||body.length>2000)throw Error('LIVE_R2_RECOVERY_FIRMA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+body))));
 let response;
 try{response=await service.fetch(new Request(END,{method:'POST',
  headers:{'Content-Type':'application/json','x-saber-ts':String(t),
   'x-saber-request-id':id,'x-saber-signature':sig},body}))}
 catch{throw Error('LIVE_R2_RECOVERY_CENTRAL')}
 if(!response.ok)throw Error('LIVE_R2_RECOVERY_RECHAZADA');
 const data=await response.json().catch(()=>null);
 if(data?.ok!==true||data.webOrderId!==meta.orderId||
  data.fileId!==meta.fileId||
   !(data.paymentVerified===true||data.paymentVerified===false&&data.bankPending===true)||
  data.productionAuthorized!==false)throw Error('LIVE_R2_RECOVERY_RESPUESTA');
 if(data.found===false){
  if(data.state!=='not_started'||data.uploadPossible!==true)
   throw Error('LIVE_R2_RECOVERY_ESTADO_AJENO');
 }else if(data.found===true){
  if(!['staged','reserved'].includes(data.state)||
    data.uploadPossible!==false||data.sha256!==meta.sha256||
    data.bytes!==meta.bytes||
    typeof data.objectKey!=='string'||
    !data.objectKey.startsWith('r2-v1/'+meta.orderId+'/')||
    !/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9-]{36}[.]pdf$/i.test(data.objectKey))
   throw Error('LIVE_R2_RECOVERY_RESERVA_AJENA');
 }else throw Error('LIVE_R2_RECOVERY_ESTADO_AJENO');
 return data;
}
