import {prepararPlanRecepcionUniversal} from './plan-recepcion-universal-r2.mjs';
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {repartirPromocionFicha} from './repartir-promocion-ficha.mjs';
import {validarTrabajosPedido} from './validar-trabajos-pedido.mjs';
// Ficha interna previa a originales. No autoriza cobros ni producción.
const NAME=/^WEB-ENSAYO-[A-F0-9]{32}$/;
export function fichaPrearchivoUniversal({webOrderId,archivos,manifiestos,trabajosPedido,tarifario,produccion=false,ahora=Date.now(),admitirFotosTusPruebas=false}={}){
 if(!NAME.test(webOrderId||''))throw Error('UNIVERSAL_ORDEN_INVALIDA');
 const grupos=trabajosPedido===undefined?null:
  validarTrabajosPedido(trabajosPedido,archivos?.length,{maxTrabajos:10});
 const grupoPorIndice=new Map();
 for(const grupo of grupos||[])for(const indice of grupo.indices)grupoPorIndice.set(indice,grupo);
 const plan=prepararPlanRecepcionUniversal({archivos,manifiestos,tarifario,produccion,ahora,admitirFotosTusPruebas});
 const quote=cotizarCargaUnica({archivos,precios:tarifario.prices,promociones:tarifario.promotions,ahora});
 if(quote.estado!=='PRELIMINAR'||quote.paymentAuthorized!==false||
    quote.total!==plan.totalArs||quote.plan.length!==archivos.length)
  throw Error('UNIVERSAL_PRECIO_INCONSISTENTE');
 const collections={documentos:'detalleImpresiones',ploteos:'detallePloteos',
  fotos:'detalleFotos',stickers:'detalleStickers',
  corte:'detalleCortes',grafica:'detalleGraficas'};
 const trabajos=plan.archivos.map((f,i)=>{
  const item=quote.plan.find(p=>p.indice===i);
  if(!item||!collections[item.destino]||item.destino!==f.destino)
   throw Error('UNIVERSAL_DESTINO_NO_ADMITIDO');
  const detalle=quote[collections[item.destino]].find(d=>d.id===item.id);
  if(!detalle||detalle.nombre!==f.nombre||
     !Number.isSafeInteger(detalle.subtotal)||detalle.subtotal<0)
   throw Error('UNIVERSAL_DESGLOSE_INCOMPLETO');
  const grupo=grupoPorIndice.get(i);
  return {indice:i,fileId:f.fileId,nombre:f.nombre,sha256:f.sha256,bytes:f.bytes,
   transporte:f.transporte,destino:f.destino,idTrabajo:item.id,
   paginasElegidas:[...f.paginasElegidas],formatoFinal:f.formatoFinal,
   configuracion:{...archivos[i]},detalle:{...detalle},importeArs:detalle.subtotal,
   ...(grupo?{trabajoPedidoId:grupo.id,nombreTrabajo:grupo.nombre}:{}),
   originalRecibido:false,integridadVerificada:false,preprensaAprobada:false};
 });
 const armados=quote.detalleArmados.map(a=>({...a}));
 const cobro=repartirPromocionFicha({quote,trabajos,armados,precios:tarifario.prices});
 if(cobro.totalArs!==plan.totalArs||!Number.isSafeInteger(cobro.totalArs))
  throw Error('UNIVERSAL_TOTAL_NO_CONCILIA');
 const trabajoIds=grupos?.map(g=>({id:g.id,nombre:g.nombre,
  fileIds:g.indices.map(i=>plan.archivos[i].fileId)}));
 return {schema:grupos?'saber-r2-universal-draft-v2':'saber-r2-universal-draft-v1',webOrderId,
  priceRevision:plan.priceRevision,totalArs:cobro.totalArs,
  archivos:cobro.trabajos,armados:cobro.armados,
  ...(trabajoIds?{trabajosPedido:trabajoIds}:{}),
  pagoAutorizado:false,subidaAutorizada:false,produccionAutorizada:false,
  estado:'PRELIMINAR_SIN_ORIGINALES'};
}
