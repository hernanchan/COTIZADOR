import {verificarPdfAlmacenado} from './verificacion-pdf-drive-servidor.mjs';
/**
 * SABER — DOCUMENTOS — ARCHIVO ÚNICO LISTO PARA PEGAR EN CLOUDFLARE
 *
 * VERSIÓN DE SEGURIDAD PARA ENSAYO, SIN CARGAS: bloqueo DOBLE.
 * INTERNAL_ALLOW_UPLOADS=false es deliberadamente constante en este código.
 * El secreto DOCS_RELAY_KEY y la URL de Apps Script están guardados
 * SOLO en Variables y secretos del Worker, NUNCA en este archivo.
 *
 * La RUTA GENERAL sigue bloqueada. PILOTO: una sesión de PDF de hasta 1 MB,
 * FASE 2: permite validar páginas del PDF original ya recibido y comprobado.
 * en carpeta separada, sin acceso a pagos ni validación de páginas.
 * La operación de ping de Google
 * puede ejecutarse si DOCS_PING_ENABLED=true y Turnstile se valida.
 * DOCS_UPLOAD_ENABLED no activa la subida, incluso si se cambia a true.
 * Nunca usar en producción tal cual.
 */
const INTERNAL_ALLOW_UPLOADS = false;
const WORKER_SERVICE = 'saber-documentos-pruebas';

