/* Librería Saber: V4 interfaz PC, sobre el motor original del ensayo.
 * Solo presentación y guardado de configuración ya aplicada por el motor.
 * Móvil (<900px), precios, pagos y transporte de archivos sin cambios.
 */
(()=>{'use strict';
if(!matchMedia('(min-width:900px)').matches)return;
const by=id=>document.getElementById(id),root=document.querySelector('main');
const ids=['zonaArchivos','modoConfiguracion','configComunGlobal','estado','presupuesto','prepararPedido','resumenPedido','anilladosConjuntos','lista'];
if(!root||ids.some(id=>!by(id)))return;
document.body.classList.add('saber-pc-v3');
const oldPrice=by('saberPrecioArriba');if(oldPrice)oldPrice.hidden=true;
const el=(tag,id,text)=>{const n=document.createElement(tag);if(id)n.id=id;if(text)n.textContent=text;return n;};
const shell=el('div','pc-shell'),left=el('div','pc-left'),side=el('aside','pc-sidebar');
shell.append(left,side);
left.append(by('zonaArchivos'));
const modeCard=el('section','pc-mode-card');modeCard.append(by('modoConfiguracion'));left.append(modeCard);
const batch=el('section','pc-batch'),batchButton=el('button','pc-batch-apply','Guardar configuración para todas'),batchHelp=el('p','pc-batch-help','Elegí una vez color, caras y copias; después guardá todas juntas.');
batchButton.type='button';
const sizeStep=el('section','pc-size-step'),sizeTitle=el('h3','pc-size-title','Elegí el tamaño final una sola vez');
const sizeDescription=el('p','pc-size-description','Los documentos tienen medidas no estándar. Indicá cómo querés imprimirlos a todos.');
const sizeButtons=el('div','pc-size-buttons'),sizeStatus=el('p','pc-size-status','');
const sizeChoices=[['a4','A4 para todos'],['a3','A3 para todos'],['original','Mantener tamaño original']];
for(const [value,label] of sizeChoices){const button=el('button','',label);button.type='button';button.dataset.targetSize=value;sizeButtons.append(button);}
sizeStep.append(sizeTitle,sizeDescription,sizeButtons,sizeStatus);
sizeStep.tabIndex=-1;
sizeStatus.setAttribute('aria-live','polite');
modeCard.append(sizeStep);
batch.append(el('h2','','4. Elegí color, caras y copias para todos'),by('configComunGlobal'),batchButton,batchHelp);
left.append(batch,by('estado'));
const filebox=el('section','pc-filebox'),grid=el('div','pc-filegrid'),queue=el('nav','pc-queue'),originalList=el('div','pc-original-list');
queue.setAttribute('aria-label','Archivos del pedido');
originalList.append(by('anilladosConjuntos'),by('lista'));grid.append(queue,originalList);
filebox.append(el('h2','','Configurá tus archivos'),el('p','pc-instruction','Seleccioná un archivo, elegí sus opciones y presioná «Guardar y siguiente».'),grid);
const actions=el('div','pc-config-actions'),save=el('button','pc-save','Guardar y siguiente →'),note=el('span','pc-config-status','Subí tus archivos para comenzar.');
save.type='button';actions.append(save,note);filebox.append(actions);left.append(filebox,by('resumenPedido'));
side.append(el('h2','','Tu presupuesto'),by('presupuesto'));
sizeTitle.textContent='3. Elegí el tamaño final para todos';
const progress=el('div','pc-progress','0 de 0 configurados'),message=el('div','pc-message','Cargá los archivos para empezar.'),next=el('button','pc-next','Siguiente: revisar pedido');
next.type='button';next.disabled=true;side.append(progress,message,next,el('p','pc-trial-note','ENSAYO · Usa tarifas de referencia del 21/08/2026. No se envían pedidos ni se habilitan cobros.'));
side.append(by('prepararPedido'));root.append(shell);
Array.from(root.children).filter(n=>n.tagName==='H2').forEach(h=>h.hidden=true);
const parent=by('lista');
let selected=0,keys='',ready=new Set(),lastNote='',sizeBatchBusy=false;
let attentionTimer=null,lastAttentionKey='';
function guideToSize(key){
 if(lastAttentionKey===key)return;
 lastAttentionKey=key;
 clearTimeout(attentionTimer);
 attentionTimer=setTimeout(()=>{
  if(!sizeStep.hidden && commonMode() && pendingSizes().length){
   sizeStep.scrollIntoView({behavior:'smooth',block:'center'});
   sizeStep.focus({preventScroll:true});
  }
 },320);
}
const cards=()=>Array.from(parent.querySelectorAll('section.archivo'));
const commonMode=()=>document.querySelector('input[name="modoImpresionLote"][value="comun"]')?.checked===true;
const groupName=c=>c.closest('section.grupo-pedido')?.querySelector('h3.titulo-grupo')?.textContent||'';
const isCommonCompatible=c=>/^(Documentos (A3|A4|A5|Legal)|Tamaño original menor que A4)/i.test(groupName(c));
const metadata=c=>c.querySelector('.resumen-archivo')?.textContent||'Analizando archivo…';
const fileValid=c=>!!c&&!c.classList.contains('archivo-no-admitido')&&
  !/Analizando PDF|Error de lectura/i.test(metadata(c))&&!c.querySelector('.pregunta-tamano')&&
  (!c.querySelector('.saber-ampliacion [role="alert"] input[type="checkbox"]')||
    c.querySelector('.saber-ampliacion [role="alert"] input[type="checkbox"]').checked);
const commonFiles=()=>cards().filter(c=>isCommonCompatible(c)&&fileValid(c));
// Una pregunta de tamaño no resuelta SIEMPRE se debe resolver, incluso cuando
// el selector "Impresión común / Ploteo / Ampliación" tiene un estilo activo.
const needsSize=c=>!!c.querySelector('.pregunta-tamano')&&
 !c.classList.contains('archivo-no-admitido');
const pendingSizes=()=>cards().filter(needsSize);
function condenseSizeWarnings(count){
 const quote=by('presupuesto');
 const warning=Array.from(quote.querySelectorAll('.advertencia')).filter(p=>/Confirmar tamaño final/i.test(p.textContent||''));
 warning.forEach(p=>p.classList.toggle('pc-collapsed-warning',count>1));
 let summary=by('pc-quote-size-summary');
 if(count>1&&warning.length>1){
  if(!summary){summary=el('p','pc-quote-size-summary');quote.prepend(summary);}
  summary.textContent=count+' archivos necesitan confirmar tamaño. Elegí el formato en el bloque «Todos iguales», a la izquierda.';
 }else summary?.remove();
}
function locateSizeOption(card,size){
 const controls=Array.from(card.querySelectorAll('.pregunta-tamano button.tamano-opcion'));
 const rx=size==='a4'?/A4/i:size==='a3'?/A3/i:/Mantener|original/i;
 return controls.find(b=>rx.test(b.textContent||''));
}
async function applySizeForBatch(size){
 if(sizeBatchBusy||!commonMode())return;
 const originals=pendingSizes().length;
 if(!originals)return;
 sizeBatchBusy=true;
 sizeStatus.textContent='Aplicando tamaño a '+originals+' archivos…';
 for(const button of sizeButtons.querySelectorAll('button'))button.disabled=true;
 try{
  let handled=0,stuck=0;
  while(handled<originals && stuck<2){
   const pending=pendingSizes();
   if(!pending.length)break;
   const card=pending[0],button=locateSizeOption(card,size);
   if(!button){sizeStatus.textContent='No todos admiten ese formato. Revisá los pendientes.';break;}
   const before=basename(card);
   button.click();
   await new Promise(resolve=>setTimeout(resolve,80));
   const remaining=pendingSizes();
   if(remaining.length<pending.length){handled++;stuck=0;}
   else if(remaining[0]&&basename(remaining[0])===before){stuck++;}
   else {handled++;stuck=0;}
  }
  const left=pendingSizes().length;
  sizeStatus.textContent=left?'Quedan '+left+' tamaños sin confirmar.':'Tamaño aplicado. Ahora elegí color, caras y copias para todos.';
  lastNote=left?'⚠ Revisá los documentos cuyo tamaño sigue pendiente.':'✓ Tamaño definido para el lote.';
  ready.clear();selected=0;sync();
  if(!pendingSizes().length){
    setTimeout(()=>{if(!batch.hidden)batch.scrollIntoView({behavior:'smooth',block:'start'});},180);
  }
 }catch(err){
  sizeStatus.textContent='No se pudo aplicar el tamaño a todos. Revisá los archivos pendientes.';
  lastNote=sizeStatus.textContent;sync();
 }finally{sizeBatchBusy=false;for(const button of sizeButtons.querySelectorAll('button'))button.disabled=false;}
}
for(const button of sizeButtons.querySelectorAll('button'))button.onclick=()=>applySizeForBatch(button.dataset.targetSize);

const commonControl=name=>Array.from(by('configComunGlobal').querySelectorAll('select')).find(x=>(x.getAttribute('aria-label')||'').includes(name));
const commonCopies=()=>by('configComunGlobal').querySelector('input[aria-label="Aplicar copias a todo el grupo"]');
const basename=c=>(c.querySelector('.nombre')?.textContent||'Documento').replace(/^\s*\d+\.\s*/, '').trim();
function openSelectedDetails(){
  const card=cards()[selected];if(!card)return;
  const expander=Array.from(card.querySelectorAll('button.editar')).find(b=>/M[aá]s opciones|Personalizar este PDF/i.test(b.textContent));
  if(expander&&expander.getAttribute('aria-expanded')==='false')expander.click();
}
function sync(){
 const list=cards(),nextKeys=list.map(basename).join('@@SEP@@');
 if(nextKeys!==keys){keys=nextKeys;ready.clear();selected=Math.max(0,Math.min(selected,list.length-1));lastNote='';}
 if(selected>=list.length)selected=0;
 queue.replaceChildren();
 const count=list.length;
 batch.hidden=!commonMode()||!count;sizeStep.hidden=!commonMode();filebox.hidden=false;
 if(commonMode()){
  const pendingSizeCount=pendingSizes().length;
  sizeStep.hidden=pendingSizeCount===0;
  if(pendingSizeCount){
   sizeTitle.textContent='3. Elegí el tamaño de '+pendingSizeCount+' archivo'+(pendingSizeCount===1?'':'s')+' de una vez';
   batch.hidden=true;
   guideToSize(nextKeys);
   filebox.hidden=true;
   by('configComunGlobal').hidden=true;
   sizeDescription.textContent='Se detectaron medidas diferentes de A4. Elegí A4, A3 o mantener el tamaño original. El ajuste a A4/A3 es proporcional y no recorta.';
  }
  const eligible=commonFiles().length;
  if(!pendingSizeCount){filebox.hidden=false;by('configComunGlobal').hidden=false;lastAttentionKey='';}
  batchButton.disabled=eligible===0||!by('configComunGlobal').querySelector('.opciones-comunes');
  batchButton.textContent=eligible?'Guardar '+eligible+' archivo'+(eligible===1?'':'s')+' de una vez':'Sin impresiones comunes compatibles';
  if(!eligible)batchHelp.textContent=pendingSizeCount?'Primero confirmá el tamaño final para el lote. Después aparecerán las opciones comunes de impresión.':'Los archivos especiales y ploteos se configuran individualmente.';
  else if(!batchHelp.dataset.error&&!batchHelp.dataset.success)batchHelp.textContent='Elegí una vez color, caras y copias. Los demás servicios siguen pendientes si necesitan opciones distintas.';
 }
 list.forEach((c,i)=>{
  c.classList.toggle('pc-not-current',i!==selected);
  const card=el('button');card.type='button';card.className=i===selected?'pc-current':'';
  card.setAttribute('aria-pressed',String(i===selected));
  const done=ready.has(i),symbol=el('span','',done?'✓':'!'),info=el('span'),title=el('span','',basename(c)),desc=el('span','',done?'Configurado · editar':'Pendiente · '+metadata(c));
  symbol.className='pc-indicator'+(done?' pc-ok':'');info.className='pc-fileinfo';title.className='pc-filename';desc.className='pc-filemeta';
  info.append(title,desc);card.append(symbol,info);
  card.setAttribute('aria-label',basename(c)+(done?' configurado':' pendiente de configurar'));card.title=card.getAttribute('aria-label');
  card.onclick=()=>{selected=i;lastNote='';sync();openSelectedDetails();cards()[selected]?.scrollIntoView({block:'nearest',behavior:'smooth'});};
  queue.append(card);
 });
 Array.from(parent.querySelectorAll('section.grupo-pedido')).forEach(group=>{group.style.display=group.querySelector('section.archivo:not(.pc-not-current)')?'':'none';});
 progress.textContent=ready.size+' de '+count+' archivos configurados';
 const pending=count-ready.size;
 condenseSizeWarnings(commonMode()?pendingSizes().length:0);
 if(!count){message.textContent='Cargá los archivos para empezar.';message.className='';save.disabled=true;}
 else if(pending){
   const pendingSizesCount=commonMode()?pendingSizes().length:0;
   message.textContent=pendingSizesCount?'Elegí el tamaño de los '+pendingSizesCount+' archivos en el bloque «Todos iguales», a la izquierda.':lastNote||('⚠ Faltan configurar '+pending+' archivo'+(pending!==1?'s':'')+'. El pedido no puede continuar todavía.');message.className='';save.disabled=false;}
 else {message.textContent='✓ Todos los archivos guardados. '+(by('prepararPedido').disabled?'Esperá a que termine la cotización.':'Ya podés revisar el pedido.');message.className='pc-complete';save.disabled=false;}
 next.disabled=!(count>0&&pending===0&&!by('prepararPedido').disabled);
 note.textContent=count?'Archivo '+(selected+1)+' de '+count+(ready.has(selected)?' · guardado':' · pendiente'):'Subí tus archivos para comenzar.';
}
function saveCommon(){
 if(!commonMode())return;
 const candidates=commonFiles();
 if(!candidates.length){batchHelp.textContent='No hay impresiones comunes listas; revisá el tamaño o el tipo de los archivos.';batchHelp.dataset.error='1';return;}
 const modo=commonControl('Impresión para todos'),caras=commonControl('Caras para todos'),copias=commonCopies();
 if(!modo?.value||!caras?.value||!copias?.value||!Number.isSafeInteger(Number(copias.value))||Number(copias.value)<1||Number(copias.value)>500){
  batchHelp.textContent='⚠ Falta definir impresión (color/B/N), caras o cantidad de copias para todos.';batchHelp.dataset.error='1';return;
 }
 // El guardado confirma lo que el motor ya aplicó mediante sus controles comunes.
 const all=cards();for(const c of candidates)ready.add(all.indexOf(c));
 delete batchHelp.dataset.error;batchHelp.dataset.success='1';
 batchHelp.textContent='✓ Configuración común guardada en '+candidates.length+' archivo'+(candidates.length===1?'':'s')+'.';
 lastNote='';const pending=all.findIndex((c,i)=>!ready.has(i));if(pending>=0)selected=pending;
 sync();openSelectedDetails();
}
batchButton.onclick=saveCommon;
by('modoConfiguracion').addEventListener('change',event=>{
 if(event.target.name!=='modoImpresionLote')return;
 ready.clear();lastNote='';lastAttentionKey='';delete batchHelp.dataset.error;delete batchHelp.dataset.success;
 batchHelp.textContent='Elegí una vez color, caras y copias; después guardá todas juntas.';
 queueMicrotask(sync);
},true);
by('configComunGlobal').addEventListener('change',()=>{
 cards().forEach((c,i)=>{if(isCommonCompatible(c))ready.delete(i);});
 lastNote='Cambiaste opciones para todos: guardá otra vez la configuración común.';
 delete batchHelp.dataset.error;delete batchHelp.dataset.success;queueMicrotask(sync);
},true);
function saveCurrent(){
 const c=cards()[selected];if(!c)return;
 if(c.classList.contains('archivo-no-admitido')||/Analizando PDF|Error de lectura/i.test(metadata(c))){lastNote='⚠ Este archivo todavía no está listo para cotizar o requiere revisión.';sync();return;}
 const amp=c.querySelector('.saber-ampliacion');
 if(amp){
  const quality=amp.querySelector('[role=alert] input[type=checkbox]');
  if(quality&&!quality.checked){lastNote='⚠ Debés aceptar la advertencia de calidad antes de guardar.';sync();return;}
  const plotter=Array.from(amp.querySelectorAll('.eleccion-plotter-boton.seleccionada')).some(b=>/Ploteo/i.test(b.textContent));
  const apply=amp.querySelector('[data-saber-amp-aplicar]');
  if(plotter&&apply&&/Aplicar ampliación/i.test(apply.textContent)){lastNote='⚠ Aplicá primero la ampliación y esperá el recálculo.';sync();return;}
 }
 if(c.querySelector('.pregunta-tamano')){lastNote='⚠ Elegí el tamaño antes de guardar este archivo.';sync();return;}
 ready.add(selected);
 const after=cards().findIndex((x,i)=>i>selected&&!ready.has(i));
 const pending=after>=0?after:cards().findIndex((x,i)=>!ready.has(i));
 lastNote=pending>=0?'✓ Guardado. Ahora configurá el siguiente pendiente.':'';
 if(pending>=0)selected=pending;
 sync();openSelectedDetails();
}
save.onclick=saveCurrent;
next.onclick=()=>{if(next.disabled)return;const original=by('prepararPedido');if(!original||original.disabled)return;original.click();by('resumenPedido').scrollIntoView({block:'start',behavior:'smooth'});};
function dirty(event){
 const c=event.target.closest('section.archivo');if(!c)return;
 const index=cards().indexOf(c);if(index<0)return;
 const button=event.target.closest('button');
 if(event.type==='click'&&(!button||/Quitar|Cerrar detalles|M[aá]s opciones|Personalizar/i.test(button.textContent)))return;
 if(ready.delete(index)){lastNote='Cambios sin guardar. Guardá nuevamente este archivo.';sync();}
}
parent.addEventListener('change',dirty,true);
parent.addEventListener('input',dirty,true);
parent.addEventListener('click',dirty,true);
let scheduled=false;
const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});};
new MutationObserver(schedule).observe(parent,{subtree:true,childList:true});
new MutationObserver(schedule).observe(by('prepararPedido'),{attributes:true,attributeFilter:['disabled']});
sync();openSelectedDetails();
})();