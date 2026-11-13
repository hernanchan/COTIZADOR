/** Consulta de elegibilidad R2 LIVE; solo metadatos.
 * El servidor Central D1 sigue siendo autoridad de pago y ficha.
 * No se entrega token ni se escribe al bucket en esta operación.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const CENTRAL='https://pagos.libreriasaber.com.ar/internal/central/live/r2-gate';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function consultarPagoArchivoR2Live(env,meta,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_RECEPCION_GATE!==GO||
  env?.DOCS_LIVE_R2_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')throw Error('LIVE_R2_NO_CONFIGURADO');
 if(!meta||typeof meta!=='object'||Array.isArray(meta)||
  Object.keys(meta).sort().join(',')!=='bytes,fileId,name,orderId,pages,sha256'||
  !WEB.test(meta.orderId||'')||!FILE.test(meta.fileId||'')||
  !SHA.test(meta.sha256||'')||typeof meta.name!=='string'||
  meta.name.length<1||meta.name.length>120||
  !meta.name.toLowerCase().endsWith('.pdf')||
  !Number.isSafeInteger(meta.bytes)||meta.bytes<=40*1048576||
  meta.bytes>200*1048576||
  !Number.isSafeInteger(meta.pages)||meta.pages<1||meta.pages>2000)
  throw Error('LIVE_R2_META_INVALIDA');
 const payload={schema:'saber-central-r2-universal-live-gate-v1',...meta};
 const body=JSON.stringify(payload),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||!UUID.test(id)||
   body.length>2000)throw Error('LIVE_R2_HMAC_IDENTIDAD');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let response;
 try{response=await service.fetch(new Request(CENTRAL,{
  method:'POST',headers:{'Content-Type':'application/json',
  'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':sig},
  body}))}catch{throw Error('LIVE_R2_CENTRAL_NO_RESPONDE')}
 if(!response.ok)throw Error(response.status===402?
  'LIVE_R2_PAGO_NO_CONCILIADO':'LIVE_R2_CENTRAL_RECHAZA');
 const data=await response.json().catch(()=>null);
 if(!data||data.ok!==true||data.webOrderId!==meta.orderId||
  data.fileId!==meta.fileId||data.sha256!==meta.sha256||
  data.bytes!==meta.bytes||data.pages!==meta.pages||
  data.transport!=='r2'||
  !(data.paymentVerified===true||data.paymentVerified===false&&data.bankPending===true)||
  !['bn','color'].includes(data.mode)||
  !Array.isArray(data.expectedMetrics)||data.expectedMetrics.length!==meta.pages||
  data.expectedMetrics.some(m=>!Number.isFinite(m.anchoCm)||
    !Number.isFinite(m.altoCm)||m.anchoCm<=0||m.altoCm<=0)||
  data.uploadAuthorized!==false||data.productionAuthorized!==false)
  throw Error('LIVE_R2_CENTRAL_NO_COINCIDE');
 return data;
}
