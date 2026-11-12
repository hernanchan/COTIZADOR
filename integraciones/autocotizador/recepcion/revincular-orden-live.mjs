/** Recuperación de sesión de una orden LIVE ya existente.
 * Una sesión Turnstile recién verificada + 2 referencias aleatorias de
 * 128 bits guardadas en sessionStorage de la MISMA pestaña permite consultar
 * el D1 firmado de Central. No acepta un número correlativo visible.
 * Nunca crea cotización, orden, preferencia de pago ni autoriza carga por sí sola.
 */
import {vinculoOrdenLive} from './sesion-comprador-live.mjs';
const HOST='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar/internal/central/live/status';
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(payload,status)=>Response.json(payload,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'
}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function revincularOrdenLive(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle,link=vinculoOrdenLive
}={}){
 if(!authorized||env?.SABER_ENTORNO!=='produccion'||
    env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_LIVE_SESSION_GATE!==GO||env?.DOCS_MP_LIVE_GATE!==GO||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'LIVE_RECUPERACION_NO_AUTORIZADA'},401);
 const u=new URL(request.url);
 if(request.method!=='POST'||u.origin!==HOST||
    u.pathname!=='/api/pedido/live/revincular'||u.search||u.hash||
    request.headers.get('Origin')!==HOST||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'LIVE_RECUPERACION_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>500)return reply({ok:false,error:'LIVE_RECUPERACION_TAMANO'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).sort().join(',')!=='commercialOrderId,webOrderId'||
   !WEB.test(p.webOrderId||'')||!UUID.test(p.commercialOrderId||''))
  return reply({ok:false,error:'LIVE_RECUPERACION_REFERENCIAS'},422);
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1e9||ts>9999999999||!UUID.test(id))
  return reply({ok:false,error:'LIVE_RECUPERACION_RELOJ'},503);
 const body=JSON.stringify({schema:'saber-mp-live-status-v1',
  webOrderId:p.webOrderId,commercialOrderId:p.commercialOrderId});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let res;
 try{
  res=await service.fetch(new Request(CENTRAL,{method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':signature
  },body}));
 }catch{return reply({ok:false,error:'LIVE_RECUPERACION_CENTRAL_NO_DISPONIBLE'},503)}
 if(!res.ok)return reply({ok:false,error:'LIVE_RECUPERACION_ORDEN_NO_VALIDADA'},
  res.status===404?404:503);
 const status=await res.json().catch(()=>null);
 if(status?.ok!==true||status.webOrderId!==p.webOrderId||
    status.commercialOrderId!==p.commercialOrderId||
    !['pendiente','pagado_esperando_archivos'].includes(status.estado)||
    !Number.isSafeInteger(status.amountArs)||status.amountArs<1||
    !Number.isSafeInteger(status.fileCount)||status.fileCount<1||status.fileCount>10||
    !Number.isSafeInteger(status.pendingFiles)||status.pendingFiles<0||
    status.pendingFiles>status.fileCount||
    status.productionAuthorized!==false)
  return reply({ok:false,error:'LIVE_RECUPERACION_ESTADO_INCOMPATIBLE'},409);
 const cookie=await link(request,env,p.webOrderId);
 if(!cookie||!cookie.startsWith('saber_pedido_live_order_v1=')||
    !cookie.includes('; Secure; HttpOnly; SameSite=Strict'))
  return reply({ok:false,error:'LIVE_RECUPERACION_SESION'},503);
 const response=reply({ok:true,recuperada:true,
  paymentAuthorized:false,uploadAuthorized:false,productionAuthorized:false},200);
 response.headers.append('Set-Cookie',cookie);
 return response;
}
