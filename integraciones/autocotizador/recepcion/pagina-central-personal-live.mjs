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
.banner{border-left:4px solid #db8d21;padding:9px;background:#fff7e8;margin:10px 0}.eta-dialog{width:min(520px,calc(100vw - 24px));border:1px solid #b8cbdc;border-radius:14px;padding:24px;color:#103452;box-shadow:0 12px 45px #142f4b44}.eta-dialog::backdrop{background:#10263a77}.eta-dialog label{display:block;font-weight:700;margin:12px 0}.eta-dialog input,.eta-dialog textarea{display:block;width:100%;font:inherit;color:#103452;padding:12px;border:1px solid #adc5d8;border-radius:9px;margin-top:6px;background:white}.eta-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eta-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:15px}.eta-actions button[type=button]{background:#657a89}.eta-hint{padding:9px;background:#f1f7fb;border-left:3px solid #17658f}.eta-error{color:#9a3100;font-weight:650;min-height:26px}@media(max-width:550px){.eta-fields{grid-template-columns:1fr}.eta-dialog{padding:18px}}#previsionCliente{font-weight:650;color:#1c5369}#previsionCliente.warning{border-left:4px solid #c27919;background:#fff5e6;padding:10px;color:#6f4400}
@media(max-width:800px){.board{grid-template-columns:1fr;overflow:visible}.lane{min-height:80px}}
</style></head><body><main>
<header><h1>Central de Pedidos · Librería Saber</h1><div class="row">
<a class="action" id="transferenciasAviso" href="/personal/transferencias" role="status" aria-live="polite">Transferencias informadas: consultando…</a>
<button id="actualizar">Actualizar</button></div></header>
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
<section class="forecast" aria-labelledby="transferNewTitle">
<h2 id="transferNewTitle">Nuevas transferencias por verificar · <span id="transferNewCount">0</span></h2>
<p>Solo aparecen cuando el cliente pulsa «Ya transferí». Para acreditar el pedido, comprobá primero el ingreso bancario.</p>
<div id="transferNewList" role="status" aria-live="polite">Consultando avisos de clientes…</div>
</section>
<p class="banner">Solo se muestran pedidos con pago verificado. Antes de imprimir, comprobá cada original y la hoja de instrucciones.</p>
<p id="estado" role="status">Consultando pedidos…</p>
<div id="tablero" class="board"></div>
<dialog id="etaDialog" class="eta-dialog" aria-labelledby="etaTitle">
<h2 id="etaTitle">Definir fecha y hora de retiro</h2>
<p>Elegí el día desde el calendario y la hora de retiro. Se informarán al cliente al guardar.</p>
<form id="etaForm">
<div class="eta-fields">
<label for="etaDate">Fecha de retiro<input id="etaDate" type="date" required></label>
<label for="etaTime">Hora de retiro<input id="etaTime" type="time" step="300" required></label>
</div>
<p id="etaHorario" class="eta-hint">Elegí un día para ver los horarios de atención.</p>
<label for="etaOperator">Responsable<input id="etaOperator" type="text" maxlength="60" minlength="2" placeholder="Nombre del operador" required></label>
<div id="etaReasonBlock" hidden><label for="etaReason">Motivo de la modificación o demora<textarea id="etaReason" maxlength="240" rows="2" placeholder="Se requiere al retrasar un retiro informado"></textarea></label></div>
<p id="etaMessage" class="eta-error" role="status" aria-live="polite"></p>
<div class="eta-actions"><button type="button" id="etaCancel">Cancelar</button><button type="submit" id="etaSave">Guardar fecha y hora</button></div>
</form></dialog>
<dialog id="stageDialog" class="eta-dialog" aria-labelledby="stageTitle">
<h2 id="stageTitle">Actualizar estado del trabajo</h2>
<form id="stageForm">
<p id="stageDescription"></p>
<label for="stageOperator">Responsable<input id="stageOperator" type="text" minlength="2" maxlength="60" required placeholder="Nombre del operador"></label>
<div id="stageReasonWrap" hidden><label for="stageReason">Motivo de la espera<textarea id="stageReason" minlength="5" maxlength="180" rows="2"></textarea></label></div>
<label for="stageConfirmed"><input id="stageConfirmed" type="checkbox" required> <span id="stageConfirmText">Confirmo el cambio de estado.</span></label>
<p id="stageMessage" class="eta-error" role="status" aria-live="polite"></p>
<div class="eta-actions"><button id="stageCancel" type="button">Cancelar</button><button id="stageSave" type="submit">Guardar estado</button></div>
</form></dialog>
</main><script>
'use strict';
const columns=[['pendiente','Nuevos'],['en_preparacion','En preparación'],['en_espera','En espera'],['listo','Listos']];
const board=document.getElementById('tablero'),info=document.getElementById('estado');
const short=x=>String(x||'').trim(),price=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const element=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
let working=false;let forecast=null;let agendaSnapshot=null;
const stageDialog=document.getElementById('stageDialog');
let stageTransition=null;
function changeState(order,next,btn){
 if(stageDialog.open)return;
 const titles={en_preparacion:'Iniciar preparación',en_espera:'Poner en espera',
  listo:'Marcar listo para retirar',entregado:'Confirmar entrega y borrar originales'};
 if(!titles[next])return;
 stageTransition={order,next,btn};
 document.getElementById('stageTitle').textContent=titles[next]+' · Orden '+order.numeroOrden;
 document.getElementById('stageDescription').textContent=
  'Se actualizará el estado para el cliente y para la Central en el mismo momento.';
 const operator=document.getElementById('stageOperator');
 operator.value=sessionStorage.getItem('saber-central-operador')||'';
 const reasonWrap=document.getElementById('stageReasonWrap');
 reasonWrap.hidden=next!=='en_espera';
 document.getElementById('stageReason').required=next==='en_espera';
 document.getElementById('stageReason').value='';
 document.getElementById('stageConfirmText').textContent=
  next==='en_preparacion'?
   'Revisé los originales, medidas y la hoja de instrucciones antes de comenzar la producción.':
  next==='listo'?
   'Confirmo que este trabajo está listo para retirar.':
  next==='entregado'?
   'Confirmo que entregué el trabajo y autorizo borrar definitivamente todos sus originales PDF privados.':
   'Confirmo que corresponde pausar el trabajo y avisar al cliente.';
 document.getElementById('stageConfirmed').checked=false;
 document.getElementById('stageMessage').textContent='';
 stageDialog.showModal();
}
async function saveProductionState(e){
 e.preventDefault();
 if(!stageTransition)return;
 const {order,next,btn}=stageTransition;
 const operator=document.getElementById('stageOperator').value.trim();
 const reason=document.getElementById('stageReason').value.trim();
 const message=document.getElementById('stageMessage');
 if(operator.length<2){message.textContent='Indicá el responsable.';return}
 if(next==='en_espera'&&reason.length<5){message.textContent='Indicá el motivo de la espera.';return}
 if(!document.getElementById('stageConfirmed').checked){
  message.textContent='Confirmá la revisión requerida para este estado.';return;
 }
 const save=document.getElementById('stageSave');
 save.disabled=true;btn.disabled=true;
 message.textContent='Registrando estado…';
 try{
  const res=await fetch('/personal/api/live-status',{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({orderId:order.orderId,from:order.productionState||'pendiente',
    to:next,version:order.productionVersion||0,operator,reason,confirmed:true})
  });
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true)throw Error(data?.error||('HTTP '+res.status));
  sessionStorage.setItem('saber-central-operador',operator);
  stageDialog.close();stageTransition=null;
  await refresh();
  if(next==='entregado')
   info.textContent=data.originalsDeleted===true?
    'Orden '+order.numeroOrden+' entregada. Borrado de originales TUS/R2 confirmado.':
    'Orden '+order.numeroOrden+' entregada. Borrado de originales pendiente: el sistema reintentará automáticamente.';
 }catch(error){message.textContent='No se guardó el estado: '+String(error.message||error)}
 finally{save.disabled=false;btn.disabled=false}
}
document.getElementById('stageCancel').addEventListener('click',()=>stageDialog.close());
document.getElementById('stageForm').addEventListener('submit',e=>void saveProductionState(e));
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

