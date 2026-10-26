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
main{max-width:1110px;margin:16px auto;padding:0 14px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:16px}
.panel{background:#fff;padding:15px;border:1px solid #cbd5e1;border-radius:13px;min-width:0}
h1{font-size:19px;margin:0 0 4px}h2{font-size:17px;margin:0 0 12px}p{line-height:1.5}
small{color:#536475}iframe{border:0;width:100%;min-height:850px}
.entry{border-top:1px solid #dce4ec;padding:13px 0}
input,select,button{font:inherit;max-width:100%}input[type=file],select{display:block;width:100%;padding:8px;margin:8px 0;border:1px solid #b9c8d8;border-radius:7px}
button{border:0;background:#0a5583;color:#fff;padding:10px 15px;border-radius:8px;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
.state{white-space:pre-wrap;overflow-wrap:anywhere;color:#0a3158;font-size:13px}
.warning{background:#fff2db;border-left:4px solid #f7931e;padding:10px;margin-bottom:12px}
.cf-turnstile{margin:15px 0}
@media(max-width:840px){main{display:block}.panel{margin-bottom:14px}iframe{min-height:740px}}
</style></head><body>
<header><h1>LIBRERÍA SABER · Cotizador V2 en ensayo privado</h1><small style="color:#d5e3f0">Sin cobros, sin órdenes de producción y sin publicación comercial.</small></header>
<main><section class="panel"><h2>Cotizador original, funciones completas</h2>
<iframe id="base" title="Cotizador V2 de prueba" src="/prueba-v2/cotizador?integrado=1&ensayoArchivos=1" loading="eager"></iframe></section>
<section class="panel">
<h2>Recepción de PDF por trabajo</h2>
<div class="warning">Para este ensayo, seleccioná nuevamente cada PDF y confirmá formato, caras, copias y anillado para comparar con el cotizador original. Se comprueba su SHA-256; no sirve otro PDF con el mismo nombre. Hasta confirmar el recibo sigue pendiente.</div>
<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
<div id="all" role="list" aria-label="Trabajos del cotizador"></div>
<p id="state" role="status" aria-live="polite" class="state">Cotizá una impresión y agregala al pedido de prueba.</p>
<section id="order-summary" class="warning" aria-label="Resumen privado del pedido" aria-live="polite"></section>
<button id="register-private" type="button" disabled>Registrar pedido de prueba en la Central</button>
<p id="register-status" role="status" aria-live="polite" class="state">Disponible únicamente cuando todos los PDF estén verificados. Sin pagos.</p>
<p><small>No se transmite ningún PDF a la tienda pública. La verificación de Drive y el presupuesto preliminar del servidor son ensayos; D1 y los cobros siguen separados.</small></p>
</section></main>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script type="module">
import {subirYVincularPdfCotizadorV2} from '/prueba-v2/subir-vincular-pdf.mjs';
import {prepararManifiestoDocumentalV2} from '/prueba-v2/preparar-manifiesto.mjs';
const list=document.getElementById('all'),status=document.getElementById('state'),frame=document.getElementById('base'),summary=document.getElementById('order-summary');
const registerButton=document.getElementById('register-private'),registerStatus=document.getElementById('register-status');
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
   const mode=document.createElement('select');
   for(const [value,label] of [['bn','Blanco y negro'],['color','Color']]){
    const o=document.createElement('option');o.value=value;o.textContent=label;mode.append(o);
   }
   const field=(title,entries)=>{
    const wrapper=document.createElement('label');wrapper.textContent=title;
    const select=document.createElement('select');
    for(const [v,t] of entries){const option=document.createElement('option');option.value=v;option.textContent=t;select.append(option)}
    wrapper.append(select);area.append(wrapper);return select;
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
   void updatePaper();
   const caras=field('Caras', [['simple','Simple faz'],['double','Doble faz']]);
   const copias=field('Copias', Array.from({length:200},(_,i)=>[String(i+1),String(i+1)]));
   const anillado=field('Anillado', [['ninguno','Sin anillado'],['juntos','Anillado conjunto']]);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Enviar, verificar y cotizar PDF';
   const msg=document.createElement('p');msg.className='state';
   btn.addEventListener('click',async()=>{
    const chosen=file.files?.[0],turnstileToken=window.turnstile?.getResponse();
    if(!chosen||(!d.sesionTemporal&&!turnstileToken)||!papel.value){msg.textContent='Seleccioná el PDF y completá la verificación de seguridad.';return}
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
    }catch(e){
     msg.textContent='No se confirmó la recepción: '+String(e.message||e)+
      (d.sesionTemporal?' Podés reintentar este PDF sin volver a enviar los bloques aceptados mientras permanezcas en esta página.':'');
     btn.disabled=false;file.disabled=false;mode.disabled=false;
     for(const control of [formato,caras,copias,anillado,papel])control.disabled=false;
    }finally{window.turnstile?.reset()}
   });
   area.prepend(name,file,mode);area.append(btn,msg);div.append(area);
  }
  list.append(div);
 }
}
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
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
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
 status.textContent='Se agregó un trabajo. Los PDF están pendientes hasta que Google confirme su recepción. Pedido de prueba: '+orderId;
 render();
});
</script></body></html>`;
}
