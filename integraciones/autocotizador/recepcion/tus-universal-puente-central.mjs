/** Signed Central bridge for universal PDF TUS: gate & verified receipt.
 * Same private Service Binding, HMAC and approved D1 quote as R2.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=u8=>Array.from(u8,b=>b.toString(16).padStart(2,'0')).join('');
export async function llamarTUSUniversalCentral(env,route,data,{
 service=env?.SABER_CENTRAL,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_UNIVERSAL_TUS_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  throw Error('UNIVERSAL_TUS_CENTRAL_OFF');
 if(!['gate','received'].includes(route))throw Error('UNIVERSAL_TUS_RUTA');
 let url;try{url=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!url||url.protocol!=='https:'||!HOST.test(url.hostname)||
    url.pathname!=='/internal/central/stage'||url.search||url.hash||
    url.username||url.password||url.port)
  throw Error('UNIVERSAL_TUS_CENTRAL_DESTINO');
 url.pathname='/internal/central/r2-universal-tus-'+route;
 const payload=JSON.stringify(data);
 if(payload.length>140000)throw Error('UNIVERSAL_TUS_CENTRAL_LIMITE');
 const t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||
   !/^[a-f0-9-]{36}$/i.test(id))
  throw Error('UNIVERSAL_TUS_FIRMA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+payload))));
 let result;
 try{result=await service.fetch(new Request(url.href,{
  method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(t),
   'x-saber-request-id':id,'x-saber-signature':signature},body:payload
 }))}catch{throw Error('UNIVERSAL_TUS_CENTRAL_NO_RESPONDE')}
 if(!result.ok){
  if(result.status===402)throw Error('UNIVERSAL_TUS_PAGO_NO_CONFIRMADO');
  throw Error('UNIVERSAL_TUS_CENTRAL_RECHAZO');
 }
 const raw=await result.text();
 if(raw.length>150000)throw Error('UNIVERSAL_TUS_CENTRAL_RESPUESTA_LARGA');
 let x;try{x=JSON.parse(raw)}catch{}
 if(x?.ok!==true||x.webOrderId!==data.orderId||
    x.fileId!==data.fileId||x.productionAuthorized!==false)
  throw Error('UNIVERSAL_TUS_CENTRAL_IDENTIDAD');
 if(route==='gate'){
  if(x.uploadAuthorized!==true||x.bytes!==data.bytes||
     x.sha256!==data.sha256||x.name!==data.name||x.pages!==data.pages||
     !['bn','color'].includes(x.mode)||!Array.isArray(x.expectedMetrics)||
     x.expectedMetrics.length!==data.pages||
     x.expectedMetrics.some(m=>!Number.isFinite(m?.anchoCm)||
      !Number.isFinite(m?.altoCm)))
   throw Error('UNIVERSAL_TUS_CENTRAL_METADATOS');
 }else if(x.saved!==true||typeof x.idempotent!=='boolean')
  throw Error('UNIVERSAL_TUS_CENTRAL_RECIBO');
 return x;
}
