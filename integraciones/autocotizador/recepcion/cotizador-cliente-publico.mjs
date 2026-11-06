/**
 * Cotización pública preliminar de Saber: no TUS, no D1 writes, no pedidos ni pagos.
 * Cookie de cliente independiente de operador, derivada solo del secreto Turnstile.
 * OFF por defecto; no reusar el cookie del operador ni abrir descarga privada.
 */
const PATH='/prueba-v2/cotizar-cliente',COOKIE='saber_quote_client_v1',MAX_AGE=1200;
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store,private',
 'X-Robots-Tag':'noindex,nofollow,noarchive','X-Content-Type-Options':'nosniff',...extra
}});
const on=env=>env?.DOCS_PUBLIC_QUOTE_GATE_ENABLED==='PRIVATE_TEST_ONLY'&&
 typeof env.DOCS_TURNSTILE_SITE_KEY==='string'&&
 /^[A-Za-z0-9_-]{20,100}$/.test(env.DOCS_TURNSTILE_SITE_KEY)&&
 typeof env.DOCS_TURNSTILE_SECRET==='string'&&env.DOCS_TURNSTILE_SECRET.length>=20&&
 env.DOCS_TURNSTILE_SECRET!==env.DOCS_V2_PRIVATE_UI_SECRET&&
 env.DOCS_TURNSTILE_SECRET!==env.DOCS_CENTRAL_ADMIN_KEY&&
 env.DOCS_TURNSTILE_SECRET!==env.CENTRAL_BRIDGE_KEY;
