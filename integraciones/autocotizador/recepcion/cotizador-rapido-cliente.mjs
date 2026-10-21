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
  const opciones=[['ninguno','Sin anillado'],['individual','Anillado individual'],...Array.from({length:5},(_,i)=>['grupo'+(i+1),'Junto con grupo '+(i+1)])];
  const anillado=select('Anillado',opciones,e.anillado==='grupo'?'grupo'+e.grupoAnillado:e.anillado,v=>{
   e.anillado=v.startsWith('grupo')?'grupo':v;e.grupoAnillado=v.startsWith('grupo')?v.slice(5):null;
  });
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
 for(const f of files)cola.push({file:f,modo:$('modoGeneral').value,formato:$('formato').value,caras:$('caras').value,copias:Number($('copias').value),anillado:$('anillado').value==='ninguno'?'ninguno':'individual',grupoAnillado:null,materialColor:'obra70',paginas:null,error:null});
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
const modoTexto=v=>v==='bn'?'Blanco y negro':'Color';
const fazTexto=v=>v==='double'?'Doble faz':'Simple faz';
const armadoTexto=d=>d.anillado==='grupo'?'Grupo '+d.grupoAnillado:d.anillado==='individual'?'Anillado individual':'Sin anillado';
function elemento(tipo,texto,clase){
 const el=document.createElement(tipo);
 if(texto!==undefined)el.textContent=String(texto);
 if(clase)el.className=clase;
 return el;
}
function linea(contenedor,izquierda,derecha,destacada=false){
 const r=elemento('div',undefined,'resumen-linea'+(destacada?' destacada':''));
 r.append(elemento('span',izquierda),elemento('strong',derecha));
 contenedor.append(r);return r;
}
function mostrarResumen(info,tiempo){
 const seccion=$('resumen');seccion.replaceChildren();
 if(!Array.isArray(info.detalles)||!Array.isArray(info.detalleArmados)||
    !Number.isFinite(info.total)||!Number.isFinite(info.subtotalImpresiones)||!Number.isFinite(info.anillados)){
  txt('precio','No se pudo construir el resumen del presupuesto.');return;
 }
 const detalles=info.detalles;
 const cliente=elemento('section',undefined,'panel-resumen');
 cliente.append(elemento('h2','Tu presupuesto'));
 cliente.append(elemento('p',detalles.length+' archivo(s) · '+info.paginas+' páginas originales · Precio preliminar','subtitulo'));
 linea(cliente,'Impresiones',money(info.subtotalImpresiones));
 linea(cliente,'Anillados',money(info.anillados));
 linea(cliente,'TOTAL ORIENTATIVO',money(info.total),true);
 const detalleCliente=elemento('details');
 detalleCliente.append(elemento('summary','Ver detalle de precios por archivo'));
 for(const d of detalles)linea(detalleCliente,d.nombre,money(d.subtotal));
 if(info.detalleArmados.length){
  detalleCliente.append(elemento('p','Anillados conjuntos (ya incluidos en el total)','subtitulo'));
  for(const a of info.detalleArmados)linea(detalleCliente,'Grupo '+a.grupo+' · '+a.juegos+' juego(s)',money(a.subtotal));
 }
 cliente.append(detalleCliente);
 cliente.append(elemento('p','Valor orientativo, pendiente de verificar los PDF originales. No se puede pagar ni confirmar el pedido desde esta prueba.','aviso'));
 const trabajo=elemento('section',undefined,'panel-resumen');
 trabajo.append(elemento('h2','Instrucciones para impresión'));
 trabajo.append(elemento('p','Orden de los PDF según la lista. Cada ficha especifica cómo imprimir y terminar el trabajo.','subtitulo'));
 for(const [i,d] of detalles.entries()){
  const ficha=elemento('section',undefined,'ficha');
  ficha.append(elemento('h3',(i+1)+'. '+d.nombre));
  ficha.append(elemento('p',
   d.paginas+' páginas · '+d.formato.toUpperCase()+' · '+modoTexto(d.modo)+
   (d.modo==='color'?' · Papel '+d.materialColor:'')+' · '+fazTexto(d.caras)));
  ficha.append(elemento('p',
   d.copias+' juego(s) · '+d.cantidad+' impresiones · '+armadoTexto(d),'instruccion'));
  trabajo.append(ficha);
 }
 if(info.detalleArmados.length){
  trabajo.append(elemento('h3','Orden de armado y anillado'));
  for(const a of info.detalleArmados){
   const box=elemento('section',undefined,'armado');
   box.append(elemento('strong','Grupo '+a.grupo+' · '+a.juegos+' anillado(s) · '+a.hojasPorJuego+' hojas por juego'));
   const lista=elemento('ol');
   for(const id of a.archivos){
    const doc=detalles.find(d=>d.id===id);
    lista.append(elemento('li',doc?doc.nombre+' ('+doc.paginas+' páginas)':'Documento por verificar'));
   }
   box.append(lista);trabajo.append(box);
  }
 }
 const acciones=elemento('div',undefined,'acciones-resumen');
 const copiar=elemento('button','Copiar instrucciones de impresión');copiar.type='button';
 copiar.addEventListener('click',async()=>{
  const texto=['ORDEN DE TRABAJO · PRELIMINAR · NO AUTORIZADA PARA PRODUCCIÓN',
   ...detalles.map((d,i)=>(i+1)+'. '+d.nombre+' | '+d.paginas+' páginas | '+d.formato.toUpperCase()+
    ' | '+modoTexto(d.modo)+(d.modo==='color'?' | '+d.materialColor:'')+' | '+fazTexto(d.caras)+
    ' | '+d.copias+' juego(s) | '+armadoTexto(d)),
   ...info.detalleArmados.map(a=>'GRUPO '+a.grupo+' ('+a.juegos+' juegos, '+a.hojasPorJuego+' hojas/juego): '+
     a.archivos.map(id=>detalles.find(d=>d.id===id)?.nombre||id).join(' → ')),
   'PRECIO PRELIMINAR: '+money(info.total),
   'PENDIENTE: verificar originales, precio final y autorización del pedido.'].join('\n');
  try{await navigator.clipboard.writeText(texto);copiar.textContent='Instrucciones copiadas';}
  catch(_){copiar.textContent='No se pudo copiar: usá selección manual';}
 });
 acciones.append(copiar);trabajo.append(acciones);
 seccion.append(cliente,trabajo);
 txt('precio','Presupuesto listo en '+tiempo+' ms. Consultá las dos vistas debajo.');
}
async function calcular(){
 $('resumen').replaceChildren();
 if(procesando||!cola.length||cola.some(x=>!x.paginas)){
  txt('precio','Completá la lectura de todos los PDF para cotizar.');return;
 }
 const archivos=cola.map((d,i)=>({id:'pdf'+(i+1),nombre:d.file.name,paginas:d.paginas,modo:d.modo,formato:d.formato,caras:d.caras,copias:d.copias,anillado:d.anillado,grupoAnillado:d.grupoAnillado,materialColor:d.materialColor,orden:i+1}));
 const grupos=new Map();
 for(const d of cola){if(d.anillado==='grupo'){
  const id=String(d.grupoAnillado);if(!grupos.has(id))grupos.set(id,[]);grupos.get(id).push(d);
 }}
 for(const [id,docs] of grupos){
  if(docs.length<2){txt('precio','El grupo '+id+' necesita por lo menos dos PDF.');return}
  if(docs.some(d=>d.formato!==docs[0].formato||d.copias!==docs[0].copias)){
   txt('precio','Grupo '+id+': los PDF deben tener el mismo tamaño y cantidad de juegos.');return;
  }
 }
 const payload={archivos,copias:Number($('copias').value),formato:$('formato').value,
  caras:$('caras').value,anillado:$('anillado').value};
 txt('precio','Calculando precio preliminar…');
 const start=performance.now();
 try{
  const response=await fetch('/api/ensayo-presupuesto-rapido',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const r=await response.json();
  if(!response.ok||r.ok!==true||r.paymentAuthorized!==false)throw Error(r.error||'Presupuesto no disponible.');
  mostrarResumen(r.resumen,Math.round(performance.now()-start));
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
