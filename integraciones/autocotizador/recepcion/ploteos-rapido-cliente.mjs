import {leerMedidasPloteo} from './medidas-local-pdf.mjs';
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
const $=id=>document.getElementById(id);
const lista=[];let catalogo=[],version=0,controlador=null,leyendo=false;
const money=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
const dato=(tag,contenido)=>{const el=document.createElement(tag);if(contenido!==undefined)el.textContent=String(contenido);return el};
const estado=txt=>$('resultado').textContent=txt;
function avisarConjunto(estado,total=0){if(window.parent!==window)window.parent.postMessage({tipo:'saber-cotizacion-parcial-v1',modulo:'ploteos',estado,total},location.origin);}
function invalidar(){
 version++;if(controlador){controlador.abort();controlador=null}
 $('importe').textContent='Por calcular';$('estadoPrecio').textContent='Pendiente de cálculo';
 avisarConjunto('pendiente');
}
function selector(label,opciones,actual,change){
 const wrap=dato('label',label),el=document.createElement('select');
 for(const [value,nombre] of opciones)el.add(new Option(nombre,value));
 el.value=actual;el.disabled=leyendo;
 el.addEventListener('change',()=>{change(el.value);render();cotizar()});
 wrap.append(el);return wrap;
}
function copiasControl(d){
 const wrap=dato('label','Copias'),input=document.createElement('input');
 input.type='number';input.min='1';input.max='500';input.step='1';
 input.value=String(d.copias);input.disabled=leyendo;
 input.addEventListener('change',()=>{d.copias=Number(input.value);cotizar()});
 wrap.append(input);return wrap;
}
function soportesCompatibles(d){
 return catalogo.filter(s=>/^rollo\d+$/.test(s.id)&&
  d.paginas.every(p=>Math.min(p.anchoCm,p.altoCm)<=s.widthCm+0.03))
  .sort((a,b)=>a.widthCm-b.widthCm);
}
function elegirSoporte(d){
 // Asignación determinista; el cliente no puede modificar el rollo.
 d.material=soportesCompatibles(d)[0]?.id||'';
}
function render(){
 const panel=$('trabajos');panel.replaceChildren();
 for(const [i,d] of lista.entries()){
  const card=dato('section');card.className='trabajo';
  card.append(dato('h2',(i+1)+'. '+d.nombre));
  if(d.error){card.append(dato('p',d.error));}
  else if(!d.paginas){card.append(dato('p','Leyendo dimensiones de PDF…'))}
  else{
   const measures=d.paginas.map(p=>p.anchoCm+' × '+p.altoCm+' cm');
   const iguales=measures.every(x=>x===measures[0]);
   card.append(dato('p',d.paginas.length+' página(s) · '+(iguales?measures[0]: 'Tamaños distintos: '+measures.join(' · '))));
   const form=dato('div');form.className='controles';
   const cad=d.paginas.filter(p=>p.modo==='cad').length,poster=d.paginas.filter(p=>p.modo==='poster').length;
   card.append(dato('p','Clasificación automática: '+cad+' CAD · '+poster+' Póster'));
   if(d.paginas.length<=15)card.append(dato('p',d.paginas.map(p=>'Pág. '+p.numero+': '+(p.modo==='cad'?'CAD':p.modo==='poster'?'Póster':'Revisión Librería Saber')).join(' · ')));
   
   if(poster>0){
    form.append(selector('Papel para póster',
      [['obra80','Obra 80 g'],['recubierto','Recubierto 130 g']],
      d.papelPoster||'obra80',v=>{d.papelPoster=v;}));
   }
   const seleccionado=soportesCompatibles(d)[0];
   if(!seleccionado){card.append(dato('p','Ningún rollo estándar admite el ancho de este PDF. Requiere revisión de Librería Saber.'))}
   else {
    const recubierto=poster>0&&d.papelPoster==='recubierto';
    if(!recubierto||cad>0)card.append(dato('p',(recubierto?'Rollo obra para páginas CAD: ':'Rollo obra asignado automáticamente: ')+seleccionado.name+' ('+seleccionado.widthCm+' cm)'));
    if(recubierto){
     const mayores=d.paginas.filter(p=>p.modo==='poster').map(p=>Math.min(p.anchoCm,p.altoCm));
     const soporteRec=catalogo.filter(x=>/^rec\\d+$/.test(x.id)&&mayores.every(ancho=>ancho<=x.widthCm+0.03)).sort((a,b)=>a.widthCm-b.widthCm)[0];
     if(soporteRec)card.append(dato('p','Rollo para páginas Póster: '+soporteRec.name+' ('+soporteRec.widthCm+' cm)'));
    }
   }
   if(poster>0&&d.papelPoster==='recubierto'){
    const recubiertos=catalogo.filter(x=>/^rec\d+$/.test(x.id));
    const falta=d.paginas.filter(p=>p.modo==='poster'&&!recubiertos.some(r=>
      Math.min(p.anchoCm,p.altoCm)<=r.widthCm+0.03));
    if(falta.length)card.append(dato('p','El papel recubierto no admite las páginas '+falta.map(x=>x.numero).join(', ')+'. Requiere revisión.'));
   }
   form.append(copiasControl(d));card.append(form);
  }
  const quitar=dato('button','Quitar PDF');quitar.type='button';quitar.disabled=leyendo;
  quitar.addEventListener('click',()=>{lista.splice(i,1);render();cotizar()});
  card.append(quitar);panel.append(card);
 }
 $('calcular').disabled=leyendo||!catalogo.length||!lista.length||lista.some(d=>!d.paginas||!d.material||d.error||d.paginas.some(p=>!['cad','poster'].includes(p.modo)));
}
async function cotizar(){
 invalidar();
 if(leyendo){estado('Leyendo las dimensiones de los PDF…');return}
 if(!lista.length){avisarConjunto('vacio');estado('Elegí al menos un PDF para cotizar.');return}
 if(!catalogo.length){estado('Todavía no están disponibles los materiales.');return}
 if(lista.some(d=>d.error||!d.paginas||!d.material||d.paginas.some(p=>!['cad','poster'].includes(p.modo)))){estado('Este trabajo requiere revisión de Librería Saber: no se pudo clasificar con certeza o no entra en los rollos.');return}
 const n=version,ac=new AbortController();controlador=ac;
 const trabajos=lista.map((d,i)=>({id:'pl'+(i+1),nombre:d.nombre,modo:d.modo,
  material:d.material,copias:d.copias,paginas:d.paginas,
  ...(d.paginas.some(p=>p.modo==='poster')?{papelPoster:d.papelPoster||'obra80'}:{})}));
 estado('Calculando el presupuesto preliminar…');
 try{
  const r=await fetch('/api/ensayo-ploteos-rapido',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({trabajos}),signal:ac.signal});
  const data=await r.json();
  if(n!==version)return;
  if(!r.ok||data.ok!==true||data.paymentAuthorized!==false)throw Error(data.error||'No se pudo cotizar');
  const resumen=data.resumen;
  $('importe').textContent=money(resumen.total);$('estadoPrecio').textContent='Calculado · orientativo';
  avisarConjunto('listo',resumen.total);
  const panel=$('resultado');panel.replaceChildren();
  panel.append(dato('h2','Presupuesto de ploteos'));
  const ol=dato('ol');
  for(const x of resumen.detalles){
   const li=dato('li',x.nombre+' · '+x.paginasTotales+' página(s) (CAD '+x.paginas.filter(p=>p.modo==='cad').length+' / Póster '+x.paginas.filter(p=>p.modo==='poster').length+') · '+x.metrosLineales+
    ' m lineales por juego · '+x.copias+' copia(s) · '+money(x.subtotal));
   const porPagina=dato('small',x.paginas.map(p=>'Pág. '+p.numero+': '+p.modo.toUpperCase()+' · '+p.materialNombre).join(' | '));
   li.append(dato('div'),porPagina);
   ol.append(li);
  }
  panel.append(ol,dato('strong','TOTAL ORIENTATIVO: '+money(resumen.total)),
   dato('p','Los tamaños se detectaron del PDF en este dispositivo; deben verificarse con los originales antes del cobro.'));
 }catch(e){
  if(n!==version||e.name==='AbortError')return;
  $('importe').textContent='Sin precio';$('estadoPrecio').textContent='Error de cálculo';estado(String(e.message||e));
  avisarConjunto('error');
 }finally{if(n===version)controlador=null}
}
$('archivosPloteo').addEventListener('change',async event=>{
 const files=Array.from(event.target.files||[]);
 event.target.value='';
 if(leyendo){estado('Esperá a que termine la lectura actual.');return}
 if(lista.length+files.length>30){estado('Máximo 30 PDF por pedido de ploteos.');return}
 invalidar();leyendo=true;
 for(const file of files)lista.push({file,nombre:file.name,modo:'cad',material:'',papelPoster:'obra80',copias:1,paginas:null,error:null});
 render();
 const start=lista.length-files.length;
 try{
  for(let i=0;i<files.length;i++){
   const d=lista[start+i];
   estado('Detectando tamaños: PDF '+(i+1)+' de '+files.length+'…');
   try{
    const data=await leerMedidasPloteo(files[i]);
    estado('Analizando cobertura de tinta: PDF '+(i+1)+' de '+files.length+'…');
    const clasificaciones=await clasificarPaginasPloteo(files[i],{onProgreso:({terminadas,total})=>estado('Analizando página '+terminadas+' de '+total+'…')});
    if(data.paginas.length!==clasificaciones.length)throw Error('La lectura de páginas no coincide con el análisis visual.');
    d.paginas=data.paginas.map((p,j)=>({...p,modo:clasificaciones[j].modo}));
    if(clasificaciones.some(p=>p.modo==='revision'))d.error='Clasificación dudosa: pendiente de revisión por Librería Saber. No se ofrece un precio automático.';
    elegirSoporte(d);
    if(!d.material)d.error='El PDF no entra en los rollos disponibles.';
   }catch(e){d.error=String(e.message||e)}
   render();
  }
 }finally{leyendo=false;render();cotizar()}
});
$('calcular').addEventListener('click',cotizar);
async function iniciar(){
 try{
  const r=await fetch('/api/ensayo-materiales-ploteo',{cache:'no-store'});
  const data=await r.json();
  if(!r.ok||!data.ok||!Array.isArray(data.supports)||!data.supports.length)throw Error('Catálogo no disponible');
  catalogo=data.supports;
  for(const d of lista)if(d.paginas)elegirSoporte(d);
  render();estado('Subí los PDF: detectaremos tamaños y si cada página es CAD o Póster automáticamente.');
 }catch(e){estado('No se pudieron cargar los materiales. Recargá la página.')}
}
iniciar();
