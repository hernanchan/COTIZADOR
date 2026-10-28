/**
 * Ruta privada V2: reutilizar UN recibo firmado después de leer/verificar el
 * PDF real en Drive. No se vuelve a descargar un original para rehacer el mismo
 * hash y páginas. El precio sigue recalculándose con catálogo del SERVIDOR.
 * Comprobantes no válidos o vencidos se rechazan; nunca aceptar datos locales.
 */
import {comprobarComprobantePdf} from './comprobante-pdf-servidor.mjs';
import {consolidarPedidoVerificado} from './consolidar-pedido-verificado.mjs';
import {prepararFichaCentral} from './ficha-produccion-central.mjs';
const DOC=/^DOC-[a-f0-9-]{36}$/i;
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const SHA=/^[a-f0-9]{64}$/;

export async function verificarPedidoPorComprobantes({
 sesiones,manifiesto,secret,preciosServidor,
 now=Date.now(),subtle=crypto.subtle
}){
 if(!manifiesto||!ORDER.test(manifiesto.orderId||'')||
    !Array.isArray(manifiesto.items)||!Array.isArray(sesiones)||
    sesiones.length<1||sesiones.length>30||sesiones.length!==manifiesto.items.length)
  throw Error('Pedido para verificación única no válido.');
 const ids=new Set(),fileIds=new Set(),huellas=new Set(),configuraciones=[],recibosServidor=[];
 for(let i=0;i<sesiones.length;i++){
  const entry=sesiones[i],item=manifiesto.items[i],sesion=entry?.sesion,config=entry?.opciones;
  if(!sesion||!DOC.test(sesion.uploadId||'')||
     typeof sesion.token!=='string'||sesion.token.length<16||sesion.token.length>256||
     !config||typeof config!=='object'||Array.isArray(config)||
     !item||!SHA.test(item.sha256||'')||!DOC.test(item.reciboPrivado||'')||
     ids.has(sesion.uploadId)||item.reciboPrivado!==sesion.uploadId)
   throw Error('Sesión o recibo duplicado o incompleto.');
  ids.add(sesion.uploadId);
  const p=await comprobarComprobantePdf({
   comprobante:entry.comprobanteServidor,secret,now,subtle
  });
  if(p.orderId!==manifiesto.orderId||p.receiptId!==sesion.uploadId||
     p.fileId!=='pdf-'+p.sha256.slice(0,24)||p.sha256!==item.sha256||
     p.pages!==item.paginas||p.mode!==config.modo||
     fileIds.has(p.fileId)||huellas.has(p.sha256))
   throw Error('El comprobante firmado corresponde a un PDF u opciones diferentes.');
  fileIds.add(p.fileId);huellas.add(p.sha256);
  // El nombre, el modo y las medidas del PDF nunca proceden de la pantalla.
  // El resto de opciones se vuelven a calcular en el backend con tarifas actuales.
  const {fileId,orderId,nombre,modo,paginas,...opciones}=config;
  configuraciones.push({...opciones,fileId:p.fileId,nombre:p.name,modo:p.mode});
  recibosServidor.push({
   orderId:p.orderId,fileId:p.fileId,receiptId:p.receiptId,name:p.name,
   status:'verified',storageVerified:true,pageVerification:'server',
   sha256:p.sha256,bytes:p.bytes,pageCount:p.pages,pageMetrics:p.pageMetrics
  });
 }
 const pedido=consolidarPedidoVerificado({
  orderId:manifiesto.orderId,configuraciones,recibosServidor,preciosServidor
 });
 const ficha=prepararFichaCentral({pedidoVerificado:pedido});
 return Object.freeze({
  schema:'saber-central-recepcion-verificada-v1',
  orderId:pedido.orderId,
  estado:'RECEPCION_VERIFICADA_PAGO_Y_PRODUCCION_PENDIENTES',
  cotizacion:pedido.cotizacion,importeVerificado:pedido.importeRecalculado,
  recibos:recibosServidor.map(r=>({
   fileId:r.fileId,receiptId:r.receiptId,sha256:r.sha256,
   bytes:r.bytes,pages:r.pageCount
  })),
  ficha,filesReceived:true,pagoConfirmado:false,paymentAuthorized:false,
  listoParaProducir:false,
  aviso:'Los PDF se comprobaron con recibo HMAC del servidor; pago y archivo imprimible pendientes.'
 });
}
