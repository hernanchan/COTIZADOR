/** Puente TUS LIVE hacia Central productiva. Sin publicar endpoints
 * de subida ni firmar bytes originales: sólo consulta D1 e informa recibos
 * del verificador SHA256 una vez habilitada la recepción productiva.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const HOST='https://pagos.libreriasaber.com.ar/internal/central/live/';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const FILE=/\.pdf$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
function check(data,action){
 if(!data||typeof data!=='object'||Array.isArray(data)||
  !WEB.test(data.orderId||'')||!ID.test(data.fileId||'')||
  !SHA.test(data.sha256||'')||typeof data.name!=='string'||
  data.name.length<1||data.name.length>120||!FILE.test(data.name)||
  !Number.isSafeInteger(data.bytes)||data.bytes<5||data.bytes>40*1048576||
  !Number.isSafeInteger(data.pages)||data.pages<1||data.pages>2000)return false;
 if(action==='gate')
  return Object.keys(data).sort().join(',')===
   'action,bytes,fileId,name,orderId,pages,schema,sha256'&&
   data.schema==='saber-central-r2-universal-tus-gate-v1'&&
   ['start','finish'].includes(data.action);
 if(action==='received')
  return Object.keys(data).sort().join(',')===
   'bytes,fileId,metrics,name,objectName,orderId,pages,receiptId,schema,sha256'&&
   data.schema==='saber-central-r2-universal-tus-received-v1'&&
   Array.isArray(data.metrics)&&data.metrics.length===data.pages&&
   data.metrics.every(m=>m&&Number.isFinite(m.anchoCm)&&
     Number.isFinite(m.altoCm)&&m.modo==='sin-clasificar')&&
   /^DOC-[a-f0-9-]{36}$/i.test(data.receiptId||'')&&
   data.objectName==='v2/'+data.orderId+'/'+data.receiptId.slice(4)+'.pdf';
 return false;
}
export async function llamarTUSUniversalCentralLive(env,action,data,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_LIVE_RECEPCION_GATE!==GO||
  env?.DOCS_LIVE_TUS_GATE!==GO||
  env?.DOCS_MP_LIVE_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')
  throw Error('LIVE_TUS_PUENTE_OFF');
 if(!['gate','received'].includes(action)||!check(data,action))
  throw Error('LIVE_TUS_PUENTE_INPUT');
 const t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||!UUID.test(id))
  throw Error('LIVE_TUS_PUENTE_RELOJ');
 const raw=JSON.stringify(data);
 if(raw.length>140000)throw Error('LIVE_TUS_PUENTE_TAMANO');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+raw))));
 let response;
 try{response=await service.fetch(new Request(HOST+'tus-'+action,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(t),'x-saber-request-id':id,'x-saber-signature':signature},
  body:raw}))}catch{throw Error('LIVE_TUS_PUENTE_NO_RESPONDE')}
 if(!response.ok)throw Error(response.status===402?
  'LIVE_TUS_PAGO_NO_CONFIRMADO':'LIVE_TUS_PUENTE_CENTRAL_RECHAZO');
 const text=await response.text();
 if(text.length>150000)throw Error('LIVE_TUS_PUENTE_RESPUESTA_LARGA');
 let result;try{result=JSON.parse(text)}catch{}
 if(result?.ok!==true||result.webOrderId!==data.orderId||
   result.fileId!==data.fileId||result.productionAuthorized!==false)
  throw Error('LIVE_TUS_PUENTE_RESPUESTA_AJENA');
 if(action==='gate'){
  if(result.uploadAuthorized!==true||result.bytes!==data.bytes||
     result.sha256!==data.sha256||result.name!==data.name||
     result.pages!==data.pages||!['bn','color'].includes(result.mode)||
     !Array.isArray(result.expectedMetrics)||
     result.expectedMetrics.length!==data.pages)
   throw Error('LIVE_TUS_PUENTE_ARCHIVO_AJENO');
 }else if(result.saved!==true||typeof result.idempotent!=='boolean')
  throw Error('LIVE_TUS_PUENTE_RECIBO_NO_GUARDADO');
 return result;
}
