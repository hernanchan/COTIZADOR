/**
 * Borrador local de pedido para Librería Saber.
 * Sólo enlaza opciones cotizadas con los originales File que siguen en memoria.
 * NUNCA acredita recepción, habilita pago ni reemplaza el cotejo en backend.
 */
const servicios=new Set(['documentos','ploteos','stickers','fotos','corte','grafica']);
const detalles={
 documentos:'detalleImpresiones',ploteos:'detallePloteos',stickers:'detalleStickers',
 fotos:'detalleFotos',corte:'detalleCortes',grafica:'detalleGraficas'
};
function entero(v){return Number.isSafeInteger(v)&&v>=0}
export function prepararBorradorPedido({cotizacion,archivos}){
 if(!cotizacion||cotizacion.ok!==true||cotizacion.paymentAuthorized!==false||
    cotizacion.verificacion!=='PRELIMINAR_SIN_VERIFICAR')
  throw Error('No existe una cotización preliminar válida.');
 if(!Array.isArray(archivos)||!archivos.length||archivos.length>30||
    !Array.isArray(cotizacion.plan)||!Array.isArray(cotizacion.pendientes))
  throw Error('Archivos o detalle del pedido inválidos.');
 if(cotizacion.estado!=='PRELIMINAR'||cotizacion.pendientes.length||
    !entero(cotizacion.total)||!cotizacion.total||
    cotizacion.plan.length!==archivos.length)
  throw Error('Hay trabajos sin presupuestar. Revisá cada archivo.');
 const subtotales=['subtotalImpresiones','subtotalPloteos','subtotalStickers',
   'subtotalFotos','subtotalCortes','subtotalGraficas'];
 if(subtotales.some(k=>!entero(cotizacion[k]??0))||
    subtotales.reduce((n,k)=>n+(cotizacion[k]??0),0)!==cotizacion.total)
  throw Error('La suma de las líneas no coincide con el presupuesto.');
 const indices=new Set(),lineas=[],nombres=new Set();
 for(const item of cotizacion.plan){
  if(!item||!Number.isSafeInteger(item.indice)||item.indice<0||
     item.indice>=archivos.length||indices.has(item.indice)||
     !servicios.has(item.destino)||typeof item.id!=='string')
   throw Error('Trabajo repetido o sin vinculación al archivo original.');
  indices.add(item.indice);
  const entrada=archivos[item.indice];
  if(!entrada||!(entrada.file instanceof Blob)||
     typeof entrada.name!=='string'||item.nombre!==entrada.name||entrada.file.name!==entrada.name||
     !Number.isSafeInteger(entrada.file.size)||entrada.file.size<5||
     !Array.isArray(entrada.paginas)||!entrada.paginas.length)
   throw Error('Seleccioná nuevamente el archivo original antes de continuar.');
  if(nombres.has(item.indice))throw Error('Archivo duplicado.');
  nombres.add(item.indice);
  const refs=item.paginasElegidas;
  if(!Array.isArray(refs)||!refs.length||
     refs.some(n=>!Number.isSafeInteger(n)||n<1||n>entrada.paginas.length)||
     new Set(refs).size!==refs.length)
   throw Error('La selección de páginas necesita revisión.');
  const detallesTrabajo=cotizacion[detalles[item.destino]];
  const calculo=detallesTrabajo?.find(x=>x.id===item.id);
  if(!calculo||calculo.nombre!==entrada.name)throw Error('Falta el detalle comercial vinculado al archivo original.');
  // Los anillados conjuntos se totalizan a nivel de presupuesto, no de archivo.
  lineas.push(Object.freeze({
   referenciaLocal:'archivo-'+(item.indice+1),nombre:entrada.name,
   servicio:item.destino,paginasElegidas:[...refs],paginasOriginales:entrada.paginas.length,
   bytes:entrada.file.size,copias:entrada.copias,descripcion:calculo.descripcion||calculo.familia||'',
   subtotalReferencia:entero(calculo.subtotal)?calculo.subtotal:null,
   estadoArchivo:'SIN_ENVIAR',reciboServidor:null,verificacionServidor:false
  }));
 }
 return Object.freeze({
  schema:'saber-pedido-borrador-v1',estado:'PENDIENTE_DE_RECEPCION',
  items:lineas,cantidadArchivos:lineas.length,totalOrientativo:cotizacion.total,
  // Contrato importante: estos valores NUNCA pueden autorizar un pago.
  filesReceived:false,serverQuoteVerified:false,paymentAuthorized:false,
  requiereValidacionPreciosYOriginales:true,
  instrucciones:'Antes de cobrar: subir cada archivo, verificar páginas y SHA en servidor, recalcular y asociar el carrito.'
 });
}
