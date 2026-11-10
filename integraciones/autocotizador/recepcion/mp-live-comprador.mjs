/**
 * Conector comprador -> Central MP LIVE.
 * No habilita nada por sí solo: requiere origen producción, sesión vinculada
 * a la orden, servicio interno HMAC y compuertas independientes.
 * Jamás consulta MP desde el navegador ni usa datos de sandbox para acreditar.
 */
const ORDER=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar';
const GATE='GO_COMERCIAL_CONFIRMADO';
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'}});
const shahex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
function checkoutSeguro(url){
 let u;try{u=new URL(url)}catch{return false}
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
  /(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(u.hostname);
}
function gate(env,service){
 return env?.SABER_ENTORNO==='produccion'&&
  env?.CENTRAL_DB_ENV==='produccion'&&
  env?.DOCS_MP_LIVE_GATE===GATE&&
  env?.CENTRAL_LIVE_URL===CENTRAL+'/internal/central/live/checkout'&&
  typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32&&
  typeof service?.fetch==='function';
}
export async function pagoMPLiveComprador(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(!gate(env,service))return reply({ok:false,error:'MP_LIVE_COMPRADOR_CERRADO'},503);
 if(authorized!==true)return reply({ok:false,error:'MP_LIVE_PEDIDO_NO_VINCULADO'},401);
 const url=new URL(request.url);
 if(request.method!=='POST'||url.origin!==ORIGIN||
    url.pathname!=='/api/pedido/live/checkout'||url.search||url.hash||
    request.headers.get('Origin')!==ORIGIN||
    (request.headers.get('Sec-Fetch-Site')&&
     request.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'MP_LIVE_ORIGEN_INVALIDO'},403);
 const raw=await request.text();
 if(raw.length>1400)return reply({ok:false,error:'MP_LIVE_BODY_DEMASIADO_GRANDE'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='action,commercialOrderId,webOrderId'||
    !['start','status'].includes(p.action)||!ORDER.test(p.commercialOrderId||'')||
    !WEB.test(p.webOrderId||''))
  return reply({ok:false,error:'MP_LIVE_IDENTIDAD_INVALIDA'},422);
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return reply({ok:false,error:'MP_LIVE_FIRMA_NO_DISPONIBLE'},503);
 const isStart=p.action==='start';
 const body=JSON.stringify({schema:isStart?'saber-mp-live-checkout-v1':
   'saber-mp-live-status-v1',webOrderId:p.webOrderId,
   commercialOrderId:p.commercialOrderId});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=shahex(new Uint8Array(await subtle.sign('HMAC',key,
   new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let upstream;
 try{
  const target=CENTRAL+(isStart?'/internal/central/live/checkout':
    '/internal/central/live/status');
  upstream=await service.fetch(new Request(target,{method:'POST',
   headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sig},body}));
 }catch{return reply({ok:false,error:'MP_LIVE_CENTRAL_NO_DISPONIBLE'},503)}
 if(!upstream.ok)return reply({ok:false,error:'MP_LIVE_CENTRAL_RECHAZO'},
  upstream.status===409?409:503);
 const result=await upstream.json().catch(()=>null);
 if(!result||result.ok!==true||!Number.isSafeInteger(result.amountArs)||
    result.amountArs<1||result.amountArs>50000000||
    (isStart?result.orderId!==p.commercialOrderId:
     result.webOrderId!==p.webOrderId||
     result.commercialOrderId!==p.commercialOrderId))
  return reply({ok:false,error:'MP_LIVE_RESPUESTA_INVALIDA'},502);
 if(isStart){
  if(!checkoutSeguro(result.checkoutUrl))
   return reply({ok:false,error:'MP_LIVE_CHECKOUT_URL_INVALIDA'},502);
  return reply({ok:true,webOrderId:p.webOrderId,
   commercialOrderId:p.commercialOrderId,amountArs:result.amountArs,
   estado:'pendiente',checkoutUrl:result.checkoutUrl,
   uploadAuthorized:false,productionAuthorized:false},200);
 }
 const statuses=['pendiente','pagado_esperando_archivos','revocado'];
 if(!statuses.includes(result.estado)||!Number.isSafeInteger(result.fileCount)||
    result.fileCount<1||result.fileCount>10||
    !Number.isSafeInteger(result.pendingFiles)||result.pendingFiles<0||
    result.pendingFiles>result.fileCount||
    !Array.isArray(result.receivedFileIds)||
    result.receivedFileIds.length!==result.fileCount-result.pendingFiles||
    result.receivedFileIds.some(x=>!FILE.test(x))||
    new Set(result.receivedFileIds).size!==result.receivedFileIds.length||
    result.productionAuthorized!==false||
    result.uploadAuthorized!==(result.estado==='pagado_esperando_archivos'))
  return reply({ok:false,error:'MP_LIVE_ESTADO_INCONSISTENTE'},502);
 return reply({ok:true,webOrderId:p.webOrderId,
  commercialOrderId:p.commercialOrderId,amountArs:result.amountArs,
  fileCount:result.fileCount,pendingFiles:result.pendingFiles,
  receivedFileIds:result.receivedFileIds,estado:result.estado,
  uploadAuthorized:result.uploadAuthorized,productionAuthorized:false},200);
}
