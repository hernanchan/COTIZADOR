import {leerMedidasPloteo,requiereClasificacionVisualPloteo} from './medidas-local-pdf.mjs';
import {clasificarDestino} from './destino-impresion.mjs';
import {opcionesTipoPloteo} from './eleccion-ploteo-cad-pleno.mjs';
import {prepararBorradorPedido} from './preparar-borrador-pedido.mjs';
import {componerCarritoPreliminar} from './componer-carrito-preliminar.mjs';
import {seleccionarPaginas} from './seleccionar-paginas.mjs';
import {decidirTamanoCliente} from './decision-tamano-impresion.mjs';
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
import {clasificarMosaicoRasterPDFGrande} from './clasificar-ploteo-grande-raster-local.mjs';
import {clasificarPloteoGrandeVisualLimitado} from './clasificar-ploteo-grande-visual-limitado.mjs';
import {clasificarPloteoGrandePorRangos} from './clasificar-ploteo-grande-por-rangos.mjs';
import {prepararLoteParcial,recomponerLoteParcial} from './cotizar-lote-parcial.mjs';
import {solicitarCotizacionPrivada} from './solicitar-cotizacion-privada.mjs';
import {decidirTransportePDF,LIMITE_TUS_PDF_BYTES,LIMITE_R2_PDF_BYTES} from './seleccionar-transporte-pdf.mjs';
import {normalizarArchivosImpresion} from './imagenes-a-pdf-local.mjs';
const $=id=>document.getElementById(id);
const entries=[];
let modoLote='individual'; // Predeterminado móvil: la carga está siempre disponible.
const configuracionComun={}; // Opciones comunes persistentes para nuevos PDF compatibles.
function actualizarModoLote(){
 const zona=$('zonaArchivos');if(zona)zona.hidden=false;
 const aviso=$('modoAviso');if(aviso)aviso.textContent=modoLote==='comun'?'Configuración común: las medidas y las páginas se revisan para cada PDF.':modoLote==='individual'?'Cada archivo conserva sus propias opciones, dentro del mismo pedido.':'Elegí una opción antes de subir archivos.';
 const campo=$('archivos');if(campo)campo.disabled=false;
}

const UNIVERSAL_COMPRADOR_LIVE=location.pathname==='/cotizar/archivos'&&window.parent!==window;
const MAX_PDF_CARGA=(location.pathname==='/prueba-v2/carga-inteligente'||UNIVERSAL_COMPRADOR_LIVE)?10:30;
const MAX_PDF_TUS_BYTES=LIMITE_TUS_PDF_BYTES;
const MAX_PDF_R2_PREPAGO_BYTES=LIMITE_R2_PDF_BYTES;
// El peso selecciona solo la vía de recepción. PDF >40 MiB: R2 universal,
// incluso si es A4 o A3. Sin circuito universal, no se envía ni se cobra.
const R2_UNIVERSAL_ENSAYO=location.pathname==='/prueba-v2/carga-inteligente'&&
 window.parent!==window&&new URLSearchParams(location.search).get('universal')==='1';

