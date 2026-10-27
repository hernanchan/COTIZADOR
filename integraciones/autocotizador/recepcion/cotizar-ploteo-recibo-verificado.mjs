/** Recalcula la orden CAD/Póster a partir del PDF privado realmente recibido.
 * El navegador sólo aporta la CLASE visual por página. Las dimensiones, el
 * número de páginas y las tarifas son autoridad del servidor.
 * Ni registra en D1 ni autoriza cobros/producción.
 */
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
const LIMIT=2000;
export function cotizarPloteoReciboVerificado({
 recibo,medidas,clasificacionCliente,copias,papelPoster,precios
}){
 if(!recibo||recibo.ok!==true||recibo.status!=='verified'||
    recibo.verified!==true||recibo.storageVerified!==true||
    recibo.pageVerification!=='server'||recibo.paymentAuthorized!==false||
    typeof recibo.name!=='string'||!/\.pdf$/i.test(recibo.name)||
    !['bn','color'].includes(recibo.mode)||
    !Number.isSafeInteger(recibo.pages)||recibo.pages<1||recibo.pages>LIMIT||
    !medidas||medidas.pageCount!==recibo.pages||
    !Array.isArray(medidas.pageMetrics)||medidas.pageMetrics.length!==recibo.pages||
    !Array.isArray(clasificacionCliente)||clasificacionCliente.length!==recibo.pages||
    !Number.isSafeInteger(copias)||copias<1||copias>200||
    !['obra80','recubierto'].includes(papelPoster)||!precios?.plotter)
  throw Error('El ploteo no tiene recibo e instrucciones completos.');
 const paginas=medidas.pageMetrics.map((p,i)=>{
  const c=clasificacionCliente[i];
  if(!p||!Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
     p.anchoCm<=0||p.altoCm<=0||p.anchoCm>2000||p.altoCm>2000||
     !c||Object.keys(c).sort().join(',')!=='altoCm,anchoCm,modo,numero'||
     c.numero!==i+1||!['cad','poster'].includes(c.modo)||
     !Number.isFinite(c.anchoCm)||!Number.isFinite(c.altoCm)||
     Math.abs(c.anchoCm-p.anchoCm)>0.15||
     Math.abs(c.altoCm-p.altoCm)>0.15)
   throw Error('La clasificación no coincide con las páginas del PDF almacenado.');
  return {numero:i+1,anchoCm:p.anchoCm,altoCm:p.altoCm,modo:c.modo};
 });
 if(!paginas.some(p=>Math.max(p.anchoCm,p.altoCm)>42.03||
    Math.min(p.anchoCm,p.altoCm)>29.73))
  throw Error('El archivo no requiere ploteo; corresponde a impresiones A4/A3.');
 const r=cotizarCargaUnica({precios,archivos:[{
  nombre:recibo.name,servicio:'auto',paginas,seleccion:'original',
  paginasSeleccionadas:'',copias,modo:recibo.mode,caras:'simple',
  papelPoster,anillado:'ninguno',grupoAnillado:'',materialColor:'',
  paginasPorHoja:1
 }]});
 if(r.estado!=='PRELIMINAR'||r.paymentAuthorized!==false||
    !Number.isSafeInteger(r.total)||r.total<=0||
    r.plan?.length!==1||r.plan[0].destino!=='ploteos'||
    r.detallePloteos?.length!==1||r.detallePloteos[0].paginas?.length!==recibo.pages)
  throw Error('El ploteo requiere revisión de clasificación o tarifas.');
 const detalle=r.detallePloteos[0];
 return Object.freeze({
  estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',totalArs:r.total,
  paginasOriginales:recibo.pages,
  paginas:detalle.paginas.map((p,i)=>Object.freeze({
   numero:i+1,anchoCm:p.anchoCm,altoCm:p.altoCm,modo:p.modo,
   rollo:p.material,papel:p.papel
  })),copias,papelPoster,material:detalle.material,
  priceVersion:precios.generatedAt||'catalogo-local',
  paymentAuthorized:false,checkoutEnabled:false,listoParaProducir:false
 });
}
