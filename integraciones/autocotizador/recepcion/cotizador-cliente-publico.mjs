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
 const original='<h2>Resumen del presupuesto</h2><section class="archivo" id="presupuesto" aria-live="polite">Esperando archivos…</section>';
 const entry='<section id="modoConfiguracion"';
 if(!page.includes(original)||!page.includes(entry))throw Error('Cotizador de clientes: estructura inesperada');
 // Únicamente cambia la PRESENTACIÓN de la cotización; no altera eventos, precios ni el motor.
 page=page.replace(original,'').replace(entry,
  '<div class="saber-quote-total"><span class="saber-quote-kicker">Tu presupuesto estimado</span><section class="archivo" id="presupuesto" aria-live="polite">Esperando archivos…</section></div>'+entry);
 page=page.replace(/<p class="nota">[\s\S]*?<\/p>/,
  '<p class="nota"><strong>Presupuesto preliminar.</strong> Tus PDF se analizan en tu dispositivo: no se suben, no se almacenan ni generan un pedido. Elegí cómo querés imprimir y mirá el precio arriba.</p>');
 page=page.replace('<h1>Una sola carga · Tamaño final</h1>',
  '<h1>Cotizá tus archivos</h1><p class="saber-quote-intro">1. Elegí la configuración · 2. Agregá tus PDF · 3. Mirá el total.</p>');
 page=page.replace('Seleccioná cómo querés trabajar para habilitar la carga.',
  'Elegí cómo configurar los documentos antes de agregarlos.');
 page=page.replace('Resumen del presupuesto','Presupuesto');
 page=page.replace('Volver a los presupuestos de prueba','Volver a la tienda')
   .replace('href="/prueba-cotizador-conjunto"','href="/prueba-v2/diseno-sin-clave"');
 const css=[
  'body{background:#edf2f6;font-size:18px;line-height:1.5}',
  'main{width:min(1220px,calc(100% - 36px));padding:clamp(20px,3vw,36px);margin:24px auto 50px}',
  'main>h1{font-size:clamp(29px,3vw,39px);margin-bottom:4px}',
  '.saber-quote-intro{font-size:16px;color:#4c6476;margin:5px 0 17px}',
  '.nota{margin:0 0 15px;padding:12px 16px;font-size:15px;line-height:1.55}',
  '.saber-quote-total{position:sticky;top:0;z-index:20;background:#edf2f6;padding:9px 0 10px;margin-bottom:12px}',
  '.saber-quote-kicker{display:block;font-size:13px;color:#315a77;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:0 2px 5px}',
  '#presupuesto{position:static;max-height:none;overflow:visible;background:#e9f4fb;border:2px solid #a4c9e4;border-radius:10px;box-shadow:0 5px 15px #163a5510;padding:13px 18px}',
  '#presupuesto strong{font-size:clamp(23px,2.4vw,31px);line-height:1.25}',
  '#presupuesto p{font-size:14px;line-height:1.45}',
  '#modoConfiguracion{padding:14px 17px;margin:10px 0}',
  '#modoConfiguracion h2{font-size:20px}',
  '.modo-tarjeta{padding:13px 15px}',
  '.modo-tarjeta strong{font-size:17px}',
  '.modo-tarjeta small{font-size:14px}',
  '#zonaArchivos{padding:19px;margin:13px 0}',
  '#zonaArchivos p{font-size:16px}',
  '#estado{font-size:15px}',
  '.fila .nombre{font-size:17px}',
  '.resumen-archivo{font-size:15px}',
  '.editar{font-size:15px;min-height:42px}',
  '#prepararPedido,#resumenPedido{display:none!important}',
  '#configComunGlobal.saber-quote-single{display:none!important}',
  '.opciones-comunes label{font-size:14px}',
  '.opciones-comunes input,.opciones-comunes select{font-size:15px;min-height:42px}',
  '@media(max-width:720px){main{width:100%;margin:0;padding:16px 12px 38px;border-radius:0}.saber-quote-total{top:0;margin-left:-4px;margin-right:-4px}.saber-quote-intro{font-size:14px}.nota{font-size:14px}.modo-tarjeta{padding:12px}.saber-quote-kicker{font-size:12px}}'
 ].join('');
 // El renderer de lote puede volver a pintar las opciones compartidas.
 // Si hay un único PDF, se editan sus opciones desde 'Personalizar este PDF'.
 const enhance=[
  '<script>(function(){',
  'function adapt(){const holder=document.getElementById("configComunGlobal");if(!holder)return;',
  'const title=holder.querySelector(".opciones-comunes strong");',
  'holder.classList.toggle("saber-quote-single",!!title&&/·\\s*1\\s+documentos?\\b/.test(title.textContent||""));}',
  'document.addEventListener("DOMContentLoaded",function(){const holder=document.getElementById("configComunGlobal");',
  'if(!holder)return;new MutationObserver(adapt).observe(holder,{childList:true,subtree:true,characterData:true});adapt();});',
  '})();</script>'
 ].join('');
 return page.replace('</style>','\n/* Vista cliente exclusiva, sin cambios a la lógica */\n'+css+'</style>')
  .replace('</body>',enhance+'</body>');
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


