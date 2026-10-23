/** Conecta datos recibidos en Google Drive al pedido y su ficha de Central.
 *
 * consultarRecibosPrivados y descargarPdfPrivado deben ser implementados por un
 * backend HMAC autenticado, nunca con datos del navegador. No hay endpoints ni
 * credenciales en este módulo. No inicia pago ni libera producción.
 */
import {verificarPdfAlmacenado} from './verificacion-pdf-drive-servidor.mjs';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {consolidarPedidoVerificado} from './consolidar-pedido-verificado.mjs';
import {prepararFichaCentral} from './ficha-produccion-central.mjs';
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const SHA=/^[a-f0-9]{64}$/;
export async function conectarRecepcionConCentral({
 orderId,configuraciones,consultarRecibosPrivados,descargarPdfPrivado,preciosServidor
}){
 if(!ORDER.test(orderId||'')||!Array.isArray(configuraciones)||
    configuraciones.length<1||configuraciones.length>30||
    typeof consultarRecibosPrivados!=='function'||typeof descargarPdfPrivado!=='function')
  throw Error('Pedido o acceso privado al receptor inválidos.');
 const ids=new Set();
 for(const c of configuraciones){
  if(!c||!FILE.test(c.fileId||'')||ids.has(c.fileId))
   throw Error('Archivos duplicados o sin identificador de pedido.');
  ids.add(c.fileId);
 }
 // Este listado se obtiene DESDE Google por el servidor, nunca desde el body
 // público. El token HMAC de la recepción nunca sale hacia el cliente.
 const almacenados=await consultarRecibosPrivados({orderId,fileIds:[...ids]});
 if(!Array.isArray(almacenados)||almacenados.length!==ids.size)
  throw Error('Faltan recibos firmados para los archivos.');
 const recibosUnicos=new Set(),vistos=new Set(),confirmados=[];
 for(const recibo of almacenados){
  if(!recibo||!FILE.test(recibo.fileId||'')||!ids.has(recibo.fileId)||
     vistos.has(recibo.fileId)||recibo.orderId!==orderId||
     !RECEIPT.test(recibo.receiptId||'')||recibosUnicos.has(recibo.receiptId)||
     recibo.status!=='verified'||recibo.verified!==true||
     recibo.storageVerified!==true||recibo.pageVerification!=='server'||
     !Number.isSafeInteger(recibo.pages)||recibo.pages<1||recibo.pages>2000||
     !Number.isSafeInteger(recibo.bytes)||recibo.bytes<5||recibo.bytes>20*1024*1024||
     !SHA.test(recibo.sha256||'')||!/\.pdf$/i.test(recibo.name||'')||
     !['bn','color'].includes(recibo.mode))
   throw Error('El receptor todavía no confirmó el PDF y sus páginas.');
  vistos.add(recibo.fileId);recibosUnicos.add(recibo.receiptId);
  const bytes=await descargarPdfPrivado({orderId,fileId:recibo.fileId,
   receiptId:recibo.receiptId,expectedBytes:recibo.bytes});
  // Validar el hash completo de los bytes reales descargados, además del estado
  // firmado del recibo. No aceptar sólo un OK de Apps Script o del navegador.
  const comprobado=await verificarPdfAlmacenado({driveBytes:bytes,
   reciboServidor:{...recibo,receiptState:'bytes_checked'}});
  if(comprobado.pages!==recibo.pages)
   throw Error('Cantidad de páginas diferente del recibo de Google.');
  const medidas=await medidasPdfServidor(bytes);
  if(medidas.pageCount!==recibo.pages)
   throw Error('El número de páginas verificadas no coincide con las medidas.');
  confirmados.push({fileId:recibo.fileId,orderId,receiptId:recibo.receiptId,
   name:recibo.name,status:'verified',storageVerified:true,
   pageVerification:'server',sha256:comprobado.sha256,bytes:comprobado.bytes,
   pageCount:comprobado.pages,pageMetrics:medidas.pageMetrics});
 }
 const verificado=consolidarPedidoVerificado({orderId,configuraciones,
  recibosServidor:confirmados,preciosServidor});
 const ficha=prepararFichaCentral({pedidoVerificado:verificado});
 return Object.freeze({
  schema:'saber-central-recepcion-verificada-v1',orderId,
  estado:'RECEPCION_VERIFICADA_PAGO_Y_PRODUCCION_PENDIENTES',
  cotizacion:verificado.cotizacion,importeVerificado:verificado.importeRecalculado,
  recibos:confirmados.map(r=>({fileId:r.fileId,receiptId:r.receiptId,
   sha256:r.sha256,bytes:r.bytes,pages:r.pageCount})),
  ficha,filesReceived:true,pagoConfirmado:false,paymentAuthorized:false,
  listoParaProducir:false,
  aviso:'Los PDF originales fueron verificados; el pago y el archivo final imprimible se validan aparte.'
 });
}
