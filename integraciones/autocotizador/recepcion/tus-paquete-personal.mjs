/**
 * Ficha numerada de ZIP: únicamente operador con HTTP Basic y origen
 * verificado. D1 es autoridad del número e instrucciones, no el navegador.
 * Solamente metadatos: los PDF se descargan después, individualmente, por
 * descargarPdfTUSPersonal (D1 + SHA-256), sin URLs directas de Storage.
 */
import {tusPrivadoConfigurado} from './tus-pedido-worker.mjs';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const CENTRAL=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const json=(x,status)=>new Response(JSON.stringify(x),{status,
 headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'}});
export async function consultarPaqueteTUSPersonal(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,uuid=()=>crypto.randomUUID(),
 now=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle
}={}){
 try{
  const u=new URL(request.url);
  if(!tusPrivadoConfigurado(env)||authorized!==true||request.method!=='POST'||
     u.protocol!=='https:'||request.headers.get('Origin')!==u.origin||
     !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
     (request.headers.get('Sec-Fetch-Site')&&
      request.headers.get('Sec-Fetch-Site')!=='same-origin'))
   return json({ok:false,error:'Operador no autorizado'},403);
  const input=await request.text();
  if(input.length>500)throw Error('Tamaño inválido');
  const d=JSON.parse(input);
  if(!d||Object.keys(d).join(',')!=='webOrderId'||!WEB.test(d.webOrderId||''))
   return json({ok:false,error:'Referencia de pedido incorrecta'},422);
  if(typeof service?.fetch!=='function'||
     typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
   return json({ok:false,error:'Central no configurada'},503);
  let target;
  try{target=new URL(env.CENTRAL_TEST_URL)}catch{}
  if(!target||target.protocol!=='https:'||!CENTRAL.test(target.hostname)||
     target.pathname!=='/internal/central/stage'||target.search||target.hash||
     target.port||target.username||target.password)
   return json({ok:false,error:'Central privada incorrecta'},503);
  target.pathname='/internal/central/tus-package';
  const payload=JSON.stringify({schema:'saber-central-tus-package-v1',webOrderId:d.webOrderId});
  const ts=now(),nonce=uuid();
  if(!Number.isSafeInteger(ts)||!/^[-a-f0-9]{36}$/i.test(nonce))
   throw Error('Solicitud inválida');
  const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
   new TextEncoder().encode(ts+'\n'+nonce+'\n'+payload))),
   x=>x.toString(16).padStart(2,'0')).join('');
  const res=await service.fetch(new Request(target.href,{method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':nonce,'x-saber-signature':signature},body:payload}));
  const raw=await res.text();
  if(raw.length>40000)throw Error('Respuesta excedida');
  const obj=JSON.parse(raw);
  if(res.status!==200||obj?.ok!==true||
     obj.webOrderId!==d.webOrderId||obj.schema!=='saber-central-tus-package-v1'||
     !/^\d{3,}$/.test(obj.numeroOrden||'')||
     !Array.isArray(obj.trabajos)||obj.trabajos.length<1||
     obj.trabajos.length>30||obj.paymentAuthorized!==false||
     obj.listoParaProducir!==false)
   return json({ok:false,error:'La Central no confirmó el paquete'},409);
  return json(obj,200);
 }catch(_){
  return json({ok:false,error:'No se pudo verificar la ficha privada'},502);
 }
}
