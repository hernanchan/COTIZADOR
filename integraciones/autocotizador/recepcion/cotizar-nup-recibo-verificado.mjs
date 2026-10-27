/** Cotización N-up de un PDF real ya verificado en GAS/Drive.
 * El tamaño y las páginas provienen del PDF leído por el servidor.
 * No autoriza cobro, recepción pública ni órdenes de producción.
 */
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
export function cotizarNupReciboVerificado({recibo,medidas,opciones,precios}){
 if(!recibo||recibo.ok!==true||recibo.status!=='verified'||
   recibo.verified!==true||recibo.storageVerified!==true||
   recibo.pageVerification!=='server'||recibo.paymentAuthorized!==false||
   !Number.isSafeInteger(recibo.pages)||recibo.pages<1||recibo.pages>2000||
   !medidas||medidas.pageCount!==recibo.pages||
   !Array.isArray(medidas.pageMetrics)||medidas.pageMetrics.length!==recibo.pages||
   !opciones||![2,4,9].includes(opciones.paginasPorHoja)||
   !['a4','a3'].includes(opciones.formato)||
   !['simple','double'].includes(opciones.caras)||
   !['ninguno'].includes(opciones.anillado)||
   !Number.isSafeInteger(opciones.copias)||opciones.copias<1||opciones.copias>200||
   !['bn','color'].includes(recibo.mode)||
   typeof opciones.materialColor!=='string')
  throw Error('PDF o composición no verificados por el servidor.');
 const paginas=medidas.pageMetrics.map((m,i)=>{
  if(!m||!Number.isFinite(m.anchoCm)||!Number.isFinite(m.altoCm)||
    m.anchoCm<=0||m.altoCm<=0||
    Math.max(m.anchoCm,m.altoCm)>42.03||
    Math.min(m.anchoCm,m.altoCm)>29.73)
   throw Error('El PDF excede A3 o tiene medidas inválidas; revisar ploteo.');
  return {numero:i+1,anchoCm:m.anchoCm,altoCm:m.altoCm,modo:'sin-clasificar'};
 });
 const r=cotizarCargaUnica({precios,archivos:[{
  nombre:recibo.name,servicio:'auto',paginas,seleccion:opciones.formato,
  paginasSeleccionadas:'',copias:opciones.copias,modo:recibo.mode,
  caras:opciones.caras,papelPoster:'obra80',anillado:'ninguno',
  grupoAnillado:'',materialColor:opciones.materialColor,
  paginasPorHoja:opciones.paginasPorHoja
 }]});
 if(r.estado!=='PRELIMINAR'||r.paymentAuthorized!==false||
   !Number.isSafeInteger(r.total)||r.total<=0||r.plan.length!==1)
  throw Error('La composición no tiene precio documental verificado.');
 return Object.freeze({estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
  totalArs:r.total,paginasOriginales:recibo.pages,
  formato:opciones.formato,caras:opciones.caras,copias:opciones.copias,
  anillado:'ninguno',materialColor:opciones.materialColor,
  paginasPorHoja:opciones.paginasPorHoja,paymentAuthorized:false});
}
