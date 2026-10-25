/**
 * RECEPCIÓN HMAC VERIFICADA → PDF DOCUMENTAL COMPUESTO (todavía no almacenado).
 * Función exclusiva de backend. No exponer bytes ni credenciales por HTTP.
 * El trabajo y las opciones surgen de la ficha calculada en el servidor.
 */
import {leerPdfFase4Privado} from './leer-pdf-fase4-privado.mjs';
import {verificarPdfAlmacenado} from './verificacion-pdf-drive-servidor.mjs';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {componerDocumentoPdfPrivado} from './componer-pdf-documentos-privado.mjs';
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const bytesHex=x=>Array.from(x,b=>b.toString(16).padStart(2,'0')).join('');
export async function componerDesdeReciboVerificado({
 manifiesto,sesion,trabajoId,consultarFirmado,
 maxFileBytes=1024*1024,subtle=crypto.subtle
}){
 if(!manifiesto||manifiesto.schema!=='saber-central-recepcion-verificada-v1'||
    manifiesto.filesReceived!==true||manifiesto.paymentAuthorized!==false||
    manifiesto.listoParaProducir!==false||
    !ORDER.test(manifiesto.orderId||'')||
    !manifiesto.ficha||manifiesto.ficha.schema!=='saber-central-ficha-produccion-v1'||
    manifiesto.ficha.orderId!==manifiesto.orderId||
    manifiesto.ficha.pagoConfirmado!==false||
    manifiesto.ficha.listoParaProducir!==false||
    !Array.isArray(manifiesto.ficha.trabajos)||
    !Array.isArray(manifiesto.recibos)||
    manifiesto.recibos.length!==manifiesto.ficha.trabajos.length||
    typeof consultarFirmado!=='function'||
    ![1024*1024,20*1024*1024].includes(maxFileBytes)||
    !sesion||!RECEIPT.test(sesion.uploadId||'')||
    typeof sesion.token!=='string'||sesion.token.length<16||
    sesion.token.length>256)
  throw Error('Composición no autorizada: falta una ficha verificada.');
 const fichas=manifiesto.ficha.trabajos;
 const trabajo=fichas.find(t=>t.idTrabajo===trabajoId);
 if(!trabajo||fichas.filter(t=>t.idTrabajo===trabajoId).length!==1||
    trabajo.servicio!=='documentos'||trabajo.estado!=='ORIGINAL_VERIFICADO_PDF_PRODUCCION_PENDIENTE'||
    trabajo.pdfImprimibleVerificado!==false||trabajo.descargaPrivadaHabilitada!==false||
    !FILE.test(trabajo.fileId||'')||!RECEIPT.test(trabajo.reciboPrivado||'')||
    trabajo.reciboPrivado!==sesion.uploadId||
    !SHA.test(trabajo.sha256||'')||
    !['a4','a3'].includes(trabajo.formatoFinal)||
    !Number.isSafeInteger(trabajo.copias)||trabajo.copias<1||trabajo.copias>200||
    !['simple','double'].includes(trabajo.carasPresupuestadas)||
    trabajo.paginasPorCaraPresupuestadas!==1||
    !Array.isArray(trabajo.paginasElegidas)||!trabajo.paginasElegidas.length)
  throw Error('Trabajo no apto: composición o tarifa requieren revisión.');
 const r=manifiesto.recibos.find(x=>x.receiptId===trabajo.reciboPrivado);
 if(!r||manifiesto.recibos.filter(x=>x.receiptId===trabajo.reciboPrivado).length!==1||
    r.fileId!==trabajo.fileId||r.sha256!==trabajo.sha256||
    r.pages!==trabajo.paginasOriginales)
  throw Error('El recibo de trabajo no coincide con la ficha.');
 const safe={uploadId:sesion.uploadId,token:sesion.token};
 const info=await consultarFirmado({op:'multiInfo',...safe});
 const state=await consultarFirmado({op:'multiVerifiedStatus',...safe});
 if(!info||info.ok!==true||info.receiptState!=='pages_verified'||
    info.receiptId!==trabajo.reciboPrivado||
    info.orderId!==manifiesto.orderId||info.fileId!==trabajo.fileId||
    info.sha256!==trabajo.sha256||info.pages!==trabajo.paginasOriginales||
    info.name!==trabajo.nombreOriginal||
    info.bytes!==r.bytes||info.privateChunkBytes!==256*1024||
    !['bn','color'].includes(info.mode)||
    !state||state.ok!==true||state.status!=='verified'||
    state.verified!==true||state.storageVerified!==true||
    state.pageVerification!=='server'||state.paymentAuthorized!==false||
    state.receiptId!==info.receiptId||state.orderId!==info.orderId||
    state.fileId!==info.fileId||state.sha256!==info.sha256||
    state.bytes!==info.bytes||state.pages!==info.pages)
  throw Error('La recepción privada no confirma el PDF original.');
 const original=await leerPdfFase4Privado({
  session:safe,receiptId:info.receiptId,bytes:info.bytes,
  sha256:info.sha256,maxFileBytes,consultarFirmado,subtle
 });
 const verified=await verificarPdfAlmacenado({
  driveBytes:original,reciboServidor:{...state,receiptState:'bytes_checked'},subtle
 });
 if(verified.pages!==trabajo.paginasOriginales)
  throw Error('El número de páginas cambió desde la cotización.');
 const medidas=await medidasPdfServidor(original);
 if(medidas.pageCount!==trabajo.paginasOriginales)
  throw Error('El número de páginas reales no coincide.');
 // Evitar reducir planos grandes accidentalmente para cobrarlos como A4/A3.
 for(const page of trabajo.paginasElegidas){
  if(!Number.isSafeInteger(page)||page<1||page>medidas.pageCount)
   throw Error('La página elegida no existe.');
  const m=medidas.pageMetrics[page-1];
  if(Math.max(m.anchoCm,m.altoCm)>42.03||
     Math.min(m.anchoCm,m.altoCm)>29.73)
   throw Error('Original supera A3: enviar a ploteo, no a documentos.');
 }
 const armado=await componerDocumentoPdfPrivado({
  pdfOriginal:original,paginas:trabajo.paginasElegidas,
  formatoHoja:trabajo.formatoFinal,
  paginasPorCara:trabajo.paginasPorCaraPresupuestadas,
  copias:trabajo.copias,
  dobleFaz:trabajo.carasPresupuestadas==='double'
 });
 const {PDFDocument}=await import('pdf-lib');
 const pdf=await PDFDocument.load(armado.pdfBytes,{
  ignoreEncryption:false,throwOnInvalidObject:true
 });
 if(pdf.getPageCount()!==armado.ficha.carasTotales)
  throw Error('El compositor no generó todas las caras previstas.');
 const outputHash=bytesHex(new Uint8Array(await subtle.digest('SHA-256',armado.pdfBytes)));
 return Object.freeze({
  pdfBytes:armado.pdfBytes,
  ficha:Object.freeze({
   schema:'saber-borrador-pdf-impresion-privado-v1',
   orderId:manifiesto.orderId,fileId:trabajo.fileId,
   documentoRecibo:trabajo.reciboPrivado,
   originalSha256:trabajo.sha256,originalPaginas:trabajo.paginasOriginales,
   compuestoSha256:outputHash,compuestoBytes:armado.pdfBytes.length,
   compuestoPaginas:armado.ficha.carasTotales,
   formatoHoja:trabajo.formatoFinal,caras:trabajo.carasPresupuestadas,
   copias:trabajo.copias,paginasPorCara:1,
   hojasFisicas:armado.ficha.hojasFisicas,
   paginasElegidas:[...trabajo.paginasElegidas],
   estado:'COMPUESTO_EN_MEMORIA_PENDIENTE_DE_DRIVE',
   guardadoEnDrive:false,pdfImprimibleVerificado:false,
   pagoConfirmado:false,descargaPrivadaHabilitada:false,
   paymentAuthorized:false,listoParaProducir:false
  })
 });
}