const etaDialog=document.getElementById('etaDialog'),etaDate=document.getElementById('etaDate'),
 etaTime=document.getElementById('etaTime'),etaOperator=document.getElementById('etaOperator'),
 etaReason=document.getElementById('etaReason'),etaMessage=document.getElementById('etaMessage'),
 etaHorario=document.getElementById('etaHorario');
let etaOrder=null;
function cordobaLocal(date){
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Cordoba',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(f.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
function etaHorarioActual(){
 const date=etaDate.value,time=etaTime.value,agenda=agendaSnapshot;
 if(!date){etaHorario.textContent='Elegí una fecha para consultar horarios.';return null}
 if(!agenda?.configured){etaHorario.textContent='Agenda sin horarios verificados: comprobá el horario antes de confirmar.';return null}
 if((agenda.closedDates||[]).includes(date)){
  etaHorario.textContent='El local está cerrado en esta fecha (feriado o cierre especial).';return false;
 }
 const day=new Date(date+'T12:00:00-03:00').getUTCDay();
 const key=['sun','mon','tue','wed','thu','fri','sat'][day];
 const windows=String(agenda.weekly?.[key]||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!windows.length){etaHorario.textContent='Día sin atención. Elegí otra fecha.';return false}
 etaHorario.textContent='Horario del día: '+windows.join(' y ')+'.';
 if(!time)return null;
 const minutes=word=>{
  const parts=word.split(':');
  return parts.length===2&&parts.every(n=>/^[0-9]{2}$/.test(n))?
   Number(parts[0])*60+Number(parts[1]):NaN;
 };
 return windows.some(w=>{
  const edges=w.split('-').map(v=>minutes(v.trim()));
  return edges.length===2&&minutes(time)>=edges[0]&&minutes(time)<=edges[1];
 });
}
function etaReasonActual(){
 const existing=forecast?.estimates?.find(e=>e.orderId===etaOrder?.orderId);
 const value=etaDate.value&&etaTime.value?Date.parse(etaDate.value+'T'+etaTime.value+':00-03:00'):NaN;
 const postponed=Boolean(existing?.readyAt)&&Number.isFinite(value)&&value>Date.parse(existing.readyAt);
 document.getElementById('etaReasonBlock').hidden=!postponed;
 etaReason.required=postponed;
 if(!postponed)etaReason.value='';
}
function openOrderEta(o){
 etaOrder=o;etaMessage.textContent='';
 document.getElementById('etaTitle').textContent='Retiro estimado · Orden '+o.numeroOrden;
 const existing=forecast?.estimates?.find(e=>e.orderId===o.orderId);
 const saved=existing?.readyAt?cordobaLocal(new Date(existing.readyAt)):'';
 etaDate.min=cordobaLocal(new Date()).slice(0,10);
 etaDate.max=cordobaLocal(new Date(Date.now()+45*24*60*60*1000)).slice(0,10);
 etaDate.value=saved.slice(0,10);
 etaTime.value=saved.slice(11,16);
 etaOperator.value=sessionStorage.getItem('saber-eta-responsable')||'';
 etaReason.value='';
 etaHorarioActual();etaReasonActual();etaDialog.showModal();
}
async function guardarEtaConCalendario(event){
 event.preventDefault();
 if(!etaOrder)return;
 const date=etaDate.value,time=etaTime.value,operator=etaOperator.value.trim();
 if(!date||!time){etaMessage.textContent='Elegí fecha y hora.';return}
 if(etaHorarioActual()===false){etaMessage.textContent='Elegí un día y hora dentro del horario de atención.';return}
 const value=Date.parse(date+'T'+time+':00-03:00'),now=Date.now();
 if(!Number.isFinite(value)||value<now+5*60000||value>now+45*24*3600000){
  etaMessage.textContent='Elegí una fecha futura entre 5 minutos y 45 días.';return;
 }
 if(operator.length<2||operator.length>60){etaMessage.textContent='Ingresá el responsable.';return}
 const previous=forecast?.estimates?.find(e=>e.orderId===etaOrder.orderId);
 const delayed=Boolean(previous?.readyAt)&&value>Date.parse(previous.readyAt);
 const reason=delayed?etaReason.value.trim():'';
 if(delayed&&reason.length<5){etaMessage.textContent='Indicá el motivo del retraso (mínimo cinco caracteres).';return}
 const button=document.getElementById('etaSave');button.disabled=true;
 etaMessage.textContent='Guardando la fecha de retiro…';
 try{
  const response=await fetch('/personal/api/live-forecast',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({
    action:'order',expectedRevision:previous?.version||0,mode:null,
    orderId:etaOrder.orderId,readyAt:new Date(value).toISOString(),operator,reason})});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)throw Error(result?.error||('HTTP '+response.status));
  sessionStorage.setItem('saber-eta-responsable',operator);
  etaDialog.close();etaOrder=null;await refresh();
 }catch(error){etaMessage.textContent='No se pudo guardar: '+String(error.message||error)}
 finally{button.disabled=false}
}
etaDate.addEventListener('change',()=>{etaMessage.textContent='';etaHorarioActual();etaReasonActual()});
etaTime.addEventListener('change',()=>{etaMessage.textContent='';etaHorarioActual();etaReasonActual()});
document.getElementById('etaCancel').addEventListener('click',()=>etaDialog.close());
document.getElementById('etaForm').addEventListener('submit',e=>void guardarEtaConCalendario(e));
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
async function actualizarAvisosTransferencia(){
 const target=document.getElementById('transferenciasAviso');
 try{
  const response=await fetch('/personal/api/live-transferencias-pendientes',
   {credentials:'same-origin',cache:'no-store'});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true||!Array.isArray(result.pending))throw Error('Sin conexión');
  const avisadas=result.pending.filter(r=>r.customerNotified===true);
  const reported=avisadas.length;
  const unreported=result.pending.length-reported;
  document.getElementById('transferNewCount').textContent=String(reported);
  const list=document.getElementById('transferNewList');
  list.replaceChildren();
  if(!reported)list.append(element('small','Sin nuevos avisos de transferencia.'));
  for(const item of avisadas){
   const link=element('a','Orden '+short(item.numero_orden||'---')+' · '+price(item.amount_ars)+
    ' · '+short(item.nombre||'Cliente')+' · Verificar en el banco');
   link.className='action';link.href='/personal/transferencias';
   link.style.margin='5px';list.append(link);
  }
  target.textContent='Transferencias avisadas por clientes: '+reported+
   (unreported?' · Solicitudes sin aviso: '+unreported:'');
  target.style.background=reported?'#ffe3a9':'#dde9f1';
  target.style.color='#143b61';
  target.title=reported?'Hay pagos informados que deben verificarse en la cuenta bancaria':
   'Todavía no hay avisos de transferencia; no significa que todos los pagos estén acreditados';
 }catch{
  target.textContent='No se pudo consultar los avisos de transferencias';
 }
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
    card.append(element('p','Archivos PDF recibidos: '+o.receivedCount+' de '+o.fileCount));
    const note=o.pendingCount>0?
      'Pago acreditado. Esperando el envío de '+o.pendingCount+' archivo(s) del cliente.':
      'Archivos listos para descargar. Revisar originales e instrucciones antes de imprimir.';
    card.append(element('p',note));
    const estimate=forecast.estimates.find(e=>e.orderId===o.orderId);
    if(estimate?.readyAt)card.append(element('p','Retiro estimado: '+formatDate(estimate.readyAt)+' (provisional)'));
    else if(['pendiente','en_preparacion'].includes(state))card.append(element('p','Previsión orientativa: '+(forecastLabels[forecast.settings.mode]||'A confirmar')+'. Hora exacta pendiente.'));
    const tools=element('div');tools.className='row';
    if(['pendiente','en_preparacion','en_espera'].includes(state)){
     const time=element('button',estimate?.readyAt?'Modificar hora estimada':'Definir hora estimada');
     time.addEventListener('click',()=>openOrderEta(o));tools.append(time);
    }
    if(o.zipEnabled===true&&o.pendingCount===0&&
       /^WEB-ENSAYO-[A-F0-9]{32}$/.test(o.webOrderId)){
     const link=element('a','Descargar ZIP + instrucciones');link.className='action';
     link.href='/personal/paquete?webOrderId='+encodeURIComponent(o.webOrderId);
     link.target='_blank';link.rel='noopener noreferrer';tools.append(link);
    }else if(o.pendingCount>0){
     card.append(element('small','El ZIP aparecerá automáticamente cuando termine de recibirse el archivo. No hay pasos técnicos adicionales.'));
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
    if(state==='listo'){
     const deliver=element('button','Entregado · borrar originales');
     deliver.disabled=o.deliveryEnabled!==true;
     deliver.title=deliver.disabled?'La eliminación segura TUS/R2 aún no está habilitada':'Confirmar entrega y eliminación de archivos';
     deliver.addEventListener('click',()=>void changeState(o,'entregado',deliver));
     tools.append(deliver);
     if(deliver.disabled)card.append(element('small','Entrega bloqueada hasta habilitar y validar la purga segura de TUS/R2.'));
    }
    card.append(tools);lane.append(card);total++;
   }
   board.append(lane);
  }
  info.textContent=total+' pedido(s) activos · Actualizado '+
   new Date().toLocaleTimeString('es-AR')+'.'+
   (Number.isSafeInteger(data.cleanupPendingCount)&&data.cleanupPendingCount>0?
     ' Atención: '+data.cleanupPendingCount+
     ' pedido(s) ya entregados tienen originales pendientes de eliminación o sin cola. El sistema reintentará los que estén en cola.':'');
 }catch(e){info.textContent=String(e.message||e)+' No se modificó ningún pedido.'}
 finally{working=false;}
}
document.getElementById('actualizar').addEventListener('click',()=>void refresh());
document.getElementById('previsionGuardar').addEventListener('click',()=>void saveForecast());
document.getElementById('agendaGuardar').addEventListener('click',()=>void saveAgenda());
void refresh();
void actualizarAvisosTransferencia();
setInterval(()=>{if(!document.hidden)void actualizarAvisosTransferencia()},15000);
// El primer refresco comprueba de nuevo los cobros conciliados en segundo plano.
setTimeout(()=>{if(!document.hidden)void refresh()},12000);
setInterval(()=>{if(!document.hidden)void refresh()},15000);
</script></body></html>`;
}
