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
#estado{margin:15px 0;padding:12px;background:#fff;border:1px solid #cddbe7;border-radius:10px}.forecast{border:1px solid #cddbe7;border-radius:12px;background:#fff;padding:16px;margin:14px 0}.forecast h2{margin-bottom:5px}.forecast .row{align-items:center}.weekly-view{font-size:15px;font-weight:600;margin:8px 0 10px}.agenda-editor{margin-top:10px;padding-top:10px;border-top:1px solid #d5e0e9}.agenda-editor summary{font-weight:700;color:#155a87;cursor:pointer}.days{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin:12px 0}.days label{font-weight:600}.days input{display:block;width:100%;font:inherit;padding:9px;border:1px solid #b3cad9;border-radius:8px;margin-top:3px}.agenda-editor textarea{width:100%;max-width:440px;display:block;min-height:90px;font:inherit;padding:10px;border:1px solid #b3cad9;border-radius:8px}
.board{display:grid;grid-template-columns:repeat(5,minmax(205px,1fr));gap:12px;overflow:auto}
.lane{background:#e7edf4;border-radius:12px;padding:12px;min-height:230px}
.lane h2{display:flex;justify-content:space-between;gap:5px}
.count{background:#fff;border-radius:16px;padding:0 9px}
.card{background:white;border:1px solid #d0dce9;border-radius:11px;margin-bottom:11px;padding:14px;overflow-wrap:anywhere}
.card strong{font-size:19px}.row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.banner{border-left:4px solid #db8d21;padding:9px;background:#fff7e8;margin:10px 0}#previsionCliente{font-weight:650;color:#1c5369}#previsionCliente.warning{border-left:4px solid #c27919;background:#fff5e6;padding:10px;color:#6f4400}
@media(max-width:800px){.board{grid-template-columns:1fr;overflow:visible}.lane{min-height:80px}}
</style></head><body><main>
<header><h1>Central de Pedidos · Librería Saber</h1><div class="row">
<a class="action" href="/personal/transferencias">Transferencias por verificar</a>
<button id="actualizar">Actualizar</button><button id="revisarMPLive" type="button">Verificar cobros Mercado Pago</button></div></header>
<p id="rescateMP" role="status" aria-live="polite"></p>
<section class="forecast" aria-labelledby="previsionTitle"><h2 id="previsionTitle">Previsión general de entrega</h2><p id="previsionEstado" role="status">Consultando previsión…</p><p id="previsionCliente" role="status" aria-live="polite">Verificando lo que ve el cliente…</p><div class="row"><label for="previsionModo">Plazo orientativo para pedidos nuevos</label><select id="previsionModo"><option value="por_confirmar">A confirmar</option><option value="hoy">Durante el día de hoy</option><option value="hoy_tarde">Hoy por la tarde</option><option value="proximo_dia">Próximo día de atención</option></select><button id="previsionGuardar" type="button">Guardar previsión</button></div><small>La fecha y hora exactas se fijan por pedido al comenzar la preparación. No se asignan automáticamente.</small></section>
<section class="forecast" aria-labelledby="agendaTitle">
<h2 id="agendaTitle">Días y horarios de atención</h2>
<p id="agendaResumen" class="weekly-view">Consultando horario guardado…</p>
<p id="agendaEstado" role="status"></p>
<details class="agenda-editor" id="agendaEditor"><summary>Editar días, horarios, feriados y cierres especiales</summary>
<div class="days">
<label>Lunes<input id="agendaMon" placeholder="07:00-13:30,16:30-20:00" maxlength="120"></label>
<label>Martes<input id="agendaTue" placeholder="07:00-13:30,16:30-20:00" maxlength="120"></label>
<label>Miércoles<input id="agendaWed" placeholder="07:00-13:30,16:30-20:00" maxlength="120"></label>
<label>Jueves<input id="agendaThu" placeholder="07:00-13:30,16:30-20:00" maxlength="120"></label>
<label>Viernes<input id="agendaFri" placeholder="07:00-13:30,16:30-20:00" maxlength="120"></label>
<label>Sábado<input id="agendaSat" placeholder="CERRADO" maxlength="120"></label>
<label>Domingo<input id="agendaSun" placeholder="CERRADO" maxlength="120"></label>
</div>
<label for="agendaCierres"><strong>Fechas sin atención (feriados y cierres especiales)</strong></label>
<textarea id="agendaCierres" placeholder="AAAA-MM-DD · una fecha por línea" spellcheck="false"></textarea>
<p><small>Un día sin horario significa cerrado. Los feriados se atienden normalmente salvo que agregues la fecha aquí. Para abrir un feriado, quitá su fecha de la lista.</small></p>
<button type="button" id="agendaGuardar">Guardar horario de atención</button>
</details></section>
<p class="banner">Solo se muestran pedidos con pago verificado. Antes de imprimir, comprobá cada original y la hoja de instrucciones.</p>
<p id="estado" role="status">Consultando pedidos…</p>
<div id="tablero" class="board"></div>
</main><script>
'use strict';
const columns=[['pendiente','Nuevos'],['en_preparacion','En preparación'],['en_espera','En espera'],['listo','Listos'],['entregado','Entregados']];
const board=document.getElementById('tablero'),info=document.getElementById('estado');
const short=x=>String(x||'').trim(),price=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const element=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
let working=false;let forecast=null;let agendaSnapshot=null;
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
async function revisarPlazoVisibleAlCliente(){
 const status=document.getElementById('previsionCliente');
 status.classList.remove('warning');
 try{
  const res=await fetch('/api/pedido/plazo',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true||typeof data.mode!=='string'||typeof data.label!=='string')
   throw Error('No hay respuesta válida de previsión del cliente');
  const saved=forecast?.settings?.mode;
  if(saved&&saved!==data.mode){
   status.classList.add('warning');
   status.textContent='Atención: la Central tiene «'+(forecastLabels[saved]||saved)+
    '», pero el cliente ve «'+data.label+'». '+(data.notice||'')+
    ' Revisá la previsión antes de recibir un nuevo trabajo.';
  }else{
   status.textContent='El cliente ve: «'+data.label+'».'+
    (data.estimatedDeadlineDate?' Fecha orientativa: '+data.estimatedDeadlineDate+'.':'');
  }
 }catch{
  status.classList.add('warning');
  status.textContent='No se pudo comprobar qué plazo ve el cliente. Revisá la previsión antes de comprometer una entrega.';
 }
}
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
const agendaDays=[['mon','Mon','Lunes'],['tue','Tue','Martes'],['wed','Wed','Miércoles'],['thu','Thu','Jueves'],['fri','Fri','Viernes'],['sat','Sat','Sábado'],['sun','Sun','Domingo']];
async function loadAgenda(force=false){
 if(document.getElementById('agendaEditor').open&&agendaSnapshot&&!force)return;
 const status=document.getElementById('agendaEstado');
 try{
  const res=await fetch('/personal/api/live-calendar',{credentials:'same-origin',cache:'no-store'});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true||!data.calendar||!data.calendar.weekly)
   throw Error('No se pudo consultar la agenda · HTTP '+res.status);
  const c=data.calendar;
  agendaSnapshot=c;
  agendaDays.forEach(([key,field])=>{
   document.getElementById('agenda'+field).value=c.weekly[key]||'';
  });
  document.getElementById('agendaCierres').value=(c.closedDates||[]).join('\\n');
  document.getElementById('agendaResumen').textContent=c.configured?
    'Lunes a viernes: '+[...new Set(['mon','tue','wed','thu','fri'].map(d=>c.weekly[d]))].join(' / ') +
    ' · Sábado: '+(c.weekly.sat||'CERRADO')+' · Domingo: '+(c.weekly.sun||'CERRADO'):
    'Agenda sin horarios guardados.';
  status.textContent='Agenda guardada · Revisión '+c.revision+' · Cierres especiales: '+(c.closedDates||[]).length;
 }catch(e){
  status.textContent='No se pudo consultar la agenda: '+String(e.message||e);
 }
}
async function saveAgenda(){
 if(!agendaSnapshot){window.alert('Primero cargá la agenda guardada.');return;}
 const weekly={};
 for(const [key,field] of agendaDays)weekly[key]=document.getElementById('agenda'+field).value.trim();
 const closedDates=document.getElementById('agendaCierres').value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
 if((weekly.sat||weekly.sun)&&!window.confirm('Los fines de semana normalmente están cerrados. ¿Querés registrar atención esos días?'))return;
 const operator=window.prompt('Responsable que confirma este horario:');
 if(operator===null)return;
 if(operator.trim().length<2){window.alert('Indicá un responsable.');return;}
 if(!window.confirm('¿Guardar los horarios y cierres especiales en la Central de producción?'))return;
 const button=document.getElementById('agendaGuardar');
 button.disabled=true;
 try{
  const res=await fetch('/personal/api/live-calendar',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({
    weekly,closedDates,expectedRevision:agendaSnapshot.revision,operator:operator.trim()})});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true||data.saved!==true)throw Error(data?.error||('HTTP '+res.status));
  await loadAgenda(true);
 }catch(e){window.alert('No se guardó la agenda: '+String(e.message||e));}
 finally{button.disabled=false;}
}
async function revisarCobrosMPLive(){
 const button=document.getElementById('revisarMPLive');
 const estado=document.getElementById('rescateMP');
 if(!window.confirm('¿Consultar a Mercado Pago los cobros pendientes? Solo se acreditarán pagos aprobados cuyo vendedor, importe y orden coincidan. No genera nuevos cobros.'))return;
 button.disabled=true;
 estado.textContent='Verificando cobros pendientes directamente con Mercado Pago…';
 try{
  const r=await fetch('/personal/api/live-reconcile',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
  const d=await r.json().catch(()=>null);
  if(!r.ok||d?.ok!==true)throw Error(d?.error||('HTTP '+r.status));
  estado.textContent='Verificados: '+d.revisados+' · Pagos recuperados: '+d.recuperados+
   ' · Sin pago confirmado: '+d.pendientes+' · Requieren revisión: '+d.enRevision+
   ' · Errores de consulta: '+d.errores+'.';
  await refresh();
 }catch(e){estado.textContent='No se completó la verificación: '+String(e.message||e)+'. No se generó ningún cobro.';}
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
  await loadAgenda();
  void revisarPlazoVisibleAlCliente();
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
document.getElementById('revisarMPLive').addEventListener('click',()=>void revisarCobrosMPLive());
document.getElementById('previsionGuardar').addEventListener('click',()=>void saveForecast());
document.getElementById('agendaGuardar').addEventListener('click',()=>void saveAgenda());
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},60000);
</script></body></html>`;
}
