/**
 * Portal del cotizador V2 servido DESDE EL MISMO ORIGEN que la recepción.
 * Sólo puede abrirse con la compuerta BASIC privada del Worker, apagada
 * por defecto, y no interactúa con la tienda pública.
 */
export function paginaCotizadorV2PruebaPrivada(sitekey){
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
#acciones-pedido{position:sticky;top:0;z-index:30;background:#eaf3fa;border-bottom:2px solid #aecce5;padding:8px max(15px,calc((100vw - 1110px)/2));box-shadow:0 3px 9px #0a315812;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#precio-smart{flex:1;font-size:16px;font-weight:750;color:#0a3158}#send-all-pdf{font-weight:750;background:#095985;white-space:nowrap;min-height:43px}#batch-progress{flex-basis:100%;margin:0;font-size:12px;line-height:1.2}#recepcion-avanzada>summary{font-size:13px!important;color:#536475}#seguridad-privada{max-width:1110px;margin:7px auto 0;padding:0 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#seguridad-privada .cf-turnstile{margin:0} @media(max-width:600px){#acciones-pedido{padding:8px 12px}#send-all-pdf{width:100%}}
.cf-turnstile{margin:15px 0}
#vista-estado-pedido{background:#fff;border-radius:12px;padding:24px;margin:12px 0;border:1px solid #bad2e7}
#vista-estado-pedido strong{display:block;font-size:21px;margin-bottom:8px}
#vista-estado-pedido p{margin:5px 0}
body.estado-envio #smart,body.estado-registro #smart{display:none}
[hidden]{display:none!important}
#drop-pdf{display:block;border:2px dashed #8faec5;background:#f4f9fd;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer}
#drop-pdf.dragging{background:#dfedfb;border-color:#095f8f}
#drop-pdf input{display:block;margin-top:8px}
@media(max-width:840px){main{display:block}.panel{margin-bottom:14px}iframe{min-height:740px}}
</style></head><body>
<header><h1>LIBRERÍA SABER · Cotizador V2 en ensayo privado</h1><small style="color:#d5e3f0">Sin cobros, sin órdenes de producción y sin publicación comercial.</small></header>
<div id="acciones-pedido"><div id="precio-smart" role="status" aria-live="polite">Presupuesto preliminar: todavía sin cotizar · No autoriza cobro</div><button id="send-all-pdf" type="button" disabled>Enviar mi pedido</button><p id="batch-progress" class="state" role="status" aria-live="polite">Cargá tus PDF y revisá las opciones.</p></div>
<div id="seguridad-privada"><small>Verificación de seguridad para el envío:</small><div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div></div>
<div style="max-width:1140px;margin:18px auto 0;padding:0 14px">
<section style="padding:8px 3px 4px"><h2 style="margin:0 0 5px;font-size:22px;color:#123852">Cargá tus archivos una sola vez</h2><p style="margin:0;color:#52677a">Arrastrá todos los PDF juntos. La web reconoce tamaños y ploteos automáticamente. Revisá el precio y pulsá «Enviar mi pedido» una sola vez.</p></section></div>
<main><section class="panel" style="padding:0;border:0;background:transparent">
<section id="vista-estado-pedido" hidden role="status" aria-live="polite"></section>
<iframe id="smart" title="Análisis automático de PDF, tamaños, CAD y póster" src="/prueba-v2/carga-inteligente" loading="eager"></iframe>
</section>
<details id="recepcion-avanzada" class="panel" style="margin-top:14px"><summary style="font-size:16px;font-weight:700;cursor:pointer;padding:5px 0">Detalles de la recepción y verificación (ensayo privado)</summary><div style="padding-top:12px">
<div class="warning">Los PDF se verifican en Drive y la Central registra automáticamente el pedido. Sin cobros.</div>
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
import {subirYVincularPdfCotizadorV2,ejecutarRecepcionParalela} from '/prueba-v2/subir-vincular-pdf.mjs';
import {prepararManifiestoDocumentalV2} from '/prueba-v2/preparar-manifiesto.mjs';
const list=document.getElementById('all'),status=document.getElementById('state'),
 frame=document.getElementById('base'),smart=document.getElementById('smart'),
 summary=document.getElementById('order-summary');
const registerButton=document.getElementById('register-private'),registerStatus=document.getElementById('register-status');
const sendAllButton=document.getElementById('send-all-pdf'),batchProgress=document.getElementById('batch-progress');
const modoDiagnostico=new URLSearchParams(location.search).get('diagnostico')==='1';
if(!modoDiagnostico){
 document.getElementById('recepcion-avanzada').hidden=true;
 document.getElementById('comparacion-original').hidden=true;
}
const vistaEstadoPedido=document.getElementById('vista-estado-pedido');
let ultimoTotalServidor=null;
function mostrarEstadoCliente(estado,titulo,detalle){
 document.body.classList.toggle('estado-envio',estado==='enviando');
 document.body.classList.toggle('estado-registro',estado==='registrado');
 vistaEstadoPedido.hidden=!estado;
 if(!estado){vistaEstadoPedido.replaceChildren();return}
 const h=document.createElement('strong');h.textContent=titulo;
 const p=document.createElement('p');p.textContent=detalle;
 vistaEstadoPedido.replaceChildren(h,p);
}
let batchSending=false,smartReady=false,smartBlockedReason='',handoffInProgress=false,handoffResolve=null;
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
  if(new URLSearchParams(location.search).get('diagnostico')==='1'){
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
 if(chosen.length>30||refs.length>30){
  batchStatus.textContent='El máximo del ensayo es de 30 PDF.';return;
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
let registering=false,registeredOrder=null;
// Recuperación de metadatos no sensibles tras recarga o suspensión móvil.
 // Nunca conservar objetos File, base64, sesiones, credenciales ni confirmaciones.
const RECOVERY_KEY='saber-v2-ensayo-metadatos-v1';
const RECOVERY_MAX_AGE=12*60*60*1000;
const RECOVERY_MAX_BYTES=25000;
const newOrderId=()=>{
 const random=new Uint8Array(16);crypto.getRandomValues(random);
 return 'WEB-ENSAYO-'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
};
const safeRef=r=>r&&r.schema==='saber-pdf-local-pendiente-v1'&&
 /^[a-f0-9-]{36}$/i.test(r.localRef||'')&&/^[a-f0-9]{64}$/.test(r.sha256||'')&&
 Number.isSafeInteger(r.bytes)&&r.bytes>=5&&r.bytes<=20*1024*1024&&
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
    state.items.length>30)return null;
  const seen=new Set(),items=[];
  let totalReferences=0;
  for(const item of state.items){
   if(!item||typeof item.name!=='string'||item.name.length>120||
    !Number.isFinite(item.price)||item.price<=0||
    !Array.isArray(item.references)||item.references.length>30)return null;
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
const previous=restore(),orderId=previous?.orderId||newOrderId();
const clientOrderId=previous?.clientOrderId||newClientOrderId();
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
function updateSummary(){
 const allRefs=all.flatMap(item=>item.references);
 const verified=allRefs.filter(d=>d.confirmacion?.reciboGoogleVerificado===true&&
  d.confirmacion?.paymentAuthorized===false&&
  (d.confirmacion?.cotizacionServidor?.estado==='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
   d.ploteoVerificado?.estado==='PRELIMINAR_VERIFICADA_SIN_PEDIDO'));
 const value=verified.reduce((n,d)=>n+
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
 sendAllButton.disabled=batchSending||registering||handoffInProgress||Boolean(registeredOrder)||
  (allRefs.length===0&&!smartReady)||withoutPdf!==0||
  allRefs.some(d=>!d.confirmacion&&!d.archivoLocal);
 sendAllButton.textContent=registeredOrder?'Pedido registrado':
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
      d.confirmacion=result;d.ploteoVerificado=data.quote;
      d.sesionConfirmada=session;d.modoConfirmado=meta.modo;
      delete d.sesionTemporal;
      retry.hidden=true;updateSummary();
      msg.textContent='PDF recibido y ploteo cotizado por servidor: '+
       new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0})
        .format(data.quote.totalArs)+
       '. El pedido todavía no se registra en D1 ni habilita pago.';
      return true;
     }catch(error){
      retry.hidden=false;retry.disabled=false;
      msg.textContent='El ploteo no fue confirmado: '+String(error.message||error)+
       '. Podés reintentar, sin reenviar las partes ya recibidas.';
      return false;
     }finally{window.turnstile?.reset()}
    };
    // Preparación segura del lote: datos del mismo PDF que sendPlot enviaría.
    d.batchInicio=()=>({
     meta:{orderId,fileId:'pdf-'+r.sha256.slice(0,24),
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
   const formato=field('Formato', [['a4','A4'],['a3','A3']]);
   const papel=field('Papel color', []);
   const updatePaper=async()=>{
    papel.replaceChildren();papel.disabled=true;
    try{
     const catalog=await catalogPromise;
     const materiales=catalog[formato.value==='a4'?'colorA4':'colorA3']?.materials||[];
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
   const anillado=field('Anillado', [['ninguno','Sin anillado'],['individual','Anillado individual']]);
   const paginasPorHoja=field('Páginas por cara', [['1','1'],['2','2'],['4','4'],['9','9']]);
   if(d.opcionesInteligentes){
    mode.value=d.opcionesInteligentes.modo;
    caras.value=d.opcionesInteligentes.caras;
    copias.value=String(d.opcionesInteligentes.copias);
    anillado.value=d.opcionesInteligentes.anillado||'ninguno';
    paginasPorHoja.value=String(d.opcionesInteligentes.paginasPorHoja??1);
   }
   const warningBinding=document.createElement('p');
   warningBinding.className='state';
   warningBinding.textContent='Anillado individual disponible en este ensayo; para anillar varios PDF juntos falta integrar el grupo completo.';
   advanced.append(warningBinding);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Reintentar solamente este PDF';
   btn.hidden=true;
   const msg=document.createElement('p');msg.className='state';
   const sendThis=async()=>{
    const chosen=d.archivoLocal||file.files?.[0],turnstileToken=window.turnstile?.getResponse();
    if(!chosen||(!d.sesionTemporal&&!turnstileToken)||!papel.value){msg.textContent='Seleccioná el PDF y completá la verificación de seguridad.';return false}
    btn.disabled=true;file.disabled=true;mode.disabled=true;
    for(const control of [formato,caras,copias,anillado,papel,paginasPorHoja])control.disabled=true;
    try{
     const result=await subirYVincularPdfCotizadorV2({
      archivo:chosen,referencia:r,orderId,modo:mode.value,turnstileToken,
      opciones:{formato:formato.value,caras:caras.value,copias:Number(copias.value),anillado:anillado.value,materialColor:papel.value,paginasPorHoja:Number(paginasPorHoja.value)},
      origin:location.origin,
      sesionPrevia:d.sesionTemporal||null,
      onSession:s=>{d.sesionTemporal=s;},
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
     btn.textContent='PDF verificado';d.confirmacion=result;
     d.sesionConfirmada=d.sesionTemporal;
     d.modoConfirmado=mode.value;
     delete d.sesionTemporal;updateSummary();
     return true;
    }catch(e){
     msg.textContent='No se confirmó la recepción: '+String(e.message||e)+
      (d.sesionTemporal?' Podés reintentar este PDF sin volver a enviar los bloques aceptados mientras permanezcas en esta página.':'');
     btn.disabled=false;file.disabled=false;mode.disabled=false;
     for(const control of [formato,caras,copias,anillado,papel,paginasPorHoja])control.disabled=false;
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
     materialColor:papel.value,paginasPorHoja:Number(paginasPorHoja.value)};
    return {meta:{orderId,fileId:'pdf-'+r.sha256.slice(0,24),
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
     String(d.opcionesInteligentes.formato).toUpperCase()+' · '+
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
sendAllButton.addEventListener('click',async()=>{
 if(batchSending||registering||handoffInProgress||registeredOrder)return;
 iniciarMedicion();
 if(all.flatMap(item=>item.references).length===0){
  if(!smartReady){batchProgress.textContent=smartBlockedReason||'El presupuesto no está listo para enviar.';terminarMedicion('presupuesto_incompleto');return;}
  marcarTiempo('preparacion_inicio');
  if(!(await prepararDesdeCotizador())){terminarMedicion('preparacion_fallida');return;}
  marcarTiempo('preparacion_terminada');
 }
 const allEntries=all.flatMap(item=>item.references);
 const pending=allEntries.filter(d=>!d.confirmacion);
 if(!allEntries.length||allEntries.length>30||
    all.some(item=>!item.references.length)||
    pending.some(d=>!d.archivoLocal||typeof d.sendNow!=='function')){
  batchProgress.textContent='Faltan archivos o trabajos por completar antes del envío.';
  terminarMedicion('trabajos_incompletos');
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
     batchProgress.textContent='Se detuvo la tanda en '+received+' de '+pending.length+
      ' archivos. Los ya verificados quedan conservados para reintentar sin duplicarlos.';
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
     batchProgress.textContent='Se detuvo la carga; podés reintentar sin duplicar el PDF.';
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
   'Número de pedido: '+registeredOrder+'. '+allEntries.length+' PDF verificados. Pago desactivado en esta prueba.');
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
     p.file.size<5||p.file.size>20*1024*1024||
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
  if(smartBlockedReason)batchProgress.textContent=smartBlockedReason;
  else if(all.length===0)batchProgress.textContent=smartReady?'Presupuesto listo. Pulsá «Enviar mi pedido».':'Revisá los archivos para continuar.';
  updateSummary();
  const headerPrice=document.getElementById('precio-smart');
  if(status==='listo'&&Number.isSafeInteger(price)&&price>0)
   headerPrice.textContent='Total preliminar: '+new Intl.NumberFormat('es-AR',{
    style:'currency',currency:'ARS',maximumFractionDigits:0}).format(price)+' · Sin cobro autorizado';
  else if(status==='calculando')headerPrice.textContent='Recalculando presupuesto…';
  else if(status==='incompleto')headerPrice.textContent='Presupuesto incompleto · Corregí los archivos pendientes';
  else if(status==='error')headerPrice.textContent='Sin presupuesto · Revisá el error en la carga';
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
     payload.files.length<1||payload.files.length>30||
     !Number.isSafeInteger(payload.total)||payload.total<1){
   batchStatus.textContent='Pedido inteligente inválido o recepción ocupada.';return;
  }
  const existing=all.flatMap(item=>item.references).length;
  if(existing+payload.files.length>30){
   batchStatus.textContent='El pedido supera los 30 PDF permitidos.';return;
  }
  // Ningún dato de la clasificación preliminar se trata como precio confirmado.
  try{
   const drafts=[],refs=new Set();
   for(let i=0;i<payload.files.length;i++){
    const file=payload.files[i],opt=payload.options[i];
    if(!(file instanceof File)||!opt||file.size<5||file.size>20*1024*1024||
       file.name!==opt.nombre||file.name.length>120||!/\\.pdf$/i.test(file.name)||
       !Number.isSafeInteger(opt.paginas)||opt.paginas<1||opt.paginas>2000||
       !['a4','a3'].includes(opt.formato)||
       !['bn','color'].includes(opt.modo)||
       !['simple','double'].includes(opt.caras)||
       !Number.isSafeInteger(opt.copias)||opt.copias<1||opt.copias>200||
       ![1,2,4,9].includes(opt.paginasPorHoja??1)||
       !['ninguno','individual'].includes(opt.anillado)||
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
    !Array.isArray(p.pdfDrafts)||p.pdfDrafts.length>30)return;
 const refs=[],seen=new Set();
 if(all.reduce((n,item)=>n+item.references.length,0)+p.pdfDrafts.length>30)return;
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
</script></body></html>`;
}
