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
small{color:#526579}#estado{line-height:1.6}#seguimiento{background:#eff7fd;padding:16px;border-radius:12px;border:1px solid #bad2e4}#seguimiento p{margin:8px 0;font-size:16px}#seguimiento strong{font-size:18px;color:#073b62}#resumenArchivos{font-weight:650}#progreso-envio{display:block;width:100%;height:20px;margin:12px 0 7px}#progreso-envio[hidden]{display:none}#porcentaje-envio{font-size:18px;font-weight:800;color:#0b517a}#reintentar{background:#0c5688;margin:10px 0}button[hidden]{display:none}button:disabled{opacity:.6;cursor:wait}#aviso-subida{border:2px solid #aa650c;background:#fff5dd;color:#593710;font-size:17px;font-weight:750;line-height:1.55;padding:14px;border-radius:10px;margin:15px 0}</style></head><body><main>
<h1>Seguimiento de tu pedido</h1>
<p id="estado" role="status" aria-live="polite">Consultando pago y estado del trabajo en Librería Saber…</p>
<div id="seguimiento" role="status" aria-live="polite">
<p id="numeroPedido"><strong>Identificando tu pedido…</strong></p>
<p id="estadoTrabajo">Estado de preparación: consultando</p>
<p id="resumenArchivos">Archivos: consultando</p>
<p id="fechaRetiro">Entrega estimada: consultando</p>
</div>
<button type="button" id="revisar">Actualizar seguimiento</button>
<section id="recibir" hidden>
<h2>Recepción automática de originales</h2>
<p>Estamos enviando los PDF que elegiste al presupuestar. No necesitás volver a seleccionarlos ni pagar otra vez.</p>
<p id="aviso-subida">PDF pesado en proceso: mantené esta pestaña abierta hasta que confirmemos «Archivo recibido». No cierres el navegador ni apagues el dispositivo. Si se interrumpe, conservá esta pestaña para reintentar; nunca vuelvas a pagar por el mismo pedido.</p>
<p id="avance" role="status" aria-live="polite">Esperando confirmación del pago para iniciar la transferencia.</p>
<p id="avanceR2" role="status" aria-live="polite"></p>
<progress id="progreso-envio" max="100" value="0" hidden aria-label="Progreso total del envío de PDF"></progress>
<p id="porcentaje-envio" role="status" aria-live="polite"></p>
<button type="button" id="reintentar" hidden>Reintentar envío de archivos, sin volver a pagar</button>
</section>
<p><a href="/cotizar">Volver al cotizador</a></p>
<small>Si Mercado Pago confirma el pago pero todavía no aparece acreditado, conservá el comprobante. No realices otro pago por este aviso.</small>
</main><script type="module">
// El estado del pago siempre se muestra, incluso si TUS está temporalmente cerrado.
(function(){
 const output=document.getElementById('estado');
 const button=document.getElementById('revisar');
 const numero=document.getElementById('numeroPedido');
 const trabajo=document.getElementById('estadoTrabajo');
 const archivos=document.getElementById('resumenArchivos');
 const entrega=document.getElementById('fechaRetiro');
 const states={pendiente:'Pedido nuevo',en_preparacion:'En preparación',en_espera:'En espera',listo:'Listo para retirar',entregado:'Entregado'};
 const modes={por_confirmar:'A confirmar',hoy:'Durante el día de hoy',hoy_tarde:'Hoy por la tarde',proximo_dia:'Próximo día de atención'};
 const localDate=value=>new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))+' hs';
 function actualizarSeguimiento(data){
  const t=data.tracking;
  const known=sessionStorage.getItem('saber-live-numero-v1');
  numero.textContent=t?.numeroOrden?'Orden '+t.numeroOrden:
   /^[0-9]{3,8}$/.test(known||'')?'Orden '+known:'Tu pedido en Librería Saber';
  const verified=data.estado==='pagado_esperando_archivos'&&data.uploadAuthorized===true;
  trabajo.textContent=verified?'Estado del trabajo: '+(states[t?.productionState]||'Pedido pagado'):
   data.estado==='revocado'?'El pago no se encuentra vigente.':'Aguardando acreditación del pago.';
  const received=Number(data.fileCount||0)-Number(data.pendingFiles||0);
  let currentOrder;try{currentOrder=JSON.parse(sessionStorage.getItem('saber-live-pedido-v1')||'null')}catch{}
  const stagedR2=currentOrder?.webOrderId===data.webOrderId&&
   sessionStorage.getItem('saber-live-r2-recibido-'+currentOrder.webOrderId)==='ok';
  archivos.textContent=verified&&stagedR2&&data.pendingFiles>0?
   'Archivo grande almacenado. Confirmando su recepción sin repetir el pago.':
   verified?'Archivos recibidos: '+received+' de '+data.fileCount+
   (data.pendingFiles?' · Enviando automáticamente '+data.pendingFiles+' archivo(s). No cierres la pestaña.':' · Todos los originales fueron recibidos.'):
   'Los PDF se envían cuando el pago está confirmado.';
  entrega.textContent=verified&&t?.readyAt?'Retiro estimado: '+localDate(t.readyAt):
   verified?'Previsión orientativa: '+(modes[t?.forecastMode]||'A confirmar')+
     '. La hora exacta se informa al comenzar la preparación.':
   'El plazo se confirma después de acreditar el pago.';
 }
 let checking=false;
 const receiving=document.getElementById('recibir');
 const progress=document.getElementById('avance');
 const progressR2=document.getElementById('avanceR2');
 const bar=document.getElementById('progreso-envio');
 const percentage=document.getElementById('porcentaje-envio');
 const retry=document.getElementById('reintentar');
 const uploadNotice=document.getElementById('aviso-subida');
 let autoSending=false,lastAutoAttempt=0,autoAttempts=0;
 let lastOrder=null,lastData=null,lastMetas=null;
 function showProgress(value,phase,channel){
  if(Number.isFinite(value)&&value>=0&&value<=100){
   bar.hidden=false;bar.value=value;
   percentage.textContent='Envío '+channel+': '+value+' %'+
    (value===100?' · Archivo recibido y verificado':
    value===99?' · Esperando confirmación del servidor':'');
  }
  const labels={
   hash:'Comprobando la integridad del PDF original',
   upload:'Subiendo archivos protegidos',
   autorizacion:'Autorizando recepción segura',
   transferencia:'Transfiriendo partes del PDF',
   'recuperacion-servidor':'Comprobando si el archivo ya está almacenado',
   'recuperado-sin-reenvio':'Original recuperado sin repetir la subida',
   'verificacion-almacenamiento':'Finalizando el almacenamiento',
   'verificando-integridad':'Verificando integridad y registro en la Central',
   'verificando-recibos':'Validando el recibo de cada archivo en la Central',
   recibido:'Archivo recibido y verificado',
   'archivo-verificado':'Archivo recibido y verificado'
  };
  return (labels[phase]||'Preparando recepción segura')+
   (Number.isFinite(value)?' · '+value+' %':'');
 }
 const receiptFlag=web=>('saber-live-r2-recibido-'+web);
 async function enviarAutomaticamente(order,data,metas){
  if(autoSending||data.estado!=='pagado_esperando_archivos'||data.uploadAuthorized!==true)return;
  lastOrder=order;lastData=data;lastMetas=metas;
  const small=metas.filter(m=>m.transport==='tus');
  const large=metas.filter(m=>m.transport==='r2');
  const received=new Set(data.receivedFileIds||[]);
  const pendingTUS=small.some(m=>!received.has(m.fileId));
  // Recuperar recibos R2 anteriores aunque sessionStorage diga 'ok'.
  // El estado verdadero está en D1; el mismo PDF se confirma sin reenvío.
  const pendingR2=large.some(m=>!received.has(m.fileId));
  if(!pendingTUS&&!pendingR2){
   retry.hidden=true;
   uploadNotice.hidden=true;
   if(data.pendingFiles===0){
    progress.textContent='PDF recibidos. El pedido ya está confirmado y Librería Saber puede prepararlo.';
    try{
     const {borrarOriginalesLive}=await import('/cotizar/flujo-live.js');
     await borrarOriginalesLive({webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId,metas});
    }catch{}
   }else if(large.length){
    progress.textContent='Archivo recibido y verificado. Librería Saber realizará la inspección del PDF antes de imprimir.';
   }
   return;
  }
  if(Date.now()-lastAutoAttempt<Math.min(120000,15000*Math.max(1,autoAttempts)))return;
  lastAutoAttempt=Date.now();autoAttempts++;autoSending=true;receiving.hidden=false;
  uploadNotice.hidden=false;retry.hidden=true;
  try{
   if((pendingTUS&&!tusReady)||(pendingR2&&!r2Ready))
    throw Error('Recepción temporalmente desactivada');
   const {leerOriginalesLive}=await import('/cotizar/flujo-live.js');
   const all=await leerOriginalesLive({webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId,metas});
   const originals=metas.map((meta,i)=>({meta,file:all[i]}));
   if(pendingTUS){
    const selectedFiles=originals.filter(x=>x.meta.transport==='tus').map(x=>x.file);
    progress.textContent='Enviando automáticamente los archivos pequeños. No cierres esta pestaña.';
    const {enviarPDFsTUSPagadosLive}=await import('/pedido/recepcion-tus.js');
    await enviarPDFsTUSPagadosLive({selectedFiles,onProgress:p=>{
     progress.textContent=showProgress(p.percent,p.phase,'TUS');
    }});
    progress.textContent='Archivos pequeños recibidos y verificados por Librería Saber.';
   }
   if(pendingR2){
    const selectedFiles=originals.filter(x=>x.meta.transport==='r2').map(x=>x.file);
    progressR2.textContent='Enviando automáticamente PDF grandes por R2. No cierres esta pestaña.';
    const {enviarPDFsR2PagadosLive}=await import('/pedido/recepcion-r2.js');
    const result=await enviarPDFsR2PagadosLive({selectedFiles,onProgress:p=>{
     progressR2.textContent=showProgress(p.batchPercent,p.phase,'R2');
    }});
    if(result?.ok!==true)throw Error('PDF_R2_AUN_SIN_RECIBO');
    sessionStorage.setItem(receiptFlag(order.webOrderId),'ok');
    progressR2.textContent='Archivo recibido y verificado. Librería Saber revisará el original y las instrucciones antes de imprimir.';
    uploadNotice.hidden=true;retry.hidden=true;
   }
   autoAttempts=0;retry.hidden=true;
   // Refrescar la situación verificada en D1; nunca inferir recepción por el redirect MP.
   void revisar();
  }catch(error){
   progress.textContent='La recepción no está completa: '+
    String(error?.message||'Fallo temporal').slice(0,110)+
    '. Usá «Reintentar envío» desde esta misma pestaña. Si persiste, contactá a Librería Saber con tu número de orden. NO pagues nuevamente.';
   percentage.textContent='Pendiente de recepción · reintento disponible';
   retry.hidden=false;
  }finally{autoSending=false;}
 }
 retry.addEventListener('click',()=>{
  if(autoSending||!lastOrder||!lastData||!lastMetas)return;
  lastAutoAttempt=0;retry.hidden=true;
  void enviarAutomaticamente(lastOrder,lastData,lastMetas);
 });
 const tusReady=${env?.DOCS_LIVE_TUS_GATE===ON&&env?.DOCS_LIVE_RECEPCION_GATE===ON};
 const r2Ready=${env?.DOCS_LIVE_R2_GATE===ON&&env?.DOCS_LIVE_R2_UPLOAD_GATE===ON&&
  env?.DOCS_LIVE_R2_STAGING_GATE===ON&&env?.DOCS_LIVE_RECEPCION_GATE===ON};

 async function revisar(){
  if(checking)return;
  let order;
  try{order=JSON.parse(sessionStorage.getItem('saber-live-pedido-v1')||'null')}catch{}
  if(!order||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(order.webOrderId||'')||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(order.commercialOrderId||'')){
   output.textContent='No encontramos la referencia de esta compra en esta pestaña. Consultá tu pedido desde el cotizador; no vuelvas a pagar por este mensaje.';
   return;
  }
  checking=true;button.disabled=true;
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
   actualizarSeguimiento(data);
   const paid=data.estado==='pagado_esperando_archivos'&&data.uploadAuthorized===true;
   if(paid){
    try{
     const {leerPedidoPostpagoLive}=await import(tusReady?'/pedido/recepcion-tus.js':'/pedido/recepcion-r2.js');
     const saved=leerPedidoPostpagoLive(sessionStorage);
     if(saved.order.webOrderId!==order.webOrderId||saved.order.commercialOrderId!==order.commercialOrderId)
      throw Error('REFERENCIA_NO_COINCIDE');
     receiving.hidden=false;
     uploadNotice.hidden=data.pendingFiles===0||
      sessionStorage.getItem(receiptFlag(order.webOrderId))==='ok';
     output.textContent=data.pendingFiles===0?'Pago acreditado y archivos recibidos. Gracias por elegir Librería Saber.':
      sessionStorage.getItem(receiptFlag(order.webOrderId))==='ok'?
       'Pago acreditado. Confirmando el archivo grande ya almacenado; no pagues ni generes otra orden.':
       'Pago acreditado. Estamos recibiendo automáticamente los archivos que elegiste antes de pagar.';
     void enviarAutomaticamente(order,data,saved.metas);
    }catch{
     receiving.hidden=false;
     progress.textContent='El pago está acreditado, pero no se puede recuperar la referencia de los archivos en esta pestaña. Comunicate con Librería Saber sin pagar nuevamente.';
     output.textContent='Pago acreditado. Archivo pendiente de recepción.';
    }
   }else{
    receiving.hidden=true;
    if(sessionStorage.getItem('saber-live-medio-v1')==='transferencia'&&data.estado==='pendiente'){
     try{
      const tr=await fetch('/api/pedido/live/transfer',{method:'POST',credentials:'same-origin',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:'status',webOrderId:order.webOrderId,
        commercialOrderId:order.commercialOrderId})});
      const t=await tr.json().catch(()=>null);
      if(tr.ok&&t?.ok===true&&t.commercialOrderId===order.commercialOrderId&&
       t.paymentVerified===false&&t.uploadAuthorized===false){
       output.textContent=t.customerNotified===true?
        'Recibimos tu aviso «Ya transferí». Librería Saber verificará el ingreso bancario. No vuelvas a transferir.':
        'Transferencia elegida. Aún no recibimos tu aviso de pago.';
       trabajo.textContent=t.customerNotified===true?
        'Estado: transferencia informada, pendiente de verificación bancaria':
        'Estado: esperando aviso de transferencia';
       entrega.textContent='El trabajo comenzará después de verificarse el pago y recibir los originales.';
      }else output.textContent='Esperando comprobación bancaria. No vuelvas a pagar.';
     }catch{output.textContent='Consultando verificación bancaria. Conservá esta pestaña abierta.'}
    }else output.textContent=data.estado==='revocado'?
     'El pago no se encuentra vigente. Contactá a Librería Saber.':
     'Esperando acreditación en Mercado Pago. Consultaremos automáticamente sin generar otro cobro.';
   }
  }catch{output.textContent='No pudimos consultar la acreditación en este momento. Conservá tu comprobante y probá nuevamente; no repitas el pago.'}
  finally{checking=false;button.disabled=false}
 }
 button.addEventListener('click',revisar);revisar();
 setInterval(()=>{if(!document.hidden)void revisar()},15000);
})();
</script></body></html>`;
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store, private','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline' https://releases.transloadit.com; style-src 'unsafe-inline'; connect-src 'self' https://*.storage.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'}});
}
