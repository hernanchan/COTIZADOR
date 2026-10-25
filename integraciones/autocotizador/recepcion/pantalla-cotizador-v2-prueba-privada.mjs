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
<div class="warning">Para este ensayo, al añadir trabajos con PDF deberás seleccionar nuevamente cada archivo. Se comprueba su SHA-256; no sirve otro PDF con el mismo nombre. Hasta confirmar el recibo sigue pendiente.</div>
<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
<div id="all" role="list" aria-label="Trabajos del cotizador"></div>
<p id="state" role="status" aria-live="polite" class="state">Cotizá una impresión y agregala al pedido de prueba.</p>
<p><small>No se transmite ningún PDF a la tienda pública. La verificación de Drive, el precio servidor, D1 y los cobros son pasos separados.</small></p>
</section></main>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script type="module">
import {subirYVincularPdfCotizadorV2} from '/prueba-v2/subir-vincular-pdf.mjs';
const list=document.getElementById('all'),status=document.getElementById('state'),frame=document.getElementById('base');
const random=new Uint8Array(16);crypto.getRandomValues(random);
const orderId='WEB-ENSAYO-'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
const all=[],used=new Set();
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
   const file=document.createElement('input');file.type='file';file.accept='.pdf,application/pdf';
   const mode=document.createElement('select');
   for(const [value,label] of [['bn','Blanco y negro'],['color','Color']]){
    const o=document.createElement('option');o.value=value;o.textContent=label;mode.append(o);
   }
   const btn=document.createElement('button');btn.type='button';btn.textContent='Enviar y verificar PDF';
   const msg=document.createElement('p');msg.className='state';
   btn.addEventListener('click',async()=>{
    const chosen=file.files?.[0],turnstileToken=window.turnstile?.getResponse();
    if(!chosen||!turnstileToken){msg.textContent='Seleccioná el PDF y completá la verificación de seguridad.';return}
    btn.disabled=true;file.disabled=true;mode.disabled=true;
    try{
     const result=await subirYVincularPdfCotizadorV2({
      archivo:chosen,referencia:r,orderId,modo:mode.value,turnstileToken,
      origin:location.origin,
      onProgress:p=>{msg.textContent=p.phase==='transferencia'?'Transferencia: '+p.completed+' de '+p.total+' bloques':p.phase}
     });
     msg.textContent='PDF recibido y verificado en Google · '+result.pages+' páginas · recibo '+result.receiptId+
      '. Precio comercial y autorización de pago: PENDIENTES.';
     btn.textContent='PDF verificado';d.confirmacion=result;
    }catch(e){
     msg.textContent='No se confirmó la recepción: '+String(e.message||e);
     btn.disabled=false;file.disabled=false;mode.disabled=false;
    }finally{window.turnstile?.reset()}
   });
   area.append(name,file,mode,btn,msg);div.append(area);
  }
  list.append(div);
 }
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type!=='SABER_ADD_PRINT')return;
 const p=event.data.payload;
 if(!p||p.type!=='print'||typeof p.name!=='string'||
    !Number.isFinite(p.price)||p.price<=0||
    !Array.isArray(p.pdfDrafts)||p.pdfDrafts.length>30)return;
 const refs=[],seen=new Set();
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
 status.textContent='Se agregó un trabajo. Los PDF están pendientes hasta que Google confirme su recepción. Pedido de prueba: '+orderId;
 render();
});
</script></body></html>`;
}
