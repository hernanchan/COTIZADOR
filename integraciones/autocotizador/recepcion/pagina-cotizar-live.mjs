/** Página del comprador en ruta separada de Sandbox.
 * El ingreso requiere sesión propia; no concede pago ni subida antes de gates.
 */
const HOST='pedidos.libreriasaber.com.ar';
const ON='GO_COMERCIAL_CONFIRMADO';
function headers(csp){
 return {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private',
 'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'};
}
const baseCss=`*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#1a3852;font:16px/1.45 system-ui,Arial,sans-serif}
header{background:#153d65;color:white;padding:19px max(18px,calc((100vw - 1100px)/2))}
header strong{font-size:21px}main{max-width:1100px;margin:22px auto;padding:0 16px}
section{border:1px solid #d5e1eb;background:white;border-radius:14px;padding:22px;margin-bottom:15px}
h1{font-size:25px;margin:0 0 10px}h2{font-size:18px;margin:0 0 10px}p{margin:9px 0;color:#3e5569}
label{font-weight:600}input{font:inherit;width:100%;max-width:330px;padding:12px;border:1px solid #aabcca;border-radius:9px;display:block;margin:8px 0 15px}
button{font:inherit;border:0;background:#0c5688;color:white;border-radius:9px;padding:13px 17px;font-weight:700;cursor:pointer}
button:disabled{opacity:.47;cursor:not-allowed}#estado{min-height:25px}small{color:#586c7e}
#pdf{width:100%;min-height:850px;border:0}#precio{font-size:23px;color:#123e66}
@media(max-width:700px){section{padding:15px}main{padding:0 9px}#pdf{min-height:1100px}}`;
export function paginaCotizarLive(req,env,{authorized=false}={}){
 const u=new URL(req.url);
 if(req.method!=='GET'||u.protocol!=='https:'||u.hostname!==HOST||
    u.pathname!=='/cotizar'||u.search||u.hash||
    env?.SABER_ENTORNO!=='produccion'||env?.DOCS_LIVE_UI_GATE!==ON||
    env?.DOCS_MP_LIVE_GATE!==ON||env?.DOCS_LIVE_SESSION_GATE!==ON)
  return new Response('No disponible',{status:404,headers:{'Cache-Control':'no-store'}});
 if(!authorized){
  const key=env?.DOCS_LIVE_TURNSTILE_SITE_KEY;
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{20,100}$/.test(key))
   return new Response('Acceso no configurado',{status:503});
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Librería Saber · Ingresar al cotizador</title><style>${baseCss}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body><header><strong>Librería Saber</strong></header><main><section>
<h1>Cotizá tus impresiones y ploteos</h1><p>Ingresá para preparar tu pedido. Tus PDF permanecen en tu dispositivo mientras elegís cómo imprimirlos.</p>
<div class="cf-turnstile" data-sitekey="${key}" data-action="saber_pedido_live" data-callback="saberIngresoLive"></div>
<p id="estado" role="status" aria-live="polite">Verificá el acceso para continuar.</p>
</section></main><script>
window.saberIngresoLive=async token=>{
 const label=document.getElementById('estado');
 label.textContent='Verificando acceso…';
 try{
  const r=await fetch('/api/pedido/live/sesion',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  const v=await r.json();
  if(!r.ok||v?.ok!==true)throw Error('No pudimos verificar el acceso.');
  location.replace('/cotizar');
 }catch{label.textContent='El acceso no pudo verificarse. Volvé a intentarlo.'}
};
</script></body></html>`;
  return new Response(html,{headers:headers(
   "default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; style-src 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")});
 }
 const enabled=env?.DOCS_LIVE_RECEPCION_GATE===ON&&env?.DOCS_LIVE_PRICING_GATE===ON&&
  env?.DOCS_LIVE_ORDER_GATE===ON;
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cotizador de PDF · Librería Saber</title><style>${baseCss}</style></head><body>
<header><strong>Librería Saber · Impresiones y ploteos</strong></header>
<main><section><h1>Prepará tus PDF</h1>
<p>Elegí los archivos y sus opciones de impresión. Las medidas y el tipo de trabajo se calculan por el contenido del PDF, no por el nombre ni por su peso.</p>
<label for="telefono">Teléfono de contacto (con código de área)</label>
<input id="telefono" inputmode="tel" autocomplete="tel" placeholder="351 555 5555" required>
<p id="precio" aria-live="polite">Precio pendiente</p>
<p id="estado" role="status" aria-live="polite">Seleccioná tus archivos para comenzar.</p>
<button type="button" id="continuar" disabled>${enabled?'Confirmar presupuesto':'Recepción de pedidos temporalmente desactivada'}</button>
<p><small>La confirmación de pago se verifica en Librería Saber. No se envía ningún original por cotizar.</small></p>
</section><section><h2>Tus archivos</h2>
<iframe id="pdf" title="Elegir PDF y opciones de impresión" src="/cotizar/archivos"></iframe>
</section></main><script type="module">
import {crearFlujoPresupuestoLive} from '/cotizar/flujo-live.js';
const phone=document.getElementById('telefono');
const status=document.getElementById('estado');
const price=document.getElementById('precio');
const action=document.getElementById('continuar');
const iframe=document.getElementById('pdf');
const enabled=${enabled};
let pending=null,flow=null,working=false;
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const orderId=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return 'WEB-ENSAYO-'+Array.from(a,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==iframe.contentWindow||!event.data)return;
 const data=event.data;
 if(data.type==='SABER_SMART_PRICE_STATE'){
  if(Number.isSafeInteger(data.total)&&data.total>0)price.textContent='Presupuesto orientativo: '+money(data.total);
  else price.textContent='Precio pendiente';
  if(data.blockReason)status.textContent=data.blockReason;
  action.disabled=!enabled||!data.sendable||working;
 }
 if(data.type==='SABER_SMART_UNIVERSAL_PDF'){
  if(working)return;
  pending={files:data.files,archivos:data.archivos};
  action.disabled=!enabled;
  status.textContent=enabled?'Archivos preparados, validando el presupuesto…':'Presupuesto preparado. El pago y el envío todavía no están habilitados.';
  if(enabled)action.click();
 }
 if(data.type==='SABER_SMART_HANDOFF_ERROR'){
  pending=null;action.disabled=true;
  status.textContent=String(data.message||'No se pudo preparar el pedido.').slice(0,180);
 }
});
action.addEventListener('click',async()=>{
 if(!enabled||working)return;
 if(!pending){
  action.disabled=true;
  status.textContent='Verificando los PDF y opciones elegidas…';
  iframe.contentWindow.postMessage({type:'SABER_SMART_PREPARAR_ENVIO'},location.origin);
  return;
 }
 working=true;action.disabled=true;
 try{
  flow=crearFlujoPresupuestoLive({
   ...pending,webOrderId:orderId(),telefono:phone.value.trim(),
   onProgress:p=>{status.textContent='Identificando PDF '+p.index+' · '+(p.porcentaje||0)+' %';}
  });
  status.textContent='Validando precio y registrando orden…';
  const order=await flow.preparar();
  price.textContent='Orden '+order.numeroOrden+' · '+money(order.amountArs);
  status.textContent='Orden registrada. Para pagar, continuá con Mercado Pago.';
  const button=document.createElement('button');
  button.type='button';button.textContent='Continuar a Mercado Pago';
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{const url=await flow.iniciarPago();location.assign(url)}
   catch{button.disabled=false;status.textContent='No pudimos iniciar el pago. La orden sigue pendiente. No pagues dos veces.'}
  });
  action.replaceWith(button);
 }catch(e){status.textContent=String(e?.message||'No se pudo completar el presupuesto.').slice(0,180);working=false;action.disabled=false;}
});
</script></body></html>`;
 return new Response(html,{headers:headers(
  "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")});
}
