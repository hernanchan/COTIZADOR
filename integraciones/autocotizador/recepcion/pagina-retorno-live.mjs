/** Retorno informativo de Mercado Pago LIVE.
 * El redirect NO acredita pagos: solo la Central conciliada en D1 lo hace.
 * Nunca se usan payment_id, status ni merchant_order de la URL para autorizar R2/TUS.
 */
const HOST='pedidos.libreriasaber.com.ar';
const ON='GO_COMERCIAL_CONFIRMADO';
export function paginaRetornoLive(request,env){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.protocol!=='https:'||u.hostname!==HOST||
    u.pathname!=='/pedido/estado'||env?.SABER_ENTORNO!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==ON)
  return new Response('No disponible',{status:404,headers:{'Cache-Control':'no-store'}});
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Estado del pedido | Librería Saber</title>
<style>section{margin-top:22px;padding-top:12px;border-top:1px solid #dae5ee}input{display:block;margin:12px 0;max-width:100%}body{font-family:system-ui,Arial,sans-serif;background:#f5f8fc;color:#183650;margin:0;padding:24px}
main{max-width:540px;margin:7vh auto;background:white;border:1px solid #dae5ee;border-radius:16px;padding:30px}
h1{font-size:24px}a{color:#075b91}button{font:inherit;padding:10px 16px;background:#113c69;color:#fff;border:0;border-radius:9px;cursor:pointer}
small{color:#526579}#estado{line-height:1.6}</style></head><body><main>
<h1>Volviste a Librería Saber</h1>
<p id="estado" role="status" aria-live="polite">Estamos verificando el estado de tu pedido. Volver desde Mercado Pago no significa que el pago ya esté acreditado.</p>
<button type="button" id="revisar">Consultar nuevamente</button>
<section id="recibir" hidden>
<h2>Enviar tus PDF después del pago</h2>
<p>Volvé a seleccionar exactamente los archivos que presupuestaste. Verificaremos sus huellas digitales antes de subirlos.</p>
<p id="indicacion"></p>
<input type="file" id="originales" accept=".pdf,application/pdf" multiple>
<button type="button" id="subir">Verificar y enviar PDF</button>
<p id="avance" role="status" aria-live="polite"></p>
</section>
<section id="recibirR2" hidden>
<h2>Enviar PDF grandes (R2)</h2>
<p>Seleccioná nuevamente los PDF de más de 40 MiB. La subida empieza solamente después del pago acreditado y usa transferencia reanudable.</p>
<input type="file" id="originalesR2" accept=".pdf,application/pdf" multiple>
<button type="button" id="subirR2">Enviar archivos grandes</button>
<p id="avanceR2" role="status" aria-live="polite"></p>
</section>
<p><a href="/cotizar">Volver al cotizador</a></p>
<small>Si Mercado Pago confirma el pago pero todavía no aparece acreditado, conservá el comprobante. No realices otro pago por este aviso.</small>
</main><script type="module">
// El estado del pago siempre se muestra, incluso si TUS está temporalmente cerrado.
(function(){
 const output=document.getElementById('estado');
 const button=document.getElementById('revisar');
 const receiving=document.getElementById('recibir');
 const input=document.getElementById('originales');
 const send=document.getElementById('subir');
 const progress=document.getElementById('avance');
 const hint=document.getElementById('indicacion');
 const receivingR2=document.getElementById('recibirR2');
 const inputR2=document.getElementById('originalesR2');
 const sendR2=document.getElementById('subirR2');
 const progressR2=document.getElementById('avanceR2');
 const tusReady=${env?.DOCS_LIVE_TUS_GATE===ON&&env?.DOCS_LIVE_RECEPCION_GATE===ON};
 const r2Ready=${env?.DOCS_LIVE_R2_GATE===ON&&env?.DOCS_LIVE_R2_UPLOAD_GATE===ON&&
  env?.DOCS_LIVE_R2_STAGING_GATE===ON&&env?.DOCS_LIVE_RECEPCION_GATE===ON};

 async function revisar(){
  let order;
  try{order=JSON.parse(sessionStorage.getItem('saber-live-pedido-v1')||'null')}catch{}
  if(!order||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(order.webOrderId||'')||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(order.commercialOrderId||'')){
   output.textContent='No encontramos la referencia de esta compra en esta pestaña. Consultá tu pedido desde el cotizador; no vuelvas a pagar por este mensaje.';
   return;
  }
  button.disabled=true;
  try{
   const response=await fetch('/api/pedido/live/checkout',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'status',webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId})});
   if(response.status===401){
    output.textContent='Tu sesión venció. Estamos recuperando el acceso a esta misma orden, sin cobrarte de nuevo.';
    location.replace('/pedido/continuar');
    return;
   }
   const data=await response.json();
   if(!response.ok||data?.ok!==true||data.webOrderId!==order.webOrderId||
     data.commercialOrderId!==order.commercialOrderId)throw Error('pendiente');
   const paid=data.estado==='pagado_esperando_archivos'&&data.uploadAuthorized===true;
   if(paid){
    try{
     const {leerPedidoPostpagoLive}=await import(tusReady?'/pedido/recepcion-tus.js':'/pedido/recepcion-r2.js');
     const saved=leerPedidoPostpagoLive(sessionStorage);
     if(saved.order.webOrderId!==order.webOrderId)throw Error('identidad');
     const small=saved.metas.filter(m=>m.transport==='tus');
     const large=saved.metas.filter(m=>m.transport==='r2');
     receiving.hidden=small.length===0||!tusReady;
     receivingR2.hidden=large.length===0||!r2Ready;
     hint.textContent=small.length+' PDF pequeños'+(large.length?' y '+large.length+' PDF grandes.':'');
     if((small.length&&!tusReady)||(large.length&&!r2Ready))
      output.textContent='Pago acreditado. Algunas rutas de recepción están temporalmente desactivadas. Contactá a Librería Saber; no pagues nuevamente.';
    }catch{receiving.hidden=true;output.textContent='Pago acreditado. La recepción de archivos está temporalmente indisponible o faltan las referencias de los PDF. Contactá a Librería Saber; no pagues nuevamente.';return}
   }else{receiving.hidden=true;receivingR2.hidden=true;}
   if(!output.textContent.includes('temporalmente desactivadas'))output.textContent=paid
    ?'Pago acreditado. Seleccioná los PDF en esta página para completar su recepción.'
    :data.estado==='revocado'
    ?'El pago no se encuentra vigente. Comunicate con Librería Saber antes de continuar.'
    :'El pago todavía está pendiente de acreditación. Podés consultar nuevamente.';
  }catch{output.textContent='No pudimos consultar la acreditación en este momento. Conservá tu comprobante y probá nuevamente; no repitas el pago.'}
  finally{button.disabled=false}
 }
 send.addEventListener('click',async()=>{
  send.disabled=true;
  progress.textContent='Comprobando tus PDF originales…';
  try{
   const {enviarPDFsTUSPagadosLive}=await import('/pedido/recepcion-tus.js');
   const result=await enviarPDFsTUSPagadosLive({
    selectedFiles:[...input.files],
    onProgress:p=>{progress.textContent=p.phase==='hash'
     ?'Comprobando integridad local del PDF…'
     :'Recibiendo y verificando documentos…'}
   });
   progress.textContent=result.pendingR2
    ?'PDF pequeños verificados. Los archivos grandes todavía deben enviarse por el circuito R2.'
    :'PDF recibidos y verificados. Librería Saber continuará con la preparación.';
   input.disabled=true;
  }catch{
   progress.textContent='No se confirmó la recepción de todos los PDF. Conservá los originales y reintentá; no pagues nuevamente.';
   send.disabled=false;
  }
 });
 sendR2.addEventListener('click',async()=>{
  if(!r2Ready)return;
  sendR2.disabled=true;
  progressR2.textContent='Comprobando integridad de archivos grandes…';
  try{
   const {enviarPDFsR2PagadosLive}=await import('/pedido/recepcion-r2.js');
   const result=await enviarPDFsR2PagadosLive({
    selectedFiles:[...inputR2.files],
    onProgress:p=>{progressR2.textContent=p.phase==='hash'
      ?'Identificando PDF original…'
      :'Transferencia y verificación R2: '+(p.percent??0)+'%'}
   });
   progressR2.textContent=result.ok
    ?'PDF grandes almacenados y SHA verificado. Falta inspección de contenido antes de imprimir.'
    :'No se confirmó el envío.';
   inputR2.disabled=true;
  }catch{
   progressR2.textContent='Envío o verificación pendiente. Conservá los originales para reintentar. No pagues de nuevo.';
   sendR2.disabled=false;
  }
 });
 button.addEventListener('click',revisar);revisar();
})();
</script></body></html>`;
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store, private','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline' https://releases.transloadit.com; style-src 'unsafe-inline'; connect-src 'self' https://*.storage.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'}});
}