const hex=arr=>Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
const equal=(a,b)=>{
 if(typeof a!=='string'||a.length!==b.length)return false;
 let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;
};
async function mac(env,ts,nonce,subtle){
 const k=await subtle.importKey('raw',new TextEncoder().encode(env.DOCS_TURNSTILE_SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await subtle.sign('HMAC',k,
  new TextEncoder().encode('saber-cotizador-cliente-exclusivo-v1\n'+ts+'\n'+nonce));
 return hex(new Uint8Array(signed));
}
export async function autorizadoCotizadorCliente(request,env,{now=Date.now(),subtle=crypto.subtle}={}){
 if(!on(env))return false;
 const cookie=request.headers.get('Cookie')||'';
 if(cookie.length>4096)return false;
 const m=cookie.match(/(?:^|;\s*)saber_quote_client_v1=(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})(?=;|$)/);
 if(!m)return false;
 const issued=Number(m[1]),seconds=Math.floor(now/1000);
 if(!Number.isSafeInteger(issued)||issued>seconds+30||seconds-issued>MAX_AGE)return false;
 return equal(await mac(env,m[1],m[2],subtle),m[3]);
}
const htmlHeaders=csp=>({
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
 'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex,nofollow,noarchive',
 'X-Content-Type-Options':'nosniff','Content-Security-Policy':csp
});
function entryPage(siteKey){
 const page=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<meta name="robots" content="noindex,nofollow"><title>Cotizar mis PDF · Librería Saber</title>',
 '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef4f7;font:16px/1.5 system-ui,Arial,sans-serif;color:#153a58}main{width:min(480px,calc(100% - 30px));box-sizing:border-box;padding:clamp(22px,4vw,38px);background:white;border:1px solid #dce6ec;border-radius:12px}h1{font-size:30px;line-height:1.2;margin:13px 0}p{color:#527087}a{color:#155786}button{width:100%;margin-top:18px;padding:14px;border:0;border-radius:8px;background:#f1942e;color:#183c54;font-weight:850;font-size:16px;cursor:pointer}button:disabled{opacity:.5}#status{font-weight:700}</style>',
 '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head>',
 '<body><main><a href="/prueba-v2/diseno-sin-clave">← Volver a la tienda</a><h1>Cotizá tus PDF</h1>',
 '<p>Calculá un presupuesto preliminar de impresión. Tus archivos se analizan en el navegador: no se envían al negocio ni se genera un pedido.</p>',
 '<form id="entry"><div class="cf-turnstile" data-sitekey="',siteKey,'" data-action="saber_quote" data-callback="saberQuoteReady"></div>',
 '<button id="start" type="submit" disabled>Empezar</button></form><p id="status" role="status" aria-live="polite"></p></main>',
 '<script>(function(){let token="";const btn=document.getElementById("start"),status=document.getElementById("status");',
 'window.saberQuoteReady=function(value){token=value;btn.disabled=!value;status.textContent="";};',
 'document.getElementById("entry").addEventListener("submit",async function(event){event.preventDefault();if(!token)return;',
 'btn.disabled=true;status.textContent="Verificando acceso…";try{',
 'const response=await fetch("/prueba-v2/cotizar-cliente",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});',
 'const data=await response.json();if(!response.ok||data.ok!==true)throw Error("No pudimos verificar el acceso.");',
 'location.replace("/prueba-v2/cotizar-cliente");',
 '}catch(e){status.textContent=e.message;token="";window.turnstile?.reset();}});})();</script></body></html>'
 ];
 return page.join('');
}
function quotePage(page){
 return page.replace('<strong>Prueba privada de clasificación.</strong>',
    '<strong>Cotización preliminar.</strong>')
  .replace('Sin envío de originales, pedidos ni pagos.',
    'Tus PDF se analizan localmente; no se suben, no se almacenan y no generan pedidos ni cobros.')
  .replace('Volver a los presupuestos de prueba','Volver a la tienda')
  .replace('href="/prueba-cotizador-conjunto"','href="/prueba-v2/diseno-sin-clave"')
  .replace('Una sola carga · Tamaño final','Cotizá tus archivos');
}
export async function manejarCotizadorCliente(request,env,{
 fetcher=fetch,now=Date.now(),random=()=>crypto.getRandomValues(new Uint8Array(16)),
 subtle=crypto.subtle,paginaCotizacion=null
}={}){
 if(!on(env))return reply({ok:false,error:'Acceso todavía no habilitado'},503);
 const url=new URL(request.url);
 if(url.pathname!==PATH||!['GET','POST'].includes(request.method))return reply({ok:false},405);
 if(request.method==='GET'){
  if(await autorizadoCotizadorCliente(request,env,{now,subtle})){
   if(typeof paginaCotizacion!=='string'||!paginaCotizacion.includes('id="presupuesto"'))
    return reply({ok:false,error:'Cotizador no disponible'},503);
   return new Response(quotePage(paginaCotizacion),{headers:htmlHeaders(
    "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; worker-src 'self' blob: https://cdnjs.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
   )});
  }
  return new Response(entryPage(env.DOCS_TURNSTILE_SITE_KEY),{headers:htmlHeaders(
   "default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; style-src 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  )});
 }
 if(request.headers.get('Origin')!==url.origin||
   (request.headers.get('Sec-Fetch-Site')&&!['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site')))||
   !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'Origen no autorizado'},403);
 let data;
 try{
  const raw=await request.text();if(raw.length>3200)throw Error('length');
  data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data)||
   Object.keys(data).join(',')!=='token'||typeof data.token!=='string'||
   data.token.length<10||data.token.length>2048)throw Error('token');
 }catch{return reply({ok:false,error:'Verificación inválida'},422)}
 let verified;
 try{
  const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
   body:new URLSearchParams({secret:env.DOCS_TURNSTILE_SECRET,response:data.token})
  });
  if(!r.ok)return reply({ok:false,error:'Verificación no disponible'},503);
  verified=await r.json();
 }catch{return reply({ok:false,error:'Verificación no disponible'},503)}
 if(verified?.success!==true||verified?.hostname!==url.hostname||verified?.action!=='saber_quote')
  return reply({ok:false,error:'No se pudo verificar el acceso'},403);
 const bytes=random();
 if(!(bytes instanceof Uint8Array)||bytes.length!==16)return reply({ok:false,error:'Sesión no disponible'},503);
 const ts=String(Math.floor(now/1000)),nonce=hex(bytes),signature=await mac(env,ts,nonce,subtle);
 return reply({ok:true,mode:'quote-only',filesUploaded:false,ordersCreated:false,paymentAuthorized:false},200,{
  'Set-Cookie':COOKIE+'='+ts+'.'+nonce+'.'+signature+'; Path=/; Max-Age='+MAX_AGE+
  '; Secure; HttpOnly; SameSite=Strict'
 });
}
