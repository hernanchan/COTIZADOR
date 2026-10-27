/**
 * Siguiente barrera del pedido: vincular PDFs VERIFICADOS desde el backend.
 * `recibosServidor` debe proceder de una búsqueda privada autenticada por orderId,
 * JAMÁS del JSON que envía el navegador.
 * Este módulo NO concede acceso a Mercado Pago: resta inspección comercial final.
 */
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
const ORDEN=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const RECIBO=/^DOC-[a-f0-9-]{36}$/i;
export function consolidarPedidoVerificado({orderId,configuraciones,recibosServidor,preciosServidor}){
 if(typeof orderId!=='string'||!ORDEN.test(orderId)||
    !Array.isArray(configuraciones)||configuraciones.length<1||configuraciones.length>30||
    !Array.isArray(recibosServidor)||recibosServidor.length!==configuraciones.length)
  throw Error('Pedido o recepción incompletos.');
 if(!preciosServidor||!preciosServidor.bnA4||!preciosServidor.plotter)
  throw Error('No se encontraron las tarifas del servidor.');
 const refs=new Map(),ids=new Set(),identificadoresRecibos=new Set();
 for(const recibo of recibosServidor){
  if(!recibo||!ID.test(recibo.fileId||'')||refs.has(recibo.fileId)||
     recibo.orderId!==orderId||recibo.status!=='verified'||
     recibo.storageVerified!==true||recibo.pageVerification!=='server'||
     (!RECIBO.test(recibo.receiptId||'')||identificadoresRecibos.has(recibo.receiptId))||!SHA.test(recibo.sha256||'')||
     !Number.isSafeInteger(recibo.bytes)||recibo.bytes<5||
     !Number.isSafeInteger(recibo.pageCount)||recibo.pageCount<1||recibo.pageCount>2000||
     !Array.isArray(recibo.pageMetrics)||recibo.pageMetrics.length!==recibo.pageCount)
   throw Error('Falta verificar un archivo PDF real desde el servidor.');
  identificadoresRecibos.add(recibo.receiptId);
  refs.set(recibo.fileId,recibo);
 }
 const archivos=configuraciones.map(config=>{
  if(!config||!ID.test(config.fileId||'')||ids.has(config.fileId))
   throw Error('Identificador duplicado o inválido en el pedido.');
  ids.add(config.fileId);
  const verificado=refs.get(config.fileId);
  if(!verificado||config.nombre!==verificado.name||
     !/\.pdf$/i.test(verificado.name||'')||
     (Array.isArray(config.paginas)&&config.paginas.length!==verificado.pageCount))
   throw Error('Archivo de pedido sin recibo coincidente.');
  // Medidas y páginas: exclusivamente desde los bytes verificados de Drive.
  // CAD/Póster: instrucción del cliente (clasificador visual local), jamás
  // una supuesta clasificación visual del validador PDF de servidor.
  // Rechazar instrucciones manipuladas o de otro PDF en vez de recalcular
  // sobre dimensiones declaradas en el navegador.
  const paginas=verificado.pageMetrics.map((x,i)=>{
   if(!x||!Number.isFinite(x.anchoCm)||!Number.isFinite(x.altoCm)||
      x.anchoCm<=0||x.altoCm<=0||x.anchoCm>2000||x.altoCm>2000||
      !['cad','poster','sin-clasificar'].includes(x.modo))
    throw Error('El servidor no confirmó las medidas del PDF.');
   // Campo optativo NUEVO: no reutilizar 'paginas', que ya pertenece
   // al contrato histórico de cotización y puede contener datos preliminares.
   if(config.clasificacionCliente!==undefined&&
      (!Array.isArray(config.clasificacionCliente)||
       config.clasificacionCliente.length!==verificado.pageCount))
    throw Error('Instrucciones CAD/Póster incompletas para el PDF.');
   const instruccion=config.clasificacionCliente?.[i]||null;
   if(instruccion&&(
      instruccion.numero!==i+1||
      !Number.isFinite(instruccion.anchoCm)||!Number.isFinite(instruccion.altoCm)||
      Math.abs(instruccion.anchoCm-x.anchoCm)>0.15||
      Math.abs(instruccion.altoCm-x.altoCm)>0.15||
      !['cad','poster','sin-clasificar'].includes(instruccion.modo)))
    throw Error('La clasificación enviada no corresponde a las páginas del PDF verificado.');
   if(x.modo!=='sin-clasificar'&&instruccion&&instruccion.modo!=='sin-clasificar'&&
      x.modo!==instruccion.modo)
    throw Error('Clasificación de impresión inconsistente con el recibo.');
   const modo=x.modo!=='sin-clasificar'?x.modo:(instruccion?.modo||'sin-clasificar');
   return {numero:i+1,anchoCm:x.anchoCm,altoCm:x.altoCm,modo};
  });
  const {fileId:descartado,paginas:declaradas,
   clasificacionCliente:instruccionesValidadas,...opciones}=config;
  return {...opciones,paginas};
 });
 if([...refs.keys()].some(k=>!ids.has(k)))throw Error('Hay recibos ajenos al pedido.');
 const cotizacion=cotizarCargaUnica({archivos,precios:preciosServidor});
 if(cotizacion.total===null||cotizacion.estado!=='PRELIMINAR')
  throw Error('El pedido requiere una revisión comercial antes de continuar.');
 return Object.freeze({
  schema:'saber-pedido-documentos-verificados-v1',
  orderId,estado:'ARCHIVOS_VERIFICADOS_SIN_PAGO',
  archivos:configuraciones.map(a=>{
   const verificado=refs.get(a.fileId);
   return {fileId:a.fileId,nombre:verificado.name,paginas:verificado.pageCount,
    receiptId:verificado.receiptId,sha256:verificado.sha256,bytes:verificado.bytes};
  }),
  cotizacion,importeRecalculado:cotizacion.total,
  paymentAuthorized:false,requiresPaymentAuthorization:true,
  requiereConciliacionCarrito:true
 });
}
