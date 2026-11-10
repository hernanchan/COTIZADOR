/** Reserva R2 tras pago conciliado, firmada Documentos → Central.
 * No crea multipart ni acepta comprobante del navegador.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const END='https://pagos.libreriasaber.com.ar/internal/central/live/r2-reserve';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function reservarCapacidadR2Live(env,p,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_RECEPCION_GATE!==GO||
  env?.DOCS_LIVE_R2_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')throw Error('LIVE_R2_RESERVA_OFF');
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='bytes,fileId,name,objectKey,orderId,pages,sha256'||
  !WEB.test(p.orderId||'')||!FILE.test(p.fileId||'')||
  !SHA.test(p.sha256||'')||typeof p.name!=='string'||
  !p.name.toLowerCase().endsWith('.pdf')||p.name.length>120||
  !Number.isSafeInteger(p.bytes)||p.bytes<=40*1048576||p.bytes>200*1048576||
  !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000||
  typeof p.objectKey!=='string'||!p.objectKey.startsWith('r2-v1/'+p.orderId+'/')||
  !UUID.test(p.objectKey.slice(('r2-v1/'+p.orderId+'/').length,-4))||
  !p.objectKey.endsWith('.pdf'))
  throw Error('LIVE_R2_RESERVA_META');
 const body=JSON.stringify({schema:'saber-central-r2-universal-live-reserve-v1',...p});
 const t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||
  !UUID.test(id)||body.length>2000)throw Error('LIVE_R2_RESERVA_RELOJ');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+body))));
 let result;
 try{result=await service.fetch(new Request(END,{method:'POST',
  headers:{'Content-Type':'application/json','x-saber-ts':String(t),
   'x-saber-request-id':id,'x-saber-signature':signature},body}))}
 catch{throw Error('LIVE_R2_RESERVA_SIN_CENTRAL')}
 if(!result.ok)throw Error(result.status===429?
  'LIVE_R2_CUPO_AGOTADO':'LIVE_R2_RESERVA_RECHAZADA');
 const value=await result.json().catch(()=>null);
 if(value?.ok!==true||value.reserved!==true||
  value.webOrderId!==p.orderId||value.fileId!==p.fileId||
  value.objectKey!==p.objectKey||
  typeof value.idempotent!=='boolean'||
  value.uploadAuthorized!==false||value.productionAuthorized!==false||
  value.paymentAuthorized!==false)
  throw Error('LIVE_R2_RESERVA_INCONSISTENTE');
 return value;
}