const MAX_LOTE_TUS_BYTES=60*1024*1024;
const tamanoPdfMiB=f=>(f.size/(1024*1024)).toFixed(1).replace('.',',')+' MiB';
const WHATSAPP_CONSULTAS_SABER='5493513110130';
function enlaceConsultaArchivoGrande(e){
 const nombre=String(e.name||'documento.pdf').slice(0,120);
 const file=e.archivoOriginal;
 const tamano=file instanceof File?tamanoPdfMiB(file):'tamaño por confirmar';
 const mensaje='Hola, Librería Saber. Necesito imprimir el archivo «'+nombre+
  '» ('+tamano+'). El cotizador indica que supera el límite de carga automática. '+
  '¿Puedo enviarlo por WhatsApp como documento o compartir un enlace privado? '+
  'Entiendo que esta consulta no genera un pedido ni autoriza un pago.';
 return 'https://wa.me/'+WHATSAPP_CONSULTAS_SABER+'?text='+encodeURIComponent(mensaje);
}
let leyendo=false;
let version=0;
let catalogo={a4:[],a3:[]};
let productosFoto=[];
let variantesCorte=[];
let productosGrafica=[];
let abierto=-1;
let ultimoPresupuesto=null;
function alertasRecepcionPDF(){
 const alertas=new Map();
 if((location.pathname!=='/prueba-v2/carga-inteligente'&&!(typeof UNIVERSAL_COMPRADOR_LIVE!=='undefined'&&UNIVERSAL_COMPRADOR_LIVE))||window.parent===window)return alertas;
 let acumulado=0;
 for(const e of entries){
  const file=e.archivoOriginal;
  if(!(file instanceof File))continue;
  const transporte=decidirTransportePDF(file.size);
  if(transporte.ruta==='r2'){
   if((typeof R2_UNIVERSAL_ENSAYO!=='undefined'&&R2_UNIVERSAL_ENSAYO)||(typeof UNIVERSAL_COMPRADOR_LIVE!=='undefined'&&UNIVERSAL_COMPRADOR_LIVE))continue;
   alertas.set(e,'El PDF «'+file.name+'» pesa '+tamanoPdfMiB(file)+
    '. El envío universal de PDF grandes está temporalmente deshabilitado. '+
    'El presupuesto mantiene su tipo y precio; consultanos antes de enviar o pagar.');
   continue;
  }
  if(transporte.ruta==='supera_cupo'){
   alertas.set(e,'El PDF «'+file.name+'» supera los 200 MiB admitidos en esta versión. '+
    'Consultanos cómo enviarlo; no se genera pedido ni pago automático.');
   continue;
  }
  if(file.size<5||file.name.length>120||!/\.pdf$/i.test(file.name)){
   alertas.set(e,'El archivo «'+file.name+'» no se admite: debe ser un PDF válido, con nombre de hasta 120 caracteres.');
   continue;
  }
  acumulado+=file.size;
  if(acumulado>MAX_LOTE_TUS_BYTES)
   alertas.set(e,'El PDF «'+file.name+'» lleva el pedido a '+(acumulado/(1024*1024)).toFixed(1).replace('.',',')+
    ' MiB; el máximo combinado es 60 MiB. Quitalo o dividí el pedido.');
 }
 return alertas;
}
const pesos=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
function informarPrecioPrivado(estado,total=null,motivo=''){
 if(window.parent===window)return;
 const bloqueoRecepcion=[...alertasRecepcionPDF().values()][0]||'';
 const sendable=estado==='listo'&&ultimoPresupuesto?.estado==='PRELIMINAR'&&!bloqueoRecepcion;
 window.parent.postMessage({type:'SABER_SMART_PRICE_STATE',estado,
  total:Number.isSafeInteger(total)&&total>0?total:null,
  promocion:estado==='listo'&&ultimoPresupuesto?.promocion?.aplicada===true?
   {titulo:ultimoPresupuesto.promocion.titulo,descuento:ultimoPresupuesto.promocion.descuento,
    totalAnterior:ultimoPresupuesto.promocion.totalAnterior}:null,
  sendable,blockReason:bloqueoRecepcion||(estado==='error'?String(motivo||'No se pudo verificar el precio.').slice(0,220):null)},location.origin);
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
 // Algunos PDF exportados desde escáner/Word agregan bordes (ej. 21,75 × 30,43).
 // Proponer A4 si ambas dimensiones están a <= 1 cm, pero nunca confundir A3/A0.
 if(paginas.every(p=>coincide(p,21,29.7,1)))return 'a4';
 if(paginas.every(p=>coincide(p,29.7,42,0.35)))return 'a3';
 return null;
}
const formatoOriginal=paginas=>{
 const v=paginas.map(p=>{const a=Math.min(p.anchoCm,p.altoCm),b=Math.max(p.anchoCm,p.altoCm);
  return Math.abs(a-14.8)<0.2&&Math.abs(b-21)<0.2?'a5':
   Math.abs(a-21)<0.2&&Math.abs(b-29.7)<0.2?'a4':
   Math.abs(a-21.59)<=0.25&&Math.abs(b-35.56)<=0.25?'legal':
   Math.abs(a-29.7)<0.2&&Math.abs(b-42)<0.2?'a3':null});
 const exacto=v.every(x=>x===v[0])?v[0]:null;
 return exacto||(paginas.every(p=>Math.min(p.anchoCm,p.altoCm)<=21.1&&
  Math.max(p.anchoCm,p.altoCm)<=29.8)?'personalizado_a4':null);
};
const valor=(label,options,selected,change)=>{const l=texto('label',label+' '),sel=document.createElement('select');for(const [k,v] of options)sel.add(new Option(v,k));sel.value=selected;sel.onchange=()=>change(sel.value);l.append(sel);return l};
function paginasElegidas(e){try{return seleccionarPaginas(e.paginas,e.paginasSeleccionadas)}catch(_){return null}}
function cambio(){version++;render();cotizar()}
// Sólo impresiones documentales: dos decisiones visibles y las demás
// en un desplegable. Conserva el mismo "paginasPorHoja" del presupuesto,
// la verificación del servidor y la ficha de producción.
function selectorPaginasPorCara(e,indice){
 const n=e.paginasPorHoja??1;
 const fieldset=document.createElement('fieldset');
 fieldset.className='composicion-por-cara';
 const legend=texto('legend','Páginas por cara');fieldset.append(legend);
 const opciones=document.createElement('div');opciones.className='composicion-opciones';
 const radio=(value,label)=>{
  const wrapper=document.createElement('label');wrapper.className='composicion-opcion';
  const input=document.createElement('input');
  input.type='radio';input.name='paginas-por-cara-'+indice;input.value=String(value);
  input.checked=n===value;
  input.onchange=()=>{if(input.checked){e.paginasPorHoja=value;cambio()}};
  wrapper.append(input,texto('span',label));
  return wrapper;
 };
 opciones.append(radio(1,'1 página'),radio(2,'2 páginas'));
 fieldset.append(opciones);
 const avanzadas=document.createElement('details');
 avanzadas.className='composicion-avanzada';
 avanzadas.open=n===4||n===9;
 const summary=texto('summary',n===4||n===9
  ?n+' páginas por cara · Más opciones'
  :'Más opciones (4 o 9 páginas por cara)');
 avanzadas.append(summary);
 const extra=document.createElement('div');extra.className='composicion-opciones';
 extra.append(radio(4,'4 páginas'),radio(9,'9 páginas'));
 avanzadas.append(extra);fieldset.append(avanzadas);
 return fieldset;
}
// Mostrar SIEMPRE la decisión más frecuente junto al archivo, incluso
// cuando el panel «Más opciones» está cerrado. Nada para ploteos/otros.
function mostrarSelectorRapido(card,e,indice){
 if(e.servicio!=='auto'||!e.paginas)return;
 const paginas=paginasElegidas(e);
 if(!paginas)return;
 const destino=clasificarDestino(paginas,e.seleccion);
 // Mientras el cliente contesta «¿Cómo querés imprimirlo?»,
 // todavía no hay destino confirmado. No ocultar entonces la opción 1/2.
 // Solo se anticipa en originales que caben en A3; si exceden A3,
 // esperar la elección y excluir ploteos y trabajos especiales.
 const enA3=paginas.every(p=>
  Number.isFinite(p.anchoCm)&&Number.isFinite(p.altoCm)&&
  Math.min(p.anchoCm,p.altoCm)<=29.9&&
  Math.max(p.anchoCm,p.altoCm)<=42.2);
 const esDocumento=destino.confirmado?destino.destino==='documentos':
  e.seleccion==='sin-confirmar'&&enA3;
 if(!esDocumento)return;
 const field=selectorPaginasPorCara(e,indice);
 field.classList.add('composicion-visible');
 card.append(field);
}
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
// La categoría es sólo presentación: no reordena `entries` ni los índices del
// manifiesto, ni modifica la clasificación página a página o los importes.
function grupoVisible(e){
 if(e.error||!e.paginas)return {id:'pendientes',titulo:'Archivos por revisar'};
 let paginas=paginasElegidas(e);
 if(!paginas)return {id:'pendientes',titulo:'Archivos por revisar'};
 const especiales={stickers:'Stickers',fotos:'Fotografías',corte:'Ploteos de corte',grafica:'Gráfica comercial'};
 if(especiales[e.servicio])return {id:e.servicio,titulo:especiales[e.servicio]};
 const d=clasificarDestino(paginas,e.seleccion);
 if(!d.confirmado)return {id:'pendientes',titulo:'Archivos por revisar'};
 if(d.destino==='documentos'){
  const formato=d.tamanoFinal==='original'?formatoOriginal(paginas):d.tamanoFinal;
  if(formato==='personalizado_a4')return {id:'personalizado_a4',titulo:'Tamaño original menor que A4 · tarifa A4'};
  if(formato==='a5')return {id:'a5',titulo:'Documentos A5 (tarifa A4)'};
  if(formato==='a4')return {id:'a4',titulo:'Documentos A4'};
  if(formato==='legal')return {id:'legal',titulo:'Documentos Legal originales (obra 70 g · tarifa A4)'};
  if(formato==='a3')return {id:'a3',titulo:'Documentos A3'};
  return {id:'pendientes',titulo:'Archivos por revisar'};
 }
 if(paginas.some(p=>!['cad','poster'].includes(p.modo)))
  return {id:'pendientes',titulo:'Archivos por revisar'};
 const cad=paginas.some(p=>p.modo==='cad'),poster=paginas.some(p=>p.modo==='poster');
 if(cad&&poster)return {id:'mixtos',titulo:'Planos CAD y póster'};
 if(poster)return {id:'poster',titulo:'Póster / pleno'};
 return {id:'cad',titulo:'Planos CAD'};
}
function accionComun(titulo,opciones,aplicar,seleccion=''){
 const label=texto('label',titulo);
 const select=document.createElement('select');
 select.setAttribute('aria-label',titulo);
 select.add(new Option('Elegir…',''));
 for(const [valor,nombre] of opciones)select.add(new Option(nombre,valor));
 select.value=seleccion;
 select.onchange=()=>{if(select.value)aplicar(select.value)};
 label.append(select);return label;
}
function aplicarConfiguracionComunAlDocumento(e){
 if(modoLote!=='comun'||!e?.paginas||e.error||e.servicio!=='auto')return;
 const paginas=paginasElegidas(e);if(!paginas)return;
 const destino=clasificarDestino(paginas,e.seleccion);
 if(!destino.confirmado||destino.destino!=='documentos')return;
 for(const [campo,valor] of Object.entries(configuracionComun)){
  if(campo==='modo'){e.modo=valor;e.materialColor=''}
  else if(campo==='caras')e.caras=valor;
  else if(campo==='copias')e.copias=valor;
  else if(campo==='paginasPorHoja')e.paginasPorHoja=valor;
  else if(campo==='anillado'){
   const g=/^grupo:([1-5])$/.exec(valor);
   e.anillado=g?'grupo':valor;e.grupoAnillado=g?g[1]:'';
  }
 }
}
function renderConfiguracionGlobal(){
 const holder=$('configComunGlobal');if(!holder)return;
 holder.replaceChildren();holder.hidden=modoLote!=='comun';
 if(modoLote!=='comun')return;
 const indices=entries.map((e,i)=>({e,i})).filter(({e})=>e.paginas&&!e.error&&
  e.servicio==='auto'&&clasificarDestino(paginasElegidas(e)||e.paginas,e.seleccion).destino==='documentos').map(({i})=>i);
 if(!indices.length){holder.append(texto('p','Cargá al menos un PDF documental para definir las opciones compartidas.'));return}
 const barra=controlesComunes({id:'a4',indices},true);
 if(barra){barra.querySelector('strong').textContent='Configuración compartida · '+indices.length+' documentos';holder.append(barra)}
 holder.append(texto('small','Estas opciones se aplican a todos los documentos compatibles. Las fichas inferiores muestran solo el resumen y las decisiones de tamaño necesarias; podés personalizar un PDF como excepción.'));
}
function controlesComunes(grupo,global=false){
 const tipos=['personalizado_a4','a5','a4','a3'].includes(grupo.id),ploteo=['cad','poster','mixtos'].includes(grupo.id);
 if((grupo.indices.length<2&&!global)||(!tipos&&!ploteo))return null;
 const barra=document.createElement('div');barra.className='opciones-comunes';
 barra.append(texto('strong','Opciones para estos '+grupo.indices.length+' archivos'));
 const aplicar=(campo,valor)=>{
  if(global)configuracionComun[campo]=valor;
  for(const i of grupo.indices){
   const e=entries[i];
   if(campo==='modo'){e.modo=valor;e.materialColor=''}
   else if(campo==='caras')e.caras=valor;
   else if(campo==='anillado'){
    const id=/^grupo:([1-5])$/.exec(valor);
    e.anillado=id?'grupo':valor;
    e.grupoAnillado=id?id[1]:'';
   }
   else if(campo==='papelPoster')e.papelPoster=valor;
   else if(campo==='copias')e.copias=valor;
   else if(campo==='paginasPorHoja')e.paginasPorHoja=valor;
  }
  cambio();
 };
 const lCopias=texto('label','Copias para todos');
 const copias=document.createElement('input');copias.type='number';copias.min='1';copias.max='500';copias.step='1';
 copias.placeholder='1 a 500';copias.setAttribute('aria-label','Aplicar copias a todo el grupo');
 if(global&&Number.isSafeInteger(configuracionComun.copias))copias.value=String(configuracionComun.copias);
 copias.onchange=()=>{
  const v=Number(copias.value);
  if(!Number.isSafeInteger(v)||v<1||v>500){copias.setCustomValidity('Elegí de 1 a 500 copias');copias.reportValidity();return}
  aplicar('copias',v);
 };
 lCopias.append(copias);barra.append(lCopias);
 if(tipos){
  barra.append(accionComun('Impresión para todos',[['bn','Blanco y negro'],['color','Color']],v=>aplicar('modo',v),global?(configuracionComun.modo||''):''));
  barra.append(accionComun('Caras para todos',[['simple','Simple faz'],['double','Doble faz']],v=>aplicar('caras',v),global?(configuracionComun.caras||''):''));
  barra.append(accionComun('Páginas por cara para todos',[['1','1 página'],['2','2 páginas'],['4','4 páginas'],['9','9 páginas']],v=>aplicar('paginasPorHoja',Number(v)),global?String(configuracionComun.paginasPorHoja||''):''));
  barra.append(accionComun('Anillado para todos',[['ninguno','Sin anillado'],['individual','Individual por archivo'],...Array.from({length:5},(_,i)=>['grupo:'+(i+1),'Juntos · Grupo '+(i+1)])],v=>aplicar('anillado',v),global?(configuracionComun.anillado||''):''));
 }
 if(['cad','poster','mixtos'].includes(grupo.id))
  barra.append(accionComun('Papel para ploteos',[['obra80','Obra 80 g'],['recubierto','Recubierto 130 g']],v=>aplicar('papelPoster',v)));
 return barra;
}
let anilladosAbierto=false;
function renderAnilladosConjuntos(){
 const host=$('anilladosConjuntos');if(!host)return;
 host.replaceChildren();
 const docs=entries.map((e,i)=>({e,i,categoria:grupoVisible(e)}))
  .filter(x=>!x.e.error&&x.e.paginas&&x.e.servicio==='auto'&&
   ['personalizado_a4','a5','a4','a3'].includes(x.categoria.id));
 host.hidden=docs.length<2;
 if(docs.length<2)return;
 const panel=document.createElement('details');panel.className='anillado-conjunto';
 panel.open=anilladosAbierto||docs.some(x=>x.e.anillado==='grupo');
 panel.addEventListener('toggle',()=>{anilladosAbierto=panel.open});
 panel.append(texto('summary','¿Querés anillar varios PDF juntos? · Orden y grupos'));
 panel.append(texto('p','Elegí qué archivos van juntos y su orden. Podés combinar B/N, color y caras diferentes, siempre que los PDF del grupo tengan el mismo tamaño de papel y cantidad de copias.'));
 const todos=document.createElement('button');todos.type='button';
 todos.className='editar';todos.textContent='Anillar todos juntos';
 const compatibles=docs.every(x=>x.categoria.id===docs[0].categoria.id&&
  x.e.seleccion===docs[0].e.seleccion&&x.e.copias===docs[0].e.copias);
 todos.disabled=leyendo||!compatibles;
 todos.title=compatibles?'Unir todos los documentos en el grupo 1':'Igualá tamaño y copias, o creá grupos diferentes.';
 todos.onclick=()=>{
  if(leyendo||!compatibles)return;
  for(const {e} of docs){e.anillado='grupo';e.grupoAnillado='1'}
  anilladosAbierto=true;cambio();
 };
 panel.append(todos);
 const lista=document.createElement('div');lista.className='anillado-filas';
 for(let pos=0;pos<docs.length;pos++){
  const {e,i}=docs[pos],fila=document.createElement('div');fila.className='anillado-fila';
  const l=texto('label',String(pos+1).padStart(2,'0')+'. '+e.name);
  const s=document.createElement('select');s.setAttribute('aria-label','Anillado de '+e.name);
  for(const [v,n] of [['ninguno','Sin anillado'],['individual','Individual'],
   ...Array.from({length:5},(_,j)=>['grupo:'+(j+1),'Junto · Grupo '+(j+1)])])
   s.add(new Option(n,v));
  s.value=e.anillado==='grupo'?'grupo:'+e.grupoAnillado:e.anillado;
  s.onchange=()=>{
   const g=/^grupo:([1-5])$/.exec(s.value);
   e.anillado=g?'grupo':s.value;e.grupoAnillado=g?g[1]:'';
   anilladosAbierto=true;cambio();
  };
  l.append(s);
  const acciones=document.createElement('div');acciones.className='anillado-orden';
  for(const [nombre,dir] of [['Subir',-1],['Bajar',1]]){
   const b=document.createElement('button');b.type='button';b.className='editar';
   b.textContent=nombre;b.setAttribute('aria-label',nombre+' '+e.name);
   b.disabled=leyendo||pos+dir<0||pos+dir>=docs.length;
   b.onclick=()=>{
    if(leyendo||!docs[pos+dir])return;
    const destino=docs[pos+dir].i,[trabajo]=entries.splice(i,1);
    entries.splice(destino,0,trabajo);abierto=-1;anilladosAbierto=true;cambio();
   };
   acciones.append(b);
  }
  fila.append(l,acciones);lista.append(fila);
 }
 panel.append(lista);
 const grupos=new Map();
 for(const {e} of docs)if(e.anillado==='grupo'){
  const id=String(e.grupoAnillado),miembros=grupos.get(id)||[];
  miembros.push(e);grupos.set(id,miembros);
 }
 for(const [id,miembros] of grupos){
  const ok=miembros.length>=2&&miembros.every(e=>
   grupoVisible(e).id===grupoVisible(miembros[0]).id&&
   e.seleccion===miembros[0].seleccion&&e.copias===miembros[0].copias);
  const aviso=texto('p',ok
   ?'Grupo '+id+': '+miembros.length+' PDF en este orden · '+miembros[0].copias+' anillado(s); precio confirmado por servidor.'
   :'Grupo '+id+': elegí al menos dos PDF del mismo tamaño y cantidad de copias.');
  if(!ok)aviso.className='advertencia';
  panel.append(aviso);
 }
 host.append(panel);
}

