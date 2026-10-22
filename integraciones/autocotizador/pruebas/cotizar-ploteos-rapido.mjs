/** Rollo estándar automático: el más angosto que admite todas las páginas, nunca recubiertos. */
export function rolloEstandarAutomatico(paginas,soportes){
 if(!Array.isArray(paginas)||!paginas.length)throw Error('Sin páginas para seleccionar rollo.');
 const estandar=soportes.filter(s=>/^rollo\d+$/.test(s.id))
  .sort((a,b)=>Number(a.widthCm)-Number(b.widthCm));
 const elegido=estandar.find(s=>paginas.every(p=>
  Number.isFinite(p.anchoCm)&&Number.isFinite(p.altoCm)&&p.anchoCm>0&&p.altoCm>0&&
  Math.min(p.anchoCm,p.altoCm)<=Number(s.widthCm)+0.03));
 if(!elegido)throw Error('Ningún rollo estándar admite las medidas del PDF.');
 return elegido;
}
/**
 * Cotización preliminar de ploteos: dimensiones detectadas localmente por página.
 * Tarifas existentes, sin carga de PDF ni autorización de compra.
 * Conserva el contrato anterior de una página como compatibilidad de pruebas.
 */
export function cotizarPloteosRapido({trabajos,precios}){
 const config=precios?.plotter;
 if(!config||!Array.isArray(config.supports))throw Error('Tarifas de ploteo no disponibles.');
 if(!Array.isArray(trabajos)||trabajos.length<1||trabajos.length>30)throw Error('Cantidad de ploteos inválida.');
 const detalles=[];let total=0;
 for(const [i,t] of trabajos.entries()){
  const keys=Object.keys(t||{}).sort().join(',');
  const anterior=keys==='altoCm,anchoCm,copias,id,material,modo,nombre';
  const nuevo=keys==='copias,id,material,modo,nombre,paginas';
  if(!t||(!anterior&&!nuevo)||t.id!=='pl'+(i+1)||
    typeof t.nombre!=='string'||!t.nombre.trim()||t.nombre.length>160||
    !['cad','poster'].includes(t.modo)||!Number.isSafeInteger(t.copias)||t.copias<1||t.copias>500)
   throw Error('Trabajo de ploteo inválido.');
  const paginas=anterior?[{numero:1,anchoCm:t.anchoCm,altoCm:t.altoCm}]:t.paginas;
  // En el flujo automático el rollo estándar no es una decisión del cliente.
  // El contrato histórico de pruebas manuales se conserva aislado.
  const seleccionado=nuevo?rolloEstandarAutomatico(paginas,config.supports):null;
  if(nuevo&&t.material!==seleccionado.id)throw Error('Rollo incompatible con selección automática.');
  const soporte=seleccionado||config.supports.find(p=>p.id===t.material);
  if(!soporte)throw Error('Material de ploteo no disponible.');
  if(!Array.isArray(paginas)||paginas.length<1||paginas.length>2000)
   throw Error('Número de páginas inválido.');
  let metros=0,subtotalBruto=0;const detailPages=[];
  const minimo=Number(config.minMeters||0),redondeo=Number(config.roundTo||1);
  if(!Number.isFinite(minimo)||minimo<0||!Number.isFinite(redondeo)||redondeo<=0)throw Error('Tarifa inválida.');
  for(const [index,p] of paginas.entries()){
   if(!p||!['altoCm,anchoCm,numero','altoCm,anchoCm,modo,numero'].includes(Object.keys(p).sort().join(','))||
    p.numero!==index+1||!Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
    p.anchoCm<=0||p.altoCm<=0||p.anchoCm>2000||p.altoCm>2000)
    throw Error('Medidas PDF inválidas.');
   const ancho=Math.min(p.anchoCm,p.altoCm),largo=Math.max(p.anchoCm,p.altoCm);
   // Los tamaños PDF pueden tener pequeñas imprecisiones en puntos.
   if(ancho>Number(soporte.widthCm)+0.03)
    throw Error('La página '+p.numero+' supera el ancho del rollo '+soporte.name+'.');
   const modoPagina=p.modo||t.modo;
   if(!['cad','poster'].includes(modoPagina))throw Error('Tipo de ploteo inválido.');
   const tarifaPagina=Number(modoPagina==='cad'?soporte.cadPerMeter:soporte.posterPerMeter);
   if(!Number.isFinite(tarifaPagina)||tarifaPagina<0)throw Error('Tarifa inválida.');
   metros+=largo/100;subtotalBruto+=largo/100*tarifaPagina;
   detailPages.push({numero:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm,modo:modoPagina,
     anchoEnRolloCm:ancho,largoEnRolloCm:largo});
  }
  const tarifa=Number(t.modo==='cad'?soporte.cadPerMeter:soporte.posterPerMeter);
  const metrosFacturables=Math.max(minimo,metros);
  const precioMixto=metros>0?subtotalBruto*metrosFacturables/metros:0;
  const subtotal=Math.ceil((precioMixto*t.copias-1e-8)/redondeo)*redondeo;
  if(!Number.isSafeInteger(subtotal)||subtotal<0)throw Error('Monto de ploteo fuera de rango.');
  total+=subtotal;
  if(!Number.isSafeInteger(total))throw Error('Total de ploteo fuera de rango.');
  detalles.push({id:t.id,nombre:t.nombre,modo:t.modo,material:t.material,
   materialNombre:soporte.name,anchoCm:paginas[0].anchoCm,altoCm:paginas[0].altoCm,
   paginas:detailPages,paginasTotales:paginas.length,copias:t.copias,
   metrosLineales:Math.round(metros*10000)/10000,tarifaPorMetro:tarifa,subtotal});
 }
 return {estado:'PRELIMINAR_SIN_VERIFICAR',paymentAuthorized:false,
  total,trabajos:detalles.length,detalles};
}