function closed() {
  return new Response(JSON.stringify({
    ok:false, service:WORKER_SERVICE, receptionEnabled:false,
    message:'Recepcion de documentos desactivada'
  }), {status:503, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, private',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  }});
}

/**
 * Librería Saber | relay Cloudflare independiente de recepción de PDF.
 * SIN RUTA ACTIVA Y NO DESPLEGADO. No reutiliza polaroids-receiver.js.
 * HMAC env.DOCS_RELAY_KEY coincide con propiedad privada Google Apps Script.
 * Requiere DOCS_UPLOAD_ENABLED=true + DOCS_ALLOWED_ORIGIN exacto + Turnstile.
 */
const MAX_BODY_BYTES=950000;
const DOCS_MAX=20*1024*1024;
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
function allowed(request,env){
 const allowed=env.DOCS_ALLOWED_ORIGIN;
 if(typeof allowed!=='string'||!/^https:\/\//.test(allowed))return false;
 const u=new URL(request.url),a=new URL(allowed);
 return u.origin===a.origin&&request.headers.get('Origin')===allowed&&
  (!request.headers.get('Sec-Fetch-Site')||request.headers.get('Sec-Fetch-Site')==='same-origin');
}
async function readLimited(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('Formato de solicitud no admitido.');
 const declared=Number(request.headers.get('Content-Length'));
 if(declared>MAX_BODY_BYTES)throw Error('Solicitud demasiado grande.');
 const reader=request.body?.getReader();if(!reader)throw Error('Solicitud vacía.');
 const chunks=[];let size=0;
 while(true){
  const part=await reader.read();if(part.done)break;
  size+=part.value.byteLength;
  if(size>MAX_BODY_BYTES){await reader.cancel();throw Error('Solicitud demasiado grande.');}
  chunks.push(part.value);
 }
 const bytes=new Uint8Array(size);let pos=0;
 for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
function validateBasic(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !['start','status','part','finish'].includes(input.op))
   throw Error('Operación inválida.');
 if(input.op==='start'){
  const m=input.meta;
  if(!m||typeof m!=='object'||typeof input.turnstileToken!=='string'||
   input.turnstileToken.length<10||
   !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
   !/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')||
   !/\.pdf$/i.test(m.name||'')||
   !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>DOCS_MAX||
   !/^[a-f0-9]{64}$/.test(m.sha256||'')||
   m.partBytes!==524288||m.parts!==Math.ceil(m.bytes/524288)||
   !['bn','color','cad','poster'].includes(m.mode))
   throw Error('PDF o verificación de inicio inválidos.');
 }
 if(input.op!=='start'&&(
   typeof input.uploadId!=='string'||!/^DOC-[a-f0-9-]{36}$/i.test(input.uploadId)||
   typeof input.token!=='string'||input.token.length<16))
   throw Error('Sesión inválida.');
 if(input.op==='part'&&(
   !Number.isSafeInteger(input.index)||input.index<0||
   !Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>524288||
   !/^[a-f0-9]{64}$/.test(input.sha256||'')||
   typeof input.dataBase64!=='string'||input.dataBase64.length>699100))
   throw Error('Fragmento inválido.');
}
async function turnstileValid(input,env,fetcher){
 const f=new URLSearchParams();
 f.set('secret',env.DOCS_TURNSTILE_SECRET||'');
 f.set('response',input.turnstileToken);
 let r;
 try{r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',
  {method:'POST',body:f,redirect:'manual',signal:AbortSignal.timeout(15000)});}
 catch(_){return false}
 if(!r.ok)return false;
 const v=await r.json().catch(()=>null);
 return v?.success===true&&v?.hostname===new URL(env.DOCS_ALLOWED_ORIGIN).hostname&&
  v?.action==='documentos';
}
async function signature(json,timestamp,key){
 const bytes=new TextEncoder().encode(timestamp+'\n'+json);
 const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',secret,bytes));
 return Array.from(signed,b=>(b&255).toString(16).padStart(2,'0')).join('');
}
function googleScriptUrl(str){
 return typeof str==='string'&&
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(str);
}
async function postToScript(env,payload,fetcher,maxResponseChars=5000){
 if(!googleScriptUrl(env.DOCS_SCRIPT_URL)||typeof env.DOCS_RELAY_KEY!=='string'||
  env.DOCS_RELAY_KEY.length<32)throw Error('Conexión privada no configurada.');
 const payloadJson=JSON.stringify(payload),timestamp=Date.now();
 const envelope=JSON.stringify({
   payloadJson,timestamp,signature:await signature(payloadJson,timestamp,env.DOCS_RELAY_KEY)
 });
 let stage='script_post';
 let r=await fetcher(env.DOCS_SCRIPT_URL,{
  method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
  body:envelope,redirect:'manual',signal:AbortSignal.timeout(55000)});
 if([302,303].includes(r.status)){
  stage='googleusercontent_get';
  const location=r.headers.get('Location')||'';
  if(!/^https:\/\/script\.googleusercontent\.com\/macros\//.test(location))
    throw Error('Redirección de Google no autorizada.');
  // Cloudflare Workers NO admite redirect:'error': se usa manual y se rechaza cualquier 3xx adicional.
  r=await fetcher(location,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
 }
 if(!r.ok){
  const failure=new Error('Google no confirmó la operación.');
  failure.stage=stage;
  if(Number.isInteger(r.status)&&r.status>=100&&r.status<=599)failure.httpStatus=r.status;
  throw failure;
 }
 const data=await r.text();
 if(data.length>maxResponseChars)throw Error('Respuesta Google inesperada.');
 let json;
 try{json=JSON.parse(data)}catch(_){throw Error('Respuesta Google ilegible.')}
 if(!json||typeof json.ok!=='boolean')throw Error('Respuesta Google inválida.');
 return json;
}
async function handleDocumentsPost(request,env,fetcher=fetch){
 if(env?.DOCS_UPLOAD_ENABLED!=='true')
  return response({ok:false,error:'Recepción de documentos desactivada.'},503);
 if(request.method!=='POST')return response({ok:false,error:'Método no permitido.'},405);
 if(!allowed(request,env))return response({ok:false,error:'Origen no autorizado.'},403);
 let input;
 try{input=await readLimited(request);validateBasic(input)}
 catch(e){return response({ok:false,error:e.message||'Solicitud inválida.'},400)}
 if(input.op==='start'&&!(await turnstileValid(input,env,fetcher)))
   return response({ok:false,error:'No se pudo validar el inicio seguro.'},403);
 const op=input.op, p={...input};delete p.turnstileToken;
 try{
  const result=await postToScript(env,p,fetcher);
  if(!result.ok)return response({ok:false,error:result.error||'Recepción no confirmada.'},422);
  // No dar al navegador URLs de Drive, sesión Google ni variables internas.
  return response(result,200);
 }catch(_){
  // Puede haberse guardado el fragmento aunque se haya perdido la respuesta:
  // la próxima llamada a status consultará la misma sesión.
  return response({ok:false,op,dispatched:'unknown',
    error:'La conexión no permitió confirmar el estado. Consultá nuevamente antes de reenviar.'},502);
 }
}


/* Página de prueba Turnstile, independiente del receptor de documentos. */
function testResponse(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex,nofollow'
  }});
}
function testPage(env,mode='turnstile'){
  const googleMode=mode==='google';
  const pageTitle=googleMode?'Prueba de conexión · Cloudflare y Google':'Prueba de seguridad · Documentos';
  const pageDescription=googleMode
    ?'Se comprobará un ping firmado a Google Apps Script. NO se envían PDF ni se habilitan compras.'
    :'La recepción de PDF permanece desactivada. Esta página sólo verifica Turnstile; no accede a Drive.';
  const endpoint=googleMode?'/prueba-google':'/prueba-turnstile';
  const successMessage=googleMode
    ?'PING CONFIRMADO: Cloudflare y Google se comunicaron mediante una firma correcta. La recepción continúa desactivada.'
    :'PRUEBA EXITOSA: Turnstile validado por Cloudflare. La recepción continúa desactivada.';
  const sitekey=env?.DOCS_TURNSTILE_SITE_KEY;
  if(typeof sitekey!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(sitekey))
    return testResponse({ok:false,reason:'site_key_missing',receptionEnabled:false},503);
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Librería Saber | Prueba de Turnstile</title>
  <style>body{font:16px Arial,sans-serif;background:#eef3f8;color:#12344d}
  main{max-width:540px;margin:9vh auto;background:#fff;border-radius:12px;padding:25px}
  h1{font-size:22px}p{line-height:1.5}
  button{border:0;border-radius:7px;padding:12px 19px;background:#176496;color:white;cursor:pointer}
  #salida{font-weight:bold}</style></head><body><main>
  <h1>${pageTitle}</h1>
  <p>${pageDescription}</p>
  <form id="form"><div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
  <p><button type="submit">Comprobar verificación</button></p></form>
  <p id="salida" aria-live="polite">Completá primero la verificación.</p>
  </main><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script>
  document.getElementById('form').addEventListener('submit',async e=>{
    e.preventDefault();
    const out=document.getElementById('salida');
    const token=window.turnstile?.getResponse();
    if(!token){out.textContent='Esperá o completá la verificación.';return;}
    out.textContent='Comprobando...';
    try{
      const res=await fetch('${endpoint}',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token})
      });
      const value=await res.json();
      out.textContent=value.ok
        ? '${successMessage}'
        : 'NO VALIDADO — diagnóstico: '+String(value.reason || 'sin_diagnostico')+
          (Array.isArray(value.codes)&&value.codes.length ? ' ('+value.codes.join(', ')+')' : '')+
          (value.kind ? ' ['+value.kind+']' : '')+
          (value.httpStatus ? ' [HTTP '+value.httpStatus+']' : '')+
          (value.stage ? ' [etapa '+value.stage+']' : '')+
          '. La recepción de PDF continúa desactivada.';
    }catch(_){out.textContent='No se pudo completar la consulta.';}
    window.turnstile?.reset();
  });
  </script></body></html>`;
  return new Response(html,{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY','X-Robots-Tag':'noindex,nofollow'
  }});
}
async function testTurnstilePost(request,env){
  if(request.headers.get('Origin')!==new URL(request.url).origin||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
    return testResponse({ok:false,reason:'origin_or_content_type',receptionEnabled:false},403);
  if(typeof env?.DOCS_TURNSTILE_SECRET!=='string'||!env.DOCS_TURNSTILE_SECRET)
    return testResponse({ok:false,reason:'turnstile_secret_missing',receptionEnabled:false},503);
  let data;
  try{
    if(Number(request.headers.get('Content-Length'))>4096)throw Error('size');
    const r=request.body?.getReader();if(!r)throw Error('body');
    const chunks=[];let size=0;
    while(true){
      const {value,done}=await r.read();if(done)break;
      size+=value.byteLength;
      if(size>4096){await r.cancel();throw Error('size');}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let start=0;
    for(const chunk of chunks){bytes.set(chunk,start);start+=chunk.length;}
    data=JSON.parse(new TextDecoder().decode(bytes));
    if(typeof data.token!=='string'||data.token.length<10||data.token.length>2048)
      throw Error('token');
  }catch(_){return testResponse({ok:false,reason:'token_body_invalid',receptionEnabled:false},400);}
  // Igual que el ejemplo oficial Cloudflare Workers: FormData y POST Siteverify.
  // Diagnósticos por etapas; nunca mostrar datos del token ni del secreto.
  const form=new FormData();
  form.append('secret',env.DOCS_TURNSTILE_SECRET);
  form.append('response',data.token);
  let r;
  try{
    r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',body:form
    });
  }catch(error){
    const kind=(error&&error.name==='TypeError')?'type_error':
      (error&&error.name==='AbortError')?'aborted':'other';
    return testResponse({ok:false,reason:'siteverify_fetch_failed',kind,receptionEnabled:false},403);
  }
  if(!r.ok)return testResponse({
    ok:false,reason:'siteverify_http_error',httpStatus:r.status,receptionEnabled:false
  },403);
  let v;
  try{v=await r.json();}
  catch(_){return testResponse({ok:false,reason:'siteverify_invalid_json',receptionEnabled:false},403);}
  if(!v||typeof v.success!=='boolean')
    return testResponse({ok:false,reason:'siteverify_unexpected_json',receptionEnabled:false},403);
  if(v.success!==true){
    const allowedCodes=['missing-input-secret','invalid-input-secret',
      'missing-input-response','invalid-input-response',
      'bad-request','timeout-or-duplicate','internal-error'];
    const codes=Array.isArray(v['error-codes'])
      ? v['error-codes'].filter(x=>allowedCodes.includes(x)).slice(0,3) : [];
    return testResponse({ok:false,reason:'cloudflare_rejected',codes,receptionEnabled:false},403);
  }
  let permitted;
  try{permitted=new URL(env.DOCS_ALLOWED_ORIGIN).hostname;}
  catch(_){return testResponse({ok:false,reason:'allowed_origin_invalid',receptionEnabled:false},503);}
  if(v.hostname!==permitted)return testResponse({
    ok:false,reason:'hostname_mismatch',receptionEnabled:false},403);
  if(v.action!=='documentos')return testResponse({
    ok:false,reason:'action_mismatch',receptionEnabled:false},403);
  return testResponse({ok:true,receptionEnabled:false},200);
}

// Puente de diagnóstico restringido a un único ping firmado.
// Incluso si DOCS_PING_ENABLED=true, el receptor de PDF continúa bloqueado.
async function testGooglePing(request,env){
  if(env?.DOCS_PING_ENABLED!=='true')return testResponse({
    ok:false,reason:'google_ping_disabled',receptionEnabled:false},503);
  // Reutilizar el control de token + origen + acción comprobado en el ensayo real.
  const guard=await testTurnstilePost(request,env);
  if(!guard.ok)return guard;
  let googleReply;
  try{
    googleReply=await postToScript(env,{
      op:'ping',purpose:'saber-docs-hmac-v1'
    },fetch);
  }catch(err){
    const msg=String(err?.message||'');
    const reason=msg==='Redirección de Google no autorizada.'?'google_access_restricted':
      msg==='Google no confirmó la operación.'?'google_http_or_access_error':
      msg==='Respuesta Google ilegible.'?'google_non_json_response':
      msg==='Respuesta Google inesperada.'?'google_response_too_large':
      msg==='Respuesta Google inválida.'?'google_response_invalid':
      msg==='Conexión privada no configurada.'?'google_config_incomplete':
      'google_transport_error';
    const diagnostic={ok:false,reason,receptionEnabled:false};
    if(reason==='google_http_or_access_error'){
      diagnostic.stage=err?.stage==='googleusercontent_get'?'googleusercontent_get':'script_post';
      if(Number.isInteger(err?.httpStatus)&&err.httpStatus>=100&&err.httpStatus<=599)
        diagnostic.httpStatus=err.httpStatus;
    }
    return testResponse(diagnostic,502);
  }
  if(googleReply?.ok===true&&
    googleReply?.service==='saber-docs-handshake'&&
    googleReply?.signed===true&&
    googleReply?.receptionEnabled===false&&
    googleReply?.apiVersion==='ping-v1'){
    return testResponse({
      ok:true,service:'saber-docs-handshake',
      signed:true,receptionEnabled:false
    },200);
  }
  return testResponse({ok:false,reason:'google_ping_not_confirmed',
    receptionEnabled:false},502);
}


/* PILOTO PDF único: endpoint distinto, un solo PDF <= 1MiB y sin checkout.
   El receptor de Google aplica su propio cupo y verifica HMAC en cada operación.
   Ninguna variable ni clave adicional en Cloudflare. */
const PILOT_MAX_BYTES=1024*1024;
const PILOT_ORDER='WEB-PILOTO-UN-PDF-20261020';
const PILOT_FILE='pdf-prueba';
function pilotHtml(env){
  const siteKey=env?.DOCS_TURNSTILE_SITE_KEY;
  if(typeof siteKey!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(siteKey))
    return testResponse({ok:false,reason:'site_key_missing',receptionEnabled:false},503);
  const html = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Librería Saber | Ensayo privado de PDF</title>
<style>
body{margin:0;background:#f1f4f7;color:#182b3f;font:16px system-ui,Arial,sans-serif}
main{max-width:600px;margin:6vh auto;padding:24px;background:white;border-radius:14px}
h1{font-size:24px;margin-top:0}
.notice{background:#e6f3f8;border-left:4px solid #1178a2;padding:12px;margin:12px 0 20px}
label{display:block;margin:15px 0 7px;font-weight:600}
input,button{font-size:16px}
button{background:#175a84;border:0;border-radius:8px;color:white;padding:13px 18px;cursor:pointer}
button:disabled{opacity:.55;cursor:wait}
#log{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.6}
</style></head><body><main><h1>Prueba de recepción de PDF</h1>
<p class="notice">Sólo UN archivo PDF de hasta 1 MB en carpeta de pruebas. No genera pedidos, precios, pagos ni documentos cobrables.</p>
<label for="pdf">Seleccionar PDF pequeño</label>
<input type="file" id="pdf" accept=".pdf,application/pdf">
<p>Verificación de seguridad</p>
<div class="cf-turnstile" data-sitekey="${siteKey}" data-action="documentos"></div>
<p><button type="button" id="send">Enviar PDF de prueba</button></p>
<div id="log" role="status" aria-live="polite">Esperando un archivo.</div>
</main>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
(async function(){
const btn=document.getElementById('send');
const log=document.getElementById('log');
const set=(message)=>log.textContent=message;
const partBytes=524288;
const MAX=1048576;
const digest=async buf=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)), b=>b.toString(16).padStart(2,'0')).join('');
function b64(u8){
 const limit=12288; let str='';
 for(let i=0;i<u8.length;i+=limit)str+=btoa(String.fromCharCode(...u8.slice(i,i+limit)));
 return str;
}
async function rpc(payload){
 const response=await fetch('/api/piloto-pdf',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 });
 const json=await response.json();
 if(!response.ok||json.ok!==true)throw Error(json.error||'El receptor no confirmó la operación ('+response.status+').');
 return json;
}
btn.addEventListener('click',async ()=>{
 if(btn.disabled)return;
 const file=document.getElementById('pdf').files[0];
 if(!file){set('Seleccioná primero un archivo PDF.');return;}
 if(!/\.pdf$/i.test(file.name)||file.size<5||file.size>MAX){
  set('Elegí un PDF de hasta 1 MB.');return;
 }
 const token=window.turnstile?.getResponse();
 if(!token){set('Completá primero la verificación Turnstile.');return;}
 btn.disabled=true;
 try{
  const buf=await file.arrayBuffer(),head=new Uint8Array(buf.slice(0,5));
  if(String.fromCharCode(...head)!=='%PDF-')throw Error('El archivo no tiene cabecera PDF.');
  const sha256=await digest(buf);
  const parts=Math.ceil(file.size/partBytes);
  set('Validación realizada. Iniciando recepción...');
  const meta={orderId:'WEB-PILOTO-UN-PDF-20261020',fileId:'pdf-prueba',
   name:file.name,mode:'bn',bytes:file.size,sha256,partBytes,parts};
  const session=await rpc({op:'start',meta,turnstileToken:token});
  for(let i=0;i<parts;i++){
   const chunk=new Uint8Array(buf.slice(i*partBytes,Math.min((i+1)*partBytes,file.size)));
   const sum=await digest(chunk);
   await rpc({op:'part',uploadId:session.uploadId,token:session.token,
    index:i,bytes:chunk.length,sha256:sum,dataBase64:b64(chunk)});
   set('Enviado: '+(i+1)+' de '+parts+' fragmentos.');
  }
  set('Comprobando integridad del PDF en Google Drive...');
  const result=await rpc({op:'finish',uploadId:session.uploadId,token:session.token,
   sha256,bytes:file.size,parts});
  if(result.received===true&&result.verified===false){
   set('PDF RECIBIDO Y COMPROBADO EN DRIVE. Recibo: '+result.receiptId+
    '\\nPrueba exitosa de almacenamiento. Validación de páginas y cobros: DESACTIVADOS.');
  }else throw Error('No se confirmó el recibo.');
 }catch(err){
  set('PRUEBA NO COMPLETADA: '+String(err?.message||'Error inesperado')+
   '\\nNo pagues ni envíes otro archivo sin consultar el estado.');
 }finally{
  btn.disabled=false;
  window.turnstile?.reset();
 }
});
})();
</script></body></html>`;
  return new Response(html,{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store, private',
    'X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex,nofollow',
    'X-Frame-Options':'DENY'
  }});
}
async function pilotVerifyTurnstile(token,env){
  if(typeof token!=='string'||token.length<10||token.length>2048||
    typeof env?.DOCS_TURNSTILE_SECRET!=='string')return false;
  const fd=new FormData();
  fd.append('secret',env.DOCS_TURNSTILE_SECRET);
  fd.append('response',token);
  try{
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:fd});
    if(!r.ok)return false;
    const answer=await r.json();
    return answer?.success===true&&answer.action==='documentos'&&
      answer.hostname===new URL(env.DOCS_ALLOWED_ORIGIN).hostname;
  }catch(_){return false;}
}
async function pilotPost(request,env){
  if(request.method!=='POST')return closed();
  if(!allowed(request,env))return testResponse({
    ok:false,error:'Origen no permitido',receptionEnabled:false},403);
  let input;
  try{
    input=await readLimited(request);
    validateBasic(input);
    if(!['start','part','status','finish'].includes(input.op))throw Error('Operación no autorizada');
    if(input.op==='start'){
      const meta=input.meta;
      if(meta.orderId!==PILOT_ORDER||meta.fileId!==PILOT_FILE||
         meta.bytes>PILOT_MAX_BYTES||!['bn','color'].includes(meta.mode))
        throw Error('Fuera de cupo piloto');
    }
  }catch(_){return testResponse({ok:false,error:'Datos fuera del cupo de prueba',receptionEnabled:false},400);}
  if(input.op==='start'&&!(await pilotVerifyTurnstile(input.turnstileToken,env))){
    return testResponse({ok:false,error:'No se pudo validar la verificación de seguridad',receptionEnabled:false},403);
  }
  const body={...input};delete body.turnstileToken;
  try{
    const result=await postToScript(env,body,fetch);
    if(!result.ok)return testResponse({ok:false,error:'Google no confirmó la solicitud',receptionEnabled:false},422);
    // No se permite declarar archivos cobrables por este endpoint.
    if(input.op==='finish'&&result.verified!==false)
      return testResponse({ok:false,error:'Validación de páginas no disponible',receptionEnabled:false},422);
    return testResponse({...result,receptionEnabled:false},200);
  }catch(_){
    return testResponse({ok:false,error:'Recepción no confirmada. No reenviar sin revisar el estado.',
      receptionEnabled:false},502);
  }
}


