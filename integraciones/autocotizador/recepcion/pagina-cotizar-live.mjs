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
label{font-weight:600;display:block}input{font:inherit;width:100%;max-width:520px;padding:12px;border:1px solid #aabcca;border-radius:9px;display:block;margin:8px 0 15px}
button{font:inherit;border:0;background:#0c5688;color:white;border-radius:9px;padding:13px 17px;font-weight:700;cursor:pointer}
button:disabled{opacity:.47;cursor:not-allowed}#estado{min-height:25px}small{color:#586c7e}
#pdf{display:block;width:100%;height:960px;min-height:0;border:0;overflow:hidden;background:#fff}
#precio-entrega{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:15px 0 0;border:2px solid #c3d9ea;background:#f4f9fe;border-radius:12px;padding:16px}
#precio-entrega>div{min-width:0;padding:0 4px}
#precio-entrega strong{display:block;color:#23506f;font-size:15px}
#precio-entrega #precio,#precio-entrega #plazo-orientativo{font-size:clamp(22px,2.4vw,28px);font-weight:850;line-height:1.25;overflow-wrap:anywhere}
#plazo-explicacion{font-size:15px;color:#536579;margin:0;padding:10px 20px 4px;background:#f4f9fe;border-left:2px solid #c3d9ea;border-right:2px solid #c3d9ea}
#promo-dia{font-size:15px;font-weight:650;color:#69420b;margin:0;padding:4px 20px 12px;background:#f4f9fe;border-left:2px solid #c3d9ea;border-right:2px solid #c3d9ea;border-bottom:2px solid #c3d9ea;border-radius:0 0 12px 12px}
#promo-dia[hidden]{display:none}
.transfer-box{width:100%;max-width:720px;padding:18px;border:2px solid #1a689b;border-radius:13px;background:#edf7ff;display:grid;gap:10px}.transfer-box strong{color:#123b5d}.transfer-amount{font-size:clamp(23px,3vw,30px);font-weight:900;color:#0b3f68}.transfer-alias{display:block;width:100%;padding:13px;background:white;border:2px dashed #427aa6;border-radius:9px;font-size:clamp(23px,3vw,32px);font-weight:850;letter-spacing:.025em;overflow-wrap:anywhere;color:#133d66;user-select:all}.transfer-box p{margin:0}.transfer-warning{font-size:16px;color:#193f5c;font-weight:650;line-height:1.55}
section[hidden]{display:none!important}
#siguiente{margin-top:12px}
#volver-archivos{display:block;background:#fff;color:#18547c;border:1px solid #9eb7cd;margin:0 0 20px;max-width:100%}.payment-options{display:flex;align-items:center;flex-wrap:wrap;gap:11px;margin-top:14px}.payment-options>p{flex-basis:100%;max-width:720px}.payment-options button{margin:0!important}
#precio-entrega:has(+ #plazo-explicacion){border-bottom:0;border-radius:12px 12px 0 0}
#plazo-explicacion:not(:has(+ #promo-dia:not([hidden]))){border-bottom:2px solid #c3d9ea;border-radius:0 0 12px 12px;padding-bottom:12px}
@media(max-width:650px){#precio-entrega{grid-template-columns:1fr}}
@media(max-width:700px){main{width:100%;max-width:100%;margin:0;padding:8px}section{padding:13px;margin-bottom:10px;border-radius:10px}h1{font-size:22px}h2{font-size:18px}#seccion-archivos{overflow:visible}#pdf{height:960px;min-height:0}#precio-entrega{padding:10px;gap:5px}#precio-entrega #precio,#precio-entrega #plazo-orientativo{font-size:21px}#plazo-explicacion,#promo-dia{padding:9px 11px;font-size:14px}button{max-width:100%;white-space:normal;min-height:46px}.payment-options button{display:block;width:100%;margin:8px 0!important}}`;
export function paginaCotizarLive(req,env,{authorized=false}={}){
 const u=new URL(req.url);
 if(req.method!=='GET'||u.protocol!=='https:'||u.hostname!==HOST||
    u.pathname!=='/cotizar'||
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
 const scriptNonce=crypto.randomUUID().replaceAll('-','');
 const enabled=env?.DOCS_LIVE_RECEPCION_GATE===ON&&env?.DOCS_LIVE_PRICING_GATE===ON&&
  env?.DOCS_LIVE_ORDER_GATE===ON;
 const bankEnabled=enabled&&env?.DOCS_LIVE_TRANSFER_GATE===ON&&
  env?.DOCS_LIVE_TUS_GATE===ON;
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cotizador de PDF · Librería Saber</title><style>${baseCss}</style></head><body>
<header><strong>Librería Saber · Impresiones y ploteos</strong></header>
<main><section><h1>Prepará tus PDF, JPG o PNG</h1>
<p>Elegí los archivos y sus opciones de impresión. Las medidas y el tipo de trabajo se calculan por el contenido del PDF, no por el nombre ni por su peso.</p>
<div id="precio-entrega" aria-label="Precio y fecha de entrega">
<div><strong>TU PRECIO A PAGAR</strong><p id="precio" aria-live="polite">Pendiente de cotización</p></div>
<div><strong>FECHA MÁXIMA ESTIMADA DE ENTREGA</strong><p id="plazo-orientativo" role="status" aria-live="polite">Consultando…</p></div>
</div>
<p id="plazo-explicacion">Fecha orientativa desde la acreditación del pago, sujeta a disponibilidad, trabajo, horario y feriados. Al iniciar tu trabajo, en el seguimiento verás una fecha y hora más precisas.</p>
<p id="promo-dia" hidden></p>
</section><section id="seccion-archivos"><h2>1. Elegí los archivos</h2><p>Seleccioná una sola vez los PDF que querés imprimir. Una vez aprobado el pago, el sistema los enviará automáticamente, sin volver a pedirlos.</p><iframe id="pdf" title="Elegir PDF, JPG o PNG y opciones de impresión" src="/cotizar/archivos" loading="eager" scrolling="no"></iframe>
<button type="button" id="siguiente" disabled>Siguiente · Tus datos</button>
<p id="aviso-siguiente" aria-live="polite">Elegí y confirmá las opciones de impresión para continuar.</p>
</section><section id="seccion-confirmacion" hidden><h2>2. Tus datos y el pago</h2>
<button type="button" id="volver-archivos">Volver a mis archivos</button>
<label for="nombre">Nombre y apellido o responsable *</label>
<input id="nombre" autocomplete="name" maxlength="100" placeholder="Nombre de quien retira" required>
<label for="telefono">Teléfono de contacto (con código de área) *</label>
<input id="telefono" inputmode="tel" autocomplete="tel" maxlength="26" placeholder="351 555 5555" required>
<label for="direccion">Dirección (opcional si retirás en el local)</label>
<input id="direccion" autocomplete="street-address" maxlength="180" placeholder="Calle y número">
<p id="estado" role="status" aria-live="polite">Seleccioná tus archivos para comenzar.</p>
<button type="button" id="continuar" disabled>${enabled?'Confirmar presupuesto':'Recepción de pedidos temporalmente desactivada'}</button>
<p><small>Antes de pagar, guardamos una copia privada de los PDF en este navegador. Al acreditarse el pago, los transferimos automáticamente a Librería Saber. Si el dispositivo no puede conservarlos, no permitimos pagar.</small></p>
<p class="transfer-warning">IMPORTANTE: Si enviás PDF pesados, mantené esta pestaña abierta después del pago hasta que aparezca «Archivo recibido». No cierres el navegador, no apagues el dispositivo y evitá cambiar de red durante la subida.</p>
</section></main><script type="module" nonce="${scriptNonce}">
import {crearFlujoPresupuestoLive} from '/cotizar/flujo-live.js';
const phone=document.getElementById('telefono');
const nombreCliente=document.getElementById('nombre');
const direccionCliente=document.getElementById('direccion');
const status=document.getElementById('estado');
const price=document.getElementById('precio');
const plazo=document.getElementById('plazo-orientativo');
const promo=document.getElementById('promo-dia');
const formatDate=s=>{
 if(!/^20\\d{2}-\\d{2}-\\d{2}$/.test(s||''))return null;
 const [year,month,day]=s.split('-');return day+'/'+month+'/'+year;
};
(async()=>{
 try{
  const r=await fetch('/api/pedido/plazo',{method:'GET',cache:'no-store'});
  const p=await r.json();
  if(!r.ok||p?.ok!==true||p.guaranteed!==false||
    typeof p.label!=='string'||typeof p.notice!=='string')
   throw Error('No hay previsión disponible');
  const fecha=formatDate(p.estimatedDeadlineDate);
  plazo.textContent=fecha?((p.mode==='hoy'||p.mode==='hoy_tarde'?'Hoy · ':'')+fecha):p.label;
  plazo.setAttribute('title',p.label);
  document.getElementById('plazo-explicacion').textContent=p.notice;
  if(p.dayPromotion?.informationalOnly===true&&
     p.dayPromotion?.appliedToQuote===false&&
     typeof p.dayPromotion.title==='string'&&typeof p.dayPromotion.summary==='string'){
   promo.hidden=false;promo.textContent='Promoción del día (informativa): '+
    p.dayPromotion.title+' · '+p.dayPromotion.summary+
    '. No descontada de este presupuesto.';
  }else{promo.hidden=true;promo.textContent=''}

 }catch{
  plazo.textContent='Previsión no disponible';
  document.getElementById('plazo-explicacion').textContent=
   'No pudimos consultar la previsión de la Central. La fecha de entrega no está confirmada; consultanos antes de pagar.';
 }
})();
const action=document.getElementById('continuar');
const next=document.getElementById('siguiente');
const stepFiles=document.getElementById('seccion-archivos');
const stepData=document.getElementById('seccion-confirmacion');
const back=document.getElementById('volver-archivos');
const stepNotice=document.getElementById('aviso-siguiente');
const iframe=document.getElementById('pdf');
const enabled=${enabled},bankEnabled=${bankEnabled};
let pending=null,flow=null,working=false;
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const orderId=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return 'WEB-ENSAYO-'+Array.from(a,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==iframe.contentWindow||!event.data)return;
 const data=event.data;
 if(data.type==='SABER_SMART_RESIZE'){
  // El contenido del iframe crece cuando el cliente agrega archivos u opciones.
  // Evitar scroll anidado: el documento principal es quien debe desplazarse.
  const h=Number(data.height);
  if(Number.isFinite(h)&&h>=280&&h<=30000){
   const target=Math.ceil(h+12);
   if(Math.abs(iframe.getBoundingClientRect().height-target)>3)
    iframe.style.height=target+'px';
  }
  return;
 }
 if(data.type==='SABER_SMART_PRICE_STATE'){
  if(Number.isSafeInteger(data.total)&&data.total>0)price.textContent='Presupuesto orientativo: '+money(data.total);
  else price.textContent='Precio pendiente';
  if(data.estado==='listo'&&data.promocion&&
     typeof data.promocion.titulo==='string'&&data.promocion.titulo.length<=90&&
     Number.isSafeInteger(data.promocion.descuento)&&data.promocion.descuento>0&&
     Number.isSafeInteger(data.promocion.totalAnterior)&&
     data.promocion.totalAnterior-data.promocion.descuento===data.total){
   promo.hidden=false;
   promo.textContent='Promoción aplicada: '+data.promocion.titulo+
    ' · Antes '+money(data.promocion.totalAnterior)+' · Descuento −'+
    money(data.promocion.descuento)+' · Total '+money(data.total);
  }
  if(data.blockReason)status.textContent=data.blockReason;
  action.disabled=!enabled||!data.sendable||working;
  next.disabled=!enabled||!data.sendable||working;
  if(data.sendable)stepNotice.textContent='Todo listo. Continuá para completar tus datos y confirmar.';
 }
 if(data.type==='SABER_SMART_UNIVERSAL_PDF'){
  if(working)return;
  pending={files:data.files,archivos:data.archivos};
  action.disabled=!enabled;
  status.textContent=enabled?'Archivos preparados, validando el presupuesto…':'Presupuesto preparado. El pago y el envío todavía no están habilitados.';
  if(enabled){
   stepFiles.hidden=true;
   stepData.hidden=false;
   action.disabled=false;
   status.textContent='Archivos preparados. Completá tus datos y confirmá el presupuesto.';
   stepData.scrollIntoView({behavior:'smooth',block:'start'});
   nombreCliente.focus({preventScroll:true});
  }
 }
 if(data.type==='SABER_SMART_HANDOFF_ERROR'){
  pending=null;action.disabled=true;next.disabled=true;
  status.textContent=String(data.message||'No se pudo preparar el pedido.').slice(0,180);
 }
});
// El contenido puede avisar su altura antes que se instale el listener.
const pedirAltura=()=>iframe.contentWindow?.postMessage(
 {type:'SABER_SMART_RESIZE_REQUEST'},location.origin);
iframe.addEventListener('load',pedirAltura);
requestAnimationFrame(pedirAltura);
next.addEventListener('click',()=>{
 if(!enabled||working||next.disabled||pending)return;
 next.disabled=true;
 stepNotice.textContent='Validando archivos y opciones…';
 iframe.contentWindow?.postMessage({type:'SABER_SMART_PREPARAR_ENVIO'},location.origin);
});
back.addEventListener('click',()=>{
 if(working||flow)return;
 pending=null;
 stepData.hidden=true;
 stepFiles.hidden=false;
 stepNotice.textContent='Podés revisar tus opciones y volver a continuar.';
 next.disabled=false;
 action.disabled=true;
 requestAnimationFrame(pedirAltura);
 stepFiles.scrollIntoView({behavior:'smooth',block:'start'});
});
action.addEventListener('click',async()=>{
 if(!enabled||working)return;
 const nombre=nombreCliente.value.trim();
 const telefono=phone.value.trim();
 const direccion=direccionCliente.value.trim();
 if(nombre.length<2||nombre.length>100||/[<>]/.test(nombre)){
  status.textContent='Ingresá el nombre y apellido o responsable del pedido.';
  nombreCliente.focus();
  return;
 }
 if(!/^\\+?[0-9 ()-]{10,26}$/.test(telefono)||telefono.replace(/\\D/g,'').length<10||
    telefono.replace(/\\D/g,'').length>15){
  status.textContent='Ingresá un teléfono válido con código de área.';
  phone.focus();
  return;
 }
 if(direccion.length>180||/[<>]/.test(direccion)){
  status.textContent='Corregí la dirección del pedido.';
  direccionCliente.focus();
  return;
 }
 if(!pending){
  action.disabled=true;
  status.textContent='Verificando los PDF y opciones elegidas…';
  iframe.contentWindow.postMessage({type:'SABER_SMART_PREPARAR_ENVIO'},location.origin);
  return;
 }
 working=true;action.disabled=true;
 try{
  flow=crearFlujoPresupuestoLive({
   ...pending,webOrderId:orderId(),telefono,nombre,direccion,
   onProgress:p=>{status.textContent=p.phase==='guardando'||p.phase==='guardado'?'Conservando los originales en este dispositivo, sin subirlos antes del pago…':'Identificando PDF '+p.index+' · '+(p.porcentaje||0)+' %';}
  });
  status.textContent='Validando precio y registrando orden…';
  const order=await flow.preparar();
  // El medio de pago anterior no debe heredarse a una orden nueva.
  sessionStorage.removeItem('saber-live-medio-v1');
  price.textContent='Orden '+order.numeroOrden+' · '+money(order.amountArs);
  status.textContent='Orden registrada. Los PDF están guardados en este navegador. Al pagar se enviarán automáticamente, sin seleccionarlos otra vez.';
  const options=document.createElement('div');
  options.className='payment-options';
  const button=document.createElement('button');
  button.type='button';button.textContent='Pagar con Mercado Pago';
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{const url=await flow.iniciarPago();sessionStorage.setItem('saber-live-medio-v1','mercadopago');location.assign(url)}
   catch(e){
    button.disabled=false;
    const reason=String(e?.message||'').slice(0,160);
    if(reason.includes('MP_LIVE_R2_NO_DISPONIBLE'))
     status.textContent='El archivo grande todavía no tiene autorizada su recepción R2 para la orden '+order.numeroOrden+'. No pagues hasta que se habilite.';
    else status.textContent='No pudimos iniciar el pago de la orden '+order.numeroOrden+'. La orden sigue pendiente; no pagues dos veces. '+reason;
   }
  });
  options.append(button);
  if(bankEnabled){
   const bank=document.createElement('button');
   bank.type='button';bank.textContent='Pagar por transferencia';
   bank.style.marginLeft='0';
   const instructions=document.createElement('div');
   instructions.setAttribute('role','status');
   options.append(bank,instructions);
   const bankRequest=async(action)=>{
    const r=await fetch('/api/pedido/live/transfer',{
     method:'POST',credentials:'same-origin',redirect:'error',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action,webOrderId:order.webOrderId,
      commercialOrderId:order.commercialOrderId})
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||data?.ok!==true||data.webOrderId!==order.webOrderId||
       data.commercialOrderId!==order.commercialOrderId||
       data.amountArs!==order.amountArs)
     throw Error('La transferencia no está disponible para este pedido.');
    return data;
   };
   let checking=false,interval=null;
   const check=async()=>{
    if(checking)return;
    checking=true;
    try{
     const result=await bankRequest('status');
     if(result.estado==='pagado_esperando_archivos'&&result.paymentVerified===true&&
        result.uploadAuthorized===true){
      if(interval)clearInterval(interval);
      instructions.textContent='Transferencia acreditada. Enviando automáticamente los PDF que elegiste antes de pagar…';
      location.assign('/pedido/estado');
     }
    }catch{instructions.textContent='Seguimos esperando la verificación bancaria. No hagas otra transferencia.';}
    finally{checking=false}
   };
   bank.addEventListener('click',async()=>{
    bank.disabled=true;instructions.textContent='Registrando transferencia pendiente…';
    try{
     const result=await bankRequest('start');
     if(result.estado!=='transferencia_pendiente'||result.paymentVerified!==false||
        result.uploadAuthorized!==false||!result.alias)
      throw Error('Respuesta de transferencia inválida.');
     button.disabled=true;
     sessionStorage.setItem('saber-live-medio-v1','transferencia');
     instructions.className='transfer-box';
     instructions.replaceChildren();
     const heading=document.createElement('strong');heading.textContent='DATOS PARA TRANSFERIR';
     const amount=document.createElement('span');amount.className='transfer-amount';
     amount.textContent='Importe: '+money(result.amountArs);
     const aliasLabel=document.createElement('strong');aliasLabel.textContent='ALIAS DE LIBRERÍA SABER';
     const alias=document.createElement('span');alias.className='transfer-alias';
     alias.textContent=result.alias;
     const copy=document.createElement('button');copy.type='button';
     copy.textContent='Copiar alias';
     copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(result.alias);copy.textContent='Alias copiado';}
      catch{copy.textContent='Seleccioná el alias para copiarlo';}
     });
     const detail=document.createElement('p');
     detail.textContent='Transferí el importe exacto al alias indicado. Después presioná «Ya transferí» para avisar a Librería Saber. Solo el personal confirma la acreditación bancaria.';
     const warning=document.createElement('p');warning.className='transfer-warning';
     warning.textContent='Si adjuntaste PDF pesados, mantené la pestaña y el navegador abiertos después de acreditar el pago, hasta ver «Archivo recibido». No realices otra transferencia.';
     instructions.append(heading,amount,aliasLabel,alias,copy,detail,warning);
     const notified=document.createElement('button');
     notified.type='button';notified.textContent='Ya transferí · Avisar a Librería Saber';
     notified.dataset.saberTransferNotice='SABER_TRANSFER_CONFIRMACION_CLIENTE_V1';
     notified.setAttribute('aria-label','Ya transferí. Avisar a Librería Saber para verificar el pago.');
     notified.addEventListener('click',async()=>{
      notified.disabled=true;instructions.textContent='Avisando a Librería Saber que realizaste la transferencia…';
      try{
       const notice=await bankRequest('notify');
       if(notice.estado==='pagado_esperando_archivos'&&notice.paymentVerified===true){
        instructions.textContent='Transferencia acreditada. Enviando automáticamente los PDF…';
        location.assign('/pedido/estado');return;
       }
       if(notice.estado!=='transferencia_informada'||notice.paymentVerified!==false||
          notice.uploadAuthorized!==false||notice.customerNotified!==true)
        throw Error('No se pudo confirmar el aviso.');
       instructions.textContent='Aviso recibido. Librería Saber ya puede ver tu transferencia en «Por verificar». '+
        'El pago sigue pendiente de comprobación bancaria; no realices otra transferencia. '+
        'Conservá esta pestaña abierta para el envío automático de los archivos después de acreditarse.';
       notified.remove();
       location.assign('/pedido/estado');
      }catch(error){
       notified.disabled=false;instructions.textContent='No se registró el aviso. '+
        'No transfieras otra vez: tocá «Ya transferí» para volver a avisarnos. '+
        String(error.message||'').slice(0,95);
      }
     });
     bank.replaceWith(notified);
     interval=setInterval(check,30000);
    }catch(error){
     bank.disabled=false;
     instructions.textContent=String(error.message||'No se pudo iniciar la transferencia.').slice(0,150);
    }
   });
  }
  action.replaceWith(options);
 }catch(e){status.textContent=String(e?.message||'No se pudo completar el presupuesto.').slice(0,180);working=false;action.disabled=false;}
});
</script></body></html>`;
 return new Response(html,{headers:headers(
  "default-src 'none'; script-src 'self' 'nonce-"+scriptNonce+"'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")});
}
