/**
 * Enlace y estado de pago EXCLUSIVAMENTE para la orden canaria TUS.
 * Acceso: Basic de operador en Worker Documentos + HMAC servicio Central.
 * No admite cliente, precio, rutas de Storage, pago simulado ni entrega.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store,private',
 'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'}});
export async function checkoutCanarioTUSPersonal(req,env,{
 authorized=false,now=()=>Math.floor(Date.now()/1000),uuid=()=>crypto.randomUUID(),
 subtle=crypto.subtle,service=env?.SABER_CENTRAL
}={}){
 if(authorized!==true)return reply({ok:false,error:'Operador no autorizado'},401);
 if(req.method!=='POST'||req.headers.get('Origin')!==new URL(req.url).origin||
    !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
    (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return reply({ok:false,error:'Solicitud privada incorrecta'},403);
 let d;
 try{
  const raw=await req.text();
  if(raw.length>250)throw Error('límite');
  d=JSON.parse(raw);
  if(!d||typeof d!=='object'||Array.isArray(d)||
    Object.keys(d).sort().join(',')!=='action,webOrderId'||
    !['start','status'].includes(d.action)||!WEB.test(d.webOrderId||''))
   throw Error('contrato');
 }catch{return reply({ok:false,error:'Referencia canaria inválida'},422)}
 if(env?.DOCS_TUS_PURGE_CANARY_ORDER!==d.webOrderId||
    env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'Ensayo canario no disponible'},503);
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{return reply({ok:false,error:'Central no disponible'},503)}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||
    target.pathname!=='/internal/central/stage'||target.search||target.hash||
    target.port||target.username||target.password)
  return reply({ok:false,error:'Central privada no autorizada'},503);
 target.pathname='/internal/central/canary-checkout';
 const payload=JSON.stringify({action:d.action,schema:'saber-central-tus-canary-checkout-v1',webOrderId:d.webOrderId});
 const ts=now(),requestId=uuid();
 if(!Number.isSafeInteger(ts)||!UUID.test(requestId))
  return reply({ok:false,error:'Firma interna no disponible'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+requestId+'\n'+payload))),
  x=>x.toString(16).padStart(2,'0')).join('');
 try{
  const r=await service.fetch(new Request(target.href,{method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':requestId,'x-saber-signature':mac},body:payload}));
  const raw=await r.text();
  if(raw.length>4000)throw Error('Respuesta demasiado extensa');
  const result=JSON.parse(raw);
  if(r.status!==200||result?.ok!==true)
   return reply({ok:false,error:String(result?.error||'El pago todavía no está disponible').slice(0,140)},r.status===409?409:503);
  if(result.webOrderId!==d.webOrderId||!Number.isSafeInteger(result.amountArs)||result.amountArs<1||
     !UUID.test(result.commercialOrderId||''))
   throw Error('Identidad de Central inválida');
  if(d.action==='status'){
   if(!['pendiente','pagado','revocado'].includes(result.estado))
    throw Error('Estado de pago inválido');
   return reply({ok:true,estado:result.estado,workNumber:'024',
    webOrderId:d.webOrderId,amountArs:result.amountArs,
    commercialOrderId:result.commercialOrderId});
  }
  const url=new URL(result.checkoutUrl);
  if(url.protocol!=='https:'||
     !/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname)||
     url.username||url.password||url.hash)
   throw Error('Enlace de pago no autorizado');
  return reply({ok:true,webOrderId:d.webOrderId,
   commercialOrderId:result.commercialOrderId,amountArs:result.amountArs,
   checkoutUrl:url.href,mode:'sandbox-only'});
 }catch{return reply({ok:false,error:'Fallo de comunicación privada con Central'},503)}
}
