/** Proxy entre comprador autenticado y pago SANDBOX prearchivo Central.
 * La sesión de comprador + vínculo con orden se comprueban ANTES de invocar.
 * No acepta importes ni enlaces inventados por cliente.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(v,status=200)=>Response.json(v,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'
}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function checkoutR2PrepaidSandboxDocumentos(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(!authorized)return reply({ok:false,error:'R2_PREPAGO_COMPRADOR_NO_AUTORIZADO'},401);
 if(env?.DOCS_R2_PREPAY_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'R2_PREPAGO_SANDBOX_APAGADO'},503);
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&
      request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return reply({ok:false,error:'R2_PREPAGO_ORIGEN_RECHAZADO'},403);
 const raw=await request.text();
 if(raw.length>2000)return reply({ok:false,error:'R2_PREPAGO_DATOS_LARGOS'},413);
 let p;try{p=JSON.parse(raw)}catch{return reply({ok:false,error:'R2_PREPAGO_JSON_INVALIDO'},400)}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='action,commercialOrderId,webOrderId'||
    !['start','status'].includes(p.action)||!WEB.test(p.webOrderId||'')||
    !UUID.test(p.commercialOrderId||''))
  return reply({ok:false,error:'R2_PREPAGO_IDENTIDAD_INVALIDA'},422);
 let url;try{url=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!url||url.protocol!=='https:'||!HOST.test(url.hostname)||
    url.pathname!=='/internal/central/stage'||url.search||url.hash||
    url.port||url.username||url.password)
  return reply({ok:false,error:'R2_PREPAGO_DESTINO_INVALIDO'},503);
 url.pathname='/internal/central/r2-prepay-checkout';
 const payload=JSON.stringify({schema:'saber-central-r2-prepaid-checkout-v1',
  action:p.action,webOrderId:p.webOrderId,commercialOrderId:p.commercialOrderId});
 const ts=now(),rid=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(rid))
  return reply({ok:false,error:'R2_PREPAGO_RELOJ_INVALIDO'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+rid+'\n'+payload))));
 let response;try{
  response=await service.fetch(new Request(url.href,{method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':rid,'x-saber-signature':signature},body:payload}));
 }catch{return reply({ok:false,error:'R2_PREPAGO_CENTRAL_NO_RESPONDE'},503)}
 if(!response.ok){
  // Sólo códigos propios predefinidos, nunca mensajes de Mercado Pago,
  // credenciales, detalles de D1 ni URLs. Permite aislar un bloqueo real
  // del checkout de ENSAYO sin relajar la compuerta de pago.
  const upstream=await response.json().catch(()=>null);
  const known=new Set([
   'R2_PREPAGO_CHECKOUT_APAGADO',
   'R2_PREPAGO_FIRMA_NO_DISPONIBLE',
   'R2_PREPAGO_FIRMA_RECHAZADA',
   'R2_PREPAGO_NO_COINCIDE',
   'R2_PREPAGO_COTIZACION_VENCIDA',
   'R2_PREPAGO_PASARELA_NO_CONFIGURADA',
   'R2_PREPAGO_CHECKOUT_RECHAZADO',
   'R2_PREPAGO_TRANSFERENCIA_EN_CURSO',
   'R2_PREPAGO_YA_PAGADO_O_CANCELADO'
  ]);
  const reasonCode=known.has(upstream?.error)?upstream.error:'R2_PREPAGO_ERROR_INTERNO';
  return reply({ok:false,error:'R2_PREPAGO_CHECKOUT_CENTRAL_RECHAZO',reasonCode},
   response.status===409?409:503);
 }
 let d;try{d=await response.json()}catch{return reply({ok:false,error:'R2_PREPAGO_CHECKOUT_INVALIDO'},502)}
 if(d?.ok!==true||d.webOrderId!==p.webOrderId||
    d.commercialOrderId!==p.commercialOrderId||
    !Number.isSafeInteger(d.amountArs)||d.amountArs<1||
    !['pendiente','pagado_esperando_archivo','revocado'].includes(d.estado)||
    d.filesUploaded!==false||d.productionAuthorized!==false)
  return reply({ok:false,error:'R2_PREPAGO_PAGO_NO_COINCIDE'},502);
 if(p.action==='status'&&d.seguimientoUrl!==undefined){
  let u;try{u=new URL(d.seguimientoUrl)}catch{}
  if(d.estado!=='pagado_esperando_archivo'||!u||u.protocol!=='https:'||
     !HOST.test(u.hostname)||u.pathname!=='/seguimiento'||
     u.username||u.password||u.hash||u.port||
     [...u.searchParams.keys()].join(',')!=='token'||
     !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(u.searchParams.get('token')||''))
    return reply({ok:false,error:'R2_SEGUIMIENTO_CENTRAL_INVALIDO'},502);
 }
 if(p.action==='start'){
  let u;try{u=new URL(d.checkoutUrl)}catch{}
  if(!u||u.protocol!=='https:'||
    !/(^|\.)mercadopago\.com(\.ar)?$/.test(u.hostname)||u.username||
    u.password||u.hash||d.estado!=='pendiente'||d.uploadAuthorized!==false)
   return reply({ok:false,error:'R2_PREPAGO_ENLACE_NO_CONFIABLE'},502);
 }
 return reply({ok:true,commercialOrderId:p.commercialOrderId,
  webOrderId:p.webOrderId,amountArs:d.amountArs,estado:d.estado,
  ...(p.action==='start'?{checkoutUrl:d.checkoutUrl}:{}),
  ...(d.seguimientoUrl?{seguimientoUrl:d.seguimientoUrl}:{}),
  filesUploaded:false,productionAuthorized:false,
  uploadAuthorized:d.estado==='pagado_esperando_archivo'},200);
}