function render(){
 renderConfiguracionGlobal();
 renderAnilladosConjuntos();
 const advertenciasRecepcion=alertasRecepcionPDF();
 const lista=$('lista');lista.replaceChildren();
 const grupos=new Map();
 entries.forEach((e,i)=>{
  const cat=grupoVisible(e);
  if(!grupos.has(cat.id))grupos.set(cat.id,{...cat,indices:[]});
  grupos.get(cat.id).indices.push(i);
 });
 const orden=['pendientes','personalizado_a4','a5','a4','a3','cad','poster','mixtos','stickers','fotos','corte','grafica'];
 for(const grupo of [...grupos.values()].sort((a,b)=>orden.indexOf(a.id)-orden.indexOf(b.id))){
  const bloque=document.createElement('section');bloque.className='grupo-pedido';
  const titulo=texto('h3',grupo.titulo+' · '+grupo.indices.length+' archivo(s)');
  titulo.className='titulo-grupo';bloque.append(titulo);
  // En modo individual cada PDF se configura desde su propia ficha.
 // En modo común el único panel compartido está sobre la carga.
 // No añadir una segunda barra de edición: las opciones viven en cada ficha.
  for(const i of grupo.indices){
  const e=entries[i];
  const card=texto('section','');card.className='archivo';
  const advertenciaRecepcion=advertenciasRecepcion.get(e);
  if(advertenciaRecepcion)card.classList.add('archivo-no-admitido');
  const fila=document.createElement('div');fila.className='fila';
  const principal=document.createElement('div');principal.className='fila-principal';
  const nombre=texto('strong',(i+1)+'. '+e.name);nombre.className='nombre';
  principal.append(nombre);
  const resumen=document.createElement('div');resumen.className='resumen-archivo';
  if(e.seleccion==='original'&&e.paginas&&formatoOriginal(paginasElegidas(e)||e.paginas)==='personalizado_a4'){
   principal.append(texto('small','Tamaño original personalizado · tarifa A4'));
  }
  if(e.seleccion==='original'&&e.paginas&&formatoOriginal(paginasElegidas(e)||e.paginas)==='a5'){
   const note=texto('small','A5 original · tarifa de impresión A4');principal.append(note);
  }
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
  principal.append(resumen);
  if(advertenciaRecepcion){
   const aviso=texto('p','PDF NO ADMITIDO · '+advertenciaRecepcion);
   aviso.className='advertencia-recepcion';
   aviso.setAttribute('role','alert');
   principal.append(aviso);
   if(e.archivoOriginal instanceof File&&
      (e.archivoOriginal.size>MAX_PDF_TUS_BYTES||
       advertenciaRecepcion.includes('máximo combinado'))){
    const contacto=document.createElement('a');
    contacto.className='consulta-archivo-grande';
    contacto.href=enlaceConsultaArchivoGrande(e);
    contacto.target='_blank';
    contacto.rel='noopener noreferrer';
    contacto.textContent='Consultar envío especial por WhatsApp';
    principal.append(contacto);
    const aclaracion=texto('small',
     'Se abre una consulta; el PDF no se adjunta automáticamente. '+
     'No se registra pedido ni se habilita cobro hasta confirmar su recepción.');
    aclaracion.className='nota-consulta-grande';
    principal.append(aclaracion);
   }
  }
  if(e.paginas&&e.servicio==='auto'){
   const elegidas=paginasElegidas(e)||e.paginas;
   const destino=clasificarDestino(elegidas,e.seleccion);
   if(destino.confirmado&&destino.destino==='ploteo'){
    const cad=elegidas.filter(p=>p.modo==='cad').length;
    const poster=elegidas.filter(p=>p.modo==='poster').length;
    const tipo=cad===elegidas.length?'CAD · Plano técnico':
     poster===elegidas.length?'PÓSTER / PLENO':
     cad+poster===elegidas.length?'MIXTO · CAD y PÓSTER':'Tipo pendiente de análisis';
    const marca=texto('strong','TIPO DE PLOTEO: '+tipo);
    marca.className='clasificacion-ploteo-visible';
    principal.append(marca);
    const medidas=elegidas.map(p=>Number(p.anchoCm).toLocaleString('es-AR',{maximumFractionDigits:2})+
     ' × '+Number(p.altoCm).toLocaleString('es-AR',{maximumFractionDigits:2})+' cm');
    const unicas=[...new Set(medidas)];
    const medidaVisible=texto('p','MEDIDA DETECTADA: '+(unicas.length===1
     ?unicas[0]:(elegidas.length<=8
      ?elegidas.map((p,j)=>'Pág. '+p.numero+': '+medidas[j]).join(' · ')
      :unicas.join(' / '))));
    medidaVisible.className='medida-ploteo-visible';
    principal.append(medidaVisible);
    const eleccion=opcionesTipoPloteo(elegidas,e.seleccion);
    if(eleccion.mostrar){
     const bloque=document.createElement('div');
     bloque.className='eleccion-plotter';
     bloque.setAttribute('role','group');
     bloque.setAttribute('aria-label','Tipo de ploteo para '+e.name);
     const aclaracion=texto('strong','TAMAÑO MAYOR A A3 · CORRESPONDE A PLOTTER');
     bloque.append(aclaracion);
     bloque.append(texto('p','Medidas originales: '+unicas.join(' / ')+
      '. Se presupuestará al tamaño real, sin reducir el plano.'));
     const clasificacionConfirmada=e.clasificacionAutomatica===true&&
      elegidas.every(p=>['cad','poster'].includes(p.modo));
     if(clasificacionConfirmada){
      const clase=eleccion.variasClases?'MIXTO CAD Y PLENO':
       eleccion.tipo==='cad'?'CAD · Plano técnico':'PLENO · Póster';
      bloque.append(texto('p','Clasificación automática: '+clase+
       '. El precio se calcula para el tipo detectado.'));
      if(e.metodoClasificacion==='MOSAICO_RASTER_LOCAL')
       bloque.append(texto('small','El PDF contiene una plancha de imágenes rasterizadas. '+
        'El análisis local es preliminar; se revisará el original antes de imprimir.'));
      const revisar=document.createElement('a');
      revisar.className='consulta-clasificacion-ploteo';
      const consulta='Hola, Librería Saber. Quiero que revisen la clasificación del PDF «'+
       e.name+'» ('+unicas.join(' / ')+'). El sistema detectó '+clase+
       '. Considero que podría ser otro tipo de ploteo. Solicito revisión antes de pagar.';
      revisar.href='https://wa.me/'+WHATSAPP_CONSULTAS_SABER+'?text='+encodeURIComponent(consulta);
      revisar.target='_blank';revisar.rel='noopener noreferrer';
      revisar.textContent='¿No coincide? Solicitar revisión';
      bloque.append(revisar);
     }else{
      bloque.append(texto('p','No pudimos identificar automáticamente si este PDF es CAD o Pleno. Solicitá revisión para presupuestarlo.'));
      const consultaManual=document.createElement('a');
      consultaManual.className='consulta-clasificacion-ploteo';
      consultaManual.href='https://wa.me/'+WHATSAPP_CONSULTAS_SABER+'?text='+
       encodeURIComponent('Hola, Librería Saber. Necesito revisar la clasificación del PDF «'+e.name+'» para cotizar un ploteo.');
      consultaManual.target='_blank';consultaManual.rel='noopener noreferrer';
      consultaManual.textContent='Solicitar revisión del PDF';
      bloque.append(consultaManual);
     }
     if(clasificacionConfirmada){
      const papel=valor('Papel para ploteo',[
       ['obra80','Obra 80 g'],['recubierto','Recubierto 130 g']
      ],e.papelPoster,v=>{e.papelPoster=v;cambio()});
      papel.className='eleccion-plotter-papel';
      bloque.append(papel);
     }
     principal.append(bloque);
    }
   }
  }
  if(e.paginas&&e.servicio==='auto'){
   const paginasFinal=paginasElegidas(e)||e.paginas;
   const regla=decidirTamanoCliente(paginasFinal);
   const recomendada=tamañoEstandar(paginasFinal);
   const pregunta=regla.requierePregunta&&e.seleccion==='sin-confirmar';
   const filaTam=document.createElement('div');filaTam.className='tamano-rapido';
   if(pregunta){
    filaTam.classList.add('pregunta-tamano');
    filaTam.setAttribute('role','group');
    filaTam.setAttribute('aria-label','Confirmar tamaño de impresión de '+e.name);
    filaTam.append(texto('strong','El PDF no es A4. ¿Cómo querés imprimirlo?'));
    filaTam.append(texto('p','Medida detectada: '+[...new Set(regla.medidas)].join(' / ')+'.'));
    if(regla.variosTamanos)
     filaTam.append(texto('p','Este PDF contiene páginas de diferentes tamaños. Elegí el destino de impresión.'));
   }else if(regla.forzarA4){
    filaTam.append(texto('small','PDF de 20 × 20 cm: se imprime en hoja A4 sin recortar.'));
   }else filaTam.append(texto('span','Imprimir en: '));
   for(const [tam,label] of [['a4',pregunta?'Ajustar a A4':'A4'],
     ['a3',pregunta?'Imprimir en A3':'A3'],
     ['original',pregunta?'Mantener tamaño real':'Tamaño original']]){
    if(regla.forzarA4&&tam!=='a4')continue;
    const btn=texto('button',label);btn.type='button';
    btn.className='tamano-opcion'+(e.seleccion===tam?' seleccionada':'');
    btn.setAttribute('aria-pressed',String(e.seleccion===tam));
    btn.onclick=()=>{e.seleccion=tam;aplicarConfiguracionComunAlDocumento(e);cambio()};
    filaTam.append(btn);
   }
   if(pregunta){
    filaTam.append(texto('small','Al ajustar a A4 o A3 se conserva la proporción, sin recortar. El tamaño real puede requerir ploteo.'));
    }else if(e.seleccion==='original'&&formatoOriginal(paginasFinal)==='personalizado_a4'){
    filaTam.append(texto('small','Tamaño original: '+[...new Set(regla.medidas)].join(' / ')+'. Se calcula con la tarifa A4 vigente, sin agrandar ni recortar.'));
   }else if(e.seleccion==='original'&&formatoOriginal(paginasFinal)==='a5'){
    filaTam.append(texto('small','A5 real (14,8 × 21 cm), sin ampliar. Se aplica la tarifa A4 vigente; no incluye corte ni terminaciones especiales.'));
   }else if(e.seleccion==='original'&&regla.superaA3){
    filaTam.append(texto('small','Ploteo a tamaño real seleccionado automáticamente. El sistema elige rollo y CAD/Póster según el PDF. Para reducirlo, podés elegir A4 o A3.'));
   }else if(e.seleccion==='original'&&!regla.a3Exacto&&!regla.a4Exacto){
    filaTam.append(texto('small','El tamaño real puede no tener una tarifa disponible. En ese caso elegí A4 o A3.'));
   }else if(recomendada==='a4'&&e.seleccion==='a4'&&!regla.a4Exacto&&!regla.forzarA4){
    filaTam.append(texto('small','A4 seleccionado: se ajusta proporcionalmente, sin recortar.'));
   }
   if(modoLote!=='comun'||pregunta)principal.append(filaTam);
  }
  fila.append(principal);
  const importe=texto('span',advertenciaRecepcion?'No admitido':(importeArchivo(i)||(e.error?'Revisar':(e.seleccion==='sin-confirmar'&&!['fotos','corte','grafica'].includes(e.servicio))?'Pendiente':'Por calcular')));
  importe.className='precio-archivo';fila.append(importe);
  const boton=texto('button',abierto===i?'Cerrar detalles':modoLote==='comun'?'Personalizar este PDF':'Más opciones');
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
  // En modo común no repetir 1/2 páginas por cara en cada ficha.
  if(modoLote!=='comun'||abierto===i)mostrarSelectorRapido(card,e,i);
  // La decisión de 1/2 páginas ya está fuera del panel: se ve sin hacer clic.
  if(abierto!==i){bloque.append(card);continue}
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
    if(!/\.pdf$/i.test(file.name)||file.size<5||file.size>250*1024*1024){
     $('estado').textContent='Elegí un PDF válido, de hasta 250 MB.';return;
    }
    leyendo=true;version++;ultimoPresupuesto=null;
    e.name=file.name;e.archivoOriginal=file;e.error=null;e.paginas=null;e.tipoPloteoElegidoPorCliente=false;e.clasificacionAutomatica=false;
    e.seleccion='sin-confirmar';e.paginasSeleccionadas='';
    render();
    try{await analizarArchivoPDF(e,file);aplicarConfiguracionComunAlDocumento(e)}
    finally{leyendo=false;render();cotizar()}
   };
   reemplazar.append(input);panel.append(reemplazar);
   card.append(panel);bloque.append(card);continue;
  }
  if(!e.paginas){panel.append(texto('p','Analizando medidas…'));card.append(panel);bloque.append(card);continue}
  const multiples=e.paginas.length>1;
  const medidas=e.paginas.map(p=>p.anchoCm.toFixed(2)+' × '+p.altoCm.toFixed(2)+' cm');
  const origin=texto('p','Tamaño original: '+(new Set(medidas).size===1?medidas[0]:(multiples?'Varios tamaños · '+[...new Set(medidas)].join(' / '):medidas[0]))+' · '+e.paginas.length+' página(s)');origin.className='origen';panel.append(origin);
  const paginas=paginasElegidas(e);
  const paginasLabel=texto('label','Páginas a imprimir (vacío = todas)');
  const paginasInput=document.createElement('input');paginasInput.type='text';paginasInput.placeholder='Ej.: 1-3,5';paginasInput.value=e.paginasSeleccionadas;
  paginasInput.setAttribute('aria-label','Páginas a imprimir de '+e.name);
  paginasInput.onchange=()=>{e.paginasSeleccionadas=paginasInput.value.trim();cambio()};
  paginasLabel.append(paginasInput);panel.append(paginasLabel);
  if(!paginas){const err=texto('p','Selección inválida. Usá 1-3,5 y números que existan en el PDF.');err.className='advertencia';panel.append(err);card.append(panel);bloque.append(card);continue}
  const aviso=clasificarDestino(paginas);
  if(aviso.requiereConfirmacion){const n=texto('p','Confirmá el tamaño de impresión: el PDF puede tener medidas distintas a las que querés.');n.className='advertencia';panel.append(n)}
  const controles=document.createElement('div');controles.className='controles';
  controles.append(valor('Servicio', [['auto','Impresiones / ploteos'],['stickers','Stickers con precorte A4/A3'],['fotos','Fotografías y carnet'],['corte','Ploteo de corte'],['grafica','Gráfica comercial']],e.servicio||'auto',v=>{e.servicio=v;if(v==='fotos'){e.seleccion='a4';e.modo='color';e.productoFoto=productosFoto[0]?.id||'';}if(v==='grafica'){e.productoGrafica=productosGrafica[0]?.id||'';}if(v==='stickers'||v==='fotos'||v==='corte'||v==='grafica'){e.anillado='ninguno';e.grupoAnillado=''}cambio()}));
  const label=texto('label','Tamaño de impresión');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Tamaño final de '+e.name);
  for(const [v,l] of [['sin-confirmar','Elegir tamaño final'],['original','Mantener tamaño original'],['a3','A3 (29,7 × 42 cm)'],['a4','A4 (21 × 29,7 cm)'],['a5','A5 (14,8 × 21 cm)']]){
   const o=new Option(l,v);sel.add(o);
  }
  sel.value=e.seleccion;sel.onchange=()=>{e.seleccion=decidirTamanoCliente(paginas).forzarA4?'a4':sel.value;aplicarConfiguracionComunAlDocumento(e);cambio()};label.append(sel);if(!['fotos','corte','grafica'].includes(e.servicio))controles.append(label);
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
    panel.append(texto('p','Elegí 1 o 2 páginas por cara directamente debajo del archivo. En doble faz, 2 páginas por cara permite hasta cuatro páginas del PDF por hoja física.'));
    const formato=decision.tamanoFinal==='original'?formatoOriginal(paginas):decision.tamanoFinal;
    if(e.modo==='color'&&['personalizado_a4','a5','a4','a3'].includes(formato)){
     const disponibles=catalogo[['a5','personalizado_a4'].includes(formato)?'a4':formato]||[];
     if(!disponibles.some(m=>m.id===e.materialColor))e.materialColor=disponibles[0]?.id||'';
     if(disponibles.length)controles.append(valor('Material',disponibles.map(m=>[m.id,m.name]),e.materialColor,v=>{e.materialColor=v;cambio()}));
     else panel.append(texto('p','Materiales no disponibles: no cotizar hasta recuperar el catálogo.'));
    }
    controles.append(valor('Anillado',[['ninguno','Sin anillado'],['individual','Cada archivo por separado'],['grupo','Varios archivos juntos']],e.anillado,v=>{e.anillado=v;if(v!=='grupo')e.grupoAnillado='';else e.grupoAnillado='1';cambio()}));
    if(e.anillado==='grupo')controles.append(valor('Grupo de anillado',[['1','Grupo 1'],['2','Grupo 2'],['3','Grupo 3'],['4','Grupo 4'],['5','Grupo 5']],e.grupoAnillado,v=>{e.grupoAnillado=v;cambio()}));
    if(e.anillado==='grupo')panel.append(texto('p','Los PDF del grupo deben tener igual tamaño final y cantidad de copias.'));
   }else{
    // CAD/pleno y el papel se eligen en la tarjeta visible, sin abrir detalles.
    // Las dimensiones físicas se detectan localmente incluso si el PDF supera 40 MiB.
    const tipo=opcionesTipoPloteo(paginas,e.seleccion);
    if(tipo.mostrar){
     panel.append(texto('p','El tamaño mayor a A3 corresponde a plotter. '+
      (e.clasificacionAutomatica?
       'El tipo CAD/PLENO se detectó automáticamente; si no coincide, solicitá revisión antes de pagar.':
       'Elegí CAD o PLENO en la ficha principal si la clasificación automática no estuvo disponible.')+
      ' La cotización preliminar se confirma al verificar el original.'));
     if(e.archivoOriginal?.size>MAX_PDF_TUS_BYTES)
      panel.append(texto('p','Este PDF se inspecciona localmente; no se envía a R2 hasta confirmar el pago.'));
    }else if(paginas.some(p=>!['cad','poster'].includes(p.modo)))
     panel.append(texto('p','Análisis CAD/Póster pendiente: requiere revisión, sin precio.'));
   }
  }else {const n=texto('p','Elegí el tamaño de impresión para continuar.');n.className='advertencia';panel.append(n)}
  panel.append(controles);
  card.append(panel);
  bloque.append(card);
  }
  lista.append(bloque);
 }
 const porConfirmar=entries.filter(x=>x.servicio==='auto'&&x.paginas&&x.seleccion==='sin-confirmar'&&
  decidirTamanoCliente(paginasElegidas(x)||x.paginas).requierePregunta).length;
 $('estado').classList.toggle('estado-recepcion-error',advertenciasRecepcion.size>0);
 $('estado').textContent=advertenciasRecepcion.size?advertenciasRecepcion.size+' PDF no admitido(s). Revisá la advertencia roja junto al archivo; los demás siguen cargados.':
  leyendo?'Analizando archivos…':
  porConfirmar?'ATENCIÓN: '+porConfirmar+' PDF con tamaño diferente de A4. Respondé la pregunta de tamaño antes de enviar.':
  entries.length?'Identificados '+entries.length+' PDF. Cotización orientativa, sin subir originales.':
  'Seleccioná tus PDF para comenzar.';
}
async function analizarArchivoPDF(e,file){
 try{
  const x=await leerMedidasPloteo(file,{maxPaginas:2000});
  e.paginas=x.paginas.map(p=>({...p,modo:'sin-clasificar'}));
  e.tipoPloteoElegidoPorCliente=false;
  e.clasificacionAutomatica=false;
  e.metodoClasificacion=null;
  // PDF >40 MiB: preferir clasificación estructural por rangos (<512 KiB).
  // Si no alcanza y el documento es pequeño en número de páginas y bytes,
  // permitir miniaturas visuales LOCALES. Nunca subir un original sin pago.
  if(file.size>MAX_PDF_TUS_BYTES&&requiereClasificacionVisualPloteo(e.paginas)){
   const hallazgo=await clasificarMosaicoRasterPDFGrande(file);
   if(hallazgo?.altaConfianza===true&&hallazgo.modo==='poster'&&
      e.paginas.length===1){
    e.paginas[0].modo='poster';
    e.clasificacionAutomatica=true;
    e.metodoClasificacion='MOSAICO_RASTER_LOCAL';
   }else{
    const visual=(await clasificarPloteoGrandeVisualLimitado(file,{paginas:e.paginas}))||
     (await clasificarPloteoGrandePorRangos(file,{paginas:e.paginas,
      onProgreso:({terminadas,total})=>{
       $('estado').textContent='Analizando visualmente el plano '+terminadas+' de '+total+
        ' páginas, sin subir el original…';
      }}));
    if(visual?.altaConfianza===true&&visual.paginas.length===e.paginas.length){
     for(const pagina of visual.paginas)e.paginas[pagina.numero-1].modo=pagina.modo;
     e.clasificacionAutomatica=e.paginas.every(p=>['cad','poster'].includes(p.modo));
     if(e.clasificacionAutomatica)e.metodoClasificacion=visual.metodo||'VISUAL_PDFJS_LIMITADO';
    }
   }
  }
  // Los PDF pequeños mantienen su clasificación visual completa.
  if(file.size<=MAX_PDF_TUS_BYTES&&requiereClasificacionVisualPloteo(e.paginas)){
   try{
    const clases=await clasificarPaginasPloteo(file);
    for(const item of clases){
     if(['cad','poster'].includes(item.modo)&&e.paginas[item.numero-1])
      e.paginas[item.numero-1].modo=item.modo;
    }
    // Solo el clasificador visual real puede habilitar un tipo automático:
    // ni el nombre del PDF ni una elección del comprador cuentan como detección.
    e.clasificacionAutomatica=clases.length===e.paginas.length&&
     e.paginas.every(p=>['cad','poster'].includes(p.modo));
    if(e.clasificacionAutomatica)e.metodoClasificacion='VISUAL_PDFJS';
   }catch(_){/* Sin clase confirmada, el ploteo no obtiene precio final. */}
  }
  const decision=decidirTamanoCliente(e.paginas);
  // A4/20x20 van a A4, tamaños mayores a A3 pasan a ploteo original
  // sin preguntas redundantes. A5, A3 y formatos intermedios aún preguntan.
  e.requiereConfirmacion=decision.requierePregunta;
  e.seleccion=decision.seleccionInicial;
  e.error=null;
 }catch(ex){e.error=String(ex.message||ex);e.paginas=null}
}
document.querySelectorAll('input[name="modoImpresionLote"]').forEach(input=>{
 input.addEventListener('change',()=>{
  if(!input.checked)return;
  modoLote=input.value;
  actualizarModoLote();
  // Al activar modo común sobre un lote existente, reutilizar las preferencias explícitas previas.
  if(modoLote==='comun')for(const e of entries)aplicarConfiguracionComunAlDocumento(e);
  cambio();
 });
});
actualizarModoLote();
$('archivos').addEventListener('change',async ev=>{
 if(!modoLote){$('estado').textContent='Elegí cómo querés configurar los archivos antes de subirlos.';return;}
 if(leyendo)return;
 const elegidos=[...(ev.target.files||[])];ev.target.value='';
 if(!elegidos.length)return;
 leyendo=true;
 let files,imagenes=0;
 try{
  $('estado').textContent='Preparando PDF e imágenes para impresión en este dispositivo…';
  const normalizados=await normalizarArchivosImpresion(elegidos);
  files=normalizados.files;imagenes=normalizados.images;
  if(entries.length+files.length>MAX_PDF_CARGA)
   throw Error('Máximo '+MAX_PDF_CARGA+' archivos imprimibles. Dividí el lote.');
 }catch(error){
  leyendo=false;
  $('estado').textContent=String(error.message||error);
  return;
 }
 if(imagenes)$('estado').textContent=imagenes+' imágenes convertidas localmente a PDF para cotizar. Podés elegir 1, 2, 4 o 9 páginas por cara.';

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
   aplicarConfiguracionComunAlDocumento(entries[start+i]);
   render();
  }
 }));
 leyendo=false;render();cotizar();
});
async function cotizar(){
 const n=++version,out=$('presupuesto');
 $('reintentarPresupuesto')?.remove();
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
 try{const respuesta=await solicitarCotizacionPrivada(archivos);if(n!==version)return;
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
 if(d.promocion?.aplicada===true)out.append(texto('p',
  'Promoción aplicada: '+d.promocion.titulo+' · Antes '+ars(d.promocion.totalAnterior)+
  ' · Ahorrás '+ars(d.promocion.descuento)+' · Total '+ars(d.total)));
 for(const p of d.pendientes){
  const warning=texto('p',p.nombre+': '+p.motivo+
   '. Tocá Editar o Quitá únicamente ese archivo; los demás mantienen su cálculo.');
  warning.className='advertencia';out.append(warning);
 }
 if(d.plan.length)out.append(texto('p',UNIVERSAL_COMPRADOR_LIVE?'Presupuesto orientativo. Librería Saber confirmará el importe antes de registrar la orden. Tus originales permanecerán en este dispositivo hasta acreditar el pago.':'Precio orientativo. Los archivos no se enviaron ni se autoriza el cobro.'));
 render();
 }catch(e){if(n===version){
   const razon=String(e.message||e).slice(0,220);
   informarPrecioPrivado('error',null,razon);
   out.textContent='Presupuesto pendiente: '+razon;
   render();
   // El iframe oculta el bloque de presupuesto: el motivo y la recuperación
   // deben mostrarse junto a los PDF, no al final de la página.
   $('estado').textContent='No pudimos calcular el presupuesto: '+razon+
    ' El PDF sigue cargado; no lo vuelvas a seleccionar.';
   const boton=texto('button','Reintentar presupuesto sin volver a subir');
   boton.id='reintentarPresupuesto';boton.type='button';
   boton.style.cssText='margin:8px 0 15px;padding:10px;border:1px solid #2878ad;border-radius:8px;background:#eef7ff;color:#174c72;font-weight:700;cursor:pointer';
   boton.onclick=()=>{boton.remove();cotizar()};
   $('estado').insertAdjacentElement('afterend',boton);
  }}
}
async function iniciar(){
 try{const r=await fetch(UNIVERSAL_COMPRADOR_LIVE?'/api/pedido/live/materiales':'/api/ensayo-materiales-rapido',{cache:'no-store'});const x=await r.json();if(!r.ok||!x.ok||!x.materials)throw Error('Catálogo inaccesible');catalogo=x.materials;productosFoto=x.photos||[];variantesCorte=x.cutVariants||[];productosGrafica=x.graphicProducts||[];}
 catch(_){catalogo={a4:[],a3:[]};productosFoto=[];variantesCorte=[];productosGrafica=[];$('estado').textContent='No se pudo cargar el catálogo comercial.';}
 render();if(entries.length)cotizar();
}
iniciar();


