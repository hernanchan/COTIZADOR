import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const script=fs.readFileSync(new URL('../integraciones/interfaz-pc/interfaz-pc.js',import.meta.url),'utf8');
const html=`<!doctype html><html><body><main>
<h1>Cotizador</h1>
<div id="zonaArchivos"></div>
<section id="modoConfiguracion"><input type="radio" name="modoImpresionLote" value="comun" checked><input type="radio" name="modoImpresionLote" value="individual"></section>
<div id="configComunGlobal"></div>
<div id="estado"></div>
<div id="anilladosConjuntos"></div>
<div id="lista"></div>
<div id="resumenPedido"></div>
<div id="presupuesto">TOTAL INCOMPLETO</div>
<button id="prepararPedido">Revisar pedido</button>
</main></body></html>`;
const {window}=new JSDOM(html,{runScripts:'outside-only',url:'https://saber-ampliaciones-ensayo-20261120.libreriasaber.workers.dev/interfaz-pc',pretendToBeVisual:true});
window.matchMedia=()=>({matches:true});
const scrollTargets=[];
window.HTMLElement.prototype.scrollIntoView=function(){scrollTargets.push(this.id||this.className||'unknown');};
const d=window.document;
const state=Array.from({length:6},(_,i)=>({name:'imagen-0'+(i+1)+'.pdf',format:null}));
function render(){
 const list=d.getElementById('lista');
 list.replaceChildren();
 for(const [i,s] of state.entries()){
  const group=d.createElement('section');group.className='grupo-pedido';
  const title=d.createElement('h3');title.className='titulo-grupo';title.textContent=s.format?'Documentos A4 · 1 archivo(s)':'Archivos por revisar · 1 archivo(s)';
  const card=d.createElement('section');card.className='archivo';
  const name=d.createElement('strong');name.className='nombre';name.textContent=(i+1)+'. '+s.name;
  const meta=d.createElement('div');meta.className='resumen-archivo';meta.textContent='1 pág. · '+(s.format?'A4':'Tamaño sin confirmar');
  card.append(name,meta);
  if(!s.format){
   const choice=d.createElement('button');choice.className='eleccion-plotter-boton seleccionada';choice.textContent='Ploteo / Ampliación';card.append(choice);
   const question=d.createElement('div');question.className='pregunta-tamano';
   for(const [value,label] of [['a4','Ajustar a A4'],['a3','Imprimir en A3'],['original','Mantener tamaño real']]){
    const b=d.createElement('button');b.className='tamano-opcion';b.type='button';b.textContent=label;
    b.onclick=()=>{state[i].format=value;render();};
    question.append(b);
   }
   card.append(question);
  }
  group.append(title,card);list.append(group);
 }
 const form=d.getElementById('configComunGlobal');
 form.replaceChildren();
 if(state.some(s=>s.format)){
  const options=d.createElement('div');options.className='opciones-comunes';
  for(const [lbl,values] of [['Impresión para todos',['','bn','color']],['Caras para todos',['','simple','double']]]){
   const select=d.createElement('select');select.setAttribute('aria-label',lbl);
   for(const v of values){const o=d.createElement('option');o.value=v;o.textContent=v||'Elegir…';select.append(o);}
   options.append(select);
  }
  const copies=d.createElement('input');copies.setAttribute('aria-label','Aplicar copias a todo el grupo');copies.type='number';options.append(copies);
  form.append(options);
 }
}
render();
try{window.eval(script)}catch(e){throw Error('No pudo iniciarse la interfaz: '+e.message)}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await sleep(410);
const sizeStep=d.getElementById('pc-size-step');
assert(sizeStep,'No existe selector de tamaño común');
assert.equal(sizeStep.parentElement?.id,'pc-mode-card','El selector debe quedar debajo de «Todos iguales»');
assert.equal(d.querySelector('#pc-sidebar #pc-size-step'),null,'El selector sigue erróneamente en el presupuesto');
assert(scrollTargets.includes('pc-size-step'),'El cliente no fue guiado automáticamente hacia el selector al terminar de cargar');
assert.equal(sizeStep.hidden,false,'El selector de tamaño no es visible');
assert.equal(d.getElementById('pc-filebox').hidden,true,'Las fichas deben ocultarse hasta elegir tamaño');
assert.equal(d.getElementById('pc-batch').hidden,true,'No se debe mostrar el formulario común antes de resolver el tamaño');
const batchSize=d.querySelector('#pc-size-buttons button[data-target-size="a4"]');
assert(batchSize,'No hay opción A4 para todos');
batchSize.click();await sleep(1200);
assert.equal(state.filter(s=>s.format==='a4').length,6,'No se aplicó el tamaño a los seis PDF');
assert.equal(d.querySelectorAll('#lista .pregunta-tamano').length,0,'Quedaron tamaños sin confirmar');
assert.equal(sizeStep.hidden,true,'No se ocultó el paso de tamaño completado');
assert.equal(d.getElementById('pc-filebox').hidden,false,'No se restituyó la lista después');
assert.equal(d.getElementById('pc-batch').hidden,false,'No apareció color, caras y copias después de resolver tamaño');
const save=d.getElementById('pc-batch-apply');
assert.match(save.textContent,/Guardar 6 archivos de una vez/,'No se habilitó el guardado común');
const selects=d.querySelectorAll('#configComunGlobal select');
assert.equal(selects.length,2);
selects[0].value='bn';selects[1].value='simple';
d.querySelector('#configComunGlobal input').value='2';
save.click();await sleep(80);
assert.match(d.getElementById('pc-progress').textContent,/6 de 6 archivos configurados/,'No guardó seis de seis');
assert.equal(d.getElementById('pc-next').disabled,false,'No habilitó revisión después de guardar seis');
console.log('E2E DOM APROBADO: 6 PDF -> autofoco en tamaño debajo de Todos iguales -> 1 elección A4 -> 6 tamaños resueltos -> 1 configuración -> 6/6 listos.');
