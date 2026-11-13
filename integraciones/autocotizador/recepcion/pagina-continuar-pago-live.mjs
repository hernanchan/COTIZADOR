/** Resume an existing buyer's order in the same tab, never create a draft/order.
 * Uses browser-only sessionStorage identifiers + signed buyer/session cookies.
 */
const HOST='https://pedidos.libreriasaber.com.ar';
const LIVE='GO_COMERCIAL_CONFIRMADO';
export function paginaContinuarPagoLive(request,env,{authorized=false}={}){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==HOST||u.pathname!=='/pedido/continuar'||
    u.search||u.hash||env?.SABER_ENTORNO!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==LIVE||env?.DOCS_LIVE_SESSION_GATE!==LIVE)
  return new Response('No disponible',{status:404,headers:{'Cache-Control':'no-store'}});
 if(!authorized){
  // La sesión caduca a los 60 minutos. Volver a verificar Turnstile
  // renueva la sesión; el vínculo de la orden se valida por HMAC/D1 después.
  const key=env?.DOCS_LIVE_TURNSTILE_SITE_KEY;
  if(typeof key!=='string'||!/^[A-Za-z0-9_-]{20,100}$/.test(key))
   return new Response('No se pudo renovar el acceso. Contactá a Librería Saber.',{
    status:503,headers:{'Cache-Control':'no-store,private'}});
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Recuperar pedido · Librería Saber</title>
<style>body{font:17px/1.5 system-ui,Arial,sans-serif;background:#f3f6fa;color:#153d65;margin:0;padding:25px}
main{max-width:610px;margin:9vh auto;background:white;border:1px solid #ccdbea;border-radius:14px;padding:28px}
h1{font-size:24px}p{line-height:1.55}small{color:#526579}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body><main><h1>Retomá tu pedido</h1>
<p>Tu acceso venció por seguridad. Verificalo nuevamente y recuperaremos el pedido de esta misma pestaña, sin crear otro ni cobrarte.</p>
<div class="cf-turnstile" data-sitekey="${key}" data-action="saber_pedido_live" data-callback="saberRenovarPedido"></div>
<p id="estado" role="status" aria-live="polite">Verificá el acceso para continuar.</p>
<small>No hagas un nuevo pedido ni pagues dos veces.</small>
</main><script>
window.saberRenovarPedido=async token=>{
 const label=document.getElementById('estado');
 label.textContent='Renovando acceso seguro…';
 try{
  const r=await fetch('/api/pedido/live/sesion',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  const data=await r.json();
  if(!r.ok||data?.ok!==true)throw Error('No se pudo renovar la sesión');
  location.replace('/pedido/continuar');
 }catch{label.textContent='No pudimos renovar el acceso. Reintentá la verificación; no hagas otro pedido.'}
};
</script></body></html>`;
  return new Response(html,{status:200,headers:{
   'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
   'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; style-src 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
   'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
   'X-Robots-Tag':'noindex,nofollow'
  }});
 }
 const nonce=crypto.randomUUID().replaceAll('-','');
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Continuar pedido · Librería Saber</title><meta name="saber-flujo" content="SABER_POSTPAGO_SIN_SEGUNDA_SELECCION_V1"><style>' +
 'body{font:17px/1.5 system-ui,Arial,sans-serif;background:#f3f6fa;color:#153d65;margin:0;padding:28px}'+
 'main{max-width:650px;margin:8vh auto;background:white;border:1px solid #ccdbea;border-radius:14px;padding:26px}'+
 'h1{font-size:25px}button{background:#075c90;color:white;border:0;border-radius:9px;padding:14px 18px;font:inherit;cursor:pointer}'+
 'button:disabled{opacity:.6;cursor:wait}p{overflow-wrap:anywhere}small{color:#465c70}</style></head><body><main>'+
 '<h1>Retomar el pedido pendiente</h1><p id="precio">Comprobando tu pedido…</p>'+
 '<p id="estado" role="status" aria-live="polite">No se va a generar otro pedido.</p>'+
 '<button id="pagar" type="button" disabled>Continuar pedido</button>'+
 '<p><small>Usamos la misma orden. Si ya pagaste, no vuelvas a pagar.</small></p>'+
 '</main><script nonce="'+nonce+'">'+
 '(function(){'+
 'const price=document.getElementById("precio"),status=document.getElementById("estado"),button=document.getElementById("pagar");'+
 'const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/, UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;'+
 'let order=null;'+
 'const pesos=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);'+
 'const post=async(action,ref)=>{const r=await fetch("/api/pedido/live/checkout",{method:"POST",credentials:"same-origin",redirect:"error",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,webOrderId:ref.webOrderId,commercialOrderId:ref.commercialOrderId})});'+
 'const data=await r.json().catch(()=>null);return {r,data};};'+
 'function safeMp(value){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.hash&&/(^|\\.)(mercadopago\\.com|mercadopago\\.com\\.ar)$/.test(u.hostname)}catch{return false}}'+
 'async function load(){let saved;try{saved=JSON.parse(sessionStorage.getItem("saber-live-archivos-v1")||"null")}catch{}'+
 'if(!saved||!WEB.test(saved.webOrderId||"")||!UUID.test(saved.commercialOrderId||"")||!Array.isArray(saved.metas)||saved.metas.length<1||saved.metas.length>10){price.textContent="No hay datos para retomar en esta pestaña.";status.textContent="Abrí esta dirección desde la misma pestaña donde preparaste la orden. No generes un nuevo pedido.";return}'+
 'try{let {r,data}=await post("status",saved);'+
 'if(r.status===401){status.textContent="Reconectando tu orden original…";'+
 'const recovered=await fetch("/api/pedido/live/revincular",{method:"POST",credentials:"same-origin",redirect:"error",'+
 'headers:{"Content-Type":"application/json"},body:JSON.stringify({webOrderId:saved.webOrderId,commercialOrderId:saved.commercialOrderId})});'+
 'const check=await recovered.json().catch(()=>null);if(!recovered.ok||check?.ok!==true||check.recuperada!==true)'+
 'throw Error("No se pudo recuperar la orden original. No hagas otro pedido.");'+
 '({r,data}=await post("status",saved));}'+
 'if(!r.ok||data?.ok!==true||data.webOrderId!==saved.webOrderId||data.commercialOrderId!==saved.commercialOrderId||!Number.isSafeInteger(data.amountArs)||data.amountArs<1||data.fileCount!==saved.metas.length)throw Error("No se pudo verificar la orden existente");'+
 'order={webOrderId:saved.webOrderId,commercialOrderId:saved.commercialOrderId,amountArs:data.amountArs,fileCount:data.fileCount};'+
 'price.textContent="Orden pendiente · "+pesos(data.amountArs);'+
 'if(data.estado==="pagado_esperando_archivos"){sessionStorage.setItem("saber-live-pedido-v1",JSON.stringify({webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId}));status.textContent="Pago acreditado. Reanudando el envío automático del PDF original…";location.replace("/pedido/estado");return}'+
 'if(data.estado!=="pendiente"){status.textContent="Esta orden no está habilitada para volver a pagar. Contactá a Librería Saber.";return}'+
 'if(sessionStorage.getItem("saber-live-medio-v1")==="transferencia"){'+
 'status.textContent="Verificando la transferencia de esta misma orden…";'+
 'const tr=await fetch("/api/pedido/live/transfer",{method:"POST",credentials:"same-origin",redirect:"error",'+
 'headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId})});'+
 'const bank=await tr.json().catch(()=>null);'+
 'if(!tr.ok||bank?.ok!==true||bank.webOrderId!==order.webOrderId){'+
 'status.textContent="No pudimos comprobar la transferencia. No pagues por otro medio ni generes otra orden.";return}'+
 'if(bank.estado==="pagado_esperando_archivos"&&bank.paymentVerified===true){location.replace("/pedido/estado");return}'+
 'if(!["transferencia_pendiente","transferencia_informada"].includes(bank.estado)){'+
 'status.textContent="La transferencia no está en un estado recuperable. Consultá a Librería Saber.";return}'+
 'status.textContent="La transferencia está registrada. No vuelvas a pagar.";'+
 'button.textContent="Ver seguimiento de transferencia";button.dataset.transfer="yes";button.disabled=false;return}'+
 'button.textContent="Continuar a Mercado Pago";'+
 'status.textContent="Tu orden está registrada. Podés intentar obtener el enlace de cobro sin crear otra.";button.disabled=false;'+
 '}catch(error){price.textContent="Orden aún no verificable";status.textContent=String(error.message||"Sin acceso a la orden").slice(0,140)}}'+
 'button.addEventListener("click",async()=>{if(!order)return;if(button.dataset.transfer==="yes"||button.dataset.paid==="yes"){location.assign("/pedido/estado");return}button.disabled=true;status.textContent="Consultando Mercado Pago para esta misma orden…";'+
 'try{const {r,data}=await post("start",order);if(!r.ok||data?.ok!==true){const etapa=String(data?.etapa||"checkout").slice(0,40);const codigo=String(data?.codigo||data?.error||"no_autorizado").slice(0,90);throw Error("No se pudo abrir Mercado Pago: "+etapa+" / "+codigo)}'+
 'if(data.webOrderId!==order.webOrderId||data.commercialOrderId!==order.commercialOrderId||data.amountArs!==order.amountArs||data.fileCount!==order.fileCount||data.uploadAuthorized!==false||data.productionAuthorized!==false||!safeMp(data.checkoutUrl))throw Error("Mercado Pago devolvió una respuesta incompatible. No pagues otra vez.");'+
 'sessionStorage.setItem("saber-live-pedido-v1",JSON.stringify({webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId}));location.assign(data.checkoutUrl);'+
 '}catch(error){status.textContent=String(error?.message||"No se pudo iniciar el pago").slice(0,195);button.disabled=false;}});load();'+
 '})();</script></body></html>';
 return new Response(html,{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store,private',
  'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex,nofollow'
 }});
}