// El puente de recepción sólo existe dentro del portal privado autenticado.
// La clasificación local sirve para cotizar; el servidor verifica cada PDF
// nuevamente antes de generar una orden. Ningún ploteo se registra aquí.
if((location.pathname==='/prueba-v2/carga-inteligente'||UNIVERSAL_COMPRADOR_LIVE)&&window.parent!==window){
 const bridgeButton=document.createElement('button');
 bridgeButton.type='button';bridgeButton.id='enviar-cotizacion-inteligente';
 bridgeButton.textContent='Agregar PDF al envío privado';
 const info=document.createElement('p');
 info.className='pie';info.setAttribute('role','status');
 info.textContent='Elegí tus PDF, revisá las opciones y el precio de impresión. '+
  'Si algún archivo necesita recepción especial, te indicaremos cómo continuar antes de confirmar el pedido.';
 const resumen=$('resumenPedido');
 resumen?.parentNode?.insertBefore(bridgeButton,resumen);
 bridgeButton.insertAdjacentElement('afterend',info);
 const prepararEnvioPrivado=()=>{
  try{
   if(leyendo||!ultimoPresupuesto||ultimoPresupuesto.estado!=='PRELIMINAR'||
      !Number.isSafeInteger(ultimoPresupuesto.total)||ultimoPresupuesto.total<1||
      entries.length<1||entries.length>MAX_PDF_CARGA||
      ultimoPresupuesto.plan?.length!==entries.length)
    throw Error('Completá primero la cotización de todos los documentos.');
   if((typeof UNIVERSAL_COMPRADOR_LIVE!=='undefined'&&UNIVERSAL_COMPRADOR_LIVE)||((typeof R2_UNIVERSAL_ENSAYO!=='undefined'&&R2_UNIVERSAL_ENSAYO)&&entries.some(e=>
      e.servicio==='fotos'||(e.archivoOriginal instanceof File&&e.archivoOriginal.size>MAX_PDF_TUS_BYTES)))){
    const lote=prepararLoteParcial(entries);
    if(lote.archivos.length!==entries.length||
       ultimoPresupuesto.pendientes?.length||
       entries.length>10)
     throw Error('Completá la clasificación y el presupuesto de todos los PDF.');
    let tusTotal=0;
    for(let i=0;i<entries.length;i++){
     const e=entries[i],plan=ultimoPresupuesto.plan.find(p=>p.indice===i);
     const f=e.archivoOriginal,config=lote.archivos[i];
     if(!(f instanceof File)||!config||config.nombre!==f.name||
        !plan||!['documentos','ploteos','fotos'].includes(plan.destino)||
        !Number.isSafeInteger(f.size)||f.size<5||
        f.size>MAX_PDF_R2_PREPAGO_BYTES||
        f.name.length>120||!/\.pdf$/i.test(f.name)||
        !Array.isArray(e.paginas)||!e.paginas.length||
        e.paginas.length>2000||
        !['bn','color'].includes(e.modo)||
        (plan.destino==='ploteos'&&e.paginas.some(p=>!['cad','poster'].includes(p.modo))))
      throw Error('Revisá el archivo «'+e.name+'»: tamaño, tipo, páginas o presupuesto pendiente.');
     if(f.size<=MAX_PDF_TUS_BYTES)tusTotal+=f.size;
    }
    if(tusTotal>MAX_LOTE_TUS_BYTES)
     throw Error('Los archivos chicos superan los 60 MiB combinados para TUS.');
    // Un solo mensaje a la vista padre, sin originales al servidor.
    window.parent.postMessage({type:'SABER_SMART_UNIVERSAL_PDF',
     files:entries.map(e=>e.archivoOriginal),
     archivos:lote.archivos,totalOrientativo:ultimoPresupuesto.total
    },location.origin);
    info.classList?.remove?.('estado-recepcion-error');
    info.textContent=(typeof UNIVERSAL_COMPRADOR_LIVE!=='undefined'&&UNIVERSAL_COMPRADOR_LIVE)?'Archivos preparados. El precio se validará con el servidor y ningún PDF se enviará antes del pago acreditado.':'Pedido completo preparado. El servidor confirmará el precio; los PDF siguen en tu dispositivo hasta el pago de prueba.';
    window.parent.postMessage({type:'SABER_SMART_HANDOFF_READY',cantidad:entries.length},location.origin);
    return;
   }
   const files=[],options=[],ploteosPendientes=[];
   for(let i=0;i<entries.length;i++){
    const e=entries[i],plan=ultimoPresupuesto.plan.find(p=>p.indice===i);
    if(!plan)throw Error('No se encontró la clasificación de este trabajo.');
    if(plan.destino==='ploteos'){
     if(!e.archivoOriginal||e.archivoOriginal.size<5||
        e.archivoOriginal.size>MAX_PDF_TUS_BYTES||!/\.pdf$/i.test(e.name)||
        e.name.length>120||e.anillado!=='ninguno'||
        !Array.isArray(e.paginas)||e.paginas.length<1||
        plan.paginasElegidas.length!==e.paginas.length)
      throw Error('Revisá el PDF de ploteo «'+e.name+'»: requiere archivo completo de hasta 40 MiB, sin anillado.');
     const clasificacionCliente=e.paginas.map((p,j)=>({
      numero:j+1,anchoCm:p.anchoCm,altoCm:p.altoCm,modo:p.modo
     }));
     if(clasificacionCliente.some(p=>!['cad','poster'].includes(p.modo)))
      throw Error('Hay páginas de ploteo sin clasificación.');
     const precio=ultimoPresupuesto.detallePloteos?.find(x=>x.id===plan.id)?.subtotal;
     if(!Number.isSafeInteger(precio)||precio<1)
      throw Error('El ploteo no tiene subtotal verificable.');
     ploteosPendientes.push({type:'SABER_FASE1_PLOTEO_PRELIMINAR',
      file:e.archivoOriginal,nombre:e.name,modo:e.modo,
      copias:e.copias,papelPoster:e.papelPoster,
      clasificacionCliente,precioPreliminar:precio});
     continue;
    }
    if(plan.destino!=='documentos')
     throw Error('Este servicio queda fuera de la primera etapa.');
    if(!(e.archivoOriginal instanceof File))
     throw Error('El PDF «'+e.name+'» ya no está disponible en esta pestaña. Volvé a seleccionarlo en su ficha.');
    if(e.archivoOriginal.size>MAX_PDF_TUS_BYTES)
     throw Error('«'+e.name+'» pesa '+tamanoPdfMiB(e.archivoOriginal)+
      '. El límite de recepción es 40 MiB por PDF; los otros archivos siguen preparados.');
    if(!Number.isSafeInteger(e.archivoOriginal.size)||e.archivoOriginal.size<5||
       e.name.length>120||!/\.pdf$/i.test(e.name))
     throw Error('El PDF «'+e.name+'» tiene un formato o nombre no admitido.');
    if(!['ninguno','individual','grupo'].includes(e.anillado)||
       (e.anillado==='grupo'&&!/^[1-9][0-9]?$/.test(String(e.grupoAnillado||'')))||
       (e.anillado!=='grupo'&&e.grupoAnillado))
     throw Error('El grupo de anillado del PDF no es válido.');
    if(![1,2,4,9].includes(e.paginasPorHoja??1))
     throw Error('Composición por cara no admitida.');
    const elegidas=paginasElegidas(e);
    if(!Array.isArray(e.paginas)||e.paginas.length<1||e.paginas.length>2000||
       !elegidas||!Array.isArray(plan.paginasElegidas)||
       elegidas.length!==plan.paginasElegidas.length||
       elegidas.some((pagina,k)=>pagina.numero!==plan.paginasElegidas[k]))
     throw Error('La selección de páginas no coincide con el presupuesto.');
    if(!['personalizado_a4','a5','a4','legal','a3'].includes(plan.formatoFinal)||
       !['bn','color'].includes(e.modo)||!['simple','double'].includes(e.caras)||
       !Number.isSafeInteger(e.copias)||e.copias<1||e.copias>200)
     throw Error('Formato, copias o impresión no admitidos por la recepción privada.');
    files.push(e.archivoOriginal);
    options.push({formato:plan.formatoFinal,modo:e.modo,caras:e.caras,
     copias:e.copias,materialColor:e.materialColor,
     anillado:e.anillado,grupoAnillado:e.anillado==='grupo'?String(e.grupoAnillado):'',
     paginasSeleccionadas:e.paginasSeleccionadas||'',paginasPorHoja:e.paginasPorHoja??1,
     paginas:e.paginas.length,nombre:e.name});
   }
   const loteBytes=files.reduce((sum,f)=>sum+f.size,0)+
     ploteosPendientes.reduce((sum,p)=>sum+p.file.size,0);
    if(loteBytes>MAX_LOTE_TUS_BYTES)
     throw Error('Los PDF suman '+(loteBytes/(1024*1024)).toFixed(1).replace('.',',')+
      ' MiB. El pedido admite hasta 60 MiB totales; dividí la carga en dos pedidos.');
    if(files.length){
    const totalDocumentos=ploteosPendientes.length?
     ultimoPresupuesto.subtotalImpresiones:ultimoPresupuesto.total;
    if(!Number.isSafeInteger(totalDocumentos)||totalDocumentos<1)
     throw Error('Las impresiones no tienen subtotal de pedido válido.');
    window.parent.postMessage({type:'SABER_SMART_DOCUMENTS_TO_PRIVATE',
     files,options,total:totalDocumentos},location.origin);
   }
   for(const trabajo of ploteosPendientes)
    window.parent.postMessage(trabajo,location.origin);
   info.classList?.remove?.('estado-recepcion-error');
   info.textContent='Pedido preparado. Ahora se reciben y verifican los PDF.';
   window.parent.postMessage({type:'SABER_SMART_HANDOFF_READY',cantidad:entries.length},location.origin);
  }catch(error){info.textContent=String(error.message||error);info.classList?.add?.('estado-recepcion-error');
   window.parent.postMessage({type:'SABER_SMART_HANDOFF_ERROR',message:String(error.message||error)},location.origin);
  }
 };
 bridgeButton.hidden=true;
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent||
     event.data?.type!=='SABER_SMART_PREPARAR_ENVIO')return;
  prepararEnvioPrivado();
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
