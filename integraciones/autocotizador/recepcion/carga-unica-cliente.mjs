import {leerMedidasPloteo} from './medidas-local-pdf.mjs';
import {clasificarDestino} from './destino-impresion.mjs';
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
const $=id=>document.getElementById(id);
const entries=[];
let leyendo=false;
let version=0;
let catalogo={a4:[],a3:[]};
const formatoOriginal=paginas=>{const v=paginas.map(p=>{const a=Math.min(p.anchoCm,p.altoCm),b=Math.max(p.anchoCm,p.altoCm);return Math.abs(a-21)<0.2&&Math.abs(b-29.7)<0.2?'a4':Math.abs(a-29.7)<0.2&&Math.abs(b-42)<0.2?'a3':null});return v.every(x=>x===v[0])?v[0]:null};
const valor=(label,options,selected,change)=>{const l=texto('label',label+' '),sel=document.createElement('select');for(const [k,v] of options)sel.add(new Option(v,k));sel.value=selected;sel.onchange=()=>change(sel.value);l.append(sel);return l};
function cambio(){version++;render();cotizar()}
function cantidadCopias(e){
 const l=texto('label','Copias (1 a 500) ');
 const input=document.createElement('input');
 input.type='number';input.min='1';input.max='500';input.step='1';input.inputMode='numeric';
 input.value=String(e.copias);input.setAttribute('aria-label','Cantidad de copias de '+e.name);
 input.onchange=()=>{
  const n=Number(input.value);
  if(!Number.isSafeInteger(n)||n<1||n>500){
   input.setCustomValidity('Elegí una cantidad entera entre 1 y 500.');
   input.reportValidity();input.value=String(e.copias);return;
  }
  input.setCustomValidity('');e.copias=n;cambio();
 };
 l.append(input);return l;
}

