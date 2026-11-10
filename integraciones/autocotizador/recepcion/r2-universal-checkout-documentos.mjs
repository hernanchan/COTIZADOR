/** Session-bound buyer -> HMAC private Central for one universal Sandbox checkout. */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
export async function pagoSandboxUniversalDocumentos(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 if(authorized!==true)return reply({ok:false,error:'UNIVERSAL_COMPRADOR_NO_AUTORIZADO'},401);
 if(env?.DOCS_R2_UNIVERSAL_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_R2_UNIVERSAL_ORDER_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_R2_UNIVERSAL_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'UNIVERSAL_PAGO_APAGADO'},503);
 const base=new URL(request.url);
 if(request.method!=='POST'||request.headers.get('Origin')!==base.origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return reply({ok:false,error:'UNIVERSAL_PAGO_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>1400)return reply({ok:false,error:'UNIVERSAL_PAGO_LIMITE'},413);
 let d;try{d=JSON.parse(raw)}catch{}
 if(!d||typeof d!=='object'||Array.isArray(d)||
    Object.keys(d).sort().join(',')!=='action,commercialOrderId,webOrderId'||
    !['start','status'].includes(d.action)||
    !WEB.test(d.webOrderId||'')||!UUID.test(d.commercialOrderId||''))
  return reply({ok:false,error:'UNIVERSAL_PAGO_IDENTIDAD'},422);
 let u;try{u=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!u||u.protocol!=='https:'||!HOST.test(u.hostname)||
    u.pathname!=='/internal/central/stage'||u.search||u.hash||
    u.port||u.username||u.password)
  return reply({ok:false,error:'UNIVERSAL_PAGO_DESTINO'},503);
 u.pathname='/internal/central/r2-universal-checkout';
 const body=JSON.stringify({schema:'saber-central-r2-universal-checkout-v1',
  action:d.action,webOrderId:d.webOrderId,commercialOrderId:d.commercialOrderId});
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return reply({ok:false,error:'UNIVERSAL_PAGO_FIRMA'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let upstream;
 try{upstream=await service.fetch(new Request(u.href,{
  method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':sig},body}))}
 catch{return reply({ok:false,error:'UNIVERSAL_PAGO_CENTRAL_NO_RESPONDE'},503)}
 if(!upstream.ok)return reply({ok:false,error:'UNIVERSAL_PAGO_CENTRAL_RECHAZA'},
  upstream.status===409?409:503);
 const x=await upstream.json().catch(()=>null);
 if(!x||x.ok!==true||x.webOrderId!==d.webOrderId||
    x.commercialOrderId!==d.commercialOrderId||
    !Number.isSafeInteger(x.amountArs)||x.amountArs<1||
    !Number.isSafeInteger(x.fileCount)||x.fileCount<1||x.fileCount>10||
    !['pendiente','revocado','pagado_esperando_archivos'].includes(x.estado)||
    x.productionAuthorized!==false)
  return reply({ok:false,error:'UNIVERSAL_PAGO_RESPUESTA_INVALIDA'},502);
 if(d.action==='start'){
  let target;try{target=new URL(x.checkoutUrl)}catch{}
  if(x.estado!=='pendiente'||x.uploadAuthorized!==false||
     !target||target.protocol!=='https:'||
     !/(^|\.)mercadopago\.com(\.ar)?$/.test(target.hostname)||
     target.username||target.password||target.hash)
   return reply({ok:false,error:'UNIVERSAL_PAGO_URL_INVALIDA'},502);
 }else{
  if(typeof x.pendingFiles!=='number'||!Number.isSafeInteger(x.pendingFiles)||
     x.pendingFiles<0||x.pendingFiles>x.fileCount||
     !Array.isArray(x.receivedFileIds)||
     x.receivedFileIds.length!==x.fileCount-x.pendingFiles||
     new Set(x.receivedFileIds).size!==x.receivedFileIds.length||
     x.receivedFileIds.some(v=>typeof v!=='string'||
      !/^[A-Za-z0-9_-]{1,80}$/.test(v))||
     x.uploadAuthorized!==(x.estado==='pagado_esperando_archivos'))
   return reply({ok:false,error:'UNIVERSAL_PAGO_ESTADO_INCONSISTENTE'},502);
 }
 return reply({ok:true,webOrderId:d.webOrderId,
  commercialOrderId:d.commercialOrderId,
  amountArs:x.amountArs,fileCount:x.fileCount,
  estado:x.estado,...(d.action==='start'?{checkoutUrl:x.checkoutUrl}:{}),
  ...(d.action==='status'?{pendingFiles:x.pendingFiles,receivedFileIds:x.receivedFileIds}:{}),
  uploadAuthorized:x.uploadAuthorized,productionAuthorized:false},200);
}