/**
 * Compradores de prueba: permiso DISTINTO del presupuesto preliminar y
 * de la cookie del operador. La autorización no habilita descargas ni
 * modificaciones administrativas; los endpoints deben verificarla por ruta.
 * OFF por defecto, exclusivamente en Worker de ensayo.
 */
const ORDER_PATH='/prueba-v2/pedido-cliente';
const ORDER_COOKIE='saber_pedido_client_v1';
const ORDER_AGE=3600;
const orderOn=env=>on(env)&&env?.DOCS_PUBLIC_ORDER_GATE_ENABLED==='PRIVATE_TEST_ONLY';
async function orderMac(env,ts,nonce,subtle){
 const k=await subtle.importKey('raw',new TextEncoder().encode(env.DOCS_TURNSTILE_SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await subtle.sign('HMAC',k,
  new TextEncoder().encode('saber-pedido-comprador-ensayo-v1\n'+ts+'\n'+nonce));
 return hex(new Uint8Array(signed));
}
export async function autorizadoPedidoCliente(request,env,{now=Date.now(),subtle=crypto.subtle}={}){
 if(!orderOn(env))return false;
 const cookie=request.headers.get('Cookie')||'';
 if(cookie.length>4096)return false;
 const m=cookie.match(/(?:^|;\s*)saber_pedido_client_v1=(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})(?=;|$)/);
 if(!m)return false;
 const issued=Number(m[1]),seconds=Math.floor(now/1000);
 if(!Number.isSafeInteger(issued)||issued>seconds+30||seconds-issued>ORDER_AGE)return false;
 return equal(await orderMac(env,m[1],m[2],subtle),m[3]);
}
function orderEntryPage(siteKey){
 return entryPage(siteKey)
  .replaceAll('/prueba-v2/cotizar-cliente',ORDER_PATH)
  .replace('data-action="saber_quote"','data-action="saber_pedido"')
  .replace('<title>Cotizar mis PDF · Librería Saber</title>','<title>Enviar mis PDF · Librería Saber</title>')
  .replace('<h1>Cotizá tus PDF</h1>','<h1>Enviá tus PDF</h1>')
  .replace('Calculá un presupuesto preliminar de impresión. Tus archivos se analizan en el navegador: no se envían al negocio ni se genera un pedido.',
   'Accedé al cotizador completo: archivos, presupuesto, envío, pago de prueba y seguimiento. No se realizan cobros reales.')
  .replace('No pudimos verificar el acceso.','No pudimos verificar el acceso de comprador.');
}
export async function manejarPortalPedidosCliente(request,env,{
 fetcher=fetch,now=Date.now(),random=()=>crypto.getRandomValues(new Uint8Array(16)),
 subtle=crypto.subtle,paginaPedido=null
}={}){
 if(!orderOn(env))return reply({ok:false,error:'Envío de pedidos todavía no habilitado'},503);
 const url=new URL(request.url);
 if(url.pathname!==ORDER_PATH||!['GET','POST'].includes(request.method))
  return reply({ok:false,error:'Ruta no admitida'},405);
 if(request.method==='GET'){
  if(await autorizadoPedidoCliente(request,env,{now,subtle})){
   const page=typeof paginaPedido==='function'?paginaPedido():null;
   if(typeof page!=='string'||!page.includes('id="send-all-pdf"'))
    return reply({ok:false,error:'Portal de pedidos no disponible'},503);
   return new Response(page,{headers:htmlHeaders(
    "default-src 'none'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://cdnjs.cloudflare.com https://releases.transloadit.com; style-src 'unsafe-inline'; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co https://releases.transloadit.com; img-src 'self' data:; worker-src 'self' blob: https://cdnjs.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
   )});
  }
  return new Response(orderEntryPage(env.DOCS_TURNSTILE_SITE_KEY),{headers:htmlHeaders(
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
 if(verified?.success!==true||verified?.hostname!==url.hostname||verified?.action!=='saber_pedido')
  return reply({ok:false,error:'No se pudo verificar el acceso'},403);
 const bytes=random();
 if(!(bytes instanceof Uint8Array)||bytes.length!==16)return reply({ok:false,error:'Sesión no disponible'},503);
 const ts=String(Math.floor(now/1000)),nonce=hex(bytes),signature=await orderMac(env,ts,nonce,subtle);
 return reply({ok:true,mode:'pedido-prueba',payments:'sandbox-only'},200,{
  'Set-Cookie':ORDER_COOKIE+'='+ts+'.'+nonce+'.'+signature+'; Path=/; Max-Age='+ORDER_AGE+
   '; Secure; HttpOnly; SameSite=Strict'
 });
}