const texto=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n};
function render(){
 const lista=$('lista');lista.replaceChildren();
 for(const [i,e] of entries.entries()){
  const card=texto('section','');card.className='archivo';
  card.append(texto('h3',(i+1)+'. '+e.name));
  if(e.error){card.append(texto('p','Error: '+e.error));lista.append(card);continue}
  if(!e.paginas){card.append(texto('p','Analizando medidas…'));lista.append(card);continue}
  const multiples=e.paginas.length>1;
  const medidas=e.paginas.map(p=>p.anchoCm.toFixed(2)+' × '+p.altoCm.toFixed(2)+' cm');
  card.append(texto('p','Tamaño original: '+(new Set(medidas).size===1?medidas[0]:(multiples?'Varios tamaños · '+[...new Set(medidas)].join(' / '):medidas[0]))+' · '+e.paginas.length+' página(s)'));
  const aviso=clasificarDestino(e.paginas);
  if(aviso.requiereConfirmacion)card.append(texto('p','Importante: confirmá el tamaño final. El tamaño del PDF no determina por sí solo el precio.'));
  const label=texto('label','Quiero imprimir en: ');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Tamaño final de '+e.name);
  for(const [v,l] of [['sin-confirmar','Elegir tamaño final'],['original','Mantener tamaño original'],['a3','A3 (29,7 × 42 cm)'],['a4','A4 (21 × 29,7 cm)'],['a5','A5 (14,8 × 21 cm)']]){
   const o=new Option(l,v);sel.add(o);
  }
  sel.value=e.seleccion;sel.onchange=()=>{e.seleccion=sel.value;cambio()};label.append(sel);card.append(label);
  const decision=clasificarDestino(e.paginas,e.seleccion);
  if(decision.confirmado){
   card.append(texto('p','Destino: '+(decision.destino==='ploteo'?'Ploteos CAD/Póster':'Impresiones de documentos')+' · Tamaño final: '+(decision.tamanoFinal==='original'?'original':decision.tamanoFinal.toUpperCase())));
   if(decision.cambioEscala)card.append(texto('p','Se ajustará proporcionalmente sin recortar. Verificar legibilidad y escala, especialmente en planos CAD.'));
   if(decision.mixtas&&decision.tamanoFinal==='original')card.append(texto('p','El PDF contiene tamaños distintos. Se conservarán individualmente al presupuestar.'));
   card.append(cantidadCopias(e));
   if(decision.destino==='documentos'){
    card.append(valor('Impresión', [['bn','Blanco y negro'],['color','Color']],e.modo,v=>{e.modo=v;cambio()}));
    card.append(valor('Caras', [['simple','Simple faz'],['double','Doble faz']],e.caras,v=>{e.caras=v;cambio()}));
    const formato=decision.tamanoFinal==='original'?formatoOriginal(e.paginas):decision.tamanoFinal;
    if(e.modo==='color'&&['a4','a3'].includes(formato)){
     const disponibles=catalogo[formato]||[];
     if(!disponibles.some(m=>m.id===e.materialColor))e.materialColor=disponibles[0]?.id||'';
     if(disponibles.length)card.append(valor('Material',disponibles.map(m=>[m.id,m.name]),e.materialColor,v=>{e.materialColor=v;cambio()}));
     else card.append(texto('p','Materiales no disponibles: no cotizar hasta recuperar el catálogo.'));
    }
    card.append(valor('Anillado',[['ninguno','Sin anillado'],['individual','Cada archivo por separado'],['grupo','Varios archivos juntos']],e.anillado,v=>{e.anillado=v;if(v!=='grupo')e.grupoAnillado='';else e.grupoAnillado='1';cambio()}));
    if(e.anillado==='grupo')card.append(valor('Grupo de anillado',[['1','Grupo 1'],['2','Grupo 2'],['3','Grupo 3'],['4','Grupo 4'],['5','Grupo 5']],e.grupoAnillado,v=>{e.grupoAnillado=v;cambio()}));
    if(e.anillado==='grupo')card.append(texto('p','Los PDF del grupo deben tener igual tamaño final y cantidad de copias.'));
   }else{
    if(e.paginas.some(p=>!['cad','poster'].includes(p.modo)))card.append(texto('p','Análisis CAD/Póster pendiente: requiere revisión, sin precio.'));
    if(e.paginas.some(p=>p.modo==='poster'))card.append(valor('Papel para póster', [['obra80','Obra 80 g'],['recubierto','Recubierto 130 g']],e.papelPoster,v=>{e.papelPoster=v;cambio()}));
   }
  }else card.append(texto('p','Sin precio hasta confirmar el tamaño final.'));
  lista.append(card);
 }
 $('estado').textContent=leyendo?'Analizando archivos…':entries.length?'Identificados '+entries.length+' PDF. Cotización orientativa, sin subir originales.':'Seleccioná tus PDF para comenzar.';
}
$('archivos').addEventListener('change',async ev=>{
 if(leyendo)return;
 const files=[...(ev.target.files||[])];ev.target.value='';
 if(entries.length+files.length>30){$('estado').textContent='Máximo 30 PDF.';return}
 leyendo=true;
 for(const f of files)entries.push({name:f.name,paginas:null,seleccion:'sin-confirmar',error:null,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',materialColor:''});
 render();
 const start=entries.length-files.length;
 for(let i=0;i<files.length;i++){
  const e=entries[start+i];
  try{
   const x=await leerMedidasPloteo(files[i],{maxPaginas:2000});
   e.paginas=x.paginas.map(p=>({...p,modo:'sin-clasificar'}));
   try{const clases=await clasificarPaginasPloteo(files[i]);for(const c of clases){if(['cad','poster'].includes(c.modo))e.paginas[c.numero-1].modo=c.modo;}}catch(_){}
   const suggested=clasificarDestino(e.paginas);
   // No adivinar tamaño final, incluso cuando el PDF parece A4.
   e.requiereConfirmacion=suggested.requiereConfirmacion;
  }catch(ex){e.error=String(ex.message||ex)}
  render();
 }
 leyendo=false;render();cotizar();
});
async function cotizar(){
 const n=++version,out=$('presupuesto');
 if(leyendo||!entries.length){out.textContent='Esperando archivos…';return}
 if(entries.some(e=>e.error||!e.paginas)){out.textContent='Hay documentos sin analizar correctamente. No se puede cotizar el conjunto.';return}
 out.textContent='Calculando importes preliminares…';
 const archivos=entries.map(e=>({nombre:e.name,paginas:e.paginas,seleccion:e.seleccion,copias:e.copias,modo:e.modo,caras:e.caras,papelPoster:e.papelPoster,anillado:e.anillado,grupoAnillado:e.grupoAnillado,materialColor:e.materialColor}));
 try{const r=await fetch('/api/ensayo-carga-unica',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({archivos})});const d=await r.json();if(n!==version)return;if(!r.ok||d.ok!==true||d.paymentAuthorized!==false)throw Error(d.error||'Sin cotización');
 const ars=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
 out.replaceChildren(texto('strong',d.total===null?'TOTAL INCOMPLETO':'TOTAL PRELIMINAR: '+ars(d.total)),texto('p','Impresiones (incluye anillados): '+ars(d.subtotalImpresiones)+' · Ploteos: '+ars(d.subtotalPloteos)),texto('p','Anillados incluidos: '+ars(d.subtotalAnillados)));
 for(const p of d.pendientes)out.append(texto('p',p.nombre+': '+p.motivo));
 if(d.plan.length)out.append(texto('p','Tamaño original y tamaño final registrados por archivo. No habilita cobro ni producción.'));
 }catch(e){if(n===version)out.textContent='No fue posible cotizar: '+String(e.message||e)}
}
async function iniciar(){
 try{const r=await fetch('/api/ensayo-materiales-rapido',{cache:'no-store'});const x=await r.json();if(!r.ok||!x.ok||!x.materials)throw Error('Catálogo inaccesible');catalogo=x.materials;}
 catch(_){catalogo={a4:[],a3:[]};$('estado').textContent='No se pudo cargar el catálogo comercial.';}
 render();if(entries.length)cotizar();
}
iniciar();
