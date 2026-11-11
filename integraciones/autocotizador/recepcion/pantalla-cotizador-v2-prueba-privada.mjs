/**
 * Portal del cotizador V2 servido DESDE EL MISMO ORIGEN que la recepción.
 * Sólo puede abrirse con la compuerta BASIC privada del Worker, apagada
 * por defecto, y no interactúa con la tienda pública.
 */
export function paginaCotizadorV2PruebaPrivada(sitekey,tusEnabled=false,tusDiagnostico=null,sandboxEnabled=false,r2PrepayEnabled=false,universalEnabled=false){
 // En esta rama de integración el portal NUNCA vuelve silenciosamente a Drive.
 const tusBloqueado=!tusEnabled;
 const fallas=Array.isArray(tusDiagnostico?.invalidos)?tusDiagnostico.invalidos:[];
 if(typeof sitekey!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(sitekey))
  throw Error('Turnstile privado sin configurar');
 return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Librería Saber · Ensayo privado V2</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px system-ui,Arial,sans-serif;background:#edf2f8;color:#19334b}
header{background:#0a3158;color:#fff;padding:15px max(15px,calc((100vw - 1110px)/2))}
main{max-width:1140px;margin:12px auto;padding:0 14px;display:block}
.panel{background:#fff;padding:15px;border:1px solid #cbd5e1;border-radius:13px;min-width:0}
h1{font-size:19px;margin:0 0 4px}h2{font-size:17px;margin:0 0 12px}p{line-height:1.5}
small{color:#536475}iframe{border:0;width:100%;display:block}#smart{height:1050px;overflow:hidden}#base{min-height:750px}
.entry{border-top:1px solid #dce4ec;padding:7px 0}.entry>strong{display:block;margin-bottom:3px}.entry p{margin:5px 0;line-height:1.28}#recepcion-avanzada>.warning{margin-bottom:6px}#recepcion-avanzada .state{font-size:12px;line-height:1.3;margin:5px 0}#recepcion-avanzada .cf-turnstile{margin:7px 0}#recepcion-avanzada #order-summary{padding:7px;margin:7px 0}#order-summary p{margin:3px 0;font-size:12px}#recepcion-avanzada button{padding:8px 11px}#recepcion-avanzada input[type=file]{margin:4px 0;padding:5px}#recepcion-avanzada details>summary{cursor:pointer}
input,select,button{font:inherit;max-width:100%}input[type=file],select{display:block;width:100%;padding:8px;margin:8px 0;border:1px solid #b9c8d8;border-radius:7px}
button{border:0;background:#0a5583;color:#fff;padding:10px 15px;border-radius:8px;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
.state{white-space:pre-wrap;overflow-wrap:anywhere;color:#0a3158;font-size:13px}
.warning{background:#fff2db;border-left:4px solid #f7931e;padding:10px;margin-bottom:12px}
#cliente-telefono-label,#cliente-nombre-label,#cliente-direccion-label{display:flex;align-items:flex-start;flex-direction:column;gap:5px;font-size:13px;font-weight:700;color:#123852}
.contacto-datos{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;flex:1 1 550px}
#cliente-nombre,#cliente-direccion{max-width:100%;font-size:15px;padding:9px 10px;border:1px solid #7599b9;border-radius:8px;background:#fff}
#cliente-nombre{width:220px}#cliente-direccion{width:240px}
#cliente-nombre:focus,#cliente-direccion:focus{outline:2px solid #1c7db5}
#cliente-telefono{width:190px;max-width:100%;font-size:15px;padding:9px 10px;border:1px solid #7599b9;border-radius:8px;background:#fff}
#cliente-telefono:focus{outline:2px solid #1c7db5}
.contacto-ayuda,.contacto-error{flex-basis:100%;font-size:12px;line-height:1.2;margin:0}
.contacto-ayuda{color:#52677a}.contacto-error{color:#a12828;font-weight:700}
.contacto-error:empty{display:none}
#resumen-precio-entrega{display:grid;grid-template-columns:minmax(180px,1fr) minmax(210px,1fr);gap:12px;flex:1 1 100%;align-items:start;background:#fff;border:2px solid #9ebfd8;border-radius:12px;padding:15px}
#resumen-precio-entrega>div{min-width:0;padding:3px 5px}
#resumen-precio-entrega .resumen-titulo{display:block;color:#183f62;font-size:15px;font-weight:750;line-height:1.25}
#resumen-precio-entrega #precio-smart{font-size:clamp(21px,2.3vw,27px);font-weight:850;line-height:1.25;overflow-wrap:anywhere}
#resumen-precio-entrega #plazo-produccion-orientativo{font-size:clamp(20px,2.3vw,27px);font-weight:850;color:#0c4671;line-height:1.25;margin:3px 0}
#resumen-precio-entrega .resumen-aviso{display:block;grid-column:1 / -1;font-size:15px;line-height:1.45;color:#43566a;font-weight:500;margin:0;padding:10px 5px 0;border-top:1px solid #d9e6ef}
#promocion-dia-resumen:not([hidden]){display:block;grid-column:1 / -1;font-size:15px;font-weight:650;margin:0;padding:5px;color:#76420b}
@media(max-width:650px){#resumen-precio-entrega{grid-template-columns:1fr;gap:8px}#resumen-precio-entrega .resumen-aviso,#promocion-dia-resumen:not([hidden]){grid-column:1}}
#acciones-pedido{position:static;top:auto;z-index:auto;background:#eaf3fa;border-bottom:2px solid #aecce5;padding:8px max(15px,calc((100vw - 1110px)/2));box-shadow:0 3px 9px #0a315812;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#precio-smart{flex:1;font-size:16px;font-weight:750;color:#0a3158}#send-all-pdf{font-weight:750;background:#095985;white-space:nowrap;min-height:43px}#batch-progress{flex-basis:100%;margin:0;font-size:12px;line-height:1.2}#batch-progress.error-recepcion{background:#fee8e6;border-left:4px solid #b42318;border-radius:6px;color:#8f1d1d;padding:9px 12px;font-weight:750}#recepcion-avanzada>summary{font-size:13px!important;color:#536475}#seguridad-privada{max-width:1110px;margin:7px auto 0;padding:0 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#seguridad-privada .cf-turnstile{margin:0} @media(max-width:600px){#acciones-pedido{padding:8px 12px}#send-all-pdf{width:100%}}
.cf-turnstile{margin:15px 0}
#vista-estado-pedido{background:#fff;border-radius:12px;padding:24px;margin:12px 0;border:1px solid #bad2e7}
#vista-estado-pedido strong{display:block;font-size:21px;margin-bottom:8px}
#vista-estado-pedido p{margin:5px 0}
.estado-pago-sandbox{max-width:540px;margin:18px auto 4px;padding:15px;border:1px solid #bed5e7;border-radius:10px;background:#fff;text-align:center}.estado-pago-sandbox .pago-total{font-size:22px;font-weight:800;color:#133d62}.estado-pago-sandbox .pago-estado{font-weight:750;color:#714b16}.estado-pago-sandbox .pago-nota{font-size:12px;color:#52677a}.estado-pago-sandbox button{margin:10px auto 4px}
body.estado-registro #vista-estado-pedido{background:#ecfaf4;border:2px solid #12805c;box-shadow:0 4px 18px #0b58301c;scroll-margin-top:130px;text-align:center;padding:28px 18px}
body.estado-registro #vista-estado-pedido strong{font-size:23px;color:#11543f}
body.estado-registro #vista-estado-pedido .numero-confirmado{font-size:clamp(30px,6vw,52px);font-weight:850;color:#074a36;line-height:1.2;margin:14px 0}
body.estado-registro #acciones-pedido{background:#e0f7e9;border-bottom-color:#12805c}
body.estado-registro #send-all-pdf:disabled{opacity:1;background:#116b4f;color:#fff;cursor:default}
body.estado-envio #smart,body.estado-registro #smart{display:none}
[hidden]{display:none!important}
#drop-pdf{display:block;border:2px dashed #8faec5;background:#f4f9fd;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer}
#drop-pdf.dragging{background:#dfedfb;border-color:#095f8f}
#drop-pdf input{display:block;margin-top:8px}
@media(max-width:840px){main{display:block}.panel{margin-bottom:14px}iframe{min-height:740px}}
</style></head><body>
<header><h1>LIBRERÍA SABER · Cotizador V2 en ensayo privado</h1><small style="color:#d5e3f0">${sandboxEnabled?'Solo pagos con usuarios de prueba; sin cobros reales ni publicación comercial.':'Sin cobros, sin órdenes de producción y sin publicación comercial.'}</small></header>
<section id="r2-prepago-panel" hidden style="max-width:850px;margin:12px auto;padding:18px;background:white;border:1px solid #bed5e7;border-radius:12px" role="status" aria-live="polite">
<h2 style="font-size:18px;margin:0 0 8px">Ploteo grande · pago antes de enviar</h2>
<p id="r2-prepago-mensaje">El PDF sigue en tu dispositivo. No enviamos nada a R2 mientras el pago esté pendiente.</p>
<p id="r2-prepago-total" style="font-size:20px;font-weight:700"></p>
<button type="button" id="r2-prepago-pagar" hidden>Pagar con Mercado Pago (prueba)</button>
<a id="r2-prepago-link" hidden target="_blank" rel="noopener noreferrer">Abrir Mercado Pago de prueba</a>
<button type="button" id="r2-prepago-reintentar" hidden>Reintentar envío del PDF pagado</button>
<div id="r2-prepago-recuperacion" hidden>
<label for="r2-prepago-recuperar-file">Para continuar tu pedido, seleccioná el mismo PDF original.</label>
<input id="r2-prepago-recuperar-file" type="file" accept=".pdf,application/pdf">
</div>
</section>
<section role="alert" class="warning" style="margin:12px auto;max-width:1110px" ${tusBloqueado?'':'hidden'}>Supabase/TUS no está operativo. El envío está BLOQUEADO para evitar volver a Google Drive. Revisar: ${fallas.join(', ')||'configuración privada'}. No vuelvas a subir PDF todavía.</section>
<div id="seguridad-privada"><small>Verificación de seguridad para el envío:</small><div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div></div>
<div style="max-width:1140px;margin:18px auto 0;padding:0 14px">
<section style="padding:8px 3px 4px"><h2 style="margin:0 0 5px;font-size:22px;color:#123852">Cargá tus archivos una sola vez</h2><p style="margin:0;color:#52677a">Elegí PDF, JPG o PNG desde tu dispositivo. Revisá el presupuesto, las promociones y la entrega antes de completar tus datos y enviar el pedido.</p></section></div>
<main><section class="panel" style="padding:0;border:0;background:transparent">
<section id="vista-estado-pedido" hidden role="status" aria-live="polite"></section>
<output id="rendimiento-privado" hidden style="display:block;margin:8px 0;padding:11px 14px;background:#f9fcff;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;white-space:pre-wrap" aria-label="Tiempos del ensayo"></output>
<iframe id="smart" title="Análisis automático de PDF, tamaños, CAD y póster" src="/prueba-v2/carga-inteligente${universalEnabled?'?universal=1':r2PrepayEnabled?'?r2Prepago=1':''}" loading="eager"></iframe>
</section>
<div id="acciones-pedido"><div id="resumen-precio-entrega" aria-label="Resumen del precio y la fecha de entrega">
<div><span class="resumen-titulo">TU PRECIO A PAGAR</span><div id="precio-smart" role="status" aria-live="polite">Pendiente de cotización</div></div>
<div><span class="resumen-titulo">FECHA MÁXIMA ESTIMADA DE ENTREGA</span><p id="plazo-produccion-orientativo" role="status" aria-live="polite">Consultando…</p></div>
<small class="resumen-aviso" id="aclaracion-plazo">Fecha orientativa desde la acreditación del pago, sujeta a disponibilidad, trabajo y horarios. Cuando iniciemos el pedido, en tu seguimiento tendrás una fecha y hora de retiro más precisas.</small>
<p id="promocion-dia-resumen" hidden></p></div>
<div class="contacto-datos" role="group" aria-label="Datos de contacto del pedido">
<label id="cliente-nombre-label" for="cliente-nombre">Nombre y apellido o responsable *
<input id="cliente-nombre" type="text" autocomplete="name" maxlength="100" placeholder="Nombre de quien retira" required aria-describedby="cliente-nombre-error"></label>
<label id="cliente-telefono-label" for="cliente-telefono">Teléfono de contacto *
<input id="cliente-telefono" type="tel" inputmode="tel" autocomplete="tel" maxlength="26" placeholder="Ej.: 351 555 1234" required aria-describedby="cliente-telefono-ayuda cliente-telefono-error">
</label><label id="cliente-direccion-label" for="cliente-direccion">Dirección (opcional si retirás en el local)
<input id="cliente-direccion" type="text" autocomplete="street-address" maxlength="180" placeholder="Calle y número"></label></div><button id="send-all-pdf" type="button" disabled>Enviar mi pedido</button>
<p id="cliente-telefono-ayuda" class="contacto-ayuda">Para consultar algo de tu archivo o avisarte cuando esté listo. No se usa para publicidad.</p>
<p id="cliente-nombre-error" class="contacto-error" role="alert" aria-live="polite"></p>
<p id="cliente-telefono-error" class="contacto-error" role="alert" aria-live="polite"></p>
<p id="cliente-direccion-error" class="contacto-error" role="alert" aria-live="polite"></p>
<p id="batch-progress" class="state" role="status" aria-live="polite">Cargá tus PDF y revisá las opciones.</p></div>

<details id="recepcion-avanzada" class="panel" style="margin-top:14px"><summary style="font-size:16px;font-weight:700;cursor:pointer;padding:5px 0">Detalles de la recepción y verificación (ensayo privado)</summary><div style="padding-top:12px">
<div class="warning">Los archivos se reciben de forma privada, se comprueba su integridad y se revisan antes de iniciar la producción.</div>
<div id="drop-pdf" style="display:none"><strong>Recuperación manual de PDF para trabajos antiguos</strong><input id="batch-files" type="file" accept=".pdf,application/pdf" multiple><p id="batch-status" class="state" role="status">Los PDF se asignan por nombre y tamaño al trabajo correspondiente. La recepción sigue protegida.</p></div>
<div id="all" role="list" aria-label="Trabajos del cotizador"></div>
<p id="state" role="status" aria-live="polite" class="state">Cotizá una impresión y agregala al pedido de prueba.</p>
<section id="order-summary" class="warning" aria-label="Resumen privado del pedido" aria-live="polite"></section>

<button id="register-private" type="button" disabled hidden aria-hidden="true">Registro interno</button>
<p id="register-status" role="status" aria-live="polite" class="state">Disponible únicamente cuando todos los PDF estén verificados. Sin pagos.</p>

</div></details></main>
<details id="comparacion-original" style="max-width:1110px;margin:10px auto 25px;padding:0 14px"><summary style="cursor:pointer">Cotizador original (comparación comercial)</summary>
<iframe id="base" title="Cotizador original de comparación" src="/prueba-v2/cotizador?integrado=1&ensayoArchivos=1" loading="lazy"></iframe>
</details>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script type="module">
import {subirYVincularPdfCotizadorV2,ejecutarRecepcionParalela,fileIdParaReferencia} from '/prueba-v2/subir-vincular-pdf.mjs';
const plazoInfo=document.getElementById('plazo-produccion-orientativo');
const promoInfo=document.getElementById('promocion-dia-resumen');
const localDate=date=>{
 if(!/^20\\d{2}-\\d{2}-\\d{2}$/.test(date||''))return null;
 const [year,month,day]=date.split('-');
 return day+'/'+month+'/'+year;
};
(async()=>{
 try{
  const r=await fetch('/prueba-v2/api/plazo-produccion',{method:'GET',cache:'no-store'});
  const d=await r.json();
  if(!r.ok||d?.ok!==true||d.guaranteed!==false||
     typeof d.label!=='string'||typeof d.notice!=='string')
   throw Error('Sin previsión vigente');
  const fecha=localDate(d.estimatedDeadlineDate);
  plazoInfo.textContent=fecha?((d.mode==='hoy'||d.mode==='hoy_tarde'?'Hoy · ':'')+fecha):d.label;
  plazoInfo.setAttribute('title',d.label);
  document.getElementById('aclaracion-plazo').textContent=d.notice;
  if(d.dayPromotion?.informationalOnly===true&&
     d.dayPromotion?.appliedToQuote===false&&
     typeof d.dayPromotion.title==='string'&&
     typeof d.dayPromotion.summary==='string'){
    promoInfo.hidden=false;
    promoInfo.textContent='Promoción del día (informativa): '+d.dayPromotion.title+
     ' · '+d.dayPromotion.summary+'. El beneficio se aplica automáticamente al cotizar los trabajos que cumplan sus condiciones.';
  }else{promoInfo.hidden=true;promoInfo.textContent=''}

 }catch{
  plazoInfo.textContent='Previsión no disponible';
  document.getElementById('aclaracion-plazo').textContent=
   'No pudimos consultar la previsión de la Central. La fecha de entrega no está confirmada; consultanos antes de pagar.';
 }
})();
import {prepararManifiestoDocumentalV2} from '/prueba-v2/preparar-manifiesto.mjs';
const list=document.getElementById('all'),status=document.getElementById('state'),
 frame=document.getElementById('base'),smart=document.getElementById('smart'),
 summary=document.getElementById('order-summary');
const registerButton=document.getElementById('register-private'),registerStatus=document.getElementById('register-status');
const sendAllButton=document.getElementById('send-all-pdf'),batchProgress=document.getElementById('batch-progress');
const telefonoContacto=document.getElementById('cliente-telefono');
const nombreCliente=document.getElementById('cliente-nombre');
const direccionCliente=document.getElementById('cliente-direccion');
const nombreError=document.getElementById('cliente-nombre-error');
const direccionError=document.getElementById('cliente-direccion-error');
function nombreValido(){
 const value=nombreCliente.value.trim();
 const ok=value.length>=2&&value.length<=100&&!/[<>]/.test(value);
 nombreError.textContent=ok?'':'Ingresá nombre y apellido o responsable (2 a 100 caracteres).';
 nombreCliente.setAttribute('aria-invalid',ok?'false':'true');
 return ok?value:null;
}
function direccionValida(){
 const value=direccionCliente.value.trim();
 const ok=value.length<=180&&!/[<>]/.test(value);
 direccionError.textContent=ok?'':'La dirección debe tener hasta 180 caracteres.';
 direccionCliente.setAttribute('aria-invalid',ok?'false':'true');
 return ok?value:null;
}
nombreCliente.addEventListener('input',()=>{nombreError.textContent='';nombreCliente.removeAttribute('aria-invalid')});
direccionCliente.addEventListener('input',()=>{direccionError.textContent='';direccionCliente.removeAttribute('aria-invalid')});
const telefonoError=document.getElementById('cliente-telefono-error');
function telefonoValido(){
 const original=telefonoContacto.value.trim();
 const numeros=original.replace(/\\D/g,'');
 const correcto=/^\\+?[0-9 ()-]{10,26}$/.test(original)&&numeros.length>=10&&numeros.length<=15;
 telefonoError.textContent=correcto?'':'Ingresá un teléfono de contacto válido (con código de área).';
 telefonoContacto.setAttribute('aria-invalid',correcto?'false':'true');
 return correcto?original:null;
}
telefonoContacto.addEventListener('input',()=>{telefonoError.textContent='';telefonoContacto.removeAttribute('aria-invalid')});

const modoDiagnostico=new URLSearchParams(location.search).get('diagnostico')==='1';
const TUS_ENABLED=${tusEnabled===true};
 const SANDBOX_PAYMENT_ENABLED=${sandboxEnabled===true};
 const R2_PREPAY_UI_ENABLED=${r2PrepayEnabled===true};
 const UNIVERSAL_R2_UI_ENABLED=${universalEnabled===true};
 const MAX_PDF_PRIVADOS=TUS_ENABLED?10:30;
const TUS_BLOCKED=${tusBloqueado};
let tusPreflightOK=false,tusPreflightError='',tusPreflightPromise=null;
if(TUS_BLOCKED){
 document.getElementById('seguridad-privada').hidden=true;
 batchProgress.textContent='Supabase/TUS no disponible. Envío desactivado para evitar Google Drive.';
}
if(TUS_ENABLED){
 document.getElementById('seguridad-privada').hidden=true;
 document.querySelector('#recepcion-avanzada .warning').textContent='PDF enviados directamente a almacenamiento privado; precio y páginas revalidados por servidor. Sin cobros.';
}
if(!modoDiagnostico){
 document.getElementById('recepcion-avanzada').hidden=true;
 document.getElementById('comparacion-original').hidden=true;
}
const vistaEstadoPedido=document.getElementById('vista-estado-pedido');
const rendimientoPrivado=document.getElementById('rendimiento-privado');
let ultimoTotalServidor=null;
function mostrarEstadoCliente(estado,titulo,detalle,numeroOrden=null){
 const confirmado=estado==='registrado'&&/^\\d{3,}$/.test(numeroOrden||'');
 document.body.classList.toggle('estado-envio',estado==='enviando');
 document.body.classList.toggle('estado-registro',confirmado);
 vistaEstadoPedido.hidden=!estado;
 if(!estado){vistaEstadoPedido.replaceChildren();return}
 const h=document.createElement('strong');h.textContent=titulo;
 const p=document.createElement('p');p.textContent=detalle;
 if(confirmado){
  const numero=document.createElement('p');
  numero.className='numero-confirmado';
  numero.textContent='Orden N.º '+numeroOrden;
  const nuevoPedido=document.createElement('button');
  nuevoPedido.type='button';
  nuevoPedido.textContent='Iniciar otro pedido';
  nuevoPedido.addEventListener('click',()=>{
   try{sessionStorage.removeItem(RECOVERY_KEY)}catch{}
   location.assign('/prueba-v2/');
  });
  vistaEstadoPedido.replaceChildren(h,numero,p,nuevoPedido);
   if(typeof SANDBOX_PAYMENT_ENABLED!=='undefined'&&SANDBOX_PAYMENT_ENABLED&&TUS_ENABLED&&registeredOrder)vistaEstadoPedido.append(pagoSandboxEnRecibo());
  batchProgress.textContent='Pedido recibido correctamente · Orden N.º '+numeroOrden+
   ' · PDF verificados y registrados.';
  sendAllButton.textContent='Orden N.º '+numeroOrden+' recibida';
  vistaEstadoPedido.scrollIntoView({block:'start',behavior:'smooth'});
 }else vistaEstadoPedido.replaceChildren(h,p);
}
function pagoSandboxEnRecibo(){
 const wrap=document.createElement('section'),mensaje=document.createElement('p'),
  boton=document.createElement('button'),transferButton=document.createElement('button'),
   transferInfo=document.createElement('p'),estado=document.createElement('p'),plazo=document.createElement('p'),
  total=document.createElement('p'),nota=document.createElement('p'),seguimiento=document.createElement('a');
 wrap.className='estado-pago-sandbox';
 seguimiento.hidden=true;seguimiento.target='_blank';seguimiento.rel='noopener noreferrer';
 seguimiento.textContent='Seguir mi pedido · estado y demora';
 seguimiento.style.cssText='display:none;margin:9px 0;padding:11px;border-radius:8px;color:white;background:#185a8b';
 mensaje.setAttribute('role','status');mensaje.setAttribute('aria-live','polite');
 estado.className='pago-estado';estado.textContent='Estado del pago: pendiente';
  plazo.className='pago-nota';plazo.textContent='Preparación: plazo a confirmar después del pago.';
 total.className='pago-total';
 total.textContent=Number.isSafeInteger(ultimoTotalServidor)&&ultimoTotalServidor>0?
  'Total del pedido: '+new Intl.NumberFormat('es-AR',{
   style:'currency',currency:'ARS',maximumFractionDigits:0
  }).format(ultimoTotalServidor):'Total verificado en la orden';
 boton.type='button';boton.textContent='Pagar con Mercado Pago (prueba)';
  transferButton.type='button';transferButton.textContent='Transferencia bancaria (prueba)';
  transferInfo.className='pago-nota';
 nota.className='pago-nota';
 nota.textContent='Ensayo privado: usá solamente la cuenta compradora de prueba, nunca dinero real.';
 mensaje.textContent='El estado se consulta automáticamente. No necesitás verificar el pago manualmente.';
 const api=async action=>{
  const response=await fetch('/prueba-v2/api/ensayo-tus-pago-sandbox',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,webOrderId:orderId,clientOrderId,commercialOrderId:registeredOrder})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)throw Error(result?.error||'No se pudo verificar el pago.');
  return result;
 };
 let consultando=false,pagado=false,revocado=false,preparandoPago=false;
  let transferenciaPendiente=false,preparandoTransferencia=false;
 const check=async()=>{
  if(consultando||!registeredOrder)return;
  consultando=true;
  try{
   const result=await api('status');
   if(typeof result.seguimientoUrl==='string'){
    try{
     const url=new URL(result.seguimientoUrl);
     if(url.protocol==='https:'&&
       /^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)&&
       url.pathname==='/seguimiento'&&url.searchParams.size===1){
      seguimiento.href=url.href;seguimiento.hidden=false;seguimiento.style.display='inline-block';
     }
    }catch{}
   }
   if(result.estado==='pagado'){
    pagado=true;revocado=false;
    estado.textContent='Estado del pago: confirmado';
    mensaje.textContent='Pago recibido. Tu pedido ya figura como pagado en la Central.';
     if(result.preparacionEstimada?.provisional===true&&
        typeof result.preparacionEstimada.readyAt==='string'){
      const fecha=new Date(result.preparacionEstimada.readyAt);
      plazo.textContent=Number.isFinite(fecha.getTime())?
       'Preparación estimada (provisional): '+new Intl.DateTimeFormat('es-AR',{
        timeZone:'America/Argentina/Cordoba',day:'2-digit',month:'2-digit',year:'numeric',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(fecha)+' hs. Te avisaremos si cambia.':
       'Preparación: todavía sin horario confirmado.';
     }else{
      const textos={
       hoy:'Prevemos que tu trabajo estará listo durante el día de hoy.',
       hoy_tarde:'Prevemos que estará listo hoy por la tarde.',
       proximo_dia:'Prevemos que estará listo el próximo día de atención.',
       por_confirmar:'Estamos organizando las entregas; confirmaremos cuándo estará listo.'
      };
      plazo.textContent=(textos[result.deliveryPlan]||textos.por_confirmar)+
       ' Es orientativo. Seguí tu pedido: cuando empecemos, indicaremos la hora estimada.';
     }
    boton.disabled=true;boton.textContent='Pago confirmado';
     transferButton.disabled=true;
    document.getElementById('precio-smart').textContent='Orden N.º '+
     (registeredShortOrder||'')+' · Pago de prueba confirmado';
    return;
   }
   if(result.estado==='revocado'){
    pagado=false;revocado=true;
    estado.textContent='Estado del pago: requiere revisión';
    mensaje.textContent='El pago fue revertido. El pedido no debe prepararse.';
     plazo.textContent='Preparación: suspendida hasta aclarar el pago.';
    boton.disabled=true;boton.textContent='Pago revertido';
     transferButton.disabled=true;
    return;
   }
   if(result.estado==='transferencia_pendiente'){
     transferenciaPendiente=true;
     estado.textContent='Estado del pago: transferencia pendiente de acreditación';
     // El servidor devuelve las instrucciones sin volver a iniciar la transferencia.
     if(typeof result.alias==='string'&&/^[A-Za-z0-9._-]{6,50}$/.test(result.alias)&&
        result.amountArs===ultimoTotalServidor){
      transferInfo.textContent='Orden N.º '+registeredShortOrder+' · Importe exacto: '+
       new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(result.amountArs)+
       ' · Alias de ENSAYO: '+result.alias;
     }
     mensaje.textContent='Transferencia pendiente. Solo Librería Saber confirma el ingreso. No envíes dinero real en este ensayo.';
     boton.disabled=true;transferButton.disabled=true;
     return;
    }
    if(!pagado&&!revocado&&!preparandoPago&&!transferenciaPendiente){
    estado.textContent='Estado del pago: pendiente';
    mensaje.textContent='Esperando confirmación de Mercado Pago. Esta pantalla se actualiza sola.';
   }
  }catch(_){
   if(!pagado&&!revocado&&!preparandoPago)
    mensaje.textContent='No pudimos consultar el estado. Reintentaremos automáticamente.';
  }finally{consultando=false}
 };
 // El servidor verifica los pagos pendientes con su propio límite de frecuencia.
 // Esta consulta nunca crea cobros, cambia importes ni habilita producción.
 setInterval(()=>{if(!document.hidden)void check()},30000);
 if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)void check();
 });
 void check();
 boton.addEventListener('click',async()=>{
  if(pagado||revocado||preparandoPago||transferenciaPendiente||preparandoTransferencia)return;
  preparandoPago=true;boton.disabled=true;
  mensaje.textContent='Preparando el pago seguro de prueba…';
  try{
   const result=await api('start');
   const url=new URL(result.checkoutUrl);
   if(url.protocol!=='https:'||!/(^|\\.)(mercadopago\\.com|mercadopago\\.com\\.ar)$/.test(url.hostname))
    throw Error('Enlace de pago no permitido.');
   const link=document.createElement('a');
   link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
   link.textContent='Abrir Mercado Pago de prueba';
   link.style.cssText='display:inline-block;margin:9px;padding:11px;border-radius:8px;color:white;background:#095985';
   wrap.insertBefore(link,mensaje);
   boton.textContent='Enlace de pago preparado';
   mensaje.textContent='Abrí Mercado Pago de prueba en otra pestaña. Al regresar, el pago se verificará automáticamente.';
   void check();
  }catch(e){
   if(!pagado&&!revocado){
    mensaje.textContent=String(e.message||e);
    boton.disabled=false;
   }
  }finally{preparandoPago=false}
 });
 transferButton.addEventListener('click',async()=>{
   if(pagado||revocado||preparandoPago||preparandoTransferencia||transferenciaPendiente)return;
   preparandoTransferencia=true;transferButton.disabled=true;
   mensaje.textContent='Preparando instrucciones bancarias de ensayo…';
   try{
    const result=await api('bank');
    if(result.estado!=='transferencia_pendiente'||
       result.amountArs!==ultimoTotalServidor||typeof result.alias!=='string')
     throw Error('La cuenta o el importe no coinciden con tu pedido.');
    transferenciaPendiente=true;boton.disabled=true;
    estado.textContent='Estado del pago: transferencia pendiente de acreditación';
    transferInfo.textContent='Orden N.º '+registeredShortOrder+' · Importe exacto: '+
     new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(result.amountArs)+
     ' · Alias de ENSAYO: '+result.alias;
    mensaje.textContent='No envíes dinero real. La Central confirmará el pedido solamente cuando el operador verifique el banco.';
    transferButton.textContent='Esperando acreditación bancaria';
   }catch(e){
    if(!transferenciaPendiente){transferButton.disabled=false;mensaje.textContent=String(e.message||e);}
   }finally{preparandoTransferencia=false}
  });
  wrap.append(total,estado,plazo,seguimiento,boton,transferButton,transferInfo,mensaje,nota);
 return wrap;
}
let batchSending=false,smartReady=false,smartBlockedReason='',handoffInProgress=false,handoffResolve=null;
let r2PrepagoPendiente=null,r2PrepagoFlujo=null,r2PagoTimer=null,r2Consultando=false,r2Subiendo=false;
let universalPendiente=null,universalFlujo=null,universalPagoTimer=null,
 universalConsultando=false,universalSubiendo=false;
const dropPdf=document.getElementById('drop-pdf'),batchFiles=document.getElementById('batch-files'),batchStatus=document.getElementById('batch-status');
 // Mediciones locales: sin archivos, nombres, importes, credenciales ni hashes.
 // Son invisibles para el cliente y no se transmiten a servicios externos.
 let medicionActual=null,analisisIniciado=null,ultimoAnalisisMs=null;
 function marcarTiempo(etapa,detalle={}){
  if(!medicionActual)return;
  medicionActual.eventos.push({etapa,ms:Math.round(performance.now()-medicionActual.inicio),...detalle});
 }
 function iniciarMedicion(){
  medicionActual={inicio:performance.now(),eventos:[],fasesPorPdf:{}};
  marcarTiempo('clic_enviar');
 }
 function medirSolicitudPdf(d,t){
  if(!medicionActual||!modoDiagnostico||!t||
     !['start','status','part','finish','vinculo'].includes(t.fase)||
     !Number.isFinite(t.duracionMs)||t.duracionMs<0)return;
  const indice=all.flatMap(item=>item.references).indexOf(d)+1;
  if(indice<1)return;
  marcarTiempo('rpc_'+t.fase,{pdf:indice,duracionMs:t.duracionMs});
 }
 function marcarFasePdf(d,progreso){
  if(!medicionActual)return;
  const indice=all.flatMap(item=>item.references).indexOf(d)+1;
  if(indice<1||medicionActual.fasesPorPdf[indice]===progreso.phase)return;
  medicionActual.fasesPorPdf[indice]=progreso.phase;
  marcarTiempo('pdf_'+progreso.phase,{pdf:indice,bloques:progreso.completed,totalBloques:progreso.total});
 }
 function terminarMedicion(estado){
  if(!medicionActual)return;
  marcarTiempo('fin',{estado});
  const resultado=Object.freeze({
   estado,tiempoTotalMs:Math.round(performance.now()-medicionActual.inicio),
   ultimoAnalisisMs,cantidadPdf:all.flatMap(item=>item.references).length,
   eventos:medicionActual.eventos
  });
  Object.defineProperty(window,'__saberRendimientoPrivado',{configurable:true,value:resultado});
  if(modoDiagnostico){
   const eventos=resultado.eventos;
   function faseMs(primera,ultima){
    const inicio=eventos.find(e=>e.etapa===primera);
    const finales=eventos.filter(e=>e.etapa===ultima);
    const fin=finales[finales.length-1];
    return inicio&&fin&&fin.ms>=inicio.ms?fin.ms-inicio.ms:null;
   }
   const segundos=ms=>ms===null?'no registrado':(ms/1000).toFixed(1)+' s';
   const fases=[
    ['Preparación',faseMs('preparacion_inicio','preparacion_terminada')],
    ['Inicio de tandas',faseMs('lote_inicio','lote_sesiones')],
    ['Recepción y verificación',faseMs('lote_transferencia_inicio','central_inicio')],
    ['Registro en Central',faseMs('central_inicio','central_fin')]
   ];
   // La suma de esperas HTTP puede superar el total por paralelismo de dos PDF.
   const desgloses=[
    ['part','Subida de fragmentos'],['finish','Verificación en Google'],
    ['vinculo','Verificación y cotización en Worker'],
    ['status','Consultas de recuperación'],['start','Inicio individual']
   ].map(([fase,titulo])=>{
     const rr=eventos.filter(e=>e.etapa==='rpc_'+fase);
     if(!rr.length)return null;
     const suma=rr.reduce((ac,e)=>ac+e.duracionMs,0);
     const max=Math.max(...rr.map(e=>e.duracionMs));
     return titulo+': '+rr.length+' llamadas, '+segundos(suma)+
      ' acumulados (máx. '+segundos(max)+')';
   }).filter(Boolean);
   rendimientoPrivado.hidden=false;
   rendimientoPrivado.textContent='Tiempos del ensayo · '+resultado.cantidadPdf+' PDF · Estado: '+resultado.estado+
    '\\nDesde pulsar Enviar: '+segundos(resultado.tiempoTotalMs)+
    (Number.isFinite(resultado.ultimoAnalisisMs)?' · Análisis previo: '+segundos(resultado.ultimoAnalisisMs):'')+
    '\\n'+fases.filter(p=>p[1]!==null).map(p=>p[0]+': '+segundos(p[1])).join(' · ')+
    (desgloses.length?'\\nDetalle HTTP (suma, puede superar el total por paralelismo):\\n'+desgloses.join('\\n'):'')+
    '\\nSolo diagnóstico local: sin archivos, nombres ni credenciales.';
   console.info('[Librería Saber] Mediciones locales del ensayo',resultado);
   console.table(resultado.eventos);
  }
  medicionActual=null;
 }

function assignFiles(files){
 const chosen=Array.from(files||[]);
 if(!chosen.length)return;
 if(chosen.some(file=>!(file instanceof File)||!/\\.pdf$/i.test(file.name))){
  batchStatus.textContent='Solo se admiten archivos PDF.';return;
 }
 const refs=all.flatMap(item=>item.references).filter(d=>!d.confirmacion);
 if(chosen.length>MAX_PDF_PRIVADOS||refs.length>MAX_PDF_PRIVADOS){
  batchStatus.textContent='El máximo del ensayo es de '+MAX_PDF_PRIVADOS+' PDF.';return;
 }
 let assigned=0,unmatched=0,ambiguous=0;
 for(const file of chosen){
  const matches=refs.filter(d=>!d.archivoLocal&&
   d.reference.nombre===file.name&&d.reference.bytes===file.size);
  if(matches.length!==1){
   if(matches.length>1)ambiguous++;else unmatched++;
   continue;
  }
  matches[0].archivoLocal=file;assigned++;
 }
 render();updateSummary();
 batchStatus.textContent=assigned+' PDF asociados a los trabajos. '+
  (unmatched?unmatched+' sin coincidencia (primero agregá esos trabajos al carrito). ':'')+
  (ambiguous?ambiguous+' con nombre y tamaño duplicados, requieren selección individual. ':'')+
  'La validación SHA-256 se realizará durante el envío seguro.';
}
batchFiles.addEventListener('change',()=>{assignFiles(batchFiles.files);batchFiles.value='';});
for(const evt of ['dragenter','dragover']){
 dropPdf.addEventListener(evt,event=>{
  if(!event.dataTransfer?.types?.includes('Files'))return;
  event.preventDefault();event.dataTransfer.dropEffect='copy';
  dropPdf.classList.add('dragging');
 });
}
dropPdf.addEventListener('dragleave',event=>{
 if(!dropPdf.contains(event.relatedTarget))dropPdf.classList.remove('dragging');
});
dropPdf.addEventListener('drop',event=>{
 event.preventDefault();dropPdf.classList.remove('dragging');
 assignFiles(event.dataTransfer?.files);
});

const newClientOrderId=()=>crypto.randomUUID();
let registering=false,registeredOrder=null,registeredShortOrder=null;
// Recuperación de metadatos no sensibles tras recarga o suspensión móvil.
 // Nunca conservar objetos File, base64, sesiones, credenciales ni confirmaciones.
const RECOVERY_KEY='saber-v2-ensayo-metadatos-v1';
const R2_RECOVERY_KEY='saber-r2-prepago-pendiente-v1';
function recuperarR2Meta(){
 try{
  const raw=localStorage.getItem(R2_RECOVERY_KEY);
  if(!raw||raw.length>1400)return null;
  const x=JSON.parse(raw),age=Date.now()-x?.savedAt;
  if(x?.schema!=='saber-r2-recuperacion-v1'||
     !Number.isSafeInteger(x.savedAt)||age<0||age>24*3600*1000||
     !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(x.webOrderId||'')||
     !/^[a-f0-9-]{36}$/i.test(x.commercialOrderId||'')||
     !/^[a-f0-9]{64}$/.test(x.sha256||'')||
     !Number.isSafeInteger(x.amountArs)||x.amountArs<1||
     !Number.isSafeInteger(x.bytes)||x.bytes<=40*1024*1024||
     x.bytes>200*1024*1024||
     typeof x.name!=='string'||x.name.length>120||
     !x.name.toLowerCase().endsWith('.pdf')||
     !Number.isSafeInteger(x.pages)||x.pages<1||x.pages>2000||
     typeof x.modo!=='string'||x.modo.length<1||x.modo.length>40)
   return null;
  return x;
 }catch{return null}
}
function borrarRecuperacionR2(){try{localStorage.removeItem(R2_RECOVERY_KEY)}catch{}}
const r2Recuperable=R2_PREPAY_UI_ENABLED?recuperarR2Meta():null;
const RECOVERY_MAX_AGE=12*60*60*1000;
const RECOVERY_MAX_BYTES=25000;
const newOrderId=()=>{
 const random=new Uint8Array(16);crypto.getRandomValues(random);
 return 'WEB-ENSAYO-'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
};
const safeRef=r=>r&&r.schema==='saber-pdf-local-pendiente-v1'&&
 /^[a-f0-9-]{36}$/i.test(r.localRef||'')&&/^[a-f0-9]{64}$/.test(r.sha256||'')&&
 Number.isSafeInteger(r.bytes)&&r.bytes>=5&&r.bytes<=40*1024*1024&&
 Number.isSafeInteger(r.paginas)&&r.paginas>=1&&r.paginas<=2000&&
 typeof r.nombre==='string'&&r.nombre.length<=120&&/\\.pdf$/i.test(r.nombre)&&
 r.estado==='PENDIENTE_DE_ENVIO'&&r.recibido===false&&r.verificadoServidor===false;
function restore(){
 try{
  const raw=sessionStorage.getItem(RECOVERY_KEY);
  if(!raw||raw.length>RECOVERY_MAX_BYTES)return null;
  const state=JSON.parse(raw);
  if(!state||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(state.orderId||'')||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(state.clientOrderId||'')||
    !Number.isSafeInteger(state.savedAt)||Date.now()-state.savedAt<0||
    Date.now()-state.savedAt>RECOVERY_MAX_AGE||!Array.isArray(state.items)||
    state.items.length>MAX_PDF_PRIVADOS)return null;
  const seen=new Set(),items=[];
  let totalReferences=0;
  for(const item of state.items){
   if(!item||typeof item.name!=='string'||item.name.length>120||
    !Number.isFinite(item.price)||item.price<=0||
    !Array.isArray(item.references)||item.references.length>MAX_PDF_PRIVADOS)return null;
   const refs=[];
   for(const d of item.references){
    if(!d||!Number.isSafeInteger(d.itemIndex)||d.itemIndex<0||d.itemIndex>29||
     !safeRef(d.reference)||seen.has(d.reference.localRef))return null;
    seen.add(d.reference.localRef);
    refs.push({itemIndex:d.itemIndex,reference:d.reference});
    totalReferences++;
    if(totalReferences>30)return null;
   }
   items.push({name:item.name,price:item.price,references:refs});
  }
  return {orderId:state.orderId,clientOrderId:state.clientOrderId,items,seen};
 }catch{return null}
}
const previous=restore();
let orderId=previous?.orderId||r2Recuperable?.webOrderId||newOrderId();
let clientOrderId=previous?.clientOrderId||newClientOrderId();
const all=previous?.items||[],used=previous?.seen||new Set();
function save(){
 try{
  // No conservar referencias de ploteo sin su clasificación: una pestaña
  // restaurada debe volver a analizar ese PDF, nunca transformarlo en A4/A3.
  if(all.some(item=>item.references.some(d=>d.ploteo))){
   sessionStorage.removeItem(RECOVERY_KEY);return;
  }
  const items=all.map(item=>({name:item.name,price:item.price,
   references:item.references.map(d=>({itemIndex:d.itemIndex,reference:{
    schema:d.reference.schema,localRef:d.reference.localRef,nombre:d.reference.nombre,
    bytes:d.reference.bytes,paginas:d.reference.paginas,sha256:d.reference.sha256,
    estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false
   }}))}));
  const encoded=JSON.stringify({orderId,clientOrderId,items,savedAt:Date.now()});
  if(encoded.length<=RECOVERY_MAX_BYTES)sessionStorage.setItem(RECOVERY_KEY,encoded);
 }catch{/* Modo privado o cuota: la cotización sigue funcionando sin persistencia. */}
}
// El análisis nuevo del iframe tiene prioridad sobre metadatos restaurados.
// Esos metadatos carecen de objetos File y no deben bloquear un nuevo PDF.
function borradorAnteriorSinPDF(){
 return all.length>0&&all.every(item=>item.references.every(d=>
  !d.archivoLocal&&!d.confirmacion));
}
function motivoBloqueoEnvio(){
 const refs=all.flatMap(item=>item.references);
 if(TUS_BLOCKED)return 'Recepción privada no configurada.';
 if(TUS_ENABLED&&!tusPreflightOK)return 'La conexión privada aún no está verificada'+(typeof tusPreflightError==='string'&&tusPreflightError?' ('+tusPreflightError+')':'')+'.';
 if(batchSending)return 'Los archivos se están enviando.';
 if(registering)return 'Se está registrando el pedido.';
 if(handoffInProgress)return 'Preparando los archivos del pedido.';
 if(registeredOrder)return 'El pedido ya fue registrado.';
 if(typeof r2PrepagoFlujo!=='undefined'&&r2PrepagoFlujo)return 'Este presupuesto de ploteo grande ya está preparado; continuá con el pago en el panel.';
 if(smartReady&&(refs.length===0||borradorAnteriorSinPDF()))return '';
 if(!refs.length)return smartBlockedReason||'Todavía no hay un presupuesto completo listo para enviar.';
 if(all.some(item=>item.references.length===0))
  return 'Hay un trabajo anterior sin PDF; quitá ese borrador antes de enviar.';
 if(refs.some(d=>!d.confirmacion&&!d.archivoLocal))
  return 'Hay un PDF anterior sin archivo local; cargá de nuevo ese PDF o iniciá un nuevo trabajo.';
 return '';
}
function descartarBorradorAnteriorParaPedidoNuevo(){
 if(!smartReady||!borradorAnteriorSinPDF())return false;
 all.length=0;
 used.clear();
 try{sessionStorage.removeItem(RECOVERY_KEY)}catch{}
 orderId=newOrderId();
 clientOrderId=newClientOrderId();
 return true;
}
function updateSummary(){
 const allRefs=all.flatMap(item=>item.references);
 const verified=allRefs.filter(d=>TUS_ENABLED&&registeredOrder?true:
  d.confirmacion?.reciboGoogleVerificado===true&&
  d.confirmacion?.paymentAuthorized===false&&
  (d.confirmacion?.cotizacionServidor?.estado==='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
   d.ploteoVerificado?.estado==='PRELIMINAR_VERIFICADA_SIN_PEDIDO'));
 const value=TUS_ENABLED&&registeredOrder&&Number.isSafeInteger(ultimoTotalServidor)
  ?ultimoTotalServidor:verified.reduce((n,d)=>n+
  (d.ploteoVerificado?.totalArs??d.confirmacion.cotizacionServidor.totalArs),0);
 const amount=Number.isSafeInteger(value)?new Intl.NumberFormat('es-AR',{
  style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value):'Requiere revisión';
 const remaining=allRefs.length-verified.length;
 const withoutPdf=all.filter(item=>item.references.length===0).length;
 summary.replaceChildren();
 const title=document.createElement('strong');
 title.textContent='Resumen del pedido · '+verified.length+' de '+allRefs.length+' PDF verificados';
 const detail=document.createElement('p');
 detail.textContent='Servidor: '+amount+' · '+(remaining?remaining+' PDF pendientes':'PDF verificados')+
   (withoutPdf?' · '+withoutPdf+' trabajos sin PDF':'')+
   ' · Central D1: '+(registeredOrder?'registrado':'pendiente')+' · Cobros desactivados.';
 summary.append(title,detail);
 const bloqueo=motivoBloqueoEnvio();
 // No dejar un botón gris sin diagnóstico: sólo deshabilitar durante operaciones irreversibles.
 // Clic con validaciones pendientes informa el motivo y NUNCA inicia un envío inseguro.
 sendAllButton.disabled=Boolean(batchSending||registering||handoffInProgress||registeredOrder);
 sendAllButton.title=bloqueo||'Enviar el pedido cotizado';
 if(bloqueo&&smartReady&&!batchSending&&!registering&&!registeredOrder)
  batchProgress.textContent='Envío pendiente: '+bloqueo;
 sendAllButton.textContent=registeredOrder?'Orden N.º '+(registeredShortOrder||'')+' recibida':
  batchSending?'Enviando archivos…':registering?'Registrando pedido…':'Enviar mi pedido';
 registerButton.disabled=true;
}

const catalogPromise=fetch('/prueba-v2/precios-web.json',{credentials:'same-origin'})
 .then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()});
function render(){
 list.replaceChildren();
 for(const [itemIndex,item] of all.entries()){
  const div=document.createElement('article');div.className='entry';
  const h=document.createElement('strong');h.textContent=item.name+' · '+new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(item.price);
  div.append(h);
  if(!item.references.length){
   const p=document.createElement('p');p.textContent='Sin PDF adjunto a este trabajo. El carrito comercial existente conserva su funcionamiento.';div.append(p);
  }
  for(const d of item.references){
   const r=d.reference,area=document.createElement('div'),name=document.createElement('p');
   name.textContent='Trabajo '+(d.itemIndex+1)+': '+r.nombre+' · '+r.paginas+' páginas (pendiente)';
   if(d.ploteo){
    const note=document.createElement('p');note.className='state';
    const meta=d.ploteo;
    note.textContent='Clasificación del navegador: '+meta.clasificacionCliente.filter(p=>p.modo==='cad').length+
     ' CAD, '+meta.clasificacionCliente.filter(p=>p.modo==='poster').length+
     ' Póster. PDF original listo para recepción protegida. Sin cobro.';
    area.append(name,note);
    const fmtMedida=p=>Number(p.anchoCm).toLocaleString('es-AR',{maximumFractionDigits:2})+
     ' × '+Number(p.altoCm).toLocaleString('es-AR',{maximumFractionDigits:2})+' cm';
    const paginasMedidas=Array.isArray(d.ploteoVerificado?.paginas)
     ?d.ploteoVerificado.paginas:meta.clasificacionCliente;
    if(Array.isArray(paginasMedidas)&&paginasMedidas.length){
     const detalle=document.createElement('div');detalle.className='state';
     const encabezado=document.createElement('p');
     encabezado.textContent=(d.ploteoVerificado?'Medidas verificadas':'Medidas detectadas (preliminares)')+
      ' · Clasificación por página:';
     detalle.append(encabezado);
     for(const p of paginasMedidas){
      const linea=document.createElement('p');
      linea.textContent='Página '+p.numero+': '+fmtMedida(p)+' · '+
       (p.modo==='cad'?'CAD':p.modo==='poster'?'Póster':'Revisión');
      detalle.append(linea);
     }
     area.append(detalle);
    }
    const msg=document.createElement('p');msg.className='state';
    if(d.confirmacion&&d.ploteoVerificado){
     msg.textContent='PDF verificado en Google · '+d.confirmacion.pages+
      ' páginas. Precio recalculado por servidor: '+
      new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0})
       .format(d.ploteoVerificado.totalArs)+
      '. Registro D1 del ploteo: PENDIENTE. Pago desactivado.';
     area.append(msg);div.append(area);continue;
    }
    const retry=document.createElement('button');retry.type='button';
    retry.textContent='Reintentar este PDF';retry.hidden=true;
    const sendPlot=async()=>{
     if(!d.archivoLocal||!d.sesionTemporal&&!window.turnstile?.getResponse()){
      msg.textContent='Completá la verificación de seguridad antes de enviar el PDF.';
      return false;
     }
     retry.disabled=true;
     try{
      const result=await subirYVincularPdfCotizadorV2({
       archivo:d.archivoLocal,referencia:r,orderId,modo:meta.modo,
       turnstileToken:window.turnstile?.getResponse()||'',
       origin:location.origin,sesionPrevia:d.sesionTemporal||null,
       onSession:session=>{d.sesionTemporal=session;},
       onRequestTiming:t=>medirSolicitudPdf(d,t),
       onProgress:p=>{marcarFasePdf(d,p);msg.textContent='Recepción protegida: '+p.phase+
        ' · '+p.completed+'/'+p.total;}
      });
      const session=d.sesionTemporal;
      if(!session)throw Error('Sesión de recepción no disponible.');
      const response=await fetch('/api/ensayo-cotizar-ploteo-verificado',{
       method:'POST',credentials:'same-origin',redirect:'error',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({
        sesion:{uploadId:session.uploadId,token:session.token},
        expectedOrderId:orderId,expectedMode:meta.modo,
        copias:meta.copias,papelPoster:meta.papelPoster,
        clasificacionCliente:meta.clasificacionCliente
       })
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.ok!==true||data?.receiptId!==result.receiptId||
         data?.sha256!==result.sha256||data?.orderId!==orderId||
         data?.quote?.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
         !Number.isSafeInteger(data.quote.totalArs)||data.quote.totalArs<1||
         data.quote.paginasOriginales!==result.pages||
         data.paymentAuthorized!==false||data.checkoutEnabled!==false)
       throw Error(data?.error||'El servidor no confirmó el ploteo.');
      d.confirmacion=result;d.ploteoVerificado=data.quote;d.ultimoErrorDeRecepcion='';
      d.sesionConfirmada=session;d.modoConfirmado=meta.modo;
      delete d.sesionTemporal;
      retry.hidden=true;updateSummary();
      msg.textContent='PDF recibido y ploteo cotizado por servidor: '+
       new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0})
        .format(data.quote.totalArs)+
       '. El pedido todavía no se registra en D1 ni habilita pago.';
      return true;
     }catch(error){
      d.ultimoErrorDeRecepcion=String(error.message||error);
      retry.hidden=false;retry.disabled=false;
      msg.textContent='El ploteo no fue confirmado: '+String(error.message||error)+
       '. Podés reintentar, sin reenviar las partes ya recibidas.';
      return false;
     }finally{window.turnstile?.reset()}
    };
    // Preparación segura del lote: datos del mismo PDF que sendPlot enviaría.
    d.batchInicio=()=>({
     meta:{orderId,fileId:fileIdParaReferencia(r),
      name:r.nombre,mode:meta.modo,bytes:r.bytes,sha256:r.sha256,
      partBytes:512*1024,parts:Math.ceil(r.bytes/(512*1024))},
     localRef:r.localRef,modo:meta.modo,opcionesKey:'null'
    });
    d.sendNow=sendPlot;
    retry.addEventListener('click',()=>{void sendPlot()});
    area.append(retry,msg);div.append(area);continue;
   }
   if(d.confirmacion && d.sesionConfirmada){
    name.textContent='Trabajo '+(d.itemIndex+1)+': '+r.nombre+' · '+d.confirmacion.pages+' páginas (PDF verificado)';
    const confirmed=document.createElement('p');
    confirmed.className='state';
    confirmed.textContent='✓ Verificado en Drive · recibo '+d.confirmacion.receiptId;
    area.append(name,confirmed);div.append(area);continue;
   }
   const file=document.createElement('input');file.type='file';file.accept='.pdf,application/pdf';
   if(d.archivoLocal instanceof File){
    const kept=document.createElement('p');kept.className='state';
    kept.textContent='Archivo asociado automáticamente.';
    area.append(kept);file.hidden=true;
   }
   const advanced=document.createElement('details');
   advanced.open=!d.opcionesInteligentes;
   const advancedTitle=document.createElement('summary');
   advancedTitle.textContent=d.opcionesInteligentes?'Revisar o corregir opciones de impresión':'Completar opciones de impresión';
   advanced.append(advancedTitle);
   const mode=document.createElement('select');
   for(const [value,label] of [['bn','Blanco y negro'],['color','Color']]){
    const o=document.createElement('option');o.value=value;o.textContent=label;mode.append(o);
   }
   const field=(title,entries)=>{
    const wrapper=document.createElement('label');wrapper.textContent=title;
    const select=document.createElement('select');
    for(const [v,t] of entries){const option=document.createElement('option');option.value=v;option.textContent=t;select.append(option)}
    wrapper.append(select);advanced.append(wrapper);return select;
   };
   const formato=field('Formato', [['a4','A4'],['a3','A3'],['a5','A5 original (tarifa A4)'],
     ['personalizado_a4','Tamaño original menor que A4 (tarifa A4)']]);
   const papel=field('Papel color', []);
   const updatePaper=async()=>{
    papel.replaceChildren();papel.disabled=true;
    try{
     const catalog=await catalogPromise;
     const materiales=catalog[formato.value==='a3'?'colorA3':'colorA4']?.materials||[];
     if(!materiales.length)throw Error('Materiales no disponibles');
     for(const m of materiales){
      const option=document.createElement('option');option.value=m.id;option.textContent=m.name;papel.append(option);
     }
     papel.disabled=false;
    }catch(_){msg.textContent='No fue posible obtener los papeles del catálogo. No se puede presupuestar.'}
   };
   formato.addEventListener('change',updatePaper);
   if(d.opcionesInteligentes?.formato)formato.value=d.opcionesInteligentes.formato;
   void updatePaper().then(()=>{
    if(d.opcionesInteligentes?.materialColor&&
       [...papel.options].some(o=>o.value===d.opcionesInteligentes.materialColor))
     papel.value=d.opcionesInteligentes.materialColor;
   });
   const caras=field('Caras', [['simple','Simple faz'],['double','Doble faz']]);
   const copias=field('Copias', Array.from({length:200},(_,i)=>[String(i+1),String(i+1)]));
   const anillado=field('Anillado', [
     ['ninguno','Sin anillado'],['individual','Anillado individual'],
     ...(TUS_ENABLED?[['grupo','Anillar varios PDF juntos']]:[])
    ]);
   const grupoAnillado=field('Grupo de anillado',Array.from({length:5},(_,i)=>[String(i+1),'Grupo '+(i+1)]));
   const mostrarGrupo=()=>{grupoAnillado.parentElement.hidden=anillado.value!=='grupo'};
   anillado.addEventListener('change',mostrarGrupo);
   const paginasPorHoja=field('Páginas por cara', [['1','1'],['2','2'],['4','4'],['9','9']]);
   if(d.opcionesInteligentes){
    mode.value=d.opcionesInteligentes.modo;
    caras.value=d.opcionesInteligentes.caras;
    copias.value=String(d.opcionesInteligentes.copias);
    anillado.value=d.opcionesInteligentes.anillado||'ninguno';
    grupoAnillado.value=String(d.opcionesInteligentes.grupoAnillado||'1');
    paginasPorHoja.value=String(d.opcionesInteligentes.paginasPorHoja??1);
   }
   const warningBinding=document.createElement('p');
   warningBinding.className='state';
   mostrarGrupo();
   warningBinding.textContent=TUS_ENABLED?'El grupo se verifica y cotiza una sola vez para todos sus PDF.':'Anillado conjunto no disponible en esta recepción.';
   advanced.append(warningBinding);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Reintentar solamente este PDF';
   btn.hidden=true;
   const msg=document.createElement('p');msg.className='state';
   const sendThis=async()=>{
    const chosen=d.archivoLocal||file.files?.[0],turnstileToken=window.turnstile?.getResponse();
    if(!chosen||(!d.sesionTemporal&&!turnstileToken)||!papel.value){msg.textContent='Seleccioná el PDF y completá la verificación de seguridad.';return false}
    btn.disabled=true;file.disabled=true;mode.disabled=true;
    for(const control of [formato,caras,copias,anillado,grupoAnillado,papel,paginasPorHoja])control.disabled=true;
    try{
     const result=await subirYVincularPdfCotizadorV2({
      archivo:chosen,referencia:r,orderId,modo:mode.value,turnstileToken,
      opciones:{formato:formato.value,caras:caras.value,copias:Number(copias.value),anillado:anillado.value,grupoAnillado:anillado.value==='grupo'?grupoAnillado.value:'',materialColor:papel.value,paginasPorHoja:Number(paginasPorHoja.value)},
      origin:location.origin,
      sesionPrevia:d.sesionTemporal||null,
      onSession:s=>{d.sesionTemporal=s;},
      onRequestTiming:t=>medirSolicitudPdf(d,t),
      onProgress:p=>{marcarFasePdf(d,p);msg.textContent=['transferencia','estado','reanudacion'].includes(p.phase)?'PDF: '+p.completed+' de '+p.total+' bloques confirmados':p.phase}
     });
     const quote=result.cotizacionServidor;
     const moneda=value=>new Intl.NumberFormat('es-AR',{style:'currency',
      currency:'ARS',maximumFractionDigits:0}).format(value);
     const comparable=item.references.length===1;
     const diferencia=quote&&comparable?quote.totalArs-item.price:null;
     const aviso=diferencia===null?'No es posible comparar: el trabajo incluye más de un PDF.'
      :Math.abs(diferencia)<0.01?'Importes numéricamente iguales; falta confirmar promociones, material y condiciones comerciales.'
      :'ATENCIÓN: diferencia orientativa frente al cotizador de '+moneda(diferencia)+
       '. Revisar promociones, materiales y opciones; el servidor todavía no confirmó el precio comercial final.';
     msg.textContent='PDF recibido y verificado · '+result.pages+' páginas · recibo '+result.receiptId+
      '. Presupuesto del servidor: '+(quote?moneda(quote.totalArs):'SIN CONFIRMAR')+
      '. '+aviso+' Pedido D1 y autorización de pago: PENDIENTES.';
     btn.textContent='PDF verificado';d.confirmacion=result;d.ultimoErrorDeRecepcion='';
     d.sesionConfirmada=d.sesionTemporal;
     d.modoConfirmado=mode.value;
     delete d.sesionTemporal;updateSummary();
     return true;
    }catch(e){
     d.ultimoErrorDeRecepcion=String(e.message||e);
     msg.textContent='No se confirmó la recepción: '+String(e.message||e)+
      (d.sesionTemporal?' Podés reintentar este PDF sin volver a enviar los bloques aceptados mientras permanezcas en esta página.':'');
     btn.disabled=false;file.disabled=false;mode.disabled=false;
     for(const control of [formato,caras,copias,anillado,grupoAnillado,papel,paginasPorHoja])control.disabled=false;
     return false;
    }finally{window.turnstile?.reset()}
   };
   // Las opciones se leen al iniciar el lote, no antes; si cambian tras
   // una sesión recibida, subirYVincularPdf las rechaza por opcionesKey.
   d.batchInicio=()=>{
    const elegido=d.archivoLocal||file.files?.[0];
    if(!papel.value||!elegido||elegido.name!==r.nombre||
       elegido.size!==r.bytes)
     throw Error('Falta el PDF original o el papel seleccionado.');
    d.archivoLocal=elegido;
    const opciones={formato:formato.value,caras:caras.value,
     copias:Number(copias.value),anillado:anillado.value,
     grupoAnillado:anillado.value==='grupo'?grupoAnillado.value:'',
     materialColor:papel.value,paginasPorHoja:Number(paginasPorHoja.value),
     paginasSeleccionadas:d.opcionesInteligentes?.paginasSeleccionadas||''};
    return {meta:{orderId,fileId:fileIdParaReferencia(r),
      name:r.nombre,mode:mode.value,bytes:r.bytes,sha256:r.sha256,
      partBytes:512*1024,parts:Math.ceil(r.bytes/(512*1024))},
     localRef:r.localRef,modo:mode.value,opcionesKey:JSON.stringify(opciones)};
   };
   d.sendNow=sendThis;
   btn.addEventListener('click',()=>{void sendThis()});
   const modeLabel=document.createElement('label');
   modeLabel.textContent='Modalidad de impresión';modeLabel.append(mode);
   advanced.prepend(modeLabel);
   if(d.opcionesInteligentes){
    const preview=document.createElement('p');preview.className='state';
    preview.textContent='Opciones recibidas: '+
     (d.opcionesInteligentes.modo==='color'?'Color':'B/N')+' · '+
     (d.opcionesInteligentes.formato==='personalizado_a4'?'Original menor que A4 (tarifa A4)':
       String(d.opcionesInteligentes.formato).toUpperCase())+' · '+
     (d.opcionesInteligentes.caras==='double'?'Doble faz':'Simple faz')+' · '+
     d.opcionesInteligentes.copias+' copia(s) · '+
     String(d.opcionesInteligentes.paginasPorHoja??1)+' por cara.';
    area.append(preview);
   }
   area.prepend(name,file);area.append(advanced,btn,msg);div.append(area);
  }
  list.append(div);
 }
}
// Una acción de usuario dirige el proceso completo, en serie para no duplicar
// transferencias. Cada archivo conserva su propia sesión y SHA verificada.
async function waitForTurnstile(){
 for(let n=0;n<120;n++){
  const token=window.turnstile?.getResponse?.();
  if(typeof token==='string'&&token.length>=10)return true;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 return false;
}
/**
 * Crea sesiones Drive de los PDF pendientes en tandas de hasta 10.
 * Un Turnstile por tanda, un HMAC de Worker a GAS y un recibo por archivo.
 * No se emiten partes ni se marca ningún documento como verificado aquí.
 */
async function prepararSesionesDeLote(pendientes){
 const nuevos=pendientes.filter(d=>!d.sesionTemporal);
 for(let inicio=0;inicio<nuevos.length;inicio+=10){
  const grupo=nuevos.slice(inicio,inicio+10);
  if(!(await waitForTurnstile()))
   throw Error('Completá la verificación de seguridad para iniciar la tanda.');
  const plans=grupo.map(d=>{
   if(typeof d.batchInicio!=='function')throw Error('El PDF no está listo para la recepción por lotes.');
   return d.batchInicio();
  });
  const token=window.turnstile?.getResponse?.();
  if(typeof token!=='string'||token.length<10)throw Error('Verificación de seguridad vencida.');
  let reply;
  try{
   const res=await fetch('/api/ensayo-pdf-iniciar-lote',{
    method:'POST',credentials:'same-origin',redirect:'error',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({turnstileToken:token,metas:plans.map(p=>p.meta)})
   });
   reply=await res.json().catch(()=>null);
   if(!res.ok||reply?.ok!==true||
      reply.paymentAuthorized!==false||
      !Array.isArray(reply.sessions)||reply.sessions.length!==grupo.length)
    throw Error(reply?.error||'Google no confirmó el inicio de toda la tanda.');
   const vistos=new Set();
   for(let i=0;i<grupo.length;i++){
    const ss=reply.sessions[i],plan=plans[i];
    if(!ss||ss.fileId!==plan.meta.fileId||
       ss.orderId!==orderId||
       !/^DOC-[a-f0-9-]{36}$/i.test(ss.uploadId||'')||
       typeof ss.token!=='string'||ss.token.length<16||
       typeof ss.newSession!=='boolean'||vistos.has(ss.uploadId))
      throw Error('La tanda devolvió sesiones incompatibles.');
    vistos.add(ss.uploadId);
   }
   // Publicación atómica: recién ahora las sesiones quedan ligadas a sus PDF.
   for(let i=0;i<grupo.length;i++){
    const plan=plans[i],ss=reply.sessions[i];
    grupo[i].sesionTemporal=Object.freeze({
     uploadId:ss.uploadId,token:ss.token,orderId,
     localRef:plan.localRef,sha256:plan.meta.sha256,
     modo:plan.modo,opcionesKey:plan.opcionesKey,
     batchFresh:ss.newSession===true
    });
   }
   marcarTiempo('lote_sesiones',{archivos:inicio+grupo.length});
   batchProgress.textContent='Sesiones protegidas listas: '+
    (inicio+grupo.length)+' de '+nuevos.length+' archivos nuevos.';
  }finally{
   // Turnstile sólo verifica el INICIO, nunca las partes ni la Central.
   window.turnstile?.reset?.();
  }
 }
}
async function prepararDesdeCotizador(){
 if(handoffInProgress)return false;
 handoffInProgress=true;updateSummary();
 batchProgress.textContent='Preparando archivos para el envío seguro…';
 let timeout;
 try{
  const result=await new Promise(resolve=>{
   handoffResolve=resolve;
   timeout=setTimeout(()=>resolve({ok:false,error:'El cotizador no confirmó los archivos.'}),20000);
   smart.contentWindow.postMessage({type:'SABER_SMART_PREPARAR_ENVIO'},location.origin);
  });
  if(!result.ok){
   batchProgress.textContent=result.error||'No se pudo preparar el envío.';
   return false;
  }
  if(universalPendiente&&UNIVERSAL_R2_UI_ENABLED)return true;
  if(r2PrepagoPendiente&&R2_PREPAY_UI_ENABLED)return true;
  for(let n=0;n<100;n++){
   const refs=all.flatMap(item=>item.references);
   if(refs.length===result.cantidad&&refs.every(d=>d.archivoLocal&&
      typeof d.sendNow==='function'))return true;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  batchProgress.textContent='No se pudieron asociar todos los PDF. Revisá la carga.';
  return false;
 }finally{clearTimeout(timeout);handoffResolve=null;handoffInProgress=false;updateSummary()}
}
/** Se conserva el análisis/UX del cotizador y sólo cambia la recepción.
 * Esta ruta está apagada salvo el flag seguro del Worker privado. */
async function enviarTUSDesdeCarrito(pendientes){
 if(!TUS_ENABLED)throw Error('Recepción TUS deshabilitada.');
 if(pendientes.length<1||pendientes.length>10)
  throw Error('Esta etapa privada admite hasta 10 PDF por pedido.');
 // Si el tarifario D1 cambió mientras el cliente configuraba los PDF,
 // lo informamos ANTES de subir archivos. No se acepta una revisión vieja.
 const preciosVistos=await catalogPromise;
 let expectedPriceVersion;
 if(typeof preciosVistos.priceVersion==='string'){
  const actual=await fetch('/prueba-v2/precios-web.json?revision='+Date.now(),{
   credentials:'same-origin',cache:'no-store'});
  if(!actual.ok)throw Error('No pudimos comprobar la tarifa actual. No se subieron archivos.');
  const vigente=await actual.json();
  if(vigente.priceVersion!==preciosVistos.priceVersion){
   const error=Error('La tarifa cambió mientras preparabas el pedido. Revisá el precio actualizado antes de enviarlo.');
   error.code='TARIFA_ANTES_DE_SUBIR';
   throw error;
  }
  expectedPriceVersion=preciosVistos.priceVersion;
 }
 const mod=await import('/prueba-v2/tus-directo.mjs');
 const trabajos=pendientes.map(d=>mod.normalizarTrabajoTUS(d,d.batchInicio()));
 batchProgress.textContent='Enviando PDF al almacenamiento privado…';
 marcarTiempo('tus_inicio',{archivos:trabajos.length});
 const resultado=await mod.enviarPedidoTUSV2({
  orderId,clientOrderId,trabajos,telefono:telefonoContacto.value.trim(),
  nombre:nombreCliente.value.trim(),direccion:direccionCliente.value.trim(),expectedPriceVersion,
  onProgress:p=>{
   if(p.phase==='transferencia')
    batchProgress.textContent='Recibiendo PDF: '+p.percent+'% · '+trabajos.length+' archivos.';
   else if(p.phase==='servidor')
    batchProgress.textContent='PDF recibidos. Validando páginas, precios y pedido en Central…';
   else if(p.phase==='registrado')
    batchProgress.textContent='Pedido verificado y registrado correctamente.';
   else batchProgress.textContent='Preparando recepción privada…';
   marcarTiempo('tus_'+p.phase,{archivos:trabajos.length});
  }
 });
 if(resultado.carritoDocumentalV2!==true||
    resultado.archivosVerificados!==trabajos.length||
    resultado.webOrderId!==orderId||resultado.paymentAuthorized!==false)
  throw Error('La Central no confirmó el pedido completo.');
 ultimoTotalServidor=resultado.totalArs;
 if(!/^\\d{3,}$/.test(resultado.numeroOrden||''))
  throw Error('La Central no confirmó el número de orden.');
 registeredOrder=resultado.orderId;
 registeredShortOrder=resultado.numeroOrden;
 const valor=new Intl.NumberFormat('es-AR',{
  style:'currency',currency:'ARS',maximumFractionDigits:0
 }).format(ultimoTotalServidor);
 document.getElementById('precio-smart').textContent='Orden N.º '+registeredShortOrder+' · Total: '+valor+(typeof SANDBOX_PAYMENT_ENABLED!=='undefined'&&SANDBOX_PAYMENT_ENABLED?' · Elegí cómo pagar (prueba)':' · Pago no disponible');
 mostrarEstadoCliente('registrado','Pedido recibido correctamente',
  trabajos.length+' PDF recibidos. Conservá el número de orden. '+(typeof SANDBOX_PAYMENT_ENABLED!=='undefined'&&SANDBOX_PAYMENT_ENABLED?'Elegí un medio de pago de prueba.':'Pago no disponible.'),registeredShortOrder);
 return resultado;
}
/** Recuperación idempotente en Central: ningún PDF se transfiere de nuevo. */
async function recuperarNumeroCentralTUS(){
 if(!TUS_ENABLED||registeredOrder)return false;
 try{
  const response=await fetch('/prueba-v2/api/ensayo-tus-recuperar',{
   method:'POST',credentials:'same-origin',redirect:'error',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({orderId,clientOrderId})
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true||data.webOrderId!==orderId||
     !/^\\d{3,}$/.test(data.numeroOrden||'')||
     !Number.isSafeInteger(data.totalArs)||data.totalArs<1||
     data.paymentAuthorized!==false||data.checkoutEnabled!==false||
     data.listoParaProducir!==false||typeof data.orderId!=='string')
   return false;
  registeredOrder=data.orderId;
  registeredShortOrder=data.numeroOrden;
  ultimoTotalServidor=data.totalArs;
  const monto=new Intl.NumberFormat('es-AR',{
   style:'currency',currency:'ARS',maximumFractionDigits:0
  }).format(data.totalArs);
  document.getElementById('precio-smart').textContent='Orden N.º '+
   data.numeroOrden+' · Total: '+monto+(typeof SANDBOX_PAYMENT_ENABLED!=='undefined'&&SANDBOX_PAYMENT_ENABLED?' · Elegí cómo pagar (prueba)':' · Pago no disponible');
  mostrarEstadoCliente('registrado','Pedido recibido correctamente',
   'Tu pedido está guardado; no necesitás volver a subir los archivos. '+(typeof SANDBOX_PAYMENT_ENABLED!=='undefined'&&SANDBOX_PAYMENT_ENABLED?'Elegí un medio de pago de prueba.':'Pago no disponible.'),
   data.numeroOrden);
  return true;
 }catch{return false;}
}
const r2Panel=document.getElementById('r2-prepago-panel');
const r2Mensaje=document.getElementById('r2-prepago-mensaje');
const r2Total=document.getElementById('r2-prepago-total');
const r2Pagar=document.getElementById('r2-prepago-pagar');
const r2Link=document.getElementById('r2-prepago-link');
const r2Retry=document.getElementById('r2-prepago-reintentar');
const r2Seguimiento=document.createElement('a');
r2Seguimiento.textContent='Consultar el seguimiento de mi ploteo';
r2Seguimiento.target='_blank';r2Seguimiento.rel='noopener noreferrer';
r2Seguimiento.hidden=true;
r2Seguimiento.style.cssText='display:none;margin:12px 0;font-weight:700;color:#175b8c';
r2Total?.insertAdjacentElement('afterend',r2Seguimiento);
function actualizarSeguimientoR2(){
 const u=r2PrepagoFlujo?.seguimientoUrl;
 if(!u)return;
 r2Seguimiento.href=u;r2Seguimiento.hidden=false;
 r2Seguimiento.style.display='inline-block';
}
const r2Recuperacion=document.getElementById('r2-prepago-recuperacion');
const r2RecuperarFile=document.getElementById('r2-prepago-recuperar-file');
function guardarRecuperacionR2(){
 const f=r2PrepagoPendiente?.file,a=r2PrepagoPendiente?.archivos?.[0];
 if(!f||!a||!Array.isArray(a.paginas)||!r2PrepagoFlujo?.sha256||
    !r2PrepagoFlujo?.commercialOrderId)return false;
 const v={schema:'saber-r2-recuperacion-v1',savedAt:Date.now(),
  webOrderId:r2PrepagoFlujo.webOrderId,commercialOrderId:r2PrepagoFlujo.commercialOrderId,
  amountArs:r2PrepagoFlujo.amountArs,sha256:r2PrepagoFlujo.sha256,
  name:f.name,bytes:f.size,pages:a.paginas.length,modo:a.modo};
 try{localStorage.setItem(R2_RECOVERY_KEY,JSON.stringify(v));return true}
 catch{return false}
}
if(r2Recuperable){
 r2Recuperacion.hidden=false;r2Panel.hidden=false;
 r2Mensaje.textContent='Tenés un pedido anterior con pago de prueba iniciado. Elegí el mismo PDF para verificar el pago y continuar, sin volver a pagar.';
 r2Total.textContent='Pedido anterior · '+new Intl.NumberFormat('es-AR',{
  style:'currency',currency:'ARS',maximumFractionDigits:0}).format(r2Recuperable.amountArs);
}
r2RecuperarFile?.addEventListener('change',async()=>{
 const file=r2RecuperarFile.files?.[0];
 if(!file||!r2Recuperable||r2Subiendo||r2Consultando)return;
 if(file.name!==r2Recuperable.name||file.size!==r2Recuperable.bytes){
  r2Informar('El archivo no coincide en nombre o tamaño. No se envió ningún archivo.');return;
 }
 r2RecuperarFile.disabled=true;
 try{
  const mod=await import('/prueba-v2/r2-prepago-flujo.mjs');
  const flow=mod.crearFlujoR2PagoAntesDeCarga({
   file,webOrderId:r2Recuperable.webOrderId,
   archivos:[{servicio:'auto',modo:r2Recuperable.modo,
    paginas:Array(r2Recuperable.pages).fill(null)}],
   restaurarPago:{commercialOrderId:r2Recuperable.commercialOrderId,
    amountArs:r2Recuperable.amountArs,sha256:r2Recuperable.sha256},
   onProgress:p=>{
    if(Number.isFinite(p.porcentaje))
     r2Informar('Comparando PDF local sin subir: '+p.porcentaje+' %.');
    else if(Number.isFinite(p.percent))
     r2Informar('Subiendo PDF pagado: '+p.percent+' %.');
   }
  });
  r2Informar('Verificando por SHA-256 que es el mismo PDF (sin enviarlo)…');
  await flow.validarRestauracion();
  r2PrepagoFlujo=flow;r2Recuperacion.hidden=true;
  await r2ConsultarPagoYContinuar();
  if(r2PrepagoFlujo?.phase==='esperando_pago'&&r2PagoTimer===null)
   r2PagoTimer=setInterval(()=>{
    if(document.visibilityState!=='hidden')void r2ConsultarPagoYContinuar();
   },25000);
 }catch(e){
  r2Informar('Recuperación pendiente: '+String(e?.message||e).slice(0,140)+
   '. No vuelvas a pagar. Si venció la sesión, contactá a Librería Saber con el comprobante.');
 }finally{r2RecuperarFile.disabled=false}
});
function r2Informar(texto){
 r2Panel.hidden=false;
 r2Mensaje.textContent=texto;
 batchProgress.textContent=texto;
}
function r2DetenerConsultas(){
 if(r2PagoTimer!==null){clearInterval(r2PagoTimer);r2PagoTimer=null;}
}
async function r2SubirSoloDespuesPago(){
 if(r2Subiendo||!r2PrepagoFlujo||
    r2PrepagoFlujo.phase!=='pagado_esperando_subida')return;
 r2Subiendo=true;r2DetenerConsultas();
 r2Pagar.hidden=true;r2Link.hidden=true;r2Retry.hidden=true;
 r2Informar('Pago sandbox confirmado por Central. Ahora sí, recibiendo el PDF en R2…');
 try{
  const result=await r2PrepagoFlujo.subirDespuesDePagar();
  if(result?.sha256Verificado!==true)throw Error('Falta verificar la integridad del PDF');
  borrarRecuperacionR2();
  r2Informar('PDF recibido y SHA-256 verificado. El original está pendiente de revisión de medidas, tipo CAD/Póster y orden de producción. Conservá el archivo y la referencia de pago.');
  r2Total.textContent='Importe abonado en ensayo: '+
   new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',
    maximumFractionDigits:0}).format(r2PrepagoFlujo.amountArs);
 }catch(error){
  const code=String(error?.message||error);
  if(code.includes('R2_CARGA_ANTERIOR_REQUIERE_REVISION')){
   r2Informar('Detectamos una transferencia anterior que no terminó. Tu pago no se repite. No vuelvas a subir el PDF: contactá a Librería Saber con la referencia de este pedido para revisar la recepción.');
   r2Retry.hidden=true;
  }else if(code.includes('R2_CENTRAL_PENDIENTE')){
   r2Informar('El PDF ya se recibió pero la Central aún no confirmó el registro. No vuelvas a pagar ni a subir el archivo. Podés volver a comprobar la recepción.');
   r2Retry.hidden=false;
  }else{
   r2Informar('No se pudo confirmar todavía la recepción. No vuelvas a pagar. Podés reintentar con el mismo PDF. Si persiste, consultá con la referencia del pedido.');
   r2Retry.hidden=false;
  }
 }finally{r2Subiendo=false}
}
async function r2ConsultarPagoYContinuar(){
 if(r2Consultando||r2Subiendo||!r2PrepagoFlujo||
    !['esperando_pago','pagado_esperando_subida','revocado'].includes(r2PrepagoFlujo.phase))return;
 r2Consultando=true;
 try{
  const estado=await r2PrepagoFlujo.consultarPago();
  if(estado==='pagado'){
   actualizarSeguimientoR2();
   r2Informar('Pago sandbox confirmado en Central. Habilitando el envío del PDF.');
   await r2SubirSoloDespuesPago();
  }else if(estado==='revocado'){
   r2Seguimiento.hidden=true;r2Seguimiento.style.display='none';
   r2DetenerConsultas();r2Pagar.hidden=true;r2Link.hidden=true;
   borrarRecuperacionR2();
   r2Informar('El pago fue revocado. No se permite almacenar ni imprimir este archivo.');
  }else{
   r2Informar('Esperando la confirmación de Mercado Pago. El PDF sigue en este dispositivo; no se cargó a R2.');
  }
 }catch(error){
  r2Informar('El pago todavía no puede comprobarse: '+
   String(error?.message||error).slice(0,140)+'. R2 permanece bloqueado.');
 }finally{r2Consultando=false}
}
r2Pagar?.addEventListener?.('click',async()=>{
 if(universalFlujo){
  if(universalFlujo.phase!=='presupuesto_sin_archivos')return;
  r2Pagar.disabled=true;
  try{
   const url=await universalFlujo.iniciarPagoSandbox();
   r2Link.href=url;r2Link.hidden=false;r2Pagar.hidden=true;
   r2Link.textContent='Abrir Mercado Pago de prueba';
   r2Informar('Enlace de pago de prueba creado. Los PDF siguen en tu dispositivo. Una sola orden, un solo pago.');
   if(universalPagoTimer===null)universalPagoTimer=setInterval(()=>{
    if(document.visibilityState==='visible')void universalConsultarPago();
   },25000);
   void universalConsultarPago();
  }catch(e){
   r2Pagar.disabled=false;
   r2Informar('Pago no iniciado: '+String(e?.message||e).slice(0,150));
  }
  return;
 }

 if(!r2PrepagoFlujo||r2PrepagoFlujo.phase!=='presupuesto_sin_archivo')return;
 r2Pagar.disabled=true;
 r2Informar('Preparando el enlace seguro de Mercado Pago (solamente cuenta de prueba)…');
 try{
  const url=await r2PrepagoFlujo.iniciarPagoSandbox();
  const recuperacionGuardada=guardarRecuperacionR2();
  r2Link.href=url;r2Link.hidden=false;
  r2Pagar.hidden=true;
  r2Link.textContent='Abrir Mercado Pago de prueba';
  r2Informar('El enlace está preparado. Abrí Mercado Pago de prueba y volvé a esta pestaña. El PDF permanece local.'+
   (recuperacionGuardada?' Podés volver a seleccionar el mismo PDF si se cierra la pestaña.':
    ' Este navegador no permite guardar la recuperación; conservá la pestaña abierta.'));
  if(r2PagoTimer===null)r2PagoTimer=setInterval(()=>{
   if(document.visibilityState!=='hidden')void r2ConsultarPagoYContinuar();
  },25000);
  void r2ConsultarPagoYContinuar();
 }catch(error){
  r2Pagar.disabled=false;
  r2Informar('No se pudo preparar el pago de prueba: '+String(error?.message||error).slice(0,180));
 }
});
r2Retry?.addEventListener?.('click',async()=>{
 if(universalFlujo){
  try{
   const state=await universalFlujo.consultarPago();
   if(state==='pagado')await universalSubirPagados();
   else r2Informar('El pago no está confirmado. Conservá el comprobante; no vuelvas a pagar.');
  }catch(e){
   r2Informar('No pudimos verificar los archivos pagados: '+
    String(e?.message||e).slice(0,140)+'. No vuelvas a pagar.');
  }
  return;
 }

 if(r2PrepagoFlujo?.phase==='pagado_esperando_subida')
  await r2SubirSoloDespuesPago();
});
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&r2PagoTimer!==null)
  void r2ConsultarPagoYContinuar();
 if(document.visibilityState==='visible'&&universalPagoTimer!==null)
  void universalConsultarPago();
});
async function universalSubirPagados(){
 if(universalSubiendo||!universalFlujo||
    !['pagado_esperando_archivos','subida_parcial'].includes(universalFlujo.phase))return;
 universalSubiendo=true;
 r2Retry.hidden=true;r2Pagar.hidden=true;r2Link.hidden=true;
 r2Informar('Pago verificado. Recibiendo y comprobando tus PDF; los grandes van a R2 y los chicos a TUS.');
 try{
  const received=await universalFlujo.subirArchivosPagados();
  if(received.ok!==true||received.productionAuthorized!==false)
   throw Error('Recepción del pedido sin confirmar');
  r2Informar('Recibimos los '+received.fileCount+
   ' PDF de la orden '+received.numeroOrden+'. Están pendientes de preprensa y preparación. No vuelvas a pagar.');
  document.getElementById('precio-smart').textContent='Orden N.º '+
   received.numeroOrden+' · PDF recibidos · Preprensa pendiente';
  r2Retry.hidden=true;
 }catch(e){
  r2Informar('Tu pago no se repite. Hay archivos pendientes de confirmar: '+
   String(e?.message||e).slice(0,150)+
   '. Si ya se transmitieron y falló la confirmación, consultá a Librería Saber antes de reenviar.');
  r2Retry.hidden=false;
 }finally{universalSubiendo=false}
}
async function universalConsultarPago(){
 if(universalConsultando||universalSubiendo||!universalFlujo||
    !['esperando_pago','pagado_esperando_archivos','subida_parcial','revocado'].includes(universalFlujo.phase))return;
 universalConsultando=true;
 try{
  const current=await universalFlujo.consultarPago();
  if(current==='pagado'){
   if(universalPagoTimer!==null){clearInterval(universalPagoTimer);universalPagoTimer=null;}
   r2Informar('Pago de prueba verificado para toda la orden. No vuelvas a pagar.');
   universalConsultando=false;
   await universalSubirPagados();
   return;
  }
  if(current==='revocado'){
   if(universalPagoTimer!==null){clearInterval(universalPagoTimer);universalPagoTimer=null;}
   r2Informar('El pago fue revocado. No podemos recibir los PDF.');
  }else r2Informar('Esperando confirmación de Mercado Pago. Ningún PDF fue almacenado antes del pago.');
 }catch(e){
  r2Informar('No pudimos comprobar el pago: '+String(e?.message||e).slice(0,140)+
   '. Conservá el comprobante. No vuelvas a pagar.');
 }finally{universalConsultando=false}
}
async function prepararPedidoUniversal(){
 if(!UNIVERSAL_R2_UI_ENABLED||!universalPendiente||universalFlujo)
  throw Error('El pedido universal no está disponible.');
 const mod=await import('/prueba-v2/flujo-universal.mjs');
 universalFlujo=mod.crearFlujoUniversalPDF({
  files:universalPendiente.files,archivos:universalPendiente.archivos,
  webOrderId:orderId,telefono:telefonoContacto.value.trim(),
  nombre:nombreCliente.value.trim(),direccion:direccionCliente.value.trim(),
  onProgress:p=>{
   if(p.phase==='hash')
    r2Informar('Identificando PDF '+p.index+' de '+p.count+
     ' en tu dispositivo: '+(p.porcentaje??0)+' %. Sin subirlo.');
   else if(Number.isFinite(p.percent))
    r2Informar('Recibiendo PDF pagados: '+p.percent+' %.');
   else if(p.phase==='verificacion')
    r2Informar('Verificando integridad y medidas de los PDF recibidos…');
  }
 });
 r2Panel.querySelector('h2').textContent='Impresiones y ploteos · Un solo pago';
 r2Recuperacion.hidden=true;r2Panel.hidden=false;
 r2Pagar.hidden=true;r2Link.hidden=true;r2Retry.hidden=true;
 r2Informar('Cotizando todos los archivos en la Central. Todavía no se subió ningún original.');
 const result=await universalFlujo.preparar();
 r2Total.textContent='Orden N.º '+result.numeroOrden+' · Total: '+
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',
   maximumFractionDigits:0}).format(result.totalArs);
 document.getElementById('precio-smart').textContent=r2Total.textContent+
  ' · Archivos locales, sin subir';
 r2Pagar.hidden=false;r2Pagar.disabled=false;
 r2Informar(result.fileCount+' PDF cotizados. Un pago de prueba para toda la orden; después se reciben los archivos.');
}
async function prepararPedidoR2Grande(){
 if(!R2_PREPAY_UI_ENABLED||!r2PrepagoPendiente||r2PrepagoFlujo)
  throw Error('Este ploteo ya fue preparado o el circuito privado está apagado.');
 const mod=await import('/prueba-v2/r2-prepago-flujo.mjs');
 const data=r2PrepagoPendiente;
 r2PrepagoFlujo=mod.crearFlujoR2PagoAntesDeCarga({
  file:data.file,archivos:data.archivos,webOrderId:orderId,
  nombre:nombreCliente.value.trim(),telefono:telefonoContacto.value.trim(),direccion:direccionCliente.value.trim(),
  onState:s=>{
   if(s.phase==='calculando_hash_local')
    r2Informar('Identificando el PDF en este dispositivo, sin subirlo a R2…');
   if(s.phase==='registrando_presupuesto')
    r2Informar('Registrando presupuesto en Central, sin archivo y sin cobro…');
  },
  onProgress:p=>{
   if(Number.isFinite(p.porcentaje))
    r2Informar('Identificando PDF local: '+p.porcentaje+' %. Cero carga a R2.');
   else if(Number.isFinite(p.percent))
    r2Informar('PDF pagado: subiendo a R2 '+p.percent+' %.');
  }
 });
 r2Informar('Preparando presupuesto sin recibir archivos…');
 const draft=await r2PrepagoFlujo.preparar();
 r2Total.textContent='Total presupuestado por servidor: '+
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',
   maximumFractionDigits:0}).format(draft.amountArs);
 r2Pagar.hidden=false;r2Pagar.disabled=false;
 r2Informar('Presupuesto registrado. Ningún archivo fue enviado. Si aceptás el precio, continuá al pago de prueba; después podrás subir el PDF.');
 document.getElementById('precio-smart').textContent='Ploteo grande · Importe del servidor: '+
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',
   maximumFractionDigits:0}).format(draft.amountArs)+' · PDF sin subir';
}
sendAllButton.addEventListener('click',async()=>{
 if(batchSending||registering||handoffInProgress||registeredOrder)return;
 if(TUS_ENABLED&&!tusPreflightOK)await verificarDisponibilidadTUS();
 const razon=motivoBloqueoEnvio();
 if(razon){
  batchProgress.textContent='El pedido todavía no se puede enviar: '+razon;
  batchProgress.classList.add('error-recepcion');
  sendAllButton.focus();
  return;
 }
 batchProgress.classList.remove('error-recepcion');
 if(!nombreValido()){
  nombreCliente.focus();
  batchProgress.textContent='Completá el nombre para enviar el pedido.';
  return;
 }
 if(direccionValida()===null){
  direccionCliente.focus();
  batchProgress.textContent='Corregí la dirección de contacto.';
  return;
 }
 if(!telefonoValido()){
  telefonoContacto.focus();
  batchProgress.textContent='Completá el teléfono para enviar el pedido.';
  return;
 }
 iniciarMedicion();
 // No mezclar PDF nuevo con referencias restauradas sin su File original.
 if(descartarBorradorAnteriorParaPedidoNuevo())
  batchProgress.textContent='Pedido nuevo preparado; el borrador anterior no se mezclará.';
 if(all.flatMap(item=>item.references).length===0){
  if(!smartReady){batchProgress.textContent=smartBlockedReason||'El presupuesto no está listo para enviar.';terminarMedicion('presupuesto_incompleto');return;}
  marcarTiempo('preparacion_inicio');
  if(!(await prepararDesdeCotizador())){terminarMedicion('preparacion_fallida');return;}
  marcarTiempo('preparacion_terminada');
 }
 if(universalPendiente){
  batchSending=true;updateSummary();
  try{
   await prepararPedidoUniversal();
   terminarMedicion('universal_presupuesto_sin_archivos');
  }catch(e){
   batchProgress.textContent='Pedido pendiente de cotización: '+
    String(e?.message||e).slice(0,170)+'. No se cobró ni subió ningún PDF.';
   terminarMedicion('universal_cotizacion_pendiente');
  }finally{batchSending=false;updateSummary()}
  return;
 }
 if(r2PrepagoPendiente){
  batchSending=true;updateSummary();
  try{
   await prepararPedidoR2Grande();
   terminarMedicion('r2_presupuesto_sin_archivo');
  }catch(error){
   batchProgress.textContent='No se registró el presupuesto del ploteo grande: '+
    String(error?.message||error).slice(0,180)+'. R2 no recibió archivos.';
   terminarMedicion('r2_presupuesto_fallido');
  }finally{batchSending=false;updateSummary();}
  return;
 }
 const allEntries=all.flatMap(item=>item.references);
 const pending=allEntries.filter(d=>!d.confirmacion);
 for(const d of pending)d.ultimoErrorDeRecepcion='';
 if(!allEntries.length||allEntries.length>MAX_PDF_PRIVADOS||
    all.some(item=>!item.references.length)||
    pending.some(d=>!d.archivoLocal||typeof d.sendNow!=='function')){
  batchProgress.textContent='Faltan archivos o trabajos por completar antes del envío.';
  terminarMedicion('trabajos_incompletos');
  return;
 }
 if(TUS_ENABLED){
  batchSending=true;updateSummary();
  mostrarEstadoCliente('enviando','Estamos recibiendo tus PDF',
   'Envío privado y verificación automática; no cierres la pestaña.');
  try{
   await enviarTUSDesdeCarrito(pending);
   terminarMedicion('tus_pedido_registrado');
  }catch(error){
   if(error?.code==='TARIFA_ANTES_DE_SUBIR'){
    batchProgress.textContent=error.message+' No se subieron archivos.';
    mostrarEstadoCliente(null);
    terminarMedicion('tarifa_cambiada_antes_subida');
   }else if(error?.code==='TARIFA_MODIFICADA'){
    batchProgress.textContent=error.message+' Los archivos enviados permanecen privados. Es necesario actualizar la cotización antes de registrar el pedido.';
    mostrarEstadoCliente(null);
    terminarMedicion('tarifa_cambiada_durante_subida');
   }else if(await recuperarNumeroCentralTUS()){
    terminarMedicion('tus_pedido_recuperado_sin_subida');
   }else{
    batchProgress.textContent='Pedido pendiente de conciliación: '+
     String(error?.message||error)+'. Conservamos los PDF privados.';
    mostrarEstadoCliente(null);
    terminarMedicion('tus_pedido_pendiente');
   }
  }finally{batchSending=false;updateSummary();}
  return;
 }
 batchSending=true;updateSummary();
 mostrarEstadoCliente('enviando','Estamos recibiendo tus archivos','Se verificarán los PDF y registraremos el pedido automáticamente. No cierres esta pestaña.');
 let received=0,success=true;
 try{
  if(pending.length>1){
   try{
    marcarTiempo('lote_inicio',{archivos:pending.length});
    await prepararSesionesDeLote(pending);
    marcarTiempo('lote_transferencia_inicio',{archivos:pending.length});
    const outcome=await ejecutarRecepcionParalela(pending,
     async(d,index)=>{
      marcarTiempo('pdf_inicio',{pdf:index+1});
      batchProgress.textContent='Recibiendo y comprobando hasta 2 PDF simultáneos · '+
       received+' de '+pending.length+' confirmados.';
      return d.sendNow();
     },(d,index)=>{
      marcarTiempo('pdf_confirmado',{pdf:index+1});
      received++;
      batchProgress.textContent='PDF verificados: '+received+' de '+pending.length+
       '. Preparando un solo pedido.';
      updateSummary();
     },2);
    if(!outcome.completo){
     success=false;
     const errorPdf=pending.find(d=>d.ultimoErrorDeRecepcion);
     batchProgress.textContent='Se detuvo la tanda en '+received+' de '+pending.length+
      ' archivos. Los ya verificados quedan conservados para reintentar sin duplicarlos.'+
      (errorPdf?' Causa: '+errorPdf.ultimoErrorDeRecepcion:'');
    }
   }catch(error){
    success=false;
    batchProgress.textContent='No se pudo completar el inicio de la tanda: '+
     String(error.message||error)+'. Las sesiones ya creadas pueden recuperarse.';
   }
  }else{
   // Un solo PDF mantiene su circuito medido y ya probado.
   for(const d of pending){
    marcarTiempo('pdf_inicio',{pdf:received+1});
    batchProgress.textContent='Recibiendo y verificando el PDF…';
    if(!d.sesionTemporal&&!(await waitForTurnstile())){
     batchProgress.textContent='Completá la verificación de seguridad y pulsá «Enviar mi pedido» otra vez.';
     success=false;break;
    }
    if(!(await d.sendNow())){
     batchProgress.textContent='Se detuvo la carga; podés reintentar sin duplicar el PDF.'+
      (d.ultimoErrorDeRecepcion?' Causa: '+d.ultimoErrorDeRecepcion:'');
     success=false;break;
    }
    marcarTiempo('pdf_confirmado',{pdf:1});
    received++;
   }
  }
 }finally{
  batchSending=false;
  updateSummary();
 }
 if(!success){
  mostrarEstadoCliente(null);
  terminarMedicion('envio_incompleto');return;
 }
 if(allEntries.some(d=>!d.confirmacion)){
  batchProgress.textContent='Hay PDF pendientes de verificar. Se detuvo el registro.';
  mostrarEstadoCliente(null);
  terminarMedicion('verificacion_incompleta');
  return;
 }
 batchProgress.textContent='Todos los PDF verificados. Registrando el pedido en la Central…';
 marcarTiempo('central_inicio');
 await registrarPedidoVerificado();
 marcarTiempo('central_fin');
 if(registeredOrder){
  batchProgress.textContent='Pedido enviado y registrado correctamente. Sin cobros.';
  if(Number.isSafeInteger(ultimoTotalServidor))
   document.getElementById('precio-smart').textContent='Total verificado: '+
    new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(ultimoTotalServidor)+
    ' · Sin cobro autorizado';
  mostrarEstadoCliente('registrado','Pedido recibido correctamente',
   allEntries.length+' PDF verificados y registrados. Conservá este número. Pago desactivado en esta prueba.',registeredShortOrder);
 }else{
  batchProgress.textContent='PDF recibidos; el registro quedó pendiente. Pulsá «Enviar mi pedido» para reintentar sin subir los PDF.';
  mostrarEstadoCliente(null);
 }
 terminarMedicion(registeredOrder?'pedido_registrado':'registro_pendiente');
});
if(previous?.items.length){
 status.textContent='Carrito recuperado: '+previous.seen.size+' referencia(s) de PDF pendiente(s) de nueva verificación. Volvé a seleccionar cada PDF: las fotos y archivos nunca se guardan en el navegador. Ningún pago ni pedido quedó confirmado. Pedido de prueba: '+orderId;
 render();
}
updateSummary();
async function registrarPedidoVerificado(){
 if(registering||registeredOrder)return;
 const entries=all.flatMap(item=>item.references);
 if(!entries.length||entries.length>30||all.some(item=>!item.references.length)||
    entries.some(d=>!d.confirmacion||!d.sesionConfirmada||
      !['bn','color'].includes(d.modoConfirmado)||
      (d.ploteo?d.ploteoVerificado?.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO':
       !['ninguno','individual'].includes(d.confirmacion.cotizacionServidor?.anillado)))){
  registerStatus.textContent='Solo PDF verificados: anillado individual admitido; grupos pendientes de integración.';
  return;
 }
 registering=true;updateSummary();
 try{
  const manifiesto=prepararManifiestoDocumentalV2({
   orderId,trabajos:entries.map(d=>({
    vinculo:d.confirmacion,
    ...(d.ploteo?{ploteoVerificado:d.ploteoVerificado}:{})
   }))
  });
  const sesiones=entries.map(d=>{
   const q=d.ploteoVerificado||d.confirmacion.cotizacionServidor;
   const plot=d.ploteo;
   return {sesion:{uploadId:d.sesionConfirmada.uploadId,token:d.sesionConfirmada.token},
    ...(d.confirmacion?.comprobanteServidor?{comprobanteServidor:d.confirmacion.comprobanteServidor}:{}),
    opciones:{servicio:'auto',seleccion:plot?'original':q.formato,paginasSeleccionadas:'',
     copias:q.copias,modo:d.modoConfirmado,caras:plot?'simple':q.caras,
     paginasPorHoja:plot?1:(q.paginasPorHoja??1),
     papelPoster:plot?q.papelPoster:'obra80',anillado:plot?'ninguno':q.anillado,grupoAnillado:'',
     materialColor:plot?'':q.materialColor,productoFoto:'',productoGrafica:'',
     corteVariante:'gt3',corteMetros:1,
     ...(plot?{clasificacionCliente:plot.clasificacionCliente}:{})}};
  });
  const response=await fetch('/api/ensayo-preparar-documentos-v2-lote',{
   method:'POST',credentials:'same-origin',redirect:'error',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({clientOrderId,items:[],manifiesto,sesiones})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true||result.carritoDocumentalV2!==true||
     result.webOrderId!==orderId||typeof result.orderId!=='string'||
     result.archivosVerificados!==entries.length||
     !Number.isSafeInteger(result.totalArs)||result.totalArs<1||
     result.checkoutEnabled!==false||result.paymentAuthorized!==false||
     result.listoParaProducir!==false)
   throw Error(result?.error||'La Central no confirmó este pedido.');
  registeredOrder=result.orderId;
  ultimoTotalServidor=result.totalArs;
  // El recibo de cliente no lleva sesiones ni tokens de Google.
  registerStatus.textContent='Pedido de ensayo registrado y comprobado: '+registeredOrder+
   '. '+entries.length+' PDF; total verificado por servidor: '+
   new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(result.totalArs)+
   '. Pago y producción: DESACTIVADOS.';
  for(const d of entries)delete d.sesionConfirmada;
 }catch(error){
  registerStatus.textContent='Pedido NO confirmado: '+String(error.message||error)+
   '. No se autorizó ningún cobro.';
 }finally{registering=false;updateSummary();}
}
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin)return;
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_UNIVERSAL_PDF'){
  const p=event.data;
  if(!UNIVERSAL_R2_UI_ENABLED||batchSending||registering||registeredOrder||
     universalPendiente||universalFlujo||!Array.isArray(p.files)||
     !Array.isArray(p.archivos)||p.files.length<1||p.files.length>10||
     p.files.length!==p.archivos.length||
     !p.files.some(f=>f instanceof File&&f.size>40*1024*1024)||
     p.files.some((f,i)=>!(f instanceof File)||
      f.name!==p.archivos[i]?.nombre||f.size<5||
      f.size>200*1024*1024||!/\.pdf$/i.test(f.name))){
   batchProgress.textContent='Revisá los archivos del pedido; todavía no se recibió ni cobró nada.';
   return;
  }
  universalPendiente={files:p.files,archivos:p.archivos};
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_R2_PREPAGO'){
  const p=event.data;
  if(!R2_PREPAY_UI_ENABLED||batchSending||registering||registeredOrder||
     r2PrepagoFlujo||r2PrepagoPendiente||
     !(p.file instanceof File)||p.file.size<=40*1024*1024||
     p.file.size>200*1024*1024||
     !Array.isArray(p.archivos)||p.archivos.length!==1||
     p.archivos[0]?.servicio!=='auto'||
     !Array.isArray(p.archivos[0]?.paginas)||
     !Number.isSafeInteger(p.totalOrientativo)||p.totalOrientativo<1){
   batchProgress.textContent='El ploteo grande no cumple las condiciones de este ensayo.';return;
  }
  r2PrepagoPendiente={file:p.file,archivos:p.archivos,
   totalOrientativo:p.totalOrientativo};
  return;
 }

 if(event.source===smart.contentWindow&&event.data?.type==='SABER_FASE1_PLOTEO_PRELIMINAR'){
  const p=event.data;
  const paginas=p.clasificacionCliente;
  if(typeof p.nombre!=='string'||p.nombre.length>120||
     !Number.isSafeInteger(p.copias)||p.copias<1||p.copias>200||
     !['obra80','recubierto'].includes(p.papelPoster)||
     !Array.isArray(paginas)||paginas.length<1||paginas.length>2000||
     paginas.some((q,i)=>!q||q.numero!==i+1||
      !['cad','poster'].includes(q.modo)||
      !Number.isFinite(q.anchoCm)||!Number.isFinite(q.altoCm)||
      q.anchoCm<=0||q.altoCm<=0||q.anchoCm>2000||q.altoCm>2000)){
   batchStatus.textContent='La clasificación preliminar del ploteo no es válida.';
   return;
  }
  if(!(p.file instanceof File)||p.file.name!==p.nombre||
     p.file.size<5||p.file.size>40*1024*1024||
     !/\.pdf$/i.test(p.nombre)||!['bn','color'].includes(p.modo)||
     !Number.isSafeInteger(p.precioPreliminar)||p.precioPreliminar<1||
     batchSending||registering||registeredOrder||
     all.flatMap(item=>item.references).length>=30){
   batchStatus.textContent='El archivo de ploteo no cumple las condiciones del ensayo privado.';
   return;
  }
  try{
   const header=new Uint8Array(await p.file.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...header)!=='%PDF-')throw Error('Cabecera PDF inválida.');
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
     await p.file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
   const localRef=crypto.randomUUID();
   if(used.has(localRef))throw Error('Referencia repetida.');
   used.add(localRef);
   all.push({name:'Ploteo · '+p.nombre,price:p.precioPreliminar,
    references:[{itemIndex:0,archivoLocal:p.file,
     ploteo:{modo:p.modo,copias:p.copias,papelPoster:p.papelPoster,
      clasificacionCliente:paginas},
     reference:{schema:'saber-pdf-local-pendiente-v1',localRef,
      nombre:p.nombre,bytes:p.file.size,paginas:paginas.length,sha256:sha,
      estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false}}]});
   save();render();updateSummary();
   // Los detalles técnicos quedan cerrados.
  }catch(error){
   batchStatus.textContent='Ploteo sin preparar: '+String(error.message||error);return;
  }
  const cad=paginas.filter(x=>x.modo==='cad').length;
  const poster=paginas.length-cad;
  batchStatus.textContent='Ploteo analizado: '+p.nombre+' · '+cad+
   ' página(s) CAD y '+poster+' Póster. PDF preparado en memoria para la recepción privada. '+
   'Cuando estés listo, pulsá «Enviar mi pedido»; el registro será automático.';
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_HANDOFF_READY'){
  if(handoffResolve){handoffResolve({ok:true,cantidad:event.data.cantidad});handoffResolve=null;}
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_HANDOFF_ERROR'){
  if(handoffResolve){handoffResolve({ok:false,error:event.data.message});handoffResolve=null;}
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_PRICE_STATE'){
  const status=event.data.estado;
  if(status==='calculando'&&analisisIniciado===null)analisisIniciado=performance.now();
  else if(status==='listo'&&analisisIniciado!==null){ultimoAnalisisMs=Math.round(performance.now()-analisisIniciado);analisisIniciado=null;}
  const price=event.data.total;
  smartReady=status==='listo'&&Number.isSafeInteger(price)&&price>0&&event.data.sendable===true;
  smartBlockedReason=typeof event.data.blockReason==='string'?event.data.blockReason:'';
   batchProgress.classList.toggle('error-recepcion',Boolean(smartBlockedReason)&&event.data.sendable===false);
  if(smartBlockedReason)batchProgress.textContent=smartBlockedReason;
  else if(all.length===0)batchProgress.textContent=smartReady?'Presupuesto listo. Pulsá «Enviar mi pedido».':'Revisá los archivos para continuar.';
  updateSummary();
  const promocion=event.data.promocion;
  if(status==='listo'&&promocion&&typeof promocion.titulo==='string'&&
     promocion.titulo.length<=90&&Number.isSafeInteger(promocion.descuento)&&
     promocion.descuento>0&&Number.isSafeInteger(promocion.totalAnterior)&&
     promocion.totalAnterior-promocion.descuento===price){
    promoInfo.hidden=false;
    const moneda=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',
      maximumFractionDigits:0}).format(n);
    promoInfo.textContent='Promoción aplicada: '+promocion.titulo+
      ' · Antes '+moneda(promocion.totalAnterior)+' · Descuento −'+
      moneda(promocion.descuento)+' · Total '+moneda(price);
  }
  const headerPrice=document.getElementById('precio-smart');
  if(status==='listo'&&Number.isSafeInteger(price)&&price>0)
   headerPrice.textContent='Total preliminar: '+new Intl.NumberFormat('es-AR',{
    style:'currency',currency:'ARS',maximumFractionDigits:0}).format(price)+' · Sin cobro autorizado';
  else if(status==='calculando')headerPrice.textContent='Recalculando presupuesto…';
  else if(status==='incompleto')headerPrice.textContent='Presupuesto incompleto · Corregí los archivos pendientes';
  else if(status==='error')headerPrice.textContent='Presupuesto pendiente · '+(smartBlockedReason||'No pudimos consultar el servidor. El PDF sigue cargado; reintentá el cálculo abajo.');
  else if(status==='esperando')headerPrice.textContent='Presupuesto preliminar: todavía sin cotizar';
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_RESIZE'){
  const height=Number(event.data.height);
  if(Number.isFinite(height)&&height>=300&&height<=40000)
   smart.style.height=Math.ceil(height+12)+'px';
  return;
 }
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_DOCUMENTS_TO_PRIVATE'){
  const payload=event.data;
  if(batchSending||registering||registeredOrder||!Array.isArray(payload.files)||
     !Array.isArray(payload.options)||payload.files.length!==payload.options.length||
     payload.files.length<1||payload.files.length>MAX_PDF_PRIVADOS||
     !Number.isSafeInteger(payload.total)||payload.total<1){
   batchStatus.textContent='Pedido inteligente inválido o recepción ocupada.';return;
  }
  const existing=all.flatMap(item=>item.references).length;
  if(existing+payload.files.length>MAX_PDF_PRIVADOS){
   batchStatus.textContent='El pedido supera los '+MAX_PDF_PRIVADOS+' PDF permitidos.';return;
  }
  // Ningún dato de la clasificación preliminar se trata como precio confirmado.
  try{
   const drafts=[],refs=new Set();
   for(let i=0;i<payload.files.length;i++){
    const file=payload.files[i],opt=payload.options[i];
    if(!(file instanceof File)||!opt||file.size<5||file.size>40*1024*1024||
       file.name!==opt.nombre||file.name.length>120||!/\\.pdf$/i.test(file.name)||
       !Number.isSafeInteger(opt.paginas)||opt.paginas<1||opt.paginas>2000||
       !['personalizado_a4','a5','a4','a3'].includes(opt.formato)||
       !['bn','color'].includes(opt.modo)||
       !['simple','double'].includes(opt.caras)||
       !Number.isSafeInteger(opt.copias)||opt.copias<1||opt.copias>200||
       ![1,2,4,9].includes(opt.paginasPorHoja??1)||
       (opt.paginasSeleccionadas!==undefined&&
        (typeof opt.paginasSeleccionadas!=='string'||opt.paginasSeleccionadas.length>500))||
       !['ninguno','individual',...(TUS_ENABLED?['grupo']:[])].includes(opt.anillado)||
       (opt.anillado==='grupo'&&!/^[1-9][0-9]?$/.test(String(opt.grupoAnillado||'')))||
       (opt.anillado!=='grupo'&&Boolean(opt.grupoAnillado))||
       typeof opt.materialColor!=='string'||opt.materialColor.length>120)
     throw Error('Un PDF o sus opciones no cumplen los límites del receptor privado.');
    const header=new Uint8Array(await file.slice(0,5).arrayBuffer());
    if(String.fromCharCode(...header)!=='%PDF-')
     throw Error('Un archivo no tiene cabecera PDF válida.');
    const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
      await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
    const localRef=crypto.randomUUID();
    if(refs.has(localRef)||used.has(localRef))throw Error('Referencia local duplicada.');
    refs.add(localRef);
    drafts.push({itemIndex:i,archivoLocal:file,opcionesInteligentes:opt,
     reference:{schema:'saber-pdf-local-pendiente-v1',localRef,
      nombre:file.name,bytes:file.size,paginas:opt.paginas,sha256:sha,
      estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false}});
   }
   drafts.forEach(d=>used.add(d.reference.localRef));
   all.push({name:'Pedido inteligente · '+drafts.length+' PDF',
    price:payload.total,references:drafts});
   save();render();updateSummary();
   status.textContent=drafts.length+' PDF preparados para el envío seguro.';
   batchStatus.textContent=drafts.length+' PDF listos para enviar, sin seleccionarlos otra vez.';
  }catch(error){batchStatus.textContent='No se preparó la carga: '+String(error.message||error)}
  return;
 }
 if(event.source!==frame.contentWindow)return;
 if(event.data?.type==='SABER_ARCHIVO_PDF_PRIVADO'){
  const {localRef,file}=event.data;
  if(!(file instanceof File)||typeof localRef!=='string')return;
  for(const item of all)for(const d of item.references){
   if(d.reference.localRef!==localRef||d.confirmacion)continue;
   if(file.name!==d.reference.nombre||file.size!==d.reference.bytes)continue;
   d.archivoLocal=file;
   render();updateSummary();return;
  }
  return;
 }
 if(event.data?.type!=='SABER_ADD_PRINT')return;
 const p=event.data.payload;
 if(!p||p.type!=='print'||typeof p.name!=='string'||
    !Number.isFinite(p.price)||p.price<=0||
    !Array.isArray(p.pdfDrafts)||p.pdfDrafts.length>MAX_PDF_PRIVADOS)return;
 const refs=[],seen=new Set();
 if(all.reduce((n,item)=>n+item.references.length,0)+p.pdfDrafts.length>MAX_PDF_PRIVADOS)return;
 for(const d of p.pdfDrafts){
  const r=d?.reference;
  if(!d||d.service!=='impresiones'||!Number.isSafeInteger(d.itemIndex)||
     d.itemIndex<0||d.itemIndex>29||!r||
     r.schema!=='saber-pdf-local-pendiente-v1'||
     !/^[a-f0-9]{64}$/.test(r.sha256||'')||
     !/^[a-f0-9-]{36}$/i.test(r.localRef||'')||
     r.recibido!==false||r.verificadoServidor!==false||
     r.estado!=='PENDIENTE_DE_ENVIO'||seen.has(r.localRef)||
     used.has(r.localRef))return;
  seen.add(r.localRef);refs.push({itemIndex:d.itemIndex,reference:r});
 }
 refs.forEach(d=>used.add(d.reference.localRef));
 all.push({name:p.name,price:p.price,references:refs});
 save();updateSummary();
 // Solicitar por canal mismo-origen los objetos File locales correspondientes.
 // La huella SHA-256 sigue revalidándose antes de aceptar cada recepción.
 for(const d of refs)frame.contentWindow.postMessage({
  type:'SABER_SOLICITAR_PDF_PRIVADO',localRef:d.reference.localRef
 },location.origin);
 status.textContent='Se agregó un trabajo. Los PDF están pendientes hasta que Google confirme su recepción. Pedido de prueba: '+orderId;
 render();
});
// La autorización real de envío nunca depende del color del botón.
// Si falla esta comprobación, mostrar su código y permitir reintentar sin recargar
// ni pedir al cliente que vuelva a subir o pagar archivos.
async function verificarDisponibilidadTUS(){
 if(!TUS_ENABLED)return false;
 if(tusPreflightPromise)return tusPreflightPromise;
 tusPreflightPromise=(async()=>{
  tusPreflightError='';
  batchProgress.textContent='Verificando conexión privada antes del envío…';
  try{
   const reply=await fetch('/prueba-v2/api/ensayo-tus-comprobar',{
    method:'POST',credentials:'same-origin',redirect:'error',
    headers:{'Content-Type':'application/json'},body:'{}'
   });
   const result=await reply.json().catch(()=>null);
   if(!reply.ok||result?.ok!==true||result.etapa!=='STORAGE_FIRMA_OK')
    throw Error(result?.etapa||'SIN_RESPUESTA');
   tusPreflightOK=true;
   batchProgress.textContent='Conexión privada verificada. Ya podés enviar un presupuesto listo.';
   return true;
  }catch(error){
   tusPreflightOK=false;
   tusPreflightError=String(error?.message||error).slice(0,80);
   batchProgress.textContent='No se pudo verificar la recepción segura ('+
    tusPreflightError+'). Pulsá «Enviar mi pedido» para reintentar la conexión.';
   return false;
  }finally{
   tusPreflightPromise=null;
   updateSummary();
  }
 })();
 return tusPreflightPromise;
}
if(TUS_ENABLED)void verificarDisponibilidadTUS();
</script></body></html>`;
}


/**
 * Mismo cotizador TUS probado, con presentación de comprador.
 * No inserta claves ni cookies del personal. El Worker decide qué rutas
 * están autorizadas; ocultar controles en HTML NO equivale a autorizar APIs.
 */
export function paginaCotizadorTUSClientePruebas(sitekey,tusEnabled,tusDiagnostico,sandboxEnabled,r2PrepayEnabled=false,universalEnabled=false){
 let html=paginaCotizadorV2PruebaPrivada(sitekey,tusEnabled,tusDiagnostico,sandboxEnabled,r2PrepayEnabled,universalEnabled);
 html=html
  .replace('<title>Librería Saber · Ensayo privado V2</title>',
   '<title>Impresiones y ploteos · Librería Saber</title>')
  .replace('LIBRERÍA SABER · Cotizador V2 en ensayo privado',
   'LIBRERÍA SABER · Impresiones y ploteos')
  .replace('Solo pagos con usuarios de prueba; sin cobros reales ni publicación comercial.',
   'Entorno de ensayo · Los pagos usan Mercado Pago Sandbox, sin dinero real.')
  .replace('Sin cobros, sin órdenes de producción y sin publicación comercial.',
   'Entorno de ensayo · No se realizan cobros reales.')
  .replace('Detalles de la recepción y verificación (ensayo privado)',
   'Detalles técnicos de la carga')
  .replace("location.assign('/prueba-v2/');",
   "location.assign('/prueba-v2/pedido-cliente');")
  .replace("const modoDiagnostico=new URLSearchParams(location.search).get('diagnostico')==='1';",
   'const modoDiagnostico=false;')
  .replace('src="/prueba-v2/cotizador?integrado=1&ensayoArchivos=1"',
   'src="about:blank"');
 return html;
}
