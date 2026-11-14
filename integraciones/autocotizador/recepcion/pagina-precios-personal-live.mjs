/** Ficha de precios LIVE. Misma autenticación Basic de la Central de Pedidos. */
export function paginaPreciosPersonalLive(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Administrar precios · Librería Saber</title>
<style>
:root{font:16px/1.5 system-ui,Arial,sans-serif;color:#103452;background:#f1f5f9}
*{box-sizing:border-box}body{margin:0;padding:16px}main{max-width:1180px;margin:auto}
header{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}
h1{font-size:clamp(24px,3vw,34px);margin:8px 0}h2{font-size:20px;margin:10px 0}
p{margin:9px 0}a{color:#125b88}
a.back{display:inline-block;border:1px solid #bdd0e0;padding:9px 13px;background:white;text-decoration:none;border-radius:9px;font-weight:700}
.box{background:white;border:1px solid #d2dee8;border-radius:12px;padding:17px;margin:14px 0}
.muted{color:#506b7d}.warning{border-left:4px solid #bd842d;background:#fff6e9;padding:10px 14px}
.status{font-weight:700;min-height:26px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
button{border:0;border-radius:8px;background:#155b88;color:white;cursor:pointer;padding:12px 16px;font:inherit;font-weight:750}
button.outline{background:#e8eff5;color:#164b71}button.approve{background:#146b45}
button:disabled{opacity:.5;cursor:not-allowed}
input,select{font:inherit;padding:9px;border:1px solid #aebecd;border-radius:8px;color:#103452;background:white}
label{font-weight:650}label.inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end}
.filters label{display:grid;gap:5px}.filters input{min-width:250px}
.table-container{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:680px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e5edf4;vertical-align:middle}
th{background:#ecf3f8;font-size:14px}td:nth-child(2){width:145px}td:nth-child(3){width:145px}
.price-input{width:130px}.modified{background:#fff8e7}small{font-size:13px;color:#47657b}
#changes p{margin:5px 0}#history{font-size:14px}#history li{margin:5px 0}
@media(max-width:630px){.box{padding:13px}.filters{display:grid}.filters input{min-width:0;width:100%}button{width:100%}}
</style></head><body><main>
<header><h1>Precios y promociones</h1><a class="back" href="/personal/central">Volver a la Central</a></header>
<p class="warning"><strong>Tarifario comercial LIVE.</strong> Guardar un borrador no cambia precios al público. Solo «Aprobar y publicar» actualiza los presupuestos <strong>nuevos</strong>. Los pedidos ya emitidos conservan sus importes.</p>
<section class="box">
<p id="state" role="status" class="status">Consultando el tarifario aprobado…</p>
<p id="revision" class="muted"></p>
<div class="filters">
<label>Grupo<select id="group"><option value="">Todos</option></select></label>
<label>Buscar tarifa<input id="search" type="search" placeholder="Ej.: Color A4, ploteo, anillado"></label>
<label>Responsable<input id="operator" maxlength="60" autocomplete="name" placeholder="Nombre del responsable"></label>
</div>
<div class="actions"><button id="refresh" class="outline">Actualizar tarifas</button><button id="preview" disabled>Ver impacto</button><button id="save" disabled>Guardar borrador</button><button id="approve" class="approve" disabled>Aprobar y publicar</button></div>
</section>
<section class="box">
<h2>Modificar tarifas</h2>
<p class="muted">Se muestran los importes <strong>realmente aprobados en producción</strong>; nunca los precios antiguos guardados en el sistema de pruebas.</p>
<div class="table-container"><table><thead><tr><th>Servicio y escala</th><th>Precio aprobado</th><th>Nuevo valor</th></tr></thead><tbody id="rows"></tbody></table></div>
<p id="empty" hidden>No hay tarifas que coincidan con la búsqueda.</p>
</section>
<section class="box"><h2>Vista previa de cambios</h2><div id="changes" role="status">Modificá una tarifa y pulsá «Ver impacto» antes de guardar.</div></section>
<section class="box"><h2>Historial reciente</h2><ol id="history"></ol></section>
</main><script>
'use strict';
const $=id=>document.getElementById(id);
let snapshot=null,updates=new Map(),busy=false,previewValid=false;
const groups=new Set();
const human=x=>typeof x==='boolean'?(x?'Sí':'No'):new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(x);
function message(text){$('state').textContent=text;}
function submitButtons(){
 $('preview').disabled=busy||!snapshot||updates.size===0;
 $('save').disabled=busy||!snapshot||updates.size===0||!previewValid;
 $('approve').disabled=busy||!snapshot||!snapshot.draftPresent||updates.size>0;
}
function display(){
 const tbody=$('rows');tbody.replaceChildren();
 const group=$('group').value,search=$('search').value.trim().toLocaleLowerCase('es-AR');
 let shown=0;
 for(const field of snapshot?.fields||[]){
  if(group&&field.category!==group)continue;
  if(search&&!(field.category+' '+field.label).toLocaleLowerCase('es-AR').includes(search))continue;
  const tr=document.createElement('tr'),modified=updates.has(field.path);
  if(modified)tr.className='modified';
  const label=document.createElement('td');label.textContent=field.category+' · '+field.label;tr.append(label);
  const approved=document.createElement('td');approved.textContent=human(field.approvedValue);tr.append(approved);
  const cell=document.createElement('td');
  const value=modified?updates.get(field.path):field.value;
  const input=document.createElement('input');input.className='price-input';input.dataset.path=field.path;
  if(field.kind==='boolean'){
   input.type='checkbox';input.checked=Boolean(value);
  }else{
   input.type='number';input.step=field.kind==='percent'?'0.01':'0.01';
   input.min=field.kind==='percent'?'0':'0.01';
   input.max=field.kind==='percent'?'50':'50000000';
   input.value=String(value);
  }
  input.disabled=busy;
  input.addEventListener('change',()=>{
   let next=field.kind==='boolean'?input.checked:Number(input.value);
   const valid=field.kind==='boolean'||(Number.isFinite(next)&&next>=(field.kind==='percent'?0:0.01)&&next<=(field.kind==='percent'?50:50000000)&&Math.round(next*100)===next*100);
   if(!valid){message('Valor inválido: revisá el importe y usá hasta dos decimales.');display();return;}
   if(next===field.value)updates.delete(field.path);else updates.set(field.path,next);
   previewValid=false;$('changes').textContent='Hay '+updates.size+' cambios sin simular. Pulsá «Ver impacto».';
   display();submitButtons();
  });
  cell.append(input);tr.append(cell);tbody.append(tr);shown++;
 }
 $('empty').hidden=shown>0;
 submitButtons();
}
function render(){
 if(!snapshot)return;
 groups.clear();
 for(const f of snapshot.fields)groups.add(f.category);
 const old=$('group').value;
 $('group').replaceChildren(new Option('Todos',''));
 for(const g of [...groups].sort())$('group').add(new Option(g,g));
 $('group').value=groups.has(old)?old:'';
 $('revision').textContent='Revisión '+snapshot.revision+' · Aprobada '+snapshot.approvedRevision+
  (snapshot.draftPresent?' · Existe un borrador sin publicar':' · No hay borradores pendientes');
 $('history').replaceChildren();
 for(const row of snapshot.history||[]){
  const li=document.createElement('li');
  const action={draft:'Borrador',approve:'Aprobado',restore:'Restaurado'}[row.action]||row.action;
  li.textContent=action+' · Revisión '+row.revision+' · '+row.changed_count+
   ' cambios · '+row.operator+' · '+row.created_at; $('history').append(li);
 }
 display();
}
async function api(action,payload=null){
 const opts={credentials:'same-origin',cache:'no-store'};
 if(action!=='read'){
  opts.method='POST';opts.headers={'Content-Type':'application/json'};
  opts.body=JSON.stringify({action,expectedRevision:snapshot.revision,
   operator:$('operator').value.trim(),changes:action==='approve'?[]:[...updates.entries()].map(([path,value])=>({path,value})),
   confirmed:action==='approve'});
 }
 const res=await fetch('/personal/api/live-pricing',opts);
 const data=await res.json().catch(()=>null);
 if(!res.ok||data?.ok!==true)throw Error(data?.error||'Error HTTP '+res.status);
 return data;
}
async function load(){
 busy=true;submitButtons();message('Cargando tarifas LIVE…');
 try{
  const result=await api('read');
  snapshot=result;updates.clear();previewValid=false;render();
  message('Tarifario comercial disponible.');
  $('changes').textContent='Modificá una tarifa y consultá primero el impacto.';
 }catch(e){message('No fue posible cargar tarifas: '+e.message)}
 finally{busy=false;submitButtons();}
}
function operatorOk(){
 if($('operator').value.trim().length<2){message('Indicá el nombre del responsable antes de guardar.');return false}
 return true;
}
async function run(action){
 if(!snapshot||busy||!operatorOk())return;
 if(action==='approve'){
  if(updates.size)return message('Primero guardá los cambios pendientes como borrador.');
  if(!snapshot.draftPresent)return message('Todavía no hay un borrador que aprobar.');
  if(!window.confirm('¿PUBLICAR estas tarifas en el cotizador comercial? Se aplicarán a presupuestos nuevos.'))return;
 }else if(!updates.size)return;
 if(action==='save'&&!previewValid)return message('Primero revisá «Ver impacto».');
 busy=true;submitButtons();message(action==='preview'?'Simulando sin publicar…':'Guardando cambios…');
 try{
  const result=await api(action==='save'?'draft':action);
  if(action==='preview'){
   const wrap=$('changes');wrap.replaceChildren();
   if(!result.edits.length){wrap.textContent='No hay diferencias respecto a los precios aprobados.';}
   else {
    const title=document.createElement('p');title.textContent=result.edits.length+' cambios propuestos:';wrap.append(title);
    for(const x of result.edits.slice(0,40)){
     const p=document.createElement('p');p.textContent=x.category+' · '+x.label+' · '+human(x.before)+' → '+human(x.after);wrap.append(p);
    }
    if(result.edits.length>40){const p=document.createElement('p');p.textContent='Y '+(result.edits.length-40)+' cambios adicionales.';wrap.append(p);}
    const examples=document.createElement('p');examples.textContent='Ejemplos de efecto en trabajos:';
    wrap.append(examples);
    for(const x of result.examples||[]){const p=document.createElement('p');p.textContent=x.label+' · $'+human(x.before)+' → $'+human(x.after);wrap.append(p);}
    const warn=document.createElement('p');warn.textContent=result.caution;wrap.append(warn);
   }
   previewValid=result.edits.length>0;
   message('Vista previa disponible. No se modificó ningún precio.');
  }else{
   await load();
   message(action==='approve'?'Tarifas aprobadas y publicadas para pedidos nuevos.':'Borrador guardado; el cliente todavía ve las tarifas anteriores.');
  }
 }catch(e){message('No se completó la operación: '+e.message)}
 finally{busy=false;submitButtons();}
}
$('group').addEventListener('change',display);
$('search').addEventListener('input',display);
$('refresh').addEventListener('click',()=>void load());
$('preview').addEventListener('click',()=>void run('preview'));
$('save').addEventListener('click',()=>void run('save'));
$('approve').addEventListener('click',()=>void run('approve'));
load();
</script></body></html>`;
}
