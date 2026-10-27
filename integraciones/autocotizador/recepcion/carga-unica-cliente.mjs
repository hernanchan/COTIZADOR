import {leerMedidasPloteo,requiereClasificacionVisualPloteo} from './medidas-local-pdf.mjs';
import {clasificarDestino} from './destino-impresion.mjs';
import {prepararBorradorPedido} from './preparar-borrador-pedido.mjs';
import {componerCarritoPreliminar} from './componer-carrito-preliminar.mjs';
import {seleccionarPaginas} from './seleccionar-paginas.mjs';
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
import {prepararLoteParcial,recomponerLoteParcial} from './cotizar-lote-parcial.mjs';
const $=id=>document.getElementById(id);
const entries=[];
let leyendo=false;
let version=0;
let catalogo={a4:[],a3:[]};
let productosFoto=[];
let variantesCorte=[];
let productosGrafica=[];
let abierto=-1;
let ultimoPresupuesto=null;
const pesos=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
function informarPrecioPrivado(estado,total=null){
 if(window.parent===window)return;
 window.parent.postMessage({type:'SABER_SMART_PRICE_STATE',estado,
  total:Number.isSafeInteger(total)&&total>0?total:null},location.origin);
}
function importeArchivo(indice){
 if(!ultimoPresupuesto)return null;
 const plan=ultimoPresupuesto.plan?.find(p=>p.indice===indice);
 if(!plan)return null;
 const d=plan.destino==='documentos'?
   ultimoPresupuesto.detalleImpresiones?.find(x=>x.id===plan.id):
   plan.destino==='stickers'?ultimoPresupuesto.detalleStickers?.find(x=>x.id===plan.id):
   plan.destino==='fotos'?ultimoPresupuesto.detalleFotos?.find(x=>x.id===plan.id):
   plan.destino==='corte'?ultimoPresupuesto.detalleCortes?.find(x=>x.id===plan.id):
   plan.destino==='grafica'?ultimoPresupuesto.detalleGraficas?.find(x=>x.id===plan.id):
   ultimoPresupuesto.detallePloteos?.find(x=>x.id===plan.id);
 // Anillados agrupados se suman sólo al total general; evitar un subtotal individual ambiguo.
 if(plan.destino==='documentos'&&entries[indice].anillado==='grupo')return 'Incluido en el grupo';
 return d?pesos(d.subtotal):null;
}
// Sólo proponemos medidas reconocibles con tolerancia para CropBox y escaneos.
/// Otros tamaños requieren confirmación explícita antes de cotizar.
function tamañoEstandar(paginas){
 if(!paginas?.length)return null;
 const coincide=(p,a,b,margen)=>{
  const x=Math.min(p.anchoCm,p.altoCm),y=Math.max(p.anchoCm,p.altoCm);
  return Math.abs(x-a)<=margen&&Math.abs(y-b)<=margen;
 };
 if(paginas.every(p=>coincide(p,21,29.7,0.35)))return 'a4';
 if(paginas.every(p=>coincide(p,29.7,42,0.35)))return 'a3';
 return null;
}
const formatoOriginal=paginas=>{const v=paginas.map(p=>{const a=Math.min(p.anchoCm,p.altoCm),b=Math.max(p.anchoCm,p.altoCm);return Math.abs(a-21)<0.2&&Math.abs(b-29.7)<0.2?'a4':Math.abs(a-29.7)<0.2&&Math.abs(b-42)<0.2?'a3':null});return v.every(x=>x===v[0])?v[0]:null};
const valor=(label,options,selected,change)=>{const l=texto('label',label+' '),sel=document.createElement('select');for(const [k,v] of options)sel.add(new Option(v,k));sel.value=selected;sel.onchange=()=>change(sel.value);l.append(sel);return l};
function paginasElegidas(e){try{return seleccionarPaginas(e.paginas,e.paginasSeleccionadas)}catch(_){return null}}
function cambio(){version++;render();cotizar()}
function cantidadCopias(e){
 const l=texto('label',e.servicio==='grafica'?'Lotes (1 a 500) ':'Copias (1 a 500) ');
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
   const independiente=['fotos','corte','grafica'].includes(e.servicio);
   const tipo=(d.confirmado||independiente)?(e.servicio==='grafica'?'Gráfica comercial':e.servicio==='stickers'?'Stickers con precorte':e.servicio==='fotos'?'Fotografías':e.servicio==='corte'?'Ploteo de corte':d.destino==='ploteo'?'Ploteo':'Impresión'):'Tamaño sin confirmar';
   const material=e.modo==='color'?'Color':'B/N';
   const extra=e.servicio==='grafica'?' · '+(productosGrafica.find(p=>p.id===e.productoGrafica)?.name||'Elegir variante'):e.servicio==='corte'?' · '+e.corteMetros+' m':e.servicio==='fotos'?' · '+(productosFoto.find(p=>p.id===e.productoFoto)?.name||'Elegir producto'):e.servicio==='stickers'?' · Adhesivo fotográfico':d.destino==='documentos'?(' · '+material+(e.anillado==='individual'?' · Anillado':e.anillado==='grupo'?' · Grupo '+e.grupoAnillado:'')):
    (elegidas.some(p=>p.modo==='poster')?' · '+(e.papelPoster==='recubierto'?'Recubierto':'Obra 80 g'):'');
   const nup=d.destino==='documentos'&&(e.paginasPorHoja??1)>1?' · '+e.paginasPorHoja+' por cara':'';
   resumen.textContent=(e.paginasSeleccionadas?(e.paginasSeleccionadas+' de '+e.paginas.length):(e.paginas.length+' pág.'))+' · '+tipo+(d.confirmado?' '+(d.tamanoFinal==='original'?'original':d.tamanoFinal.toUpperCase()):'')+' · '+e.copias+(e.servicio==='grafica'?' lote(s)':' copia(s)')+((d.confirmado||independiente)?extra+nup:'');
  }else resumen.textContent=e.error?'Error de lectura':'Analizando PDF…';
  principal.append(resumen);fila.append(principal);
  const importe=texto('span',importeArchivo(i)||(e.error?'Revisar':(e.seleccion==='sin-confirmar'&&!['fotos','corte','grafica'].includes(e.servicio))?'Pendiente':'Por calcular'));
  importe.className='precio-archivo';fila.append(importe);
  const boton=texto('button',abierto===i?'Cerrar':'Editar');
  boton.className='editar';boton.type='button';boton.setAttribute('aria-expanded',String(abierto===i));
  boton.onclick=()=>{abierto=abierto===i?-1:i;render()};
  const acciones=document.createElement('div');acciones.className='acciones-archivo';
  acciones.append(boton);
  const quitar=texto('button','Quitar');
  quitar.type='button';quitar.className='editar';
  quitar.style.color='#9d3434';quitar.disabled=leyendo;
  quitar.setAttribute('aria-label','Quitar archivo '+e.name);
  quitar.onclick=()=>{
   if(leyendo)return; // Evita cambiar índices durante análisis asincrónico.
   entries.splice(i,1);
   if(abierto===i)abierto=-1;
   else if(abierto>i)abierto--;
   cambio();
   $('estado').textContent=entries.length+' PDF en la lista. No hace falta volver a cargar los restantes.';
  };
  acciones.append(quitar);fila.append(acciones);card.append(fila);
  if(abierto!==i){lista.append(card);continue}
  const panel=document.createElement('div');panel.className='panel-edicion';
  if(e.error){
   const error=texto('p','No pudimos analizar este PDF: '+e.error);
   error.className='advertencia';panel.append(error);
   const reemplazar=document.createElement('label');
   reemplazar.textContent='Reemplazar únicamente este PDF';
   const input=document.createElement('input');
   input.type='file';input.accept='.pdf,application/pdf';input.disabled=leyendo;
   input.onchange=async()=>{
    const file=input.files?.[0];input.value='';
    if(!file||leyendo)return;
    if(!/\\.pdf$/i.test(file.name)||file.size<5||file.size>250*1024*1024){
     $('estado').textContent='Elegí un PDF válido, de hasta 250 MB.';return;
    }
    leyendo=true;version++;ultimoPresupuesto=null;
    e.name=file.name;e.archivoOriginal=file;e.error=null;e.paginas=null;
    e.seleccion='sin-confirmar';e.paginasSeleccionadas='';
    render();
    try{await analizarArchivoPDF(e,file)}
    finally{leyendo=false;render();cotizar()}
   };
   reemplazar.append(input);panel.append(reemplazar);
   card.append(panel);lista.append(card);continue;
  }
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
  controles.append(valor('Servicio', [['auto','Impresiones / ploteos'],['stickers','Stickers con precorte A4/A3'],['fotos','Fotografías y carnet'],['corte','Ploteo de corte'],['grafica','Gráfica comercial']],e.servicio||'auto',v=>{e.servicio=v;if(v==='fotos'){e.seleccion='a4';e.productoFoto=productosFoto[0]?.id||'';}if(v==='grafica'){e.productoGrafica=productosGrafica[0]?.id||'';}if(v==='stickers'||v==='fotos'||v==='corte'||v==='grafica'){e.anillado='ninguno';e.grupoAnillado=''}cambio()}));
  const label=texto('label','Tamaño de impresión');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Tamaño final de '+e.name);
  for(const [v,l] of [['sin-confirmar','Elegir tamaño final'],['original','Mantener tamaño original'],['a3','A3 (29,7 × 42 cm)'],['a4','A4 (21 × 29,7 cm)'],['a5','A5 (14,8 × 21 cm)']]){
   const o=new Option(l,v);sel.add(o);
  }
  sel.value=e.seleccion;sel.onchange=()=>{e.seleccion=sel.value;cambio()};label.append(sel);if(!['fotos','corte','grafica'].includes(e.servicio))controles.append(label);
  const decision=clasificarDestino(paginas,e.seleccion);
  if(decision.confirmado||['corte','fotos','grafica'].includes(e.servicio)){
   const destino=texto('p',(e.servicio==='grafica'?'Gráfica comercial · Precio por lote, sin diseño':e.servicio==='corte'?'Trabajo: ploteo de corte · Metros declarados':e.servicio==='fotos'?'Trabajo fotográfico · Tamaño elegido por producto':'Trabajo: '+(decision.destino==='ploteo'?'Ploteo grande':'Impresión de documentos')+' · Salida: '+(decision.tamanoFinal==='original'?'tamaño original':decision.tamanoFinal.toUpperCase())));destino.className='destino';panel.append(destino);
   if(decision.cambioEscala){const n=texto('p','El archivo se ajustará sin recortar. Revisá que textos y escalas sigan siendo legibles.');n.className='advertencia';panel.append(n)}
   if(decision.mixtas&&decision.tamanoFinal==='original')panel.append(texto('p','El PDF contiene tamaños distintos. Se conservarán individualmente al presupuestar.'));
   if(e.servicio!=='corte')controles.append(cantidadCopias(e));
   if(e.servicio==='grafica'){
    if(productosGrafica.length)controles.append(valor('Producto y variante',productosGrafica.map(p=>[p.id,p.name]),e.productoGrafica||productosGrafica[0].id,v=>{e.productoGrafica=v;cambio()}));
    else panel.append(texto('p','Catálogo de gráfica no disponible.'));
    panel.append(texto('p','Una sola página PDF con el diseño. Cantidad expresada en lotes comerciales, no unidades sueltas. No incluye diseño.'));
   }else if(e.servicio==='fotos'){
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
    controles.append(valor('Páginas por cara',[['1','1 página'],['2','2 páginas'],['4','4 páginas'],['9','9 páginas']],String(e.paginasPorHoja??1),v=>{e.paginasPorHoja=Number(v);cambio()}));
    panel.append(texto('p','Las páginas se reducen proporcionalmente dentro de cada cara impresa. La doble faz utiliza dos caras por hoja física.'));
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
async function analizarArchivoPDF(e,file){
 try{
  const x=await leerMedidasPloteo(file,{maxPaginas:2000});
  e.paginas=x.paginas.map(p=>({...p,modo:'sin-clasificar'}));
  // Para A4/A3 y documentos pequeños no hace falta renderizar cada página.
  // Para ploteos sí se mantiene el clasificador CAD/Póster por página.
  if(requiereClasificacionVisualPloteo(e.paginas)){
   try{
    const clases=await clasificarPaginasPloteo(file);
    for(const item of clases){
     if(['cad','poster'].includes(item.modo)&&e.paginas[item.numero-1])
      e.paginas[item.numero-1].modo=item.modo;
    }
   }catch(_){/* Sin clase confirmada, el ploteo no obtiene precio final. */}
  }
  const suggested=clasificarDestino(e.paginas);
  e.requiereConfirmacion=suggested.requiereConfirmacion;
  const estandar=tamañoEstandar(e.paginas);
  if(estandar)e.seleccion=estandar;
  else if(e.paginas.some(p=>Math.max(p.anchoCm,p.altoCm)>42.03||
      Math.min(p.anchoCm,p.altoCm)>29.73))
   e.seleccion='original';
  e.error=null;
 }catch(ex){e.error=String(ex.message||ex);e.paginas=null}
}
$('archivos').addEventListener('change',async ev=>{
 if(leyendo)return;
 const files=[...(ev.target.files||[])];ev.target.value='';
 if(entries.length+files.length>30){$('estado').textContent='Máximo 30 PDF.';return}
 leyendo=true;
 // Mantener fichas compactas al cargar un lote; cada PDF se edita sólo si hace falta.
 if(!entries.length)abierto=-1;
 for(const f of files)entries.push({name:f.name,archivoOriginal:f,paginas:null,seleccion:'sin-confirmar',error:null,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',paginasPorHoja:1,materialColor:'',paginasSeleccionadas:'',servicio:'auto',productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1});
 render();
 const start=entries.length-files.length;
 // Lotes pequeños: lectura de hasta tres PDF en paralelo, sin cargar Google.
 // Archivos grandes se analizan de a uno para limitar presión de memoria.
 const concurrencia=files.every(f=>f.size<=12*1024*1024)?Math.min(3,files.length):1;
 let siguiente=0;
 await Promise.all(Array.from({length:concurrencia},async()=>{
  while(siguiente<files.length){
   const i=siguiente++;
   await analizarArchivoPDF(entries[start+i],files[i]);
   render();
  }
 }));
 leyendo=false;render();cotizar();
});
async function cotizar(){
 const n=++version,out=$('presupuesto');
 informarPrecioPrivado('calculando');
 $('prepararPedido').disabled=true;
 $('resumenPedido').replaceChildren();
 ultimoPresupuesto=null;
 if(leyendo||!entries.length){out.textContent='Esperando archivos…';informarPrecioPrivado('esperando');return}
 const lote=prepararLoteParcial(entries);
 if(!lote.archivos.length){
  out.replaceChildren(texto('strong','No hay PDF aptos para cotizar'));
  for(const e of lote.noLeidos){
   const note=texto('p',e.nombre+' · '+e.motivo);
   note.className='advertencia';out.append(note);
  }
  out.append(texto('p','Podés quitar únicamente el archivo con error. Los demás no se pierden.'));
  informarPrecioPrivado('incompleto');
  render();return;
 }
 out.textContent=lote.noLeidos.length?
  'Calculando los '+lote.archivos.length+' PDF legibles; los demás quedarán pendientes…':
  'Calculando importes preliminares…';
 for(const e of entries){
  if(!e.paginas||e.modo!=='color')continue;
  const d=clasificarDestino(paginasElegidas(e)||e.paginas,e.seleccion);
  if(d.destino!=='documentos')continue;
  const formato=d.tamanoFinal==='original'?formatoOriginal(paginasElegidas(e)||e.paginas):d.tamanoFinal;
  const disponibles=catalogo[formato]||[];
  if(!e.materialColor&&disponibles.length)e.materialColor=disponibles[0].id;
 }
 // Los materiales de color se completan antes de formar el payload.
 const archivos=prepararLoteParcial(entries).archivos;
 try{const r=await fetch('/api/ensayo-carga-unica',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({archivos})});const respuesta=await r.json();if(n!==version)return;
 if(!r.ok||respuesta.ok!==true||respuesta.paymentAuthorized!==false)
  throw Error(respuesta.error||'Sin cotización');
 const d=recomponerLoteParcial(respuesta,lote);
 ultimoPresupuesto=d;
 informarPrecioPrivado(d.estado==='PRELIMINAR'?'listo':'incompleto',d.total);
 $('prepararPedido').disabled=!(d.estado==='PRELIMINAR'&&Number.isSafeInteger(d.total)&&d.total>0&&entries.every(e=>e.archivoOriginal));
 const ars=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
 out.replaceChildren(
  texto('strong',d.total!==null?'TOTAL PRELIMINAR: '+ars(d.total):
   d.subtotalCalculable!==null?'SUBTOTAL DE PDF COTIZABLES: '+ars(d.subtotalCalculable):
   'TOTAL INCOMPLETO'),
  texto('p',d.contieneArchivosSinAnalizar?
   'Falta revisar '+lote.noLeidos.length+' PDF. Este subtotal NO es el total del pedido y no habilita su envío.':
   'Impresiones (incluye anillados): '+ars(d.subtotalImpresiones)+' · Ploteos: '+ars(d.subtotalPloteos)+' · Stickers: '+ars(d.subtotalStickers||0)+' · Fotos: '+ars(d.subtotalFotos||0)+' · Corte: '+ars(d.subtotalCortes||0)+' · Gráfica: '+ars(d.subtotalGraficas||0)),
  texto('p','Anillados incluidos en el cálculo: '+ars(d.subtotalAnillados)));
 for(const p of d.pendientes){
  const warning=texto('p',p.nombre+': '+p.motivo+
   '. Tocá Editar o Quitá únicamente ese archivo; los demás mantienen su cálculo.');
  warning.className='advertencia';out.append(warning);
 }
 if(d.plan.length)out.append(texto('p','Precio orientativo. Los archivos no se enviaron ni se autoriza el cobro.'));
 render();
 }catch(e){if(n===version){informarPrecioPrivado('error');out.textContent='No fue posible cotizar: '+String(e.message||e);render()}}
}
async function iniciar(){
 try{const r=await fetch('/api/ensayo-materiales-rapido',{cache:'no-store'});const x=await r.json();if(!r.ok||!x.ok||!x.materials)throw Error('Catálogo inaccesible');catalogo=x.materials;productosFoto=x.photos||[];variantesCorte=x.cutVariants||[];productosGrafica=x.graphicProducts||[];}
 catch(_){catalogo={a4:[],a3:[]};productosFoto=[];variantesCorte=[];productosGrafica=[];$('estado').textContent='No se pudo cargar el catálogo comercial.';}
 render();if(entries.length)cotizar();
}
iniciar();


// El puente de recepción sólo existe dentro del portal privado autenticado.
// La clasificación local sirve para cotizar; el servidor verifica cada PDF
// nuevamente antes de generar una orden. Ningún ploteo se registra aquí.
if(location.pathname==='/prueba-v2/carga-inteligente'&&window.parent!==window){
 const bridgeButton=document.createElement('button');
 bridgeButton.type='button';bridgeButton.id='enviar-cotizacion-inteligente';
 bridgeButton.textContent='Agregar PDF al envío privado';
 const info=document.createElement('p');
 info.className='pie';info.setAttribute('role','status');
 info.textContent='Para este ensayo el envío integrado admite sólo PDF completos A4/A3 sin anillado. Los ploteos se cotizan, pero quedan pendientes de integración con el servidor.';
 const resumen=$('resumenPedido');
 resumen?.parentNode?.insertBefore(bridgeButton,resumen);
 bridgeButton.insertAdjacentElement('afterend',info);
 bridgeButton.addEventListener('click',()=>{
  try{
   if(leyendo||!ultimoPresupuesto||ultimoPresupuesto.estado!=='PRELIMINAR'||
      !Number.isSafeInteger(ultimoPresupuesto.total)||ultimoPresupuesto.total<1||
      entries.length<1||entries.length>30||
      ultimoPresupuesto.plan?.length!==entries.length)
    throw Error('Completá primero la cotización de todos los documentos.');
   const files=[],options=[];
   for(let i=0;i<entries.length;i++){
    const e=entries[i],plan=ultimoPresupuesto.plan.find(p=>p.indice===i);
    if(!plan||plan.destino!=='documentos')
     throw Error('Los ploteos y otros servicios se calculan automáticamente, pero su recepción privada todavía requiere la validación del servidor.');
    if(!e.archivoOriginal||!Number.isSafeInteger(e.archivoOriginal.size)||
       e.archivoOriginal.size<5||e.archivoOriginal.size>20*1024*1024||
       e.name.length>120||!/\\.pdf$/i.test(e.name))
     throw Error('La recepción privada admite PDF de hasta 20 MB por archivo.');
    if(e.anillado!=='ninguno')
     throw Error('El anillado está disponible para cotizar, pero su registro privado todavía requiere validación.');
    if(![1,2,4,9].includes(e.paginasPorHoja??1))
     throw Error('Composición por cara no admitida.');
    if(!Array.isArray(e.paginas)||e.paginas.length<1||
       e.paginas.length>2000||plan.paginasElegidas.length!==e.paginas.length)
     throw Error('El envío directo admite PDF completos, sin selección parcial de páginas.');
    if(!['a4','a3'].includes(plan.formatoFinal)||
       !['bn','color'].includes(e.modo)||!['simple','double'].includes(e.caras)||
       !Number.isSafeInteger(e.copias)||e.copias<1||e.copias>200)
     throw Error('Formato, copias o impresión no admitidos por la recepción privada.');
    files.push(e.archivoOriginal);
    options.push({formato:plan.formatoFinal,modo:e.modo,caras:e.caras,
     copias:e.copias,materialColor:e.materialColor,
     paginasPorHoja:e.paginasPorHoja??1,
     paginas:e.paginas.length,nombre:e.name});
   }
   window.parent.postMessage({type:'SABER_SMART_DOCUMENTS_TO_PRIVATE',
    files,options,total:ultimoPresupuesto.total},location.origin);
   info.textContent='Documentos enviados a la cola del portal privado. El envío a Drive se realizará únicamente al pulsar «Enviar todos los PDF del pedido».';
  }catch(error){info.textContent=String(error.message||error)}
 });
}
$('prepararPedido').addEventListener('click',()=>{
 const contenedor=$('resumenPedido');contenedor.replaceChildren();
 try{
  const draft=prepararBorradorPedido({
   cotizacion:ultimoPresupuesto,
   archivos:entries.map(e=>({
    file:e.archivoOriginal,name:e.name,paginas:e.paginas,copias:e.copias,
    caras:e.caras,anillado:e.anillado,grupoAnillado:e.grupoAnillado,
    paginasPorHoja:e.paginasPorHoja??1
   }))
  });
  let articulos=[];
  try{articulos=JSON.parse(localStorage.getItem('saberCartV1')||'[]')}catch(_){articulos=[]}
  const carrito=componerCarritoPreliminar({borrador:draft,articulos});
  contenedor.append(texto('h3','Pedido en preparación · '+pesos(carrito.totalOrientativo)));
  if(carrito.productos.length)contenedor.append(texto('p','Artículos de tienda (precios pendientes de verificación): '+carrito.productos.length+' · '+pesos(carrito.subtotalProductosOrientativo)));
  else contenedor.append(texto('p','Artículos de tienda: ninguno accesible desde este ensayo. Si el carrito está en otro dominio, todavía no se sincroniza.'));
  contenedor.append(texto('p','Trabajos de impresión: '+pesos(carrito.subtotalTrabajosOrientativo)));
  contenedor.append(texto('p','Los archivos siguen en este dispositivo. No fueron recibidos por Librería Saber.'));
  const listado=document.createElement('ol');
  for(const item of draft.items){
   const li=document.createElement('li');
   li.textContent=item.nombre+' · '+item.servicio+' · páginas '+item.paginasElegidas.join(', ')+' · '+item.estadoArchivo.replaceAll('_',' ');
   listado.append(li);
  }
  contenedor.append(listado);
  const aviso=texto('p','Falta la recepción protegida, la comprobación de originales y la validación de precios por servidor. Pago desactivado.');
  aviso.className='advertencia';contenedor.append(aviso);
 }catch(error){
  const aviso=texto('p',String(error.message||error));aviso.className='advertencia';contenedor.append(aviso);
 }
});
