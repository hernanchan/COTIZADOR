/**
 * Recepción Polaroids Saber, Preparado para la web de producción de Librería Saber; APAGADO hasta autorización.
 * Proxy stateless. Fotos en tránsito directo a Google Apps Script privado.
 * Sin R2, KV, D1, almacenamiento intermedio ni claves de Google en cliente.
 *
 * La verificación Turnstile del inicio, autenticación de pedido,
 * cuotas y creación de PDF se ejecutan en Apps Script.
 */
const HOST='libreriasaber.com.ar';
const ORIGIN='https://'+HOST;
const APPS_SCRIPT='https://script.google.com/macros/s/AKfycbxH5hpSS0HjTLQtFIxmTluo7KHzxHj1FWpDkbIwW25_jKVdDq_EFnfBFyNO3XIJpv0TIg/exec';
const CALLBACK='saberStatus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MAX_POST_BYTES=15*1024*1024;
const REFERENCE=/^POL-[A-F0-9]{24}$/;
const UPLOAD_KEY=/^[a-f0-9]{64}$/;
const OPTIONS=new Set(['start','photo','finish','status']);

function json(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
 }});
}
function allowedUrl(request){
 const url=new URL(request.url);
 return url.hostname===HOST&&url.protocol==='https:';
}
function permittedPost(request){
 if(!allowedUrl(request)||request.headers.get('Origin')!==ORIGIN)return false;
 const site=request.headers.get('Sec-Fetch-Site');
 return !site||site==='same-origin';
}
async function upstreamStatus(reference,uploadKey){
 const url=new URL(APPS_SCRIPT);
 url.searchParams.set('api','status');
 url.searchParams.set('reference',reference);
 url.searchParams.set('uploadKey',uploadKey);
 url.searchParams.set('callback',CALLBACK);
 const response=await fetch(url.toString(),{
  method:'GET',redirect:'follow',cache:'no-store',
  headers:{'Accept':'text/javascript'},
  signal:AbortSignal.timeout(16000)
 });
 if(!response.ok)throw Error('Google status HTTP '+response.status);
 const script=(await response.text()).trim();
 const prefix=CALLBACK+'(';
 if(!script.startsWith(prefix)||!script.endsWith(');')||script.length>1200)
  throw Error('Respuesta inesperada desde Google.');
 const data=JSON.parse(script.slice(prefix.length,-2));
 if(!data||typeof data!=='object'||typeof data.ok!=='boolean')
  throw Error('El estado de Google no es válido.');
 return data;
}
export async function onRequestGet({request,env}){
 if(!allowedUrl(request))return json({ok:false,error:'Host no autorizado.'},403);
 const receptionEnabled=await testReceptionEnabled(request,env);
 return json({ok:true,route:'polaroids-receiver',testOnly:false,
  photosSent:0,receptionEnabled});
}
async function testReceptionEnabled(request,env){
 // The client-side configuration is not a security gate by itself.
 // Enforce the same switch at the Cloudflare relay before contacting Google.
 // A missing asset binding, invalid JSON or a stale/wrong hostname fails closed.
 if(!env||!env.ASSETS||typeof env.ASSETS.fetch!=='function')return false;
 try{
  const url=new URL('/polaroids/recepcion-config.json',request.url);
  const response=await env.ASSETS.fetch(new Request(url.toString(),{
   method:'GET',cache:'no-store',headers:{Accept:'application/json'}
  }));
  if(!response.ok)return false;
  const raw=await response.text();
  if(raw.length>4096)return false;
  const state=JSON.parse(raw);
  return state.enabled===true&&state.rollout==='APROBADO'&&
   /^0x[A-Za-z0-9_-]{8,}$/.test(String(state.turnstileSiteKey||''))&&
   state.allowedHost===HOST&&state.bridgeUrl===APPS_SCRIPT;
 }catch(_){return false}
}
export async function onRequestPost({request,env}){
 if(!permittedPost(request))return json({ok:false,error:'Origen no autorizado.'},403);
 if(!await testReceptionEnabled(request,env))
  return json({ok:false,error:'Recepción de pruebas pausada.'},503);
 const type=request.headers.get('Content-Type')||'';
 if(!/^application\/json(?:;|$)/i.test(type))
  return json({ok:false,error:'Formato de solicitud no admitido.'},415);
 const op=new URL(request.url).searchParams.get('op')||'';
 if(!OPTIONS.has(op))return json({ok:false,error:'Operación no admitida.'},400);
 const statedSize=Number(request.headers.get('Content-Length'));
 if(statedSize>MAX_POST_BYTES)
  return json({ok:false,error:'La foto excede el tamaño de transmisión permitido.'},413);
 if(!request.body)return json({ok:false,error:'Faltan datos.'},400);
 if(op==='status'){
  let input;
  try{
   const raw=await request.text();
   if(raw.length>2000)throw Error('Solicitud demasiado larga.');
   input=JSON.parse(raw);
  }catch(_){return json({ok:false,error:'Solicitud de consulta inválida.'},400)}
  if(!REFERENCE.test(input.reference)||!UPLOAD_KEY.test(input.uploadKey))
   return json({ok:false,error:'Datos de pedido inválidos.'},400);
  try{
   const data=await upstreamStatus(input.reference,input.uploadKey);
   if(data.ok!==true)return json({ok:false,error:'No se pudo validar el pedido.'},403);
   return json({
    ok:true,found:data.found===true,
    status:data.found?data.status:undefined,
    received:data.found?data.received:undefined,
    photos:data.found?data.photos:undefined,
    sheets:data.found?data.sheets:undefined
   });
  }catch(_){return json({ok:false,error:'Google no respondió a la consulta de recepción.'},502)}
 }
 // Se preserva el cuerpo por streaming, sin leer ni almacenar fotos en Cloudflare.
 // TransformStream corta cualquier transmisión que supere 15 MiB, aun sin
 // Content-Length. No se necesitan datos persistentes ni planes pagos.
 let transferred=0;
 const limited=request.body.pipeThrough(new TransformStream({
  transform(chunk,controller){
   transferred+=chunk.byteLength;
   if(transferred>MAX_POST_BYTES)throw Error('Carga demasiado grande.');
   controller.enqueue(chunk);
  }
 }));
 try{
  const upstream=await fetch(APPS_SCRIPT,{
   method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
   body:limited,redirect:'manual',cache:'no-store',
   signal:AbortSignal.timeout(40000)
  });
  // ContentService de Google suele devolver HTTP 302 para entregar "OK".
  // El estado definitivo SIEMPRE se verifica por la consulta privada.
  if(upstream.status===302||upstream.status===303||upstream.ok)
   return json({ok:true,dispatched:true,confirmed:false},202);
  return json({ok:false,error:'Google rechazó la transmisión (HTTP '+upstream.status+').'},502);
 }catch(_){
  // Una caída de red podría producirse después de que Google guardó la foto:
  // no afirmar fallo definitivo; el navegador debe consultar estado.
  return json({ok:false,dispatched:'unknown',
   error:'No se pudo confirmar el envío a Google. Consultá el estado del pedido.'},502);
 }
}
