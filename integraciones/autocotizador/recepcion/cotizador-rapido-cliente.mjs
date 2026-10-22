import {leerPaginasLocales} from './lectura-local-pdf.mjs';
const $=id=>document.getElementById(id);
const cola=[];let procesando=false;
let catalogoMateriales=null;
const materialesPara=formato=>catalogoMateriales?.[formato]||[];
function ajustarMaterial(e){
 const lista=materialesPara(e.formato);
 if(e.modo==='color'){
  if(!lista.some(p=>p.id===e.materialColor))e.materialColor=lista[0]?.id||null;
 }else e.materialColor=null;
}
// Una respuesta anterior nunca debe sobrescribir un presupuesto más reciente.
let versionCotizacion=0,solicitudCotizacion=null;
function invalidarCotizacion(){
 versionCotizacion++;
 if(solicitudCotizacion){solicitudCotizacion.abort();solicitudCotizacion=null;}
 $('resumen').replaceChildren();
 estadoBarra('pendiente','Por calcular','Modificaste el pedido: recalculando');
}
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const txt=(id,v)=>$(id).textContent=v;
function estadoBarra(tipo,importe,mensaje){
 $('resumenRapido').dataset.estado=tipo;
 txt('importeArriba',importe);
 txt('estadoImporte',tipo==='listo'?'Total orientativo':'Precio preliminar');
 txt('detalleArriba',mensaje);
}
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
  const modo=select('Impresión',[['bn','Blanco y negro'],['color','Color']],e.modo,v=>{e.modo=v;ajustarMaterial(e);actualizar()});
  const formato=select('Tamaño',[['a4','A4'],['a3','A3']],e.formato,v=>{e.formato=v;ajustarMaterial(e);actualizar()});
  const caras=select('Caras',[['simple','Simple faz'],['double','Doble faz']],e.caras,v=>e.caras=v);
  const papel=select('Papel para color',materialesPara(e.formato).map(p=>[p.id,p.name]),e.materialColor,v=>e.materialColor=v);
  papel.hidden=e.modo!=='color';
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
 invalidarCotizacion();
 const files=Array.from(input);
 if(cola.length+files.length>30){txt('estado','Máximo 30 PDF en este ensayo.');return}
 for(const f of files){const e={file:f,modo:$('modoGeneral').value,formato:$('formato').value,caras:$('caras').value,copias:Number($('copias').value),anillado:$('anillado').value==='ninguno'?'ninguno':'individual',grupoAnillado:null,materialColor:null,paginas:null,error:null};ajustarMaterial(e);cola.push(e)}
 $('archivo').value='';procesando=true;actualizar();
 const offset=cola.length-files.length,start=performance.now();
 try {
  const r=await leerPaginasLocales(files,{concurrencia:2,maxArchivos:30,
   onProgreso:({terminados,total})=>txt('estado','Leyendo páginas: '+terminados+' de '+total+'…')});
  r.documentos.forEach((d,i)=>{cola[offset+i].paginas=d.paginas;cola[offset+i].error=d.error});
  txt('estado','Archivos analizados. Ya podés ver el presupuesto preliminar; no se enviaron PDF a Google.');
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
 estadoBarra('listo',money(info.total),
  detalles.length+' archivo(s) · Impresiones '+money(info.subtotalImpresiones)+' · Anillados '+money(info.anillados));
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
   d.copias+' juego(s) · '+Math.ceil(d.paginas/(d.caras==='double'?2:1))+' hoja(s) por juego · '+d.cantidad+' impresiones · '+armadoTexto(d),'instruccion'));
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
    ' | '+d.copias+' juego(s) | '+Math.ceil(d.paginas/(d.caras==='double'?2:1))+' hojas por juego | '+armadoTexto(d)),
   ...info.detalleArmados.map(a=>'GRUPO '+a.grupo+' ('+a.juegos+' juegos, '+a.hojasPorJuego+' hojas/juego): '+
     a.archivos.map(id=>detalles.find(d=>d.id===id)?.nombre||id).join(' → ')),
   'PRECIO PRELIMINAR: '+money(info.total),
   'PENDIENTE: verificar originales, precio final y autorización del pedido.'].join('\n');
  try{await navigator.clipboard.writeText(texto);copiar.textContent='Instrucciones copiadas';}
  catch(_){copiar.textContent='No se pudo copiar: usá selección manual';}
 });
 acciones.append(copiar);trabajo.append(acciones);
 seccion.append(cliente,trabajo);
 txt('precio','Presupuesto orientativo listo. Debajo podés ver el detalle de precios y las instrucciones de impresión.');
}
async function calcular(){
 invalidarCotizacion();
 const version=versionCotizacion;
 if(procesando||!cola.length||!catalogoMateriales||cola.some(x=>!x.paginas)){
  estadoBarra('pendiente','A cotizar',cola.length+' archivos seleccionados');
  txt('precio','Completá la lectura de todos los PDF para cotizar.');return;
 }
 const archivos=cola.map((d,i)=>({id:'pdf'+(i+1),nombre:d.file.name,paginas:d.paginas,modo:d.modo,formato:d.formato,caras:d.caras,copias:d.copias,anillado:d.anillado,grupoAnillado:d.grupoAnillado,materialColor:d.materialColor,orden:i+1}));
 const grupos=new Map();
 for(const d of cola){if(d.anillado==='grupo'){
  const id=String(d.grupoAnillado);if(!grupos.has(id))grupos.set(id,[]);grupos.get(id).push(d);
 }}
 for(const [id,docs] of grupos){
  if(docs.length<2){estadoBarra('error','Revisar grupo '+id,'Se requieren dos PDF');txt('precio','El grupo '+id+' necesita por lo menos dos PDF.');return}
  if(docs.some(d=>d.formato!==docs[0].formato||d.copias!==docs[0].copias)){
   estadoBarra('error','Revisar grupo '+id,'Tamaño o cantidad de juegos incompatible');txt('precio','Grupo '+id+': los PDF deben tener el mismo tamaño y cantidad de juegos.');return;
  }
 }
 const payload={archivos,copias:Number($('copias').value),formato:$('formato').value,
  caras:$('caras').value,anillado:$('anillado').value};
 txt('precio','Calculando precio preliminar…');
 estadoBarra('calculando','Calculando…','Actualizando con las especificaciones elegidas');
 const start=performance.now();
 const controlador=new AbortController();
 solicitudCotizacion=controlador;
 try{
  const response=await fetch('/api/ensayo-presupuesto-rapido',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controlador.signal});
  const r=await response.json();
  if(version!==versionCotizacion)return;
  if(!response.ok||r.ok!==true||r.paymentAuthorized!==false)throw Error(r.error||'Presupuesto no disponible.');
  mostrarResumen(r.resumen,Math.round(performance.now()-start));
 }catch(e){
  if(version===versionCotizacion&&e.name!=='AbortError'){
   estadoBarra('error','Sin precio','Revisá las opciones del pedido');
   txt('precio','No se pudo cotizar: '+String(e.message||e));
  }
 }finally{if(version===versionCotizacion)solicitudCotizacion=null;}
}
$('archivo').addEventListener('change',e=>seleccionar(e.target.files));
const drop=$('soltar');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active')});
drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('active');seleccionar(e.dataTransfer.files)});
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('archivo').click()}});
$('cotizar').addEventListener('click',calcular);
$('aplicarTodos').addEventListener('click',()=>{for(const e of cola){e.modo=$('modoGeneral').value;e.formato=$('formato').value;e.caras=$('caras').value;e.copias=Number($('copias').value);e.anillado=$('anillado').value==='ninguno'?'ninguno':$('anillado').value==='juntos'&&cola.length>=2?'grupo':'individual';e.grupoAnillado=e.anillado==='grupo'?'1':null;ajustarMaterial(e);}actualizar();calcular()});
async function cargarMateriales(){
 try{
  const respuesta=await fetch('/api/ensayo-materiales-rapido',{cache:'no-store'});
  const datos=await respuesta.json();
  if(!respuesta.ok||datos.ok!==true||!Array.isArray(datos.materials?.a4)||!Array.isArray(datos.materials?.a3)||
      !datos.materials.a4.length||!datos.materials.a3.length)throw Error('Catálogo no disponible');
  catalogoMateriales=datos.materials;
  for(const e of cola)ajustarMaterial(e);
  actualizar();
  txt('estado','Materiales de impresión cargados. Elegí tus archivos para cotizar.');
  if(cola.length)calcular();
 }catch(_){
  catalogoMateriales=null;
  estadoBarra('error','Sin precio','No se pudo cargar el catálogo de papeles');
  txt('estado','No se pudo cargar la lista de papeles. Recargá la página para intentar nuevamente.');
 }
}
txt('estado','Cargando opciones de papeles A4 y A3…');
cargarMateriales();
