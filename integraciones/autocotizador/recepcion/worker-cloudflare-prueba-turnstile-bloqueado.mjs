/**
 * SABER — DOCUMENTOS — ARCHIVO ÚNICO LISTO PARA PEGAR EN CLOUDFLARE
 *
 * VERSIÓN DE SEGURIDAD PARA ENSAYO, SIN CARGAS: bloqueo DOBLE.
 * INTERNAL_ALLOW_UPLOADS=false es deliberadamente constante en este código.
 * El secreto DOCS_RELAY_KEY y la URL de Apps Script están guardados
 * SOLO en Variables y secretos del Worker, NUNCA en este archivo.
 *
 * Esta versión no recibe archivos ni contacta Google, incluso con la variable
 * DOCS_UPLOAD_ENABLED activada por error. Nunca usar en producción tal cual.
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
  {method:'POST',body:f,redirect:'error',signal:AbortSignal.timeout(15000)});}
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
async function postToScript(env,payload,fetcher){
 if(!googleScriptUrl(env.DOCS_SCRIPT_URL)||typeof env.DOCS_RELAY_KEY!=='string'||
  env.DOCS_RELAY_KEY.length<32)throw Error('Conexión privada no configurada.');
 const payloadJson=JSON.stringify(payload),timestamp=Date.now();
 const envelope=JSON.stringify({
   payloadJson,timestamp,signature:await signature(payloadJson,timestamp,env.DOCS_RELAY_KEY)
 });
 let r=await fetcher(env.DOCS_SCRIPT_URL,{
  method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
  body:envelope,redirect:'manual',signal:AbortSignal.timeout(55000)});
 if([302,303].includes(r.status)){
  const location=r.headers.get('Location')||'';
  if(!/^https:\/\/script\.googleusercontent\.com\/macros\//.test(location))
    throw Error('Redirección de Google no autorizada.');
  r=await fetcher(location,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
 }
 if(!r.ok)throw Error('Google no confirmó la operación.');
 const data=await r.text();
 if(data.length>5000)throw Error('Respuesta Google inesperada.');
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
function testPage(env){
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
  <h1>Prueba de seguridad · Documentos</h1>
  <p>La recepción de PDF permanece desactivada. Esta página sólo verifica Turnstile; no accede a Drive.</p>
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
      const res=await fetch('/prueba-turnstile',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token})
      });
      const value=await res.json();
      out.textContent=value.ok
        ? 'PRUEBA EXITOSA: Turnstile validado por Cloudflare. La recepción continúa desactivada.'
        : 'La prueba no se pudo validar. Revisaremos la configuración.';
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
    return testResponse({ok:false,receptionEnabled:false},403);
  if(typeof env?.DOCS_TURNSTILE_SECRET!=='string'||!env.DOCS_TURNSTILE_SECRET)
    return testResponse({ok:false,receptionEnabled:false},503);
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
  }catch(_){return testResponse({ok:false,receptionEnabled:false},400);}
  try{
    const form=new URLSearchParams({secret:env.DOCS_TURNSTILE_SECRET,response:data.token});
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(15000)
    });
    if(!r.ok)throw Error('siteverify');
    const v=await r.json();
    const permitted=new URL(env.DOCS_ALLOWED_ORIGIN).hostname;
    const verified=v.success===true&&v.hostname===permitted&&v.action==='documentos';
    return testResponse({ok:verified,receptionEnabled:false},verified?200:403);
  }catch(_){return testResponse({ok:false,receptionEnabled:false},403);}
}

export default {
  async fetch(request, env, ctx) {
    const page=new URL(request.url).pathname;
    if(page==='/prueba-turnstile') {
      if(request.method==='GET')return testPage(env);
      if(request.method==='POST')return testTurnstilePost(request,env);
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
