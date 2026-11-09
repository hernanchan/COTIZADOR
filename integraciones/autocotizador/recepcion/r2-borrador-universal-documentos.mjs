/** Cotización de lote mixto y registro en Central firmado, sin checkout.
 * Personal privado únicamente hasta completar autenticar comprador/recuperación.
 */
import {fichaPrearchivoUniversal} from './ficha-prearchivo-universal.mjs';
import {obtenerTarifarioD1Privado} from './obtener-tarifario-d1-privado.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const reply=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store,private'}});
export async function guardarBorradorUniversal(request,env,{
 authorized=false,priceLoader=obtenerTarifarioD1Privado,
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(!authorized)return reply({ok:false,error:'UNIVERSAL_SESION'},401);
 if(env?.DOCS_R2_UNIVERSAL_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_PRICE_ADMIN_D1_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    !service?.fetch)return reply({ok:false,error:'UNIVERSAL_OFF'},503);
 const origin=new URL(request.url).origin;
 if(request.method!=='POST'||request.headers.get('Origin')!==origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'UNIVERSAL_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>150000)return reply({ok:false,error:'UNIVERSAL_LARGO'},413);
 let data;try{data=JSON.parse(raw)}catch{}
 if(!data||Object.keys(data).sort().join(',')!=='archivos,manifiestos,webOrderId')
  return reply({ok:false,error:'UNIVERSAL_DATOS'},422);
 let ficha;try{ficha=fichaPrearchivoUniversal({...data,tarifario:await priceLoader(env)})}
 catch{return reply({ok:false,error:'UNIVERSAL_COTIZACION'},422)}
 const hash=hex(new Uint8Array(await subtle.digest('SHA-256',
   new TextEncoder().encode(JSON.stringify(ficha)))));
 const body=JSON.stringify({...ficha,quoteHash:hash});
 // La Central requiere HMAC de <=32k; bloquear, nunca truncar instrucciones.
 if(body.length>31000)return reply({ok:false,error:'UNIVERSAL_FICHA_DEMASIADO_GRANDE'},413);
 let target;try{target=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!target||target.protocol!=='https:'||!HOST.test(target.hostname)||
    target.pathname!=='/internal/central/stage'||target.port||
    target.username||target.password||target.search||target.hash)
  return reply({ok:false,error:'UNIVERSAL_CENTRAL'},503);
 target.pathname='/internal/central/r2-universal-draft';
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return reply({ok:false,error:'UNIVERSAL_RELOJ'},503);
 const k=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',k,
   new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let res;try{res=await service.fetch(new Request(target.href,{method:'POST',
  headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':sig},body}))}
 catch{return reply({ok:false,error:'UNIVERSAL_CENTRAL_NO_RESPONDE'},503)}
 if(!res.ok)return reply({ok:false,error:'UNIVERSAL_RECHAZADO'},res.status===409?409:503);
 const saved=await res.json().catch(()=>null);
 if(!saved||saved.ok!==true||saved.webOrderId!==ficha.webOrderId||
    saved.totalArs!==ficha.totalArs||saved.fileCount!==ficha.archivos.length||
    !/^[a-f0-9-]{36}$/i.test(saved.draftId||'')||
    saved.checkoutEnabled!==false||saved.filesUploaded!==false||
    saved.paymentAuthorized!==false||saved.productionAuthorized!==false)
  return reply({ok:false,error:'UNIVERSAL_RESPUESTA'},502);
 return reply({ok:true,webOrderId:ficha.webOrderId,draftId:saved.draftId,
  totalArs:ficha.totalArs,fileCount:ficha.archivos.length,
  idempotent:!!saved.idempotent,checkoutEnabled:false,
  filesUploaded:false,paymentAuthorized:false,productionAuthorized:false},
  saved.idempotent?200:201);
}