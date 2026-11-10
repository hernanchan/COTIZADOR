/** Preflight comprador PDF grande (>40MiB) previo al multipart.
 * No reserva objeto ni devuelve URL de subida: la siguiente fase debe
 * conectar reserva D1, cuota, bucket aislado, recibo y verificación real.
 */
import {consultarPagoArchivoR2Live} from './r2-live-puente-central.mjs';
const HOST='https://pedidos.libreriasaber.com.ar',GO='GO_COMERCIAL_CONFIRMADO';
const reply=(data,status)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function preflightOriginalR2Live(req,env,{
 authorized=false,check=consultarPagoArchivoR2Live
}={}){
 const url=new URL(req.url);
 if(url.pathname!=='/api/pedido/live/r2/preflight'||
    url.origin!==HOST||req.method!=='POST'||url.search||
    req.headers.get('Origin')!==HOST||
    (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
    !authorized||env?.SABER_ENTORNO!=='produccion'||
    env?.DOCS_LIVE_R2_GATE!==GO||
    env?.DOCS_LIVE_RECEPCION_GATE!==GO||
    env?.DOCS_MP_LIVE_GATE!==GO)
  return reply({ok:false,error:'LIVE_R2_PREFLIGHT_OFF'},503);
 if(Number(req.headers.get('Content-Length')||0)>2500)
  return reply({ok:false,error:'LIVE_R2_PREFLIGHT_LIMITE'},413);
 const raw=await req.text();
 if(raw.length>2500)return reply({ok:false,error:'LIVE_R2_PREFLIGHT_LIMITE'},413);
 let input;try{input=JSON.parse(raw)}catch{}
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='bytes,fileId,name,orderId,pages,sha256')
  return reply({ok:false,error:'LIVE_R2_PREFLIGHT_META'},422);
 let data;
 try{data=await check(env,input)}
 catch{return reply({ok:false,error:'LIVE_R2_PREFLIGHT_PAGO_O_DATOS'},402)}
 return reply({ok:true,webOrderId:data.webOrderId,fileId:data.fileId,
  paymentVerified:true,uploadAuthorized:false,storageReserved:false,
  productionAuthorized:false,next:'R2_WAITING_FOR_MULTIPART'},200);
}
