import {leerMedidasPloteo} from './medidas-local-pdf.mjs';
import {clasificarDestino} from './destino-impresion.mjs';
import {seleccionarPaginas} from './seleccionar-paginas.mjs';
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
const $=id=>document.getElementById(id);
const entries=[];
let leyendo=false;
let version=0;
let catalogo={a4:[],a3:[]};
let productosFoto=[];
let variantesCorte=[];
let abierto=-1;
let ultimoPresupuesto=null;
const pesos=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
function importeArchivo(indice){
 if(!ultimoPresupuesto)return null;
 const plan=ultimoPresupuesto.plan?.find(p=>p.indice===indice);
 if(!plan)return null;
 const d=plan.destino==='documentos'?
   ultimoPresupuesto.detalleImpresiones?.find(x=>x.id===plan.id):
   plan.destino==='stickers'?ultimoPresupuesto.detalleStickers?.find(x=>x.id===plan.id):
   plan.destino==='fotos'?ultimoPresupuesto.detalleFotos?.find(x=>x.id===plan.id):
   plan.destino==='corte'?ultimoPresupuesto.detalleCortes?.find(x=>x.id===plan.id):
   ultimoPresupuesto.detallePloteos?.find(x=>x.id===plan.id);
 // Anillados agrupados se suman sólo al total general; evitar un subtotal individual ambiguo.
 if(plan.destino==='documentos'&&entries[indice].anillado==='grupo')return 'Incluido en el grupo';
 return d?pesos(d.subtotal):null;
}
const formatoOriginal=paginas=>{const v=paginas.map(p=>{const a=Math.min(p.anchoCm,p.altoCm),b=Math.max(p.anchoCm,p.altoCm);return Math.abs(a-21)<0.2&&Math.abs(b-29.7)<0.2?'a4':Math.abs(a-29.7)<0.2&&Math.abs(b-42)<0.2?'a3':null});return v.every(x=>x===v[0])?v[0]:null};
const valor=(label,options,selected,change)=>{const l=texto('label',label+' '),sel=document.createElement('select');for(const [k,v] of options)sel.add(new Option(v,k));sel.value=selected;sel.onchange=()=>change(sel.value);l.append(sel);return l};
function paginasElegidas(e){try{return seleccionarPaginas(e.paginas,e.paginasSeleccionadas)}catch(_){return null}}
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
  const fila=document.createElement('div');fila.className='fila';
  const principal=document.createElement('div');principal.className='fila-principal';
  const nombre=texto('strong',(i+1)+'. '+e.name);nombre.className='nombre';
  principal.append(nombre);
  const resumen=document.createElement('div');resumen.className='resumen-archivo';
  if(e.paginas){
   const elegidas=paginasElegidas(e)||e.paginas;
   const d=clasificarDestino(elegidas,e.seleccion);
   const tipo=d.confirmado?(e.servicio==='stickers'?'Stickers con precorte':e.servicio==='fotos'?'Fotografías':e.servicio==='corte'?'Ploteo de corte':d.destino==='ploteo'?'Ploteo':'Impresión'):'Tamaño sin confirmar';
   const material=e.modo==='color'?'Color':'B/N';
   const extra=e.servicio==='corte'?' · '+e.corteMetros+' m':e.servicio==='fotos'?' · '+(productosFoto.find(p=>p.id===e.productoFoto)?.name||'Elegir producto'):e.servicio==='stickers'?' · Adhesivo fotográfico':d.destino==='documentos'?(' · '+material+(e.anillado==='individual'?' · Anillado':e.anillado==='grupo'?' · Grupo '+e.grupoAnillado:'')):
    (elegidas.some(p=>p.modo==='poster')?' · '+(e.papelPoster==='recubierto'?'Recubierto':'Obra 80 g'):'');
   resumen.textContent=(e.paginasSeleccionadas?(e.paginasSeleccionadas+' de '+e.paginas.length):(e.paginas.length+' pág.'))+' · '+tipo+(d.confirmado?' '+(d.tamanoFinal==='original'?'original':d.tamanoFinal.toUpperCase()):'')+' · '+e.copias+' copia(s)'+(d.confirmado?extra:'');
  }else resumen.textContent=e.error?'Error de lectura':'Analizando PDF…';
  principal.append(resumen);fila.append(principal);
  const importe=texto('span',importeArchivo(i)||(e.error?'Revisar':e.seleccion==='sin-confirmar'?'Pendiente':'Por calcular'));
  importe.className='precio-archivo';fila.append(importe);
  const boton=texto('button',abierto===i?'Cerrar':'Editar');
  boton.className='editar';boton.type='button';boton.setAttribute('aria-expanded',String(abierto===i));
  boton.onclick=()=>{abierto=abierto===i?-1:i;render()};
  fila.append(boton);card.append(fila);
  if(abierto!==i){lista.append(card);continue}
  const panel=document.createElement('div');panel.className='panel-edicion';
  if(e.error){panel.append(texto('p','Error: '+e.error));card.append(panel);lista.append(card);continue}
  if(!e.paginas){panel.append(texto('p','Analizando medidas…'));card.append(panel);lista.append(card);continue}
  const multiples=e.paginas.length>1;
  const medidas=e.paginas.map(p=>p.anchoCm.toFixed(2)+' × '+p.altoCm.toFixed(2)+' cm');
  const origin=texto('p','Tamaño original: '+(new Set(medidas).size===1?medidas[0]:(multiples?'Varios tamaños · '+[...new Set(medidas)].join(' / '):medidas[0]))+' · '+e.paginas.length+' página(s)');origin.className='origen';panel.append(origin);
  const paginas=paginasElegidas(e);
  const paginasLabel=texto('label','Páginas a imprimir (vacío = todas)');
  const paginasInput=document.createElement('input');paginasInput.type='text';paginasInput.placeholder='Ej.: 1-3,5';paginasInput.value=e.paginasSeleccionadas;
  paginasInput.setAttribute('aria-label','Páginas a imprimir de '+e.name);
  paginasInput.onchange=()=>{e.paginasSeleccionadas=paginasInput.value.trim();cambio()};
  paginasLabel.append(paginasInput);panel.append(paginasLabel);
  if(!paginas){const err=texto('p','Selección inválida. Usá 1-3,5 y números que existan en el PDF.');err.className='advertencia';panel.append(err);card.append(panel);lista.append(card);continue}
  const aviso=clasificarDestino(paginas);
  if(aviso.requiereConfirmacion){const n=texto('p','Confirmá el tamaño de impresión: el PDF puede tener medidas distintas a las que querés.');n.className='advertencia';panel.append(n)}
  const controles=document.createElement('div');controles.className='controles';
  controles.append(valor('Servicio', [['auto','Impresiones / ploteos'],['stickers','Stickers con precorte A4/A3'],['fotos','Fotografías y carnet'],['corte','Ploteo de corte']],e.servicio||'auto',v=>{e.servicio=v;if(v==='fotos'){e.seleccion='a4';e.productoFoto=productosFoto[0]?.id||'';}if(v==='stickers'||v==='fotos'||v==='corte'){e.anillado='ninguno';e.grupoAnillado=''}cambio()}));
  const label=texto('label','Tamaño de impresión');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Tamaño final de '+e.name);
  for(const [v,l] of [['sin-confirmar','Elegir tamaño final'],['original','Mantener tamaño original'],['a3','A3 (29,7 × 42 cm)'],['a4','A4 (21 × 29,7 cm)'],['a5','A5 (14,8 × 21 cm)']]){
   const o=new Option(l,v);sel.add(o);
  }
  sel.value=e.seleccion;sel.onchange=()=>{e.seleccion=sel.value;cambio()};label.append(sel);if(e.servicio!=='fotos'&&e.servicio!=='corte')controles.append(label);
  const decision=clasificarDestino(paginas,e.seleccion);
  if(decision.confirmado||e.servicio==='corte'){
   const destino=texto('p',(e.servicio==='corte'?'Trabajo: ploteo de corte · Metros declarados':e.servicio==='fotos'?'Trabajo fotográfico · Tamaño elegido por producto':'Trabajo: '+(decision.destino==='ploteo'?'Ploteo grande':'Impresión de documentos')+' · Salida: '+(decision.tamanoFinal==='original'?'tamaño original':decision.tamanoFinal.toUpperCase())));destino.className='destino';panel.append(destino);
   if(decision.cambioEscala){const n=texto('p','El archivo se ajustará sin recortar. Revisá que textos y escalas sigan siendo legibles.');n.className='advertencia';panel.append(n)}
   if(decision.mixtas&&decision.tamanoFinal==='original')panel.append(texto('p','El PDF contiene tamaños distintos. Se conservarán individualmente al presupuestar.'));
   if(e.servicio!=='corte')controles.append(cantidadCopias(e));
   if(e.servicio==='fotos'){
    if(productosFoto.length)controles.append(valor('Papel y tamaño',productosFoto.map(p=>[p.id,p.name]),e.productoFoto||productosFoto[0].id,v=>{e.productoFoto=v;cambio()}));
    else panel.append(texto('p','Catálogo de fotografías no disponible.'));
    panel.append(texto('p','Cada página seleccionada es una foto; carnet equivale a una plancha de seis. El encuadre se confirmará antes de producir.'));
   }else if(e.servicio==='corte'){
    if(variantesCorte.length)controles.append(valor('Tipo de corte',variantesCorte.map(v=>[v.id,v.name]),e.corteVariante,v=>{e.corteVariante=v;cambio()}));
    const l=texto('label','Metros lineales');
    const input=document.createElement('input');input.type='number';input.min='0.1';input.max='1000';input.step='0.1';
    input.value=String(e.corteMetros);input.onchange=()=>{const n=Number(input.value);if(n>=0.1&&n<=1000){e.corteMetros=n;cambio()}else input.reportValidity()};
    l.append(input);controles.append(l);
    panel.append(texto('p','El metraje debe corresponder al trabajo real; no se deduce de las páginas del PDF. Contornos sujetos a verificación.'));
   }else if(e.servicio==='stickers'){
    if(!['a4','a3'].includes(decision.tamanoFinal==='original'?formatoOriginal(paginas):decision.tamanoFinal)){
     const aviso=texto('p','Para stickers, elegí tamaño de salida A4 o A3.');aviso.className='advertencia';panel.append(aviso);
    }else panel.append(texto('p','Incluye impresión en adhesivo fotográfico y precorte. Cada página del PDF representa una plancha por copia.'));
   }else if(decision.destino==='documentos'){
    controles.append(valor('Impresión', [['bn','Blanco y negro'],['color','Color']],e.modo,v=>{e.modo=v;cambio()}));
    controles.append(valor('Caras', [['simple','Simple faz'],['double','Doble faz']],e.caras,v=>{e.caras=v;cambio()}));
    const formato=decision.tamanoFinal==='original'?formatoOriginal(paginas):decision.tamanoFinal;
    if(e.modo==='color'&&['a4','a3'].includes(formato)){
     const disponibles=catalogo[formato]||[];
     if(!disponibles.some(m=>m.id===e.materialColor))e.materialColor=disponibles[0]?.id||'';
     if(disponibles.length)controles.append(valor('Material',disponibles.map(m=>[m.id,m.name]),e.materialColor,v=>{e.materialColor=v;cambio()}));
     else panel.append(texto('p','Materiales no disponibles: no cotizar hasta recuperar el catálogo.'));
    }
    controles.append(valor('Anillado',[['ninguno','Sin anillado'],['individual','Cada archivo por separado'],['grupo','Varios archivos juntos']],e.anillado,v=>{e.anillado=v;if(v!=='grupo')e.grupoAnillado='';else e.grupoAnillado='1';cambio()}));
    if(e.anillado==='grupo')controles.append(valor('Grupo de anillado',[['1','Grupo 1'],['2','Grupo 2'],['3','Grupo 3'],['4','Grupo 4'],['5','Grupo 5']],e.grupoAnillado,v=>{e.grupoAnillado=v;cambio()}));
    if(e.anillado==='grupo')panel.append(texto('p','Los PDF del grupo deben tener igual tamaño final y cantidad de copias.'));
   }else{
    if(paginas.some(p=>!['cad','poster'].includes(p.modo)))panel.append(texto('p','Análisis CAD/Póster pendiente: requiere revisión, sin precio.'));
    if(e.paginas.some(p=>p.modo==='poster'))controles.append(valor('Papel para póster', [['obra80','Obra 80 g'],['recubierto','Recubierto 130 g']],e.papelPoster,v=>{e.papelPoster=v;cambio()}));
   }
  }else {const n=texto('p','Elegí el tamaño de impresión para continuar.');n.className='advertencia';panel.append(n)}
  panel.append(controles);
  card.append(panel);
  lista.append(card);
 }
 $('estado').textContent=leyendo?'Analizando archivos…':entries.length?'Identificados '+entries.length+' PDF. Cotización orientativa, sin subir originales.':'Seleccioná tus PDF para comenzar.';
}
$('archivos').addEventListener('change',async ev=>{
 if(leyendo)return;
 const files=[...(ev.target.files||[])];ev.target.value='';
 if(entries.length+files.length>30){$('estado').textContent='Máximo 30 PDF.';return}
 leyendo=true;
 if(!entries.length)abierto=0;
 for(const f of files)entries.push({name:f.name,paginas:null,seleccion:'sin-confirmar',error:null,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',materialColor:'',paginasSeleccionadas:'',servicio:'auto',productoFoto:'',corteVariante:'gt3',corteMetros:1});
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
   if(e.paginas.every(p=>Math.abs(Math.min(p.anchoCm,p.altoCm)-21)<0.2&&Math.abs(Math.max(p.anchoCm,p.altoCm)-29.7)<0.2))e.seleccion='a4';
   else if(e.paginas.every(p=>Math.abs(Math.min(p.anchoCm,p.altoCm)-29.7)<0.2&&Math.abs(Math.max(p.anchoCm,p.altoCm)-42)<0.2))e.seleccion='a3';
  }catch(ex){e.error=String(ex.message||ex)}
  render();
 }
 leyendo=false;render();cotizar();
});
async function cotizar(){
 const n=++version,out=$('presupuesto');
 ultimoPresupuesto=null;
 if(leyendo||!entries.length){out.textContent='Esperando archivos…';return}
 if(entries.some(e=>e.error||!e.paginas)){out.textContent='Hay documentos sin analizar correctamente. No se puede cotizar el conjunto.';return}
 out.textContent='Calculando importes preliminares…';
 for(const e of entries){
  if(!e.paginas||e.modo!=='color')continue;
  const d=clasificarDestino(paginasElegidas(e)||e.paginas,e.seleccion);
  if(d.destino!=='documentos')continue;
  const formato=d.tamanoFinal==='original'?formatoOriginal(paginasElegidas(e)||e.paginas):d.tamanoFinal;
  const disponibles=catalogo[formato]||[];
  if(!e.materialColor&&disponibles.length)e.materialColor=disponibles[0].id;
 }
 const archivos=entries.map(e=>({nombre:e.name,paginas:e.paginas,paginasSeleccionadas:e.paginasSeleccionadas,seleccion:e.seleccion,servicio:e.servicio||'auto',productoFoto:e.productoFoto||'',corteVariante:e.corteVariante,corteMetros:e.corteMetros,copias:e.copias,modo:e.modo,caras:e.caras,papelPoster:e.papelPoster,anillado:e.anillado,grupoAnillado:e.grupoAnillado,materialColor:e.materialColor}));
 try{const r=await fetch('/api/ensayo-carga-unica',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({archivos})});const d=await r.json();if(n!==version)return;if(!r.ok||d.ok!==true||d.paymentAuthorized!==false)throw Error(d.error||'Sin cotización');
 ultimoPresupuesto=d;
 const ars=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
 out.replaceChildren(texto('strong',d.total===null?'TOTAL INCOMPLETO':'TOTAL PRELIMINAR: '+ars(d.total)),texto('p','Impresiones (incluye anillados): '+ars(d.subtotalImpresiones)+' · Ploteos: '+ars(d.subtotalPloteos)+' · Stickers: '+ars(d.subtotalStickers||0)+' · Fotos: '+ars(d.subtotalFotos||0)+' · Corte: '+ars(d.subtotalCortes||0)),texto('p','Anillados incluidos: '+ars(d.subtotalAnillados)));
 for(const p of d.pendientes)out.append(texto('p',p.nombre+': '+p.motivo));
 if(d.plan.length)out.append(texto('p','Precio orientativo. Los archivos no se enviaron ni se autoriza el cobro.'));
 render();
 }catch(e){if(n===version){out.textContent='No fue posible cotizar: '+String(e.message||e);render()}}
}
async function iniciar(){
 try{const r=await fetch('/api/ensayo-materiales-rapido',{cache:'no-store'});const x=await r.json();if(!r.ok||!x.ok||!x.materials)throw Error('Catálogo inaccesible');catalogo=x.materials;productosFoto=x.photos||[];variantesCorte=x.cutVariants||[];}
 catch(_){catalogo={a4:[],a3:[]};productosFoto=[];variantesCorte=[];$('estado').textContent='No se pudo cargar el catálogo comercial.';}
 render();if(entries.length)cotizar();
}
iniciar();