/* FASE 2 — Validación del PDF EXISTENTE, sin una segunda subida.
 * Los bytes se transportan sólo entre Apps Script y Worker. El navegador
 * recibe únicamente {páginas,recibo} al terminar. PDF-lib empaquetado en build.
 */
function validarPdfHtml(env){
 const key=env?.DOCS_TURNSTILE_SITE_KEY;
 if(typeof key!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(key))
   return testResponse({ok:false,reason:'site_key_missing'},503);
 return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Librería Saber — Verificar PDF privado</title>
<style>
body{background:#eef2f6;color:#142a3d;font:16px system-ui,sans-serif;margin:0}
main{max-width:580px;margin:7vh auto;background:#fff;padding:26px;border-radius:14px}
h1{font-size:24px}button{cursor:pointer;background:#135e91;border:0;border-radius:8px;color:white;padding:14px 18px;font-size:16px}
button:disabled{opacity:.55}#out{white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body><main>
<h1>Validación del PDF ya recibido</h1>
<p>El sistema leerá el PDF del Drive privado y comprobará su cantidad de páginas sin solicitar que lo vuelvas a subir.</p>
<p>No habilita pagos ni modifica la web pública.</p>
<div class="cf-turnstile" data-sitekey="${key}" data-action="documentos"></div>
<p><button id="go" type="button">Verificar páginas</button></p>
<p id="out" role="status">Esperando la comprobación.</p>
</main><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
document.getElementById('go').addEventListener('click',async function(){
 const b=this, out=document.getElementById('out');
 const token=window.turnstile?.getResponse();
 if(!token){out.textContent='Completá primero Turnstile.';return}
 b.disabled=true;out.textContent='Leyendo el archivo privado y contando páginas...';
 try{
  const response=await fetch('/api/validar-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({turnstileToken:token})});
  const j=await response.json();
  if(!response.ok||j.ok!==true)throw Error(j.error||'No se pudo terminar la comprobación.');
  out.textContent='PDF VERIFICADO EN SERVIDOR: '+j.pages+' página(s).\\nRecibo: '+j.receiptId+'\\nPagos: desactivados.';
 }catch(e){out.textContent='SIN VALIDAR: '+String(e.message||e)+'\\nNo se habilitan cobros.'}
 finally{b.disabled=false;window.turnstile?.reset()}
});
</script></body></html>`,{status:200,headers:{
 'Content-Type':'text/html;charset=utf-8','Cache-Control':'private,no-store',
 'X-Robots-Tag':'noindex,nofollow','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'
 }});
}
const hexSha256=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function safeHash(data){return hexSha256(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));}
async function verifyExistingPdf(request,env){
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))return testResponse({ok:false,error:'Origen no permitido',receptionEnabled:false},403);
 let input;
 try{
   input=await readLimited(request);
   if(!input||Object.keys(input).length!==1||typeof input.turnstileToken!=='string')
     throw Error('Inválido');
 }catch(_){return testResponse({ok:false,error:'Solicitud de prueba inválida',receptionEnabled:false},400)}
 if(!(await pilotVerifyTurnstile(input.turnstileToken,env)))
   return testResponse({ok:false,error:'Verificación Turnstile incorrecta',receptionEnabled:false},403);
 try{
   const m=await postToScript(env,{op:'privatePilotInfo'},fetch);
   if(!m.ok||m.bytes<5||!Number.isSafeInteger(m.bytes)||m.bytes>1024*1024||
       !/^DOC-[a-f0-9-]{36}$/i.test(m.receiptId||'')||
       !/^[a-f0-9]{64}$/.test(m.sha256||'')||
       m.privateChunkBytes!==256*1024)
     throw Error('Información privada de archivo inválida');
   if(m.pageVerification==='server'&&Number.isSafeInteger(m.pages)&&m.pages>0){
     const existing=await postToScript(env,{op:'privateVerifiedStatus',receiptId:m.receiptId},fetch);
     if(existing.ok&&existing.verified&&existing.pages===m.pages)
       return testResponse({ok:true,pages:existing.pages,receiptId:existing.receiptId,
         alreadyVerified:true,paymentAuthorized:false,receptionEnabled:false});
   }
   const bytes=new Uint8Array(m.bytes),size=256*1024;
   for(let offset=0;offset<bytes.length;offset+=size){
     const part=await postToScript(env,{op:'privateReadPart',
       receiptId:m.receiptId,offset},fetch,420000);
     const n=Math.min(size,bytes.length-offset);
     if(!part.ok||part.receiptId!==m.receiptId||part.offset!==offset||
         part.length!==n||part.bytes!==m.bytes||part.sha256!==m.sha256||
         typeof part.dataBase64!=='string'||part.dataBase64.length>380000||
         !/^[a-f0-9]{64}$/.test(part.chunkSha256||''))
       throw Error('Fragmento del PDF privado no confirmado');
     const decoded=atob(part.dataBase64);
     if(decoded.length!==n)throw Error('Fragmento de tamaño incorrecto');
     const chunk=Uint8Array.from(decoded,c=>c.charCodeAt(0));
     if(await safeHash(chunk)!==part.chunkSha256)
       throw Error('Integridad de un fragmento incorrecta');
     bytes.set(chunk,offset);
   }
   const receipt={receiptState:'bytes_checked',receiptId:m.receiptId,
     orderId:m.orderId,fileId:m.fileId,name:m.name,mode:m.mode,bytes:m.bytes,
     sha256:m.sha256};
   const verified=await verificarPdfAlmacenado({
     driveBytes:bytes,reciboServidor:receipt
   });
   const registered=await postToScript(env,{op:'privateCommitPages',
     receiptId:verified.receiptId,pages:verified.pages,sha256:verified.sha256,
     bytes:verified.bytes,parserVersion:'pdf-lib-1.17.1'},fetch);
   if(!registered.ok||!registered.verified||registered.pages!==verified.pages||
       registered.receiptId!==verified.receiptId||registered.paymentAuthorized!==false)
     throw Error('Google no confirmó el conteo de páginas');
   return testResponse({ok:true,pages:registered.pages,receiptId:registered.receiptId,
     verifiedBy:'server',paymentAuthorized:false,receptionEnabled:false});
 }catch(_){
   return testResponse({ok:false,
     error:'No se pudo verificar el PDF almacenado. No se habilitan cobros.',
     receptionEnabled:false},502);
 }
}

export default {
  async fetch(request, env, ctx) {
    const page=new URL(request.url).pathname;
    if(page==='/prueba-validacion'&&request.method==='GET')return validarPdfHtml(env);
    if(page==='/api/validar-pdf')return verifyExistingPdf(request,env);
    if(page==='/prueba-pdf'&&request.method==='GET')return pilotHtml(env);
    if(page==='/api/piloto-pdf')return pilotPost(request,env);
    if(page==='/prueba-turnstile') {
      if(request.method==='GET')return testPage(env);
      if(request.method==='POST')return testTurnstilePost(request,env);
      return closed();
    }
    if(page==='/prueba-google'){
      if(request.method==='GET')return testPage(env,'google');
      if(request.method==='POST')return testGooglePing(request,env);
      return closed();
    }
    // Este guardia permanece desactivado hasta revisión técnica formal.
    if (!INTERNAL_ALLOW_UPLOADS || env?.DOCS_UPLOAD_ENABLED !== 'true') {
      return closed();
    }
    // Aun habilitado, el receptor requiere validación del pedido en backend,
    // límites de abuso y Turnstile; no eliminar el bloqueo antes de implementarlos.
    if (request.method !== 'POST') return closed();
    return handleDocumentsPost(request, env);
  }
};
