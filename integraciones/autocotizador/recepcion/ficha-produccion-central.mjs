/** Ficha técnica PREVIA al pago para la Central única, construida solo a partir
 * de un pedido cuyo contenido y cantidad de páginas fue comprobado en backend.
 * No contiene URL de Drive, tokens, ni enlaces imprimibles. Aún NO es orden de producción.
 */
const TIPOS=new Set(['documentos','ploteos','stickers','fotos','corte','grafica']);
const DETALLE={
 documentos:'detalleImpresiones',ploteos:'detallePloteos',stickers:'detalleStickers',
 fotos:'detalleFotos',corte:'detalleCortes',grafica:'detalleGraficas'
};
export function prepararFichaCentral({pedidoVerificado}){
 const p=pedidoVerificado;
 if(!p||p.schema!=='saber-pedido-documentos-verificados-v1'||
    p.estado!=='ARCHIVOS_VERIFICADOS_SIN_PAGO'||p.paymentAuthorized!==false||
    !Number.isSafeInteger(p.importeRecalculado)||p.importeRecalculado<=0||
    !Array.isArray(p.archivos)||!p.archivos.length||p.archivos.length>30)
  throw Error('Falta el pedido íntegro verificado en el servidor.');
 const c=p.cotizacion;
 if(!c||c.estado!=='PRELIMINAR'||c.paymentAuthorized!==false||
    c.total!==p.importeRecalculado||!Array.isArray(c.plan)||c.plan.length!==p.archivos.length||
    !Array.isArray(c.pendientes)||c.pendientes.length)
  throw Error('Cotización no apta para preparar una ficha de producción.');
 const indices=new Set(),lineas=[],ids=new Set();
 for(const fila of c.plan){
  if(!fila||!Number.isSafeInteger(fila.indice)||fila.indice<0||fila.indice>=p.archivos.length||
     indices.has(fila.indice)||!TIPOS.has(fila.destino)||typeof fila.id!=='string'||ids.has(fila.id))
   throw Error('Hay trabajos omitidos o duplicados en la ficha.');
  indices.add(fila.indice);ids.add(fila.id);
  const origen=p.archivos[fila.indice];
  if(!origen||origen.nombre!==fila.nombre||typeof origen.fileId!=='string'||
     !/^DOC-[a-f0-9-]{36}$/i.test(origen.receiptId||'')||
     !/^[a-f0-9]{64}$/.test(origen.sha256||'')||
     !Number.isSafeInteger(origen.paginas)||origen.paginas<1||
     !Array.isArray(fila.paginasElegidas)||!fila.paginasElegidas.length||
     fila.paginasElegidas.some(n=>!Number.isSafeInteger(n)||n<1||n>origen.paginas)||
     new Set(fila.paginasElegidas).size!==fila.paginasElegidas.length)
   throw Error('Falta la referencia de recepción o las páginas verificadas.');
  const desglose=c[DETALLE[fila.destino]];
  const detalles=desglose?.find(x=>x.id===fila.id);
  if(!detalles||detalles.nombre!==origen.nombre)
   throw Error('El trabajo no coincide con su desglose.');
  lineas.push({
   orden:fila.indice+1,idTrabajo:fila.id,servicio:fila.destino,
   nombreOriginal:origen.nombre,
   fileId:origen.fileId,reciboPrivado:origen.receiptId,
   sha256:origen.sha256,paginasOriginales:origen.paginas,
   paginasElegidas:[...fila.paginasElegidas],
   copias:detalles.copias??detalles.lotes??null,
   formatoFinal:fila.formatoFinal||null,
   material:detalles.material||detalles.papel||fila.papelPoster||null,
   modo:detalles.modo||null,
   // Procede del presupuesto recomputado; no aceptar opciones de impresión
   // nuevas durante la preparación del PDF sin volver a presupuestar.
   carasPresupuestadas:fila.destino==='documentos'?detalles.caras:null,
   paginasPorCaraPresupuestadas:fila.destino==='documentos'?1:null,
   tipoAnillado:fila.destino==='documentos'?detalles.anillado:null,
   productoId:detalles.productoId||null,
   variante:detalles.variante||null,
   metros:detalles.metros??null,
   descripcion:detalles.descripcion||detalles.familia||null,
   operaciones:(fila.ajuste?[fila.ajuste]:[]),
   estado:'ORIGINAL_VERIFICADO_PDF_PRODUCCION_PENDIENTE',
   pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false
  });
 }
 lineas.sort((a,b)=>a.orden-b.orden);
 return Object.freeze({
  schema:'saber-central-ficha-produccion-v1',orderId:p.orderId,
  estado:'ARCHIVOS_VERIFICADOS_PAGO_PENDIENTE',
  totalVerificadoSinPago:p.importeRecalculado,
  trabajos:lineas,gruposAnillado:c.detalleArmados||[],
  archivosVerificados:lineas.length,
  pdfsFinalesVerificados:0,
  pagoConfirmado:false,listoParaProducir:false,
  requiresPrivatePaymentLookup:true,requiresPdfFinalVerification:true,
  nota:'Documento privado de preparación. El pago, PDF final y acceso a Drive se comprueban aparte.'
 });
}
