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
button:disabled{opacity:.55}a.action{display:inline-block;padding:9px 13px;border:1px solid #b3cad9;border-radius:8px;text-decoration:none;background:#eef7fd;font-weight:650}
#estado{margin:15px 0;padding:12px;background:#fff;border:1px solid #cddbe7;border-radius:10px}
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
<p class="banner">Solo se muestran pedidos con pago verificado. Antes de imprimir, comprobá cada original y la hoja de instrucciones.</p>
<p id="estado" role="status">Consultando pedidos…</p>
<div id="tablero" class="board"></div>
</main><script>
'use strict';
const columns=[['pendiente','Nuevos'],['en_preparacion','En preparación'],['en_espera','En espera'],['listo','Listos'],['entregado','Entregados']];
const board=document.getElementById('tablero'),info=document.getElementById('estado');
const short=x=>String(x||'').trim(),price=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const element=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
let working=false;
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
async function refresh(){
 if(working)return;working=true;info.textContent='Actualizando pedidos pagados…';
 try{
  const r=await fetch('/personal/api/live-board',{credentials:'same-origin',cache:'no-store'});
  const data=await r.json().catch(()=>null);
  if(!r.ok||data?.ok!==true||!Array.isArray(data.orders))throw Error('La Central no pudo confirmar los pedidos (HTTP '+r.status+').');
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
    const tools=element('div');tools.className='row';
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
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},60000);
</script></body></html>`;
}
