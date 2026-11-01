/**
 * Adaptador Supabase Storage privado → motor original de precios + ficha de Central.
 *
 * Usa exclusivamente comprobantes HMAC emitidos por el Worker privado.
 * No cree en el estado, las páginas, los hashes ni los importes del navegador:
 * el pipeline existente vuelve a descargar el objeto, coteja SHA, páginas,
 * dimensiones y cotiza con el catálogo del servidor ANTES de escribir D1.
 *
 * No habilita pagos ni expone URLs de descarga.
 */
import {conectarRecepcionConCentral} from './puente-recepcion-central.mjs';
import {validarLoteFirmadoTUS} from './tus-pedido-contrato.mjs';

export async function verificarTandaTUSYRecalcular({
 orderId,entries,secret,leerObjetoPrivado,preciosServidor,
 ahora,subtle=crypto.subtle,puente=conectarRecepcionConCentral,
}={}){
 if(typeof leerObjetoPrivado!=='function'||typeof puente!=='function')
  throw Error('Falta el almacenamiento privado de PDFs.');
 const claims=await validarLoteFirmadoTUS({orderId,entries,secret,ahora,subtle});
 // Los recibos son *provisionales*: únicamente existen dentro de este
 // proceso de servidor y no permiten D1 hasta que el puente verifique bytes.
 const byId=new Map(claims.map(c=>[c.fileId,c]));
 const byReceipt=new Map(claims.map(c=>[c.receiptId,c]));
 const configs=claims.map(c=>{
  // Nunca permitir que el cliente reemplace identidad/hashes de una firma.
  const {fileId,orderId:ignored,nombre,modo,paginas,...rest}=c.opciones;
  return {...rest,fileId:c.fileId,nombre:c.name,modo:c.mode};
 });
 const provisional=claims.map(c=>Object.freeze({
  fileId:c.fileId,orderId:c.orderId,receiptId:c.receiptId,
  name:c.name,mode:c.mode,bytes:c.bytes,sha256:c.sha256,pages:c.pages,
  status:'verified',verified:true,storageVerified:true,pageVerification:'server'
 }));
 const verified=await puente({
  orderId,configuraciones:configs,preciosServidor,
  consultarRecibosPrivados:async ({orderId:requerido,fileIds})=>{
   if(requerido!==orderId||fileIds.length!==claims.length||
      fileIds.some(id=>!byId.has(id)))
    throw Error('Recibos de pedido incompatibles.');
   return provisional;
  },
  descargarPdfPrivado:async ({orderId:pedido,fileId,receiptId,expectedBytes})=>{
   const c=byId.get(fileId);
   if(!c||pedido!==orderId||byReceipt.get(receiptId)!==c||
      expectedBytes!==c.bytes)throw Error('El archivo solicitado difiere del comprobante TUS.');
   const bytes=await leerObjetoPrivado(c.objectName,c);
   if(!(bytes instanceof Uint8Array)||bytes.byteLength!==c.bytes)
    throw Error('PDF privado ausente o incompleto.');
   return bytes;
  }
 });
 // En esta instancia, puente-recepcion-central ya recomputó SHA, páginas,
 // clasificación y precios sobre los BYTES REALES, y produjo ficha para D1.
 if(verified?.schema!=='saber-central-recepcion-verificada-v1'||
    verified.orderId!==orderId||verified.filesReceived!==true||
    verified.recibos?.length!==claims.length||
    verified.paymentAuthorized!==false||verified.listoParaProducir!==false||
    !Number.isSafeInteger(verified.importeVerificado)||verified.importeVerificado<1)
  throw Error('El servidor no reconcilió la tanda TUS.');
 const saved=new Map(verified.recibos.map(r=>[r.receiptId,r]));
 if(saved.size!==claims.length||claims.some(c=>{
  const r=saved.get(c.receiptId);
  return !r||r.fileId!==c.fileId||r.sha256!==c.sha256||r.pages!==c.pages||r.bytes!==c.bytes;
 }))throw Error('Los PDF verificados no coinciden con la tanda firmada.');
 return Object.freeze({verificacion:verified,
  claims:Object.freeze(claims),checkoutEnabled:false,paymentAuthorized:false});
}
