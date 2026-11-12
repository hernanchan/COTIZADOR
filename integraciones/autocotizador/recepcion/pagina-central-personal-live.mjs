/** Central de Pedidos LIVE: misma autenticación personal Basic, sin claves nuevas. */
export function paginaCentralPersonalLive(){
return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Central de Pedidos · Librería Saber</title>
<style>
:root{font:16px/1.5 system-ui,Arial,sans-serif;color:#103452;background:#f1f5f9}
*{box-sizing:border-box}body{margin:0;padding:15px}main{max-width:1320px;margin:auto}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:clamp(22px,3vw,32px);margin:10px 0}
h2{font-size:18px;margin:0 0 12px}p{margin:8px 0}small{color:#4d6375}
a{color:#075b99}button{border:0;border-radius:9px;padding:11px 15px;color:white;background:#155a87;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.55}select{padding:10px;border:1px solid #b3cad9;border-radius:8px;font:inherit;background:white;color:#103452}a.action{display:inline-block;padding:9px 13px;border:1px solid #b3cad9;border-radius:8px;text-decoration:none;background:#eef7fd;font-weight:650}
#estado{margin:15px 0;padding:12px;background:#fff;border:1px solid #cddbe7;border-radius:10px}.forecast{border:1px solid #cddbe7;border-radius:12px;background:#fff;padding:16px;margin:14px 0}.forecast h2{margin-bottom:5px}.forecast .row{align-items:center}
.board{display:grid;grid-template-columns:repeat(5,minmax(205px,1fr));gap:12px;overflow:auto}
.lane{background:#e7edf4;border-radius:12px;padding:12px;min-height:230px}
.lane h2{display:flex;justify-content:space-between;gap:5px}
.count{background:#fff;border-radius:16px;padding:0 9px}
.card{background:white;border:1px solid #d0dce9;border-radius:11px;margin-bottom:11px;padding:14px;overflow-wrap:anywhere}
.card strong{font-size:19px}.row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.banner{border-left:4px solid #db8d21;padding:9px;background:#fff7e8;margin:10px 0}
@media(max-width:800px){.board{grid-template-columns:1fr;overflow:visible}.lane{min-height:80px}}
</style></head><body><main>
<header><h1>Central de Pedidos · Librería Saber</h1><div class="row">
<a class="action" href="/personal/transferencias">Transferencias por verificar</a>
<button id="actualizar">Actualizar</button></div></header>
<section class="forecast" aria-labelledby="previsionTitle"><h2 id="previsionTitle">Previsión general de entrega</h2><p id="previsionEstado" role="status">Consultando previsión…</p><div class="row"><label for="previsionModo">Plazo orientativo para pedidos nuevos</label><select id="previsionModo"><option value="por_confirmar">A confirmar</option><option value="hoy">Durante el día de hoy</option><option value="hoy_tarde">Hoy por la tarde</option><option value="proximo_dia">Próximo día de atención</option></select><button id="previsionGuardar" type="button">Guardar previsión</button></div><small>La fecha y hora exactas se fijan por pedido al comenzar la preparación. No se asignan automáticamente.</small></section>
<p class="banner">Solo se muestran pedidos con pago verificado. Antes de imprimir, comprobá cada original y la hoja de instrucciones.</p>
<p id="estado" role="status">Consultando pedidos…</p>
<div id="tablero" class="board"></div>
</main><script>
'use strict';
const columns=[['pendiente','Nuevos'],['en_preparacion','En preparación'],['en_espera','En espera'],['listo','Listos'],['entregado','Entregados']];
const board=document.getElementById('tablero'),info=document.getElementById('estado');
const short=x=>String(x||'').trim(),price=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const element=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
let working=false;let forecast=null;
async function changeState(order,next,btn){
 const operator=window.prompt('Nombre de quien realiza el cambio de estado:');
 if(operator===null)return;
 if(operator.trim().length<2){window.alert('Ingresá el responsable.');return;}
 let reason='';
 if(next==='en_espera'){
  const r=window.prompt('Motivo de la espera (mínimo cinco caracteres):');
  if(r===null)return;reason=r.trim();
  if(reason.length<5){window.alert('Falta el motivo.');return;}
 }
 const message=next==='en_preparacion'?
  '¿Revisaste los PDF originales, medidas e instrucciones y confirmás INICIAR la producción?':
  next==='listo'?'¿Confirmás que la orden está LISTA para retirar?':
  '¿Confirmás que querés pausar este trabajo?';
 if(!window.confirm(message))return;
 btn.disabled=true;
 try{
  const res=await fetch('/personal/api/live-status',{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({orderId:order.orderId,from:order.productionState||'pendiente',
    to:next,version:order.productionVersion||0,operator:operator.trim(),reason,confirmed:true})
  });
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true)throw Error(data?.error||('HTTP '+res.status));
  await refresh();
 }catch(e){window.alert('No se cambió el estado: '+String(e.message||e));}
 finally{btn.disabled=false;}
}
const forecastLabels={por_confirmar:'A confirmar',hoy:'Durante el día de hoy',hoy_tarde:'Hoy por la tarde',proximo_dia:'Próximo día de atención'};
const formatDate=iso=>{try{return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Cordoba',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso))+' hs'}catch{return 'Fecha no válida'}};
async function saveForecast(){
 if(!forecast?.settings){window.alert('Previsión no cargada. Actualizá la Central.');return;}
 const mode=document.getElementById('previsionModo').value;
 if(mode===forecast.settings.mode)return;
 const operator=window.prompt('Nombre del responsable que confirma la previsión:');
 if(operator===null)return;
 if(operator.trim().length<2){window.alert('Indicá el responsable.');return;}
 if(!window.confirm('¿Guardar previsión: '+forecastLabels[mode]+'? Es orientativa y no fija hora.'))return;
 const button=document.getElementById('previsionGuardar');button.disabled=true;
 try{
  const res=await fetch('/personal/api/live-forecast',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'global',expectedRevision:forecast.settings.revision,mode,orderId:null,readyAt:null,operator:operator.trim(),reason:''})});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true)throw Error(data?.error||('HTTP '+res.status));
  await refresh();
 }catch(e){window.alert('No se guardó la previsión: '+String(e.message||e));}
 finally{button.disabled=false;}
}
async function saveOrderEta(o,button){
 const existing=forecast?.estimates?.find(e=>e.orderId===o.orderId);
 const typed=window.prompt('Fecha y hora estimada para orden '+o.numeroOrden+' (AAAA-MM-DD HH:MM, hora Córdoba):');
 if(typed===null)return;
 const value=typed.trim();
 if(!/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/.test(value)){window.alert('Usá AAAA-MM-DD HH:MM.');return;}
 const iso=new Date(value.replace(' ','T')+':00-03:00').toISOString();
 let reason='';
 if(existing?.readyAt&&new Date(iso)>new Date(existing.readyAt)){
  const answer=window.prompt('Motivo por el que se retrasa el pedido (mínimo 5 caracteres):');
  if(answer===null)return;reason=answer.trim();if(reason.length<5){window.alert('Indicá el motivo.');return;}
 }
 const operator=window.prompt('Responsable que confirma esta hora:');
 if(operator===null)return;
 if(operator.trim().length<2){window.alert('Indicá el responsable.');return;}
 if(!window.confirm('¿Guardar la hora estimada '+value+' para la orden '+o.numeroOrden+'?'))return;
 button.disabled=true;
 try{
  const res=await fetch('/personal/api/live-forecast',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'order',expectedRevision:existing?.version||0,mode:null,orderId:o.orderId,readyAt:iso,operator:operator.trim(),reason})});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true)throw Error(data?.error||('HTTP '+res.status));
  await refresh();
 }catch(e){window.alert('No se guardó la hora: '+String(e.message||e));}
 finally{button.disabled=false;}
}
async function refresh(){

 if(working)return;working=true;info.textContent='Actualizando pedidos pagados…';
 try{
  const r=await fetch('/personal/api/live-board',{credentials:'same-origin',cache:'no-store'});
  const data=await r.json().catch(()=>null);
  if(!r.ok||data?.ok!==true||!Array.isArray(data.orders))throw Error('La Central no pudo confirmar los pedidos (HTTP '+r.status+').');
  const prevision=await fetch('/personal/api/live-forecast',{credentials:'same-origin',cache:'no-store'});
  const f=await prevision.json().catch(()=>null);
  if(!prevision.ok||f?.ok!==true||!f.settings||!Array.isArray(f.estimates))throw Error('La previsión de entrega no está disponible (HTTP '+prevision.status+').');
  forecast=f;
  document.getElementById('previsionModo').value=f.settings.mode;
  document.getElementById('previsionEstado').textContent='Previsión vigente: '+(forecastLabels[f.settings.mode]||'A confirmar')+' · Revisión '+f.settings.revision;
  board.replaceChildren();
  let total=0;
  for(const [state,title] of columns){
   const lane=element('section');lane.className='lane';lane.id='lane-'+state;
   const rows=data.orders.filter(o=>(o.productionState||'pendiente')===state);
   const heading=element('h2',title);const count=element('span',String(rows.length));count.className='count';heading.append(count);
   lane.append(heading);
   if(!rows.length)lane.append(element('small','Sin pedidos'));
   for(const o of rows){
    const card=element('article');card.className='card';
    card.append(element('strong','Orden '+short(o.numeroOrden)));
    card.append(element('p',price(o.amountArs)+' · Pago acreditado'));
    const customer=short(o.nombreCliente)||'Cliente no informado';
    card.append(element('p',customer));
    if(o.telefonoContacto)card.append(element('p','Tel.: '+short(o.telefonoContacto)));
    if(o.direccionCliente)card.append(element('p',short(o.direccionCliente)));
    card.append(element('p','PDF '+o.receivedCount+'/'+o.fileCount+' recibidos · TUS '+o.tusCount+' · R2 '+o.r2Count));
    const note=o.pendingCount>0?'Pendiente de recepción de '+o.pendingCount+' archivo(s)':
      'Originales recibidos; revisar preprensa antes de imprimir';
    card.append(element('p',note));
    const estimate=forecast.estimates.find(e=>e.orderId===o.orderId);
    if(estimate?.readyAt)card.append(element('p','Retiro estimado: '+formatDate(estimate.readyAt)+' (provisional)'));
    else if(['pendiente','en_preparacion'].includes(state))card.append(element('p','Previsión orientativa: '+(forecastLabels[forecast.settings.mode]||'A confirmar')+'. Hora exacta pendiente.'));
    const tools=element('div');tools.className='row';
    if(['pendiente','en_preparacion','en_espera'].includes(state)){
     const time=element('button',estimate?.readyAt?'Modificar hora estimada':'Definir hora estimada');
     time.addEventListener('click',()=>void saveOrderEta(o,time));tools.append(time);
    }
    if(o.pendingCount===0&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(o.webOrderId)){
     const link=element('a','Descargar ZIP + instrucciones');link.className='action';
     link.href='/personal/paquete?webOrderId='+encodeURIComponent(o.webOrderId);
     link.target='_blank';link.rel='noopener noreferrer';tools.append(link);
    }else if(o.r2Count>0){
     const link=element('a','Verificar PDF R2');link.className='action';
     link.href='/personal/paquete?webOrderId='+encodeURIComponent(o.webOrderId);
     link.target='_blank';link.rel='noopener noreferrer';tools.append(link);
    }
    if(state==='pendiente'&&o.pendingCount===0){
     const start=element('button','Iniciar preparación');
     start.addEventListener('click',()=>void changeState(o,'en_preparacion',start));
     tools.append(start);
    }
    if(state==='en_preparacion'){
     const ready=element('button','Marcar listo');
     ready.addEventListener('click',()=>void changeState(o,'listo',ready));tools.append(ready);
     const hold=element('button','En espera');
     hold.addEventListener('click',()=>void changeState(o,'en_espera',hold));tools.append(hold);
    }
    if(state==='en_espera'){
     const resume=element('button','Retomar preparación');
     resume.addEventListener('click',()=>void changeState(o,'en_preparacion',resume));tools.append(resume);
    }
    if(state==='listo')card.append(element('small','Entrega: pendiente de habilitar eliminación segura de originales; no borrar ni cerrar todavía.'));
    card.append(tools);lane.append(card);total++;
   }
   board.append(lane);
  }
  info.textContent=total+' pedido(s) pagados verificados · Actualizado '+new Date().toLocaleTimeString('es-AR')+'.';
 }catch(e){info.textContent=String(e.message||e)+' No se modificó ningún pedido.'}
 finally{working=false;}
}
document.getElementById('actualizar').addEventListener('click',()=>void refresh());
document.getElementById('previsionGuardar').addEventListener('click',()=>void saveForecast());
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},60000);
</script></body></html>`;
}
