import {leerPaginasLocales} from './lectura-local-pdf.mjs';
const $=id=>document.getElementById(id);
const cola=[];let procesando=false;
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const txt=(id,v)=>$(id).textContent=v;
function actualizar(){
 const lista=$('documentos');lista.replaceChildren();
 cola.forEach((e,i)=>{
  const li=document.createElement('li');
  const name=document.createElement('span');
  name.textContent=e.file.name+' — '+(e.paginas?e.paginas+' página(s)':e.error||'Pendiente');
  const select=(aria,choices,value,handler)=>{
   const el=document.createElement('select');el.setAttribute('aria-label',aria+' de '+e.file.name);
   choices.forEach(([v,t])=>el.add(new Option(t,v)));el.value=value;el.disabled=procesando;
   el.addEventListener('change',()=>{handler(el.value);calcular()});return el;
  };
  const modo=select('Impresión',[['bn','Blanco y negro'],['color','Color']],e.modo,v=>e.modo=v);
  const formato=select('Tamaño',[['a4','A4'],['a3','A3']],e.formato,v=>e.formato=v);
  const caras=select('Caras',[['simple','Simple faz'],['double','Doble faz']],e.caras,v=>e.caras=v);
  const papel=select('Papel para color',[['obra70','Obra 70'],['obra140','Obra 140'],['obra180','Obra 180']],e.materialColor,v=>e.materialColor=v);
  papel.hidden=e.modo!=='color';modo.addEventListener('change',()=>{papel.hidden=modo.value!=='color'});
  const copias=document.createElement('input');copias.type='number';copias.min='1';copias.max='500';
  copias.value=String(e.copias);copias.setAttribute('aria-label','Copias de '+e.file.name);
  copias.disabled=procesando;copias.style.width='82px';
  copias.addEventListener('change',()=>{e.copias=Number(copias.value);calcular()});
  const anillado=select('Anillado',[['ninguno','Sin anillado'],['individual','Anillado individual']],e.anillado,v=>e.anillado=v);
  const remove=document.createElement('button');remove.textContent='Quitar';remove.type='button';remove.disabled=procesando;
  remove.addEventListener('click',()=>{cola.splice(i,1);actualizar();calcular()});
  li.append(name,modo,formato,caras,papel,copias,anillado,remove);lista.append(li);
 });
 const ok=cola.length>0&&cola.every(x=>Number.isSafeInteger(x.paginas)&&x.paginas>0);
 $('cotizar').disabled=procesando||!ok;
 txt('paginas',cola.reduce((n,x)=>n+(x.paginas||0),0)+' páginas detectadas');
}
async function seleccionar(input){
 if(procesando)return;
 const files=Array.from(input);
 if(cola.length+files.length>30){txt('estado','Máximo 30 PDF en este ensayo.');return}
 for(const f of files)cola.push({file:f,modo:$('modoGeneral').value,formato:$('formato').value,caras:$('caras').value,copias:Number($('copias').value),anillado:$('anillado').value==='ninguno'?'ninguno':'individual',materialColor:'obra70',paginas:null,error:null});
 $('archivo').value='';procesando=true;actualizar();
 const offset=cola.length-files.length,start=performance.now();
 try {
  const r=await leerPaginasLocales(files,{concurrencia:2,maxArchivos:30,
   onProgreso:({terminados,total})=>txt('estado','Leyendo páginas: '+terminados+' de '+total+'…')});
  r.documentos.forEach((d,i)=>{cola[offset+i].paginas=d.paginas;cola[offset+i].error=d.error});
  txt('estado','Lectura local terminada en '+Math.round(performance.now()-start)+' ms. Ningún PDF se envió a Google.');
 }catch(e){txt('estado','No se pudieron analizar los PDF: '+String(e.message||e))}
 finally{procesando=false;actualizar();calcular()}
}
async function calcular(){
 if(procesando||!cola.length||cola.some(x=>!x.paginas)){
  txt('precio','Completá la lectura de todos los PDF para cotizar.');return;
 }
 const archivos=cola.map((d,i)=>({id:'pdf'+(i+1),nombre:d.file.name,paginas:d.paginas,modo:d.modo,formato:d.formato,caras:d.caras,copias:d.copias,anillado:d.anillado,materialColor:d.materialColor,orden:i+1}));
 const payload={archivos,copias:Number($('copias').value),formato:$('formato').value,
  caras:$('caras').value,anillado:$('anillado').value};
 txt('precio','Calculando precio preliminar…');
 const start=performance.now();
 try{
  const response=await fetch('/api/ensayo-presupuesto-rapido',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const r=await response.json();
  if(!response.ok||r.ok!==true||r.paymentAuthorized!==false)throw Error(r.error||'Presupuesto no disponible.');
  const info=r.resumen;
  const detalles=(info.detalles||[]).map(d=>d.nombre+': '+money(d.subtotal)+' ('+d.cantidad+' impresiones)').join(' · ');
  txt('precio','TOTAL ORIENTATIVO: '+money(info.total)+' — '+detalles+' — Respuesta: '+Math.round(performance.now()-start)+' ms.');
 }catch(e){txt('precio','No se pudo cotizar: '+String(e.message||e))}
}
$('archivo').addEventListener('change',e=>seleccionar(e.target.files));
const drop=$('soltar');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active')});
drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('active');seleccionar(e.dataTransfer.files)});
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('archivo').click()}});
$('cotizar').addEventListener('click',calcular);
$('aplicarTodos').addEventListener('click',()=>{for(const e of cola){e.modo=$('modoGeneral').value;e.formato=$('formato').value;e.caras=$('caras').value;e.copias=Number($('copias').value);e.anillado=$('anillado').value==='ninguno'?'ninguno':'individual';}actualizar();calcular()});
txt('estado','Seleccioná varios archivos para conocer el precio sin esperar la subida.');
