/**
 * Receptor privado EXCLUSIVO para Polaroids Express.
 * GOOGLE DRIVE: un único PDF por POL-..., sin originales, JPG, recortes ni JSON.
 * NO desplegar ni sustituir el Apps Script existente sin aprobación.
 *
 * Propiedades privadas de Apps Script:
 * EXPRESS_PDF_FOLDER_ID = carpeta privada dedicada
 * EXPRESS_PDF_HMAC_KEY = secreto distinto de cualquier clave de Web/Documentos
 */
var EXPRESS_MAX_BYTES_=12*1024*1024;
var EXPRESS_REF_=/^POL-[A-F0-9]{24}$/;
var EXPRESS_SHA_=/^[a-f0-9]{64}$/;
function expressHex_(values){
 return values.map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2)}).join('');
}
function expressEqual_(a,b){
 a=String(a||'');b=String(b||'');
 if(a.length!==b.length)return false;
 var diff=0;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
function expressJson_(value){
 return ContentService.createTextOutput(JSON.stringify(value))
  .setMimeType(ContentService.MimeType.JSON);
}
function expressPdfHash_(bytes){
 return expressHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));
}
function expressVerify_(input,secret){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    !Number.isSafeInteger(input.timestamp)||Math.abs(Date.now()-input.timestamp*1000)>300000||
    typeof input.nonce!=='string'||!/^[a-f0-9-]{36}$/i.test(input.nonce)||
    typeof input.payloadJson!=='string'||input.payloadJson.length>18*1024*1024||
    !EXPRESS_SHA_.test(input.signature||''))
  throw Error('Firma privada no válida.');
 var message=input.timestamp+'\n'+input.nonce+'\n'+input.payloadJson;
 var computed=expressHex_(Utilities.computeHmacSha256Signature(message,secret));
 if(!expressEqual_(computed,input.signature))throw Error('Firma rechazada.');
 return JSON.parse(input.payloadJson);
}
function expressStore_(p,folderId){
 if(!p||p.op!=='guardarPdfExpress'||!EXPRESS_REF_.test(p.referencia||'')||
    !Number.isSafeInteger(p.bytes)||p.bytes<100||p.bytes>EXPRESS_MAX_BYTES_||
    !Number.isSafeInteger(p.paginas)||p.paginas<1||p.paginas>4||
    !Number.isSafeInteger(p.fotos)||p.fotos<1||p.fotos>24||
    p.paginas!==Math.ceil(p.fotos/6)||!EXPRESS_SHA_.test(p.sha256||'')||
    typeof p.pdfBase64!=='string'||p.pdfBase64.length>17*1024*1024)
  throw Error('PDF o número de hojas inválidos.');
 var fileBytes=Utilities.base64Decode(p.pdfBase64);
 if(fileBytes.length!==p.bytes||expressPdfHash_(fileBytes)!==p.sha256||
    fileBytes[0]!==37||fileBytes[1]!==80||fileBytes[2]!==68||
    fileBytes[3]!==70||fileBytes[4]!==45)
  throw Error('PDF distinto del original calculado por el Worker.');
 var tail=fileBytes.slice(-64).map(function(v){return String.fromCharCode((v+256)%256)}).join('');
 if(tail.indexOf('%%EOF')<0)throw Error('PDF sin final válido.');
 var lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('Recepción ocupada. Reintentar.');
 try{
  var folder=DriveApp.getFolderById(folderId);
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
   throw Error('Carpeta de recepción no es privada.');
  var name=p.referencia+'_IMPRIMIR.pdf';
  var existing=folder.getFilesByName(name),found=null;
  while(existing.hasNext()){
   if(found)throw Error('Pedido duplicado en Drive; revisar manualmente.');
   found=existing.next();
  }
  if(found){
   var saved=found.getBlob().getBytes();
   if(saved.length!==p.bytes||expressPdfHash_(saved)!==p.sha256)
    throw Error('Ya existe otro PDF bajo esta referencia.');
  }else{
   var file=folder.createFile(Utilities.newBlob(fileBytes,'application/pdf',name));
   var verify=DriveApp.getFileById(file.getId()).getBlob().getBytes();
   if(verify.length!==p.bytes||expressPdfHash_(verify)!==p.sha256){
    file.setTrashed(true);throw Error('Drive no confirmó el PDF íntegro.');
   }
  }
  // Nunca entregar ID de Drive o URL pública.
  return {ok:true,verified:true,referencia:p.referencia,
   sha256:p.sha256,bytes:p.bytes,paginas:p.paginas,fotos:p.fotos};
 }finally{lock.releaseLock()}
}

/** Lectura posterior para operador autenticado en la Central.
 * La petición HMAC sale exclusivamente del Worker privado. GAS nunca publica
 * links, ni IDs de Drive. La Central verifica SHA completo antes de descargar.
 */
function expressRead_(p,folderId){
 if(!p||p.op!=='leerPdfExpress'||!EXPRESS_REF_.test(p.referencia||'')||
    !EXPRESS_SHA_.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<100||p.bytes>EXPRESS_MAX_BYTES_)
  throw Error('Lectura privada fuera del contrato.');
 var folder=DriveApp.getFolderById(folderId);
 if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
  throw Error('La carpeta no es privada.');
 var name=p.referencia+'_IMPRIMIR.pdf';
 var files=folder.getFilesByName(name),file=null;
 while(files.hasNext()){
  if(file)throw Error('Más de un PDF para la referencia.');
  file=files.next();
 }
 if(!file||file.getMimeType&&file.getMimeType()!=='application/pdf')
  throw Error('PDF privado ausente o incompatible.');
 var buffer=file.getBlob().getBytes();
 if(buffer.length!==p.bytes||expressPdfHash_(buffer)!==p.sha256)
  throw Error('El PDF cambió desde su recepción.');
 if(buffer[0]!==37||buffer[1]!==80||buffer[2]!==68||
    buffer[3]!==70||buffer[4]!==45)
  throw Error('La cabecera del PDF es inválida.');
 return {ok:true,verified:true,referencia:p.referencia,
  sha256:p.sha256,bytes:p.bytes,pdfBase64:Utilities.base64Encode(buffer)};
}

function doPost(e){
 try{
  var properties=PropertiesService.getScriptProperties();
  var key=properties.getProperty('EXPRESS_PDF_HMAC_KEY');
  var folder=properties.getProperty('EXPRESS_PDF_FOLDER_ID');
  if(!key||key.length<32||!folder)throw Error('Receptor no configurado.');
  var source=e&&e.postData&&e.postData.contents;
  if(typeof source!=='string'||source.length>19*1024*1024)
   throw Error('Solicitud no válida.');
  var request=expressVerify_(JSON.parse(source),key);
  if(request.op==='leerPdfExpress')return expressJson_(expressRead_(request,folder));
  return expressJson_(expressStore_(request,folder));
 }catch(_){
  // No filtrar nombres, tokens, IDs o Drive a visitantes no autorizados.
  return expressJson_({ok:false,verified:false,error:'Recepción Express no confirmada.'});
 }
}
