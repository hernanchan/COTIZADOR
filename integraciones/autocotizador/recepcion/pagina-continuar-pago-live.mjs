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
 if(!authorized)return new Response('Sesión de compra vencida. No crees otro pedido; contactá a Librería Saber.',{
   status:401,headers:{'Cache-Control':'no-store,private','X-Robots-Tag':'noindex,nofollow'}});
 const nonce=crypto.randomUUID().replaceAll('-');
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Continuar pedido · Librería Saber</title><style>'+
 'body{font:17px/1.5 system-ui,Arial,sans-serif;background:#f3f6fa;color:#153d65;margin:0;padding:28px}'+
 'main{max-width:650px;margin:8vh auto;background:white;border:1px solid #ccdbea;border-radius:14px;padding:26px}'+
 'h1{font-size:25px}button{background:#075c90;color:white;border:0;border-radius:9px;padding:14px 18px;font:inherit;cursor:pointer}'+
 'button:disabled{opacity:.6;cursor:wait}p{overflow-wrap:anywhere}small{color:#465c70}</style></head><body><main>'+
 '<h1>Retomar el pedido pendiente</h1><p id="precio">Comprobando tu pedido…</p>'+
 '<p id="estado" role="status" aria-live="polite">No se va a generar otro pedido.</p>'+
 '<button id="pagar" type="button" disabled>Continuar a Mercado Pago</button>'+
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
 'try{const {r,data}=await post("status",saved);'+
 'if(!r.ok||data?.ok!==true||data.webOrderId!==saved.webOrderId||data.commercialOrderId!==saved.commercialOrderId||!Number.isSafeInteger(data.amountArs)||data.amountArs<1||data.fileCount!==saved.metas.length)throw Error("No se pudo verificar la orden existente");'+
 'order={webOrderId:saved.webOrderId,commercialOrderId:saved.commercialOrderId,amountArs:data.amountArs,fileCount:data.fileCount};'+
 'price.textContent="Orden pendiente · "+pesos(data.amountArs);'+
 'if(data.estado==="pagado_esperando_archivos"){sessionStorage.setItem("saber-live-pedido-v1",JSON.stringify({webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId}));status.textContent="El pago ya está acreditado. Continuá con la recepción del PDF.";button.textContent="Enviar PDF pagado";button.disabled=false;button.dataset.paid="yes";return}'+
 'if(data.estado!=="pendiente"){status.textContent="Esta orden no está habilitada para volver a pagar. Contactá a Librería Saber.";return}'+
 'status.textContent="Tu orden está registrada. Podés intentar obtener el enlace de cobro sin crear otra.";button.disabled=false;'+
 '}catch(error){price.textContent="Orden aún no verificable";status.textContent=String(error.message||"Sin acceso a la orden").slice(0,140)}}'+
 'button.addEventListener("click",async()=>{if(!order)return;if(button.dataset.paid==="yes"){location.assign("/pedido/estado");return}button.disabled=true;status.textContent="Consultando Mercado Pago para esta misma orden…";'+
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
