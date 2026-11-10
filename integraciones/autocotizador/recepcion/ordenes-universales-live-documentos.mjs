/** Cotización y orden LIVE: sólo con sesión comprador vinculada, HTTPS y
 * Service Binding de Central producción. No usa endpoints /prueba-v2.
 * La aprobación de pago/recepción permanece en otra compuerta.
 */
import {fichaPrearchivoUniversal} from './ficha-prearchivo-universal.mjs';
import {obtenerTarifarioD1Live} from './obtener-tarifario-d1-live.mjs';
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar/internal/central/live/';
const GATE='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function permitted(req,env,authorized,service){
 const u=new URL(req.url);
 return authorized===true&&req.method==='POST'&&u.origin===ORIGIN&&
  !u.search&&!u.hash&&req.headers.get('Origin')===ORIGIN&&
  (!req.headers.get('Sec-Fetch-Site')||
   req.headers.get('Sec-Fetch-Site')==='same-origin')&&
  /^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')&&
  env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'&&
  env?.DOCS_MP_LIVE_GATE===GATE&&
  env?.DOCS_LIVE_PRICING_GATE===GATE&&
  env?.DOCS_LIVE_ORDER_GATE===GATE&&
  typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32&&
  typeof service?.fetch==='function';
}
async function signedService(service,env,path,payload,{subtle,now,nonce}){
 const body=JSON.stringify(payload);
 if(body.length>500000)throw Error('LIVE_BODY_EXCEDE');
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||!UUID.test(id))
  throw Error('LIVE_HMAC_IDENTIFIER');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 return service.fetch(new Request(CENTRAL+path,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig},body}));
}
export async function guardarBorradorUniversalLive(req,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 priceLoader=obtenerTarifarioD1Live,quoteBuilder=fichaPrearchivoUniversal,
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID()
}={}){
 if(!permitted(req,env,authorized,service)||new URL(req.url).pathname!=='/api/pedido/live/borrador')
  return reply({ok:false,error:'LIVE_DRAFT_OFF'},503);
 const raw=await req.text();
 if(raw.length>150000)return reply({ok:false,error:'LIVE_DRAFT_LIMITE'},413);
 let input;try{input=JSON.parse(raw)}catch{}
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).sort().join(',')!=='archivos,manifiestos,webOrderId'||
  !WEB.test(input.webOrderId||''))return reply({ok:false,error:'LIVE_DRAFT_INPUT'},422);
 let ficha;
 try{ficha=quoteBuilder({...input,tarifario:await priceLoader(env),produccion:true})}
 catch{return reply({ok:false,error:'LIVE_DRAFT_NO_QUOTE'},422)}
 const hash=hex(new Uint8Array(await subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(ficha)))));
 let response;
 try{response=await signedService(service,env,'draft',{...ficha,quoteHash:hash},
   {subtle,now,nonce})}
 catch{return reply({ok:false,error:'LIVE_DRAFT_CENTRAL_OFF'},503)}
 if(!response.ok)return reply({ok:false,error:'LIVE_DRAFT_CENTRAL_REJECT'},
  response.status===409?409:503);
 const saved=await response.json().catch(()=>null);
 if(!saved||saved.ok!==true||saved.webOrderId!==input.webOrderId||
  saved.totalArs!==ficha.totalArs||saved.fileCount!==ficha.archivos.length||
  !UUID.test(saved.draftId||'')||
  saved.checkoutEnabled!==false||saved.paymentAuthorized!==false||
  saved.filesUploaded!==false||saved.productionAuthorized!==false)
  return reply({ok:false,error:'LIVE_DRAFT_MISMATCH'},502);
 return reply({ok:true,webOrderId:input.webOrderId,draftId:saved.draftId,
  quoteHash:hash,totalArs:ficha.totalArs,fileCount:ficha.archivos.length,
  idempotent:!!saved.idempotent,checkoutEnabled:false,
  paymentAuthorized:false,filesUploaded:false,productionAuthorized:false},
  saved.idempotent?200:201);
}
export async function crearOrdenUniversalLive(req,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID()
}={}){
 if(!permitted(req,env,authorized,service)||new URL(req.url).pathname!=='/api/pedido/live/orden')
  return reply({ok:false,error:'LIVE_ORDER_OFF'},503);
 const raw=await req.text();
 if(raw.length>1200)return reply({ok:false,error:'LIVE_ORDER_LIMITE'},413);
 let input;try{input=JSON.parse(raw)}catch{}
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).sort().join(',')!=='draftId,quoteHash,telefono,webOrderId'||
  !WEB.test(input.webOrderId||'')||!UUID.test(input.draftId||'')||
  !SHA.test(input.quoteHash||'')||
  typeof input.telefono!=='string'||!/^[+0-9 ()-]{10,26}$/.test(input.telefono)||
  input.telefono.replace(/\D/g,'').length<10||
  input.telefono.replace(/\D/g,'').length>15)
  return reply({ok:false,error:'LIVE_ORDER_INPUT'},422);
 let response;
 try{response=await signedService(service,env,'order',{
  schema:'saber-central-r2-universal-create-order-v1',...input
 },{subtle,now,nonce})}
 catch{return reply({ok:false,error:'LIVE_ORDER_CENTRAL_OFF'},503)}
 if(!response.ok)return reply({ok:false,error:'LIVE_ORDER_CENTRAL_REJECT'},
  response.status===409?409:503);
 const saved=await response.json().catch(()=>null);
 if(!saved||saved.ok!==true||saved.webOrderId!==input.webOrderId||
  !UUID.test(saved.commercialOrderId||'')||
  !/^\d{3,}$/.test(saved.numeroOrden||'')||
  !Number.isSafeInteger(saved.totalArs)||saved.totalArs<1||
  !Number.isSafeInteger(saved.fileCount)||saved.fileCount<1||saved.fileCount>10||
  saved.checkoutEnabled!==false||saved.paymentAuthorized!==false||
  saved.uploadAuthorized!==false||saved.filesUploaded!==false||
  saved.productionAuthorized!==false)
  return reply({ok:false,error:'LIVE_ORDER_MISMATCH'},502);
 return reply(saved,saved.idempotent?200:201);
}
