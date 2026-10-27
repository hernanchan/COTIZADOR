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
.entry{border-top:1px solid #dce4ec;padding:13px 0}
input,select,button{font:inherit;max-width:100%}input[type=file],select{display:block;width:100%;padding:8px;margin:8px 0;border:1px solid #b9c8d8;border-radius:7px}
button{border:0;background:#0a5583;color:#fff;padding:10px 15px;border-radius:8px;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
.state{white-space:pre-wrap;overflow-wrap:anywhere;color:#0a3158;font-size:13px}
.warning{background:#fff2db;border-left:4px solid #f7931e;padding:10px;margin-bottom:12px}
#precio-smart{position:sticky;top:0;z-index:10;background:#eaf3fa;border-bottom:2px solid #aecce5;padding:9px max(15px,calc((100vw - 1110px)/2));font-size:16px;font-weight:750;color:#0a3158;box-shadow:0 3px 9px #0a315812}
.cf-turnstile{margin:15px 0}
#drop-pdf{display:block;border:2px dashed #8faec5;background:#f4f9fd;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer}
#drop-pdf.dragging{background:#dfedfb;border-color:#095f8f}
#drop-pdf input{display:block;margin-top:8px}
@media(max-width:840px){main{display:block}.panel{margin-bottom:14px}iframe{min-height:740px}}
</style></head><body>
<header><h1>LIBRERÍA SABER · Cotizador V2 en ensayo privado</h1><small style="color:#d5e3f0">Sin cobros, sin órdenes de producción y sin publicación comercial.</small></header>
<div id="precio-smart" role="status" aria-live="polite">Presupuesto preliminar: todavía sin cotizar · No autoriza cobro</div>
<div style="max-width:1140px;margin:18px auto 0;padding:0 14px">
<section style="padding:8px 3px 4px"><h2 style="margin:0 0 5px;font-size:22px;color:#123852">Cargá tus archivos una sola vez</h2><p style="margin:0;color:#52677a">Arrastrá todos los PDF juntos, revisá el presupuesto y después prepará el envío. Los ploteos se cotizan automáticamente; su recepción sigue en pruebas.</p></section></div>
<main><section class="panel" style="padding:0;border:0;background:transparent">
<iframe id="smart" title="Análisis automático de PDF, tamaños, CAD y póster" src="/prueba-v2/carga-inteligente" loading="eager"></iframe>
</section>
<details id="recepcion-avanzada" class="panel" style="margin-top:14px"><summary style="font-size:16px;font-weight:700;cursor:pointer;padding:5px 0">Paso 2 · Enviar los PDF y registrar el pedido (ensayo privado)</summary><div style="padding-top:12px">
<div class="warning">Los documentos A4/A3 compatibles se trasladan desde la cotización a esta etapa. Sólo confirmamos la recepción después de verificar el PDF original y su presupuesto en el servidor. Los ploteos y los trabajos con anillado todavía no pueden registrarse en esta recepción. No se modificarán ni descartarán silenciosamente las opciones elegidas.</div>
<div id="drop-pdf" style="display:none"><strong>Recuperación manual de PDF para trabajos antiguos</strong><input id="batch-files" type="file" accept=".pdf,application/pdf" multiple><p id="batch-status" class="state" role="status">Los PDF se asignan por nombre y tamaño al trabajo correspondiente. La recepción sigue protegida.</p></div>
<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
<div id="all" role="list" aria-label="Trabajos del cotizador"></div>
<p id="state" role="status" aria-live="polite" class="state">Cotizá una impresión y agregala al pedido de prueba.</p>
<section id="order-summary" class="warning" aria-label="Resumen privado del pedido" aria-live="polite"></section>
<button id="send-all-pdf" type="button" disabled>Enviar todos los PDF del pedido</button>
<p id="batch-progress" class="state" role="status" aria-live="polite">Agregá los archivos al carrito para habilitar el envío conjunto.</p>
<button id="register-private" type="button" disabled>Registrar pedido de prueba en la Central</button>
<p id="register-status" role="status" aria-live="polite" class="state">Disponible únicamente cuando todos los PDF estén verificados. Sin pagos.</p>
<p><small>No se transmite ningún PDF a la tienda pública. La verificación de Drive y el presupuesto preliminar del servidor son ensayos; D1 y los cobros siguen separados.</small></p>
</div></details></main>
<details style="max-width:1110px;margin:10px auto 25px;padding:0 14px"><summary style="cursor:pointer">Cotizador original (comparación comercial)</summary>
<iframe id="base" title="Cotizador original de comparación" src="/prueba-v2/cotizador?integrado=1&ensayoArchivos=1" loading="lazy"></iframe>
</details>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script type="module">
import {subirYVincularPdfCotizadorV2} from '/prueba-v2/subir-vincular-pdf.mjs';
import {prepararManifiestoDocumentalV2} from '/prueba-v2/preparar-manifiesto.mjs';
const list=document.getElementById('all'),status=document.getElementById('state'),
 frame=document.getElementById('base'),smart=document.getElementById('smart'),
 summary=document.getElementById('order-summary');
const registerButton=document.getElementById('register-private'),registerStatus=document.getElementById('register-status');
const sendAllButton=document.getElementById('send-all-pdf'),batchProgress=document.getElementById('batch-progress');
let batchSending=false;
const dropPdf=document.getElementById('drop-pdf'),batchFiles=document.getElementById('batch-files'),batchStatus=document.getElementById('batch-status');
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
  d.confirmacion?.cotizacionServidor?.estado==='PRELIMINAR_VERIFICADA_SIN_PEDIDO');
 const value=verified.reduce((n,d)=>n+d.confirmacion.cotizacionServidor.totalArs,0);
 const amount=Number.isSafeInteger(value)?new Intl.NumberFormat('es-AR',{
  style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value):'Requiere revisión';
 const remaining=allRefs.length-verified.length;
 const withoutPdf=all.filter(item=>item.references.length===0).length;
 summary.replaceChildren();
 const title=document.createElement('strong');
 title.textContent='Resumen del pedido · '+verified.length+' de '+allRefs.length+' PDF verificados';
 const detail=document.createElement('p');
 detail.textContent='Cotización del servidor para archivos verificados: '+amount+
  '. '+(remaining?'Faltan '+remaining+' PDF.':'Todos los PDF declarados fueron verificados preliminarmente.')+
   (withoutPdf?' Trabajos sin PDF asociado: '+withoutPdf+'; requieren revisión manual.':'')+
  ' Registro en Central D1: PENDIENTE. Pago y producción: DESACTIVADOS.';
 summary.append(title,detail);
 sendAllButton.disabled=batchSending||registering||Boolean(registeredOrder)||
  allRefs.length===0||allRefs.every(d=>Boolean(d.confirmacion))||
  allRefs.some(d=>!d.confirmacion&&!d.archivoLocal);
 registerButton.disabled=registering||Boolean(registeredOrder)||verified.length===0||
  remaining!==0||withoutPdf!==0||verified.some(d=>!d.sesionConfirmada||!d.modoConfirmado);
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
   if(d.confirmacion && d.sesionConfirmada){
    name.textContent='Trabajo '+(d.itemIndex+1)+': '+r.nombre+' · '+d.confirmacion.pages+' páginas (PDF verificado)';
    const confirmed=document.createElement('p');
    confirmed.className='state';
    confirmed.textContent='PDF ya confirmado, recibo '+d.confirmacion.receiptId+'. No hace falta volver a subirlo.';
    area.append(name,confirmed);div.append(area);continue;
   }
   const file=document.createElement('input');file.type='file';file.accept='.pdf,application/pdf';
   if(d.archivoLocal instanceof File){
    const kept=document.createElement('p');kept.className='state';
    kept.textContent='Archivo recuperado del cotizador en esta pestaña. No hace falta seleccionarlo otra vez.';
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
   const anillado=field('Anillado (recepción privada)', [['ninguno','Sin anillado — integración pendiente']]);
   if(d.opcionesInteligentes){
    mode.value=d.opcionesInteligentes.modo;
    caras.value=d.opcionesInteligentes.caras;
    copias.value=String(d.opcionesInteligentes.copias);
    anillado.value='ninguno';
   }
   const warningBinding=document.createElement('p');
   warningBinding.className='state';
   warningBinding.textContent='El anillado se cotiza en la pantalla inteligente, pero todavía no puede registrarse en la Central. Este ensayo admite solamente PDF sin anillar.';
   advanced.append(warningBinding);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Reintentar solamente este PDF';
   btn.hidden=true;
   const msg=document.createElement('p');msg.className='state';
   const sendThis=async()=>{
    const chosen=d.archivoLocal||file.files?.[0],turnstileToken=window.turnstile?.getResponse();
    if(!chosen||(!d.sesionTemporal&&!turnstileToken)||!papel.value){msg.textContent='Seleccioná el PDF y completá la verificación de seguridad.';return false}
    btn.disabled=true;file.disabled=true;mode.disabled=true;
    for(const control of [formato,caras,copias,anillado,papel])control.disabled=true;
    try{
     const result=await subirYVincularPdfCotizadorV2({
      archivo:chosen,referencia:r,orderId,modo:mode.value,turnstileToken,
      opciones:{formato:formato.value,caras:caras.value,copias:Number(copias.value),anillado:anillado.value,materialColor:papel.value},
      origin:location.origin,
      sesionPrevia:d.sesionTemporal||null,
      onSession:s=>{d.sesionTemporal=s;},
      onProgress:p=>{msg.textContent=['transferencia','estado','reanudacion'].includes(p.phase)?'PDF: '+p.completed+' de '+p.total+' bloques confirmados':p.phase}
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
     for(const control of [formato,caras,copias,anillado,papel])control.disabled=false;
     return false;
    }finally{window.turnstile?.reset()}
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
     d.opcionesInteligentes.copias+' copia(s).';
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
sendAllButton.addEventListener('click',async()=>{
 if(batchSending||registeredOrder)return;
 const pending=all.flatMap(item=>item.references).filter(d=>!d.confirmacion);
 if(!pending.length||pending.length>30||pending.some(d=>!d.archivoLocal||typeof d.sendNow!=='function')){
  batchProgress.textContent='Faltan PDF por asociar al pedido. Arrastralos al área superior.';
  return;
 }
 batchSending=true;updateSummary();
 try{
  let completed=0;
  for(const d of pending){
   batchProgress.textContent='Enviando y verificando PDF '+(completed+1)+' de '+pending.length+
    ' · '+d.reference.nombre;
   if(!d.sesionTemporal&&!(await waitForTurnstile())){
    batchProgress.textContent='La verificación de seguridad no está lista. Completala y pulsá nuevamente Enviar todos; los PDF confirmados no se repiten.';
    return;
   }
   const ok=await d.sendNow();
   if(!ok){
    batchProgress.textContent='Envío detenido en '+d.reference.nombre+
     '. Revisá el mensaje del archivo; al reintentar no se vuelven a enviar los ya verificados.';
    return;
   }
   completed++;
  }
  batchProgress.textContent=completed+' PDF recibidos y verificados. El pedido está listo para registrar en la Central.';
 }finally{batchSending=false;updateSummary()}
});
if(previous?.items.length){
 status.textContent='Carrito recuperado: '+previous.seen.size+' referencia(s) de PDF pendiente(s) de nueva verificación. Volvé a seleccionar cada PDF: las fotos y archivos nunca se guardan en el navegador. Ningún pago ni pedido quedó confirmado. Pedido de prueba: '+orderId;
 render();
}
updateSummary();
registerButton.addEventListener('click',async()=>{
 if(registering||registeredOrder)return;
 const entries=all.flatMap(item=>item.references);
 if(!entries.length||entries.length>30||all.some(item=>!item.references.length)||
    entries.some(d=>!d.confirmacion||!d.sesionConfirmada||
      !['bn','color'].includes(d.modoConfirmado)||
      d.confirmacion.cotizacionServidor?.anillado!=='ninguno')){
  registerStatus.textContent='Este ensayo sólo permite PDF verificados sin anillado conjunto ni trabajos sin archivo.';
  return;
 }
 registering=true;updateSummary();
 try{
  const manifiesto=prepararManifiestoDocumentalV2({
   orderId,trabajos:entries.map(d=>({vinculo:d.confirmacion}))
  });
  const sesiones=entries.map(d=>{
   const q=d.confirmacion.cotizacionServidor;
   return {sesion:{uploadId:d.sesionConfirmada.uploadId,token:d.sesionConfirmada.token},
    opciones:{servicio:'auto',seleccion:q.formato,paginasSeleccionadas:'',
     copias:q.copias,modo:d.modoConfirmado,caras:q.caras,
     papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',
     materialColor:q.materialColor,productoFoto:'',productoGrafica:'',
     corteVariante:'gt3',corteMetros:1}};
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
});
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin)return;
 if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_PRICE_STATE'){
  const status=event.data.estado;
  const price=event.data.total;
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
   document.getElementById('recepcion-avanzada').open=true;
   status.textContent='Se asociaron '+drafts.length+
    ' PDF con la cotización inteligente. Verificá las opciones y pulsá Enviar todos los PDF del pedido.';
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
