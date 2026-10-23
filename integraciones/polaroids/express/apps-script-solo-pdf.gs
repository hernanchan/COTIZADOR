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


/**
 * Prueba de recepción REAL, sin navegador ni Cloudflare:
 * 1) Requiere una carpeta PRIVADA y el secreto HMAC en Propiedades de script.
 * 2) Construye un PDF válido A4 de seis posiciones (sólo dibujos de prueba).
 * 3) Firma el mismo contrato HMAC que usaría el Worker y guarda UN solo PDF.
 * 4) Lo vuelve a leer mediante el contrato privado y verifica SHA y bytes.
 * 5) Puede ejecutarse otra vez: no debe crear otro archivo.
 *
 * Referencia fija de ENSAYO, imposible de confundir con una referencia aleatoria
 * de clientes reales. No envía fotos ni modifica otros archivos en Drive.
 */
function pruebaExpressDriveReal(){
 var props=PropertiesService.getScriptProperties();
 var folderId=props.getProperty('EXPRESS_PDF_FOLDER_ID');
 var key=props.getProperty('EXPRESS_PDF_HMAC_KEY');
 if(!folderId||!key||key.length<32)
  throw Error('Configurar EXPRESS_PDF_FOLDER_ID y EXPRESS_PDF_HMAC_KEY antes del ensayo.');
 var reference='POL-FFFFFFFFFFFFFFFFFFFFFFFF';
 var mm=function(n){return n*72/25.4};
 var commands=['0.5 w','0.1 0.1 0.1 RG'];
 for(var i=0;i<6;i++){
  var col=i%2,row=Math.floor(i/2);
  var x=mm(20+col*85),y=mm(297-13.5-(row+1)*90);
  commands.push(x.toFixed(2)+' '+y.toFixed(2)+' '+mm(85).toFixed(2)+' '+mm(90).toFixed(2)+' re S');
  commands.push('0.92 0.92 0.92 rg');
  commands.push((x+mm(5)).toFixed(2)+' '+(y+mm(90-4-75)).toFixed(2)+' '+mm(75).toFixed(2)+' '+mm(75).toFixed(2)+' re f');
  commands.push('0.1 0.1 0.1 RG');
 }
 commands.push('BT /F1 12 Tf 55 25 Td (POLAROIDS EXPRESS - ENSAYO PRIVADO) Tj ET');
 var stream=commands.join('\n')+'\n';
 var objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
 ];
 var pdf='%PDF-1.4\n';
 var offsets=[0];
 for(var j=0;j<objs.length;j++){
  offsets.push(pdf.length);
  pdf+=(j+1)+' 0 obj\n'+objs[j]+'\nendobj\n';
 }
 var start=pdf.length;
 pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(var k=1;k<offsets.length;k++){
  pdf+=('0000000000'+offsets[k]).slice(-10)+' 00000 n \n';
 }
 pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 var bytes=Utilities.newBlob(pdf,'application/pdf').getBytes();
 var sha=expressPdfHash_(bytes);
 var payload={op:'guardarPdfExpress',referencia:reference,
  bytes:bytes.length,paginas:1,fotos:6,sha256:sha,
  pdfBase64:Utilities.base64Encode(bytes)};
 var build=function(body){
  var timestamp=Math.floor(Date.now()/1000),nonce=Utilities.getUuid();
  var payloadJson=JSON.stringify(body);
  return {timestamp:timestamp,nonce:nonce,payloadJson:payloadJson,
   signature:expressHex_(Utilities.computeHmacSha256Signature(
    timestamp+'\n'+nonce+'\n'+payloadJson,key))};
 };
 var stored=expressStore_(expressVerify_(build(payload),key),folderId);
 if(stored.ok!==true||stored.verified!==true||stored.sha256!==sha)
  throw Error('La carpeta Drive no confirmó el PDF.');
 var read=expressRead_(expressVerify_(build({
  op:'leerPdfExpress',referencia:reference,bytes:bytes.length,sha256:sha
 }),key),folderId);
 if(read.ok!==true||read.verified!==true||
    read.pdfBase64!==Utilities.base64Encode(bytes))
  throw Error('El PDF devuelto por Drive no coincide con el original.');
 var response={ok:true,archivo:reference+'_IMPRIMIR.pdf',
  paginas:1,fotos:6,bytes:bytes.length,sha256:sha,
  recibo:stored.verified,lecturaPrivada:read.verified,
  originalFotosGuardadas:0,recortesSueltosGuardados:0};
 Logger.log(JSON.stringify(response));
 return response;
}
