/**
 * PDF ya reconstruido y verificado → borrador Drive privado vía GAS HMAC.
 * No forma parte de la UI pública ni del checkout. Una respuesta de GAS no
 * equivale a un pago ni autoriza descargar desde el panel.
 */
const SHA=/^[a-f0-9]{64}$/;
const DOC=/^DOC-[a-f0-9-]{36}$/i;
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,70}$/;
const CHUNK=512*1024;
const hex=data=>Array.from(data,x=>x.toString(16).padStart(2,'0')).join('');
export async function guardarPdfCompuestoPrivado({
 pdfBytes,ficha,sesionOriginal,consultarFirmado,
 habilitado,subtle=crypto.subtle
}){
 if(habilitado!=='PRIVATE_TEST_ONLY'||typeof consultarFirmado!=='function'||
    !(pdfBytes instanceof Uint8Array)||pdfBytes.length<100||
    pdfBytes.length>20*1024*1024||
    !ficha||ficha.schema!=='saber-borrador-pdf-impresion-privado-v1'||
    ficha.estado!=='COMPUESTO_EN_MEMORIA_PENDIENTE_DE_DRIVE'||
    ficha.paymentAuthorized!==false||ficha.guardadoEnDrive!==false||
    ficha.pdfImprimibleVerificado!==false||
    ficha.listoParaProducir!==false||ficha.descargaPrivadaHabilitada!==false||
    !WEB.test(ficha.orderId||'')||!FILE.test(ficha.fileId||'')||
    !DOC.test(ficha.documentoRecibo||'')||
    !SHA.test(ficha.compuestoSha256||'')||
    ficha.compuestoBytes!==pdfBytes.length||
    !Number.isSafeInteger(ficha.compuestoPaginas)||ficha.compuestoPaginas<1||
    ficha.compuestoPaginas>2000||
    !sesionOriginal||sesionOriginal.uploadId!==ficha.documentoRecibo||
    typeof sesionOriginal.token!=='string'||sesionOriginal.token.length<16)
  throw Error('PDF privado no autorizado para guardar.');
 const actual=hex(new Uint8Array(await subtle.digest('SHA-256',pdfBytes)));
 if(actual!==ficha.compuestoSha256)
  throw Error('El PDF compuesto cambió luego de generarse.');
 const parts=Math.ceil(pdfBytes.length/CHUNK);
 const start=await consultarFirmado({
  op:'printDraftStart',originalToken:sesionOriginal.token,
  meta:{orderId:ficha.orderId,fileId:ficha.fileId,
   originalReceiptId:ficha.documentoRecibo,
   sha256:actual,bytes:pdfBytes.length,pages:ficha.compuestoPaginas,
   partBytes:CHUNK,parts}
 });
 if(start?.ok!==true||!DOC.test(start.uploadId||'')||
    typeof start.token!=='string'||start.token.length<16||
    start.orderId!==ficha.orderId||start.verified!==false||
    start.paymentAuthorized!==false||start.guardadoEnDrive!==false)
  throw Error('Google no confirmó una sesión privada de borrador.');
 const safe={uploadId:start.uploadId,token:start.token};
 const status=await consultarFirmado({op:'printDraftStatus',...safe});
 if(status?.ok!==true||status.uploadId!==safe.uploadId||
    !Array.isArray(status.acceptedParts)||status.verified!==false||
    !Number.isSafeInteger(status.receivedBytes)||status.receivedBytes<0||
    status.receivedBytes>pdfBytes.length)
  throw Error('Google no confirmó el progreso del borrador.');
 const accepted=new Set(status.acceptedParts);
 if(accepted.size!==status.acceptedParts.length||
    [...accepted].some(n=>!Number.isSafeInteger(n)||n<0||n>=parts)||
    [...accepted].some((n,i)=>n!==i))
  throw Error('El progreso del borrador contiene bloques inconsistentes.');
 for(let index=0;index<parts;index++){
  if(accepted.has(index))continue;
  const startOffset=index*CHUNK;
  const fragment=pdfBytes.subarray(startOffset,Math.min(startOffset+CHUNK,pdfBytes.length));
  const fragmentSha=hex(new Uint8Array(await subtle.digest('SHA-256',fragment)));
  // btoa no recibe Uint8Array: dividir en tramos para no desbordar argumentos.
  let binary='';
  for(let at=0;at<fragment.length;at+=0x6000)
   binary+=String.fromCharCode(...fragment.subarray(at,at+0x6000));
  const response=await consultarFirmado({op:'printDraftPart',...safe,
   index,bytes:fragment.length,sha256:fragmentSha,dataBase64:btoa(binary)});
  if(response?.ok!==true||response.accepted!==true||response.index!==index)
   throw Error('Google rechazó un bloque del PDF compuesto.');
 }
 const done=await consultarFirmado({op:'printDraftFinish',...safe,
  sha256:actual,bytes:pdfBytes.length,parts});
 if(done?.ok!==true||done.received!==true||
    done.sha256!==actual||done.bytes!==pdfBytes.length)
  throw Error('Drive aún no recibió el archivo completo.');
 const committed=await consultarFirmado({op:'printDraftCommitPages',...safe,
  receiptId:safe.uploadId,sha256:actual,bytes:pdfBytes.length,
  pages:ficha.compuestoPaginas,parserVersion:'pdf-lib-1.17.1'});
 if(committed?.ok!==true||committed.receiptId!==safe.uploadId||
    committed.orderId!==ficha.orderId||committed.fileId!==ficha.fileId||
    committed.originalReceiptId!==ficha.documentoRecibo||
    committed.sha256!==actual||committed.bytes!==pdfBytes.length||
    committed.pages!==ficha.compuestoPaginas||
    committed.status!=='stored_private_draft'||committed.storageVerified!==true||
    committed.guardadoEnDrive!==true||
    committed.pdfImprimibleVerificado!==false||
    committed.descargaPrivadaHabilitada!==false||
    committed.paymentAuthorized!==false||
    committed.listoParaProducir!==false)
  throw Error('Google no comprobó el archivo de impresión privado.');
 return Object.freeze({
  schema:'saber-pdf-compuesto-drive-privado-v1',
  orderId:ficha.orderId,fileId:ficha.fileId,
  originalReceiptId:ficha.documentoRecibo,
  borradorReceiptId:safe.uploadId,sha256:actual,
  bytes:pdfBytes.length,pages:ficha.compuestoPaginas,
  guardadoEnDrive:true,pdfImprimibleVerificado:false,
  descargaPrivadaHabilitada:false,
  paymentAuthorized:false,listoParaProducir:false,
  estado:'BORRADOR_VERIFICADO_EN_DRIVE_PAGO_PENDIENTE'
 });
}
