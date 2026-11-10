/**
 * Adaptador de comprador LIVE: NO es un endpoint por sí solo.
 * El Worker producción debe autenticar una sesión asociada al pedido y
 * suministrar authorized=true SOLO después de verificarla.
 * Nunca reutilizar SABER_CENTRAL/CENTRAL_TEST_URL de los ensayos.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'
}});
const safeCheckout=value=>{
 let url;try{url=new URL(value)}catch{return null}
 return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&
  /(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(url.hostname)?url.href:null;
};
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export async function pagoLiveUniversalDocumentos(request,env,{
 authorized=false,service=env?.SABER_CENTRAL_LIVE,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 if(authorized!==true)return reply({ok:false,error:'MP_LIVE_COMPRADOR_NO_AUTORIZADO'},401);
 // Tres compuertas independientes del sandbox y dos secretos no reutilizables.
 if(env?.SABER_ENTORNO!=='produccion'||
    env?.DOCS_LIVE_CHECKOUT_GATE!=='GO_COMERCIAL_CONFIRMADO'||
    env?.MP_LIVE_GATE!=='GO_COMERCIAL_CONFIRMADO'||
    env?.DOCS_CENTRAL_LIVE_DB_ENV!=='produccion'||
    typeof env?.DOCS_LIVE_BRIDGE_KEY!=='string'||
    env.DOCS_LIVE_BRIDGE_KEY.length<32||
    env.DOCS_LIVE_BRIDGE_KEY===env.CENTRAL_BRIDGE_KEY||
    env.DOCS_LIVE_BRIDGE_KEY===env.DOCS_TURNSTILE_SECRET||
    service===env.SABER_CENTRAL||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'MP_LIVE_COMPRADOR_GATE_CERRADO'},503);
 const u=new URL(request.url);
 if(request.method!=='POST'||request.headers.get('Origin')!==u.origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')
  return reply({ok:false,error:'MP_LIVE_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>1000)return reply({ok:false,error:'MP_LIVE_BODY_LIMITE'},413);
 let d;try{d=JSON.parse(raw)}catch{}
 if(!d||typeof d!=='object'||Array.isArray(d)||
    Object.keys(d).sort().join(',')!=='action,commercialOrderId,webOrderId'||
    !['start','status'].includes(d.action)||
    !UUID.test(d.commercialOrderId||'')||!WEB.test(d.webOrderId||''))
  return reply({ok:false,error:'MP_LIVE_IDENTIDAD'},422);
 const body=JSON.stringify({schema:d.action==='start'?'saber-mp-live-checkout-v1':
  'saber-mp-live-status-v1',commercialOrderId:d.commercialOrderId,webOrderId:d.webOrderId});
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return reply({ok:false,error:'MP_LIVE_HORA_ID'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.DOCS_LIVE_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const pathname=d.action==='start'?'/internal/central/live/checkout':
  '/internal/central/live/status';
 let result;
 try{
  // Host ficticio: solo se usa por Service Binding interno de Cloudflare.
  // No se hace fetch() público ni se envían tokens al navegador.
  result=await service.fetch(new Request('https://saber-central-live.internal.invalid'+pathname,{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sign},body
  }));
 }catch{return reply({ok:false,error:'MP_LIVE_CENTRAL_NO_RESPONDE'},503)}
 if(!result.ok)return reply({ok:false,error:'MP_LIVE_CENTRAL_RECHAZA'},
  result.status===409?409:503);
 const data=await result.json().catch(()=>null);
 if(data?.ok!==true||data.webOrderId!==d.webOrderId||
    data.commercialOrderId!==d.commercialOrderId||
    !Number.isSafeInteger(data.amountArs)||data.amountArs<1||data.amountArs>50000000)
  return reply({ok:false,error:'MP_LIVE_CENTRAL_RESPUESTA'},502);
 if(d.action==='start'){
  const checkout=safeCheckout(data.checkoutUrl);
  if(!checkout)return reply({ok:false,error:'MP_LIVE_ENLACE_INVALIDO'},502);
  return reply({ok:true,webOrderId:d.webOrderId,commercialOrderId:d.commercialOrderId,
   amountArs:data.amountArs,checkoutUrl:checkout,uploadAuthorized:false,
   productionAuthorized:false},200);
 }
 if(!Number.isSafeInteger(data.fileCount)||data.fileCount<1||data.fileCount>10||
    !Number.isSafeInteger(data.pendingFiles)||data.pendingFiles<0||
    data.pendingFiles>data.fileCount||!Array.isArray(data.receivedFileIds)||
    data.receivedFileIds.length!==data.fileCount-data.pendingFiles||
    new Set(data.receivedFileIds).size!==data.receivedFileIds.length||
    data.receivedFileIds.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(x))||
    !['pendiente','pagado_esperando_archivos','revocado'].includes(data.estado)||
    data.uploadAuthorized!==(data.estado==='pagado_esperando_archivos')||
    data.productionAuthorized!==false)
  return reply({ok:false,error:'MP_LIVE_ESTADO_INCOHERENTE'},502);
 return reply({ok:true,webOrderId:d.webOrderId,commercialOrderId:d.commercialOrderId,
  amountArs:data.amountArs,fileCount:data.fileCount,pendingFiles:data.pendingFiles,
  receivedFileIds:data.receivedFileIds,estado:data.estado,
  uploadAuthorized:data.uploadAuthorized,productionAuthorized:false},200);
}
