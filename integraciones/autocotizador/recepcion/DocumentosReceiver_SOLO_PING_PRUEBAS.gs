/**
 * Librería Saber | Receptor independiente de documentos PDF
 * MODO PILOTO DE CONEXIÓN: doPost SÓLO responde ping firmado, NUNCA recibe archivos.
 * No modificar el Apps Script de Polaroids.
 *
 * Propiedades privadas requeridas:
 *   DOCS_RELAY_KEY: secreto compartido con Worker (32+ caracteres)
 *   DOCS_ROOT_FOLDER_ID: carpeta privada de Drive para pedidos web
 * Envíos firmados HMAC-SHA256 desde Worker, no acceso directo del cliente.
 * Los PDFs se envían mediante Drive API v3 resumable upload en bloques 512KiB.
 * Atención: NO hay validador fiable de páginas en backend todavía.
 * Por ello finish confirma bytes, pero NUNCA devuelve verified:true ni permite cobrar.
 */
var DOCS_MAX=20*1024*1024, DOCS_PART=512*1024, DOCS_TTL=6*86400000;
function docsJson(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function docsHex(a){return Array.from(a,function(b){return ('0'+(b&255).toString(16)).slice(-2)}).join('');}
function docsSha(a){return docsHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,a));}
function docsEq(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 var diff=a.length^b.length,n=Math.max(a.length,b.length);
 for(var i=0;i<n;i++)diff|=a.charCodeAt(i%a.length||0)^b.charCodeAt(i%b.length||0);
 return diff===0;
}
function docsProp(k){var v=PropertiesService.getScriptProperties().getProperty(k);if(!v)throw Error('Configuración incompleta');return v;}
function docsVerifyEnvelope(env){
 if(!env||typeof env.payloadJson!=='string'||typeof env.timestamp!=='number'||
    typeof env.signature!=='string'||env.payloadJson.length>1024*1024||
    Math.abs(Date.now()-env.timestamp)>300000)throw Error('Solicitud sin firma');
 var calculated=docsHex(Utilities.computeHmacSha256Signature(env.timestamp+'\n'+env.payloadJson,docsProp('DOCS_RELAY_KEY')));
 if(!docsEq(calculated,env.signature))throw Error('Firma inválida');
 var p=JSON.parse(env.payloadJson);
 if(!p||typeof p!=='object'||Array.isArray(p)||!['ping','start','status','part','finish'].includes(p.op))throw Error('Operación inválida');
 return p;
}
function doGet(){return docsJson({ok:false,error:'Servicio privado de documentos'});}
// Bloqueo fijo: ningún endpoint web puede iniciar ni reanudar subidas de documentos.
var DOCS_RECEPCION_PUBLICA_HABILITADA=false;
function doPost(e){
 try{
  if(!e||!e.postData||!e.postData.contents)throw Error('Solicitud vacía');
  var payload=docsVerifyEnvelope(JSON.parse(e.postData.contents));
  if(payload.op!=='ping'||payload.purpose!=='saber-docs-hmac-v1'||
    DOCS_RECEPCION_PUBLICA_HABILITADA!==false)
    throw Error('Operación bloqueada');
  // Sin DriveApp, UrlFetchApp, subida de partes ni lectura de PDF.
  return docsJson({ok:true,service:'saber-docs-handshake',signed:true,
    receptionEnabled:false,apiVersion:'ping-v1'});
 }catch(_){
  return docsJson({ok:false,receptionEnabled:false,
    error:'Solicitud no autorizada o recepción desactivada'});
 }
}
// Prueba local opcional, ejecutable desde el editor de Apps Script:
function probarPingDocumentosLocal(){
 var k=docsProp('DOCS_RELAY_KEY'),
    payloadJson=JSON.stringify({op:'ping',purpose:'saber-docs-hmac-v1'}),
    timestamp=Date.now();
 var signature=docsHex(Utilities.computeHmacSha256Signature(
   timestamp+'\n'+payloadJson,k));
 var envelope={payloadJson:payloadJson,timestamp:timestamp,signature:signature};
 var accepted=JSON.parse(doPost({postData:{contents:JSON.stringify(envelope)}}).getContent());
 if(!accepted.ok||!accepted.signed||accepted.receptionEnabled!==false)
   throw Error('No se aceptó el ping firmado');
 Logger.log('PRUEBA 1 OK: ping firmado aceptado sin habilitar la recepción');
 envelope.signature='0'.repeat(64);
 var blocked=JSON.parse(doPost({postData:{contents:JSON.stringify(envelope)}}).getContent());
 if(blocked.ok||blocked.receptionEnabled!==false)
   throw Error('Se aceptó una firma inválida');
 Logger.log('PRUEBA 2 OK: firma inválida rechazada');
 envelope.timestamp=timestamp-360000;
 envelope.signature=docsHex(Utilities.computeHmacSha256Signature(
   envelope.timestamp+'\n'+payloadJson,k));
 var expired=JSON.parse(doPost({postData:{contents:JSON.stringify(envelope)}}).getContent());
 if(expired.ok||expired.receptionEnabled!==false)
   throw Error('Se aceptó una firma vencida');
 Logger.log('PRUEBA 3 OK: firma vencida rechazada');
 var uploadPayload=JSON.stringify({op:'start'});
 var uploadSignature=docsHex(Utilities.computeHmacSha256Signature(
   timestamp+'\n'+uploadPayload,k));
 var blockedUpload=JSON.parse(doPost({postData:{contents:JSON.stringify({
   timestamp:timestamp,payloadJson:uploadPayload,signature:uploadSignature
 })}}).getContent());
 if(blockedUpload.ok||blockedUpload.receptionEnabled!==false)
   throw Error('Se aceptó una operación de documentos');
 Logger.log('PRUEBA 4 OK: recepción de PDF cerrada');
}

function docsStore(){return PropertiesService.getScriptProperties();}
function docsRead(id){
 if(typeof id!=='string'||!/^DOC-[a-f0-9-]{36}$/i.test(id))throw Error('Sesión inválida');
 var raw=docsStore().getProperty('FILE_'+id);
 if(!raw)throw Error('Sesión no registrada');
 var state=JSON.parse(raw);
 if(Date.now()-state.createdAt>DOCS_TTL)throw Error('Sesión vencida');
 return state;
}
function docsSave(s){docsStore().setProperty('FILE_'+s.uploadId,JSON.stringify(s));}
function docsAuth(p){var s=docsRead(p.uploadId);if(!p.token||!docsEq(p.token,s.token))throw Error('Acceso denegado');return s;}
function docsApi(url,method,headers,body){
 var args={method:method,headers:Object.assign({Authorization:'Bearer '+ScriptApp.getOAuthToken()},headers||{}),
           muteHttpExceptions:true,followRedirects:false};
 if(body!==undefined)args.payload=body;
 return UrlFetchApp.fetch(url,args);
}
function docsHeader(response,key){
 var all=response.getAllHeaders();
 for(var k in all)if(k.toLowerCase()===key.toLowerCase())return Array.isArray(all[k])?all[k][0]:all[k];
 return null;
}
function docsFolder(orderId){
 var props=docsStore(),key='FOLDER_'+orderId,old=props.getProperty(key);
 if(old)return old;
 var folder=DriveApp.getFolderById(docsProp('DOCS_ROOT_FOLDER_ID')).createFolder(orderId);
 props.setProperty(key,folder.getId());
 return folder.getId();
}
function docsStart(p){
 var m=p.meta;
 if(!m||!/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
  !/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')||
  typeof m.name!=='string'||m.name.length>160||!/\.pdf$/i.test(m.name)||
  !['bn','color','cad','poster'].includes(m.mode)||
  !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>DOCS_MAX||
  !/^[a-f0-9]{64}$/.test(m.sha256||'')||
  m.partBytes!==DOCS_PART||m.parts!==Math.ceil(m.bytes/DOCS_PART))
  throw Error('Datos PDF inválidos');
 var props=docsStore(),index='INDEX_'+docsSha(Utilities.newBlob(m.orderId+'\n'+m.fileId).getBytes()).slice(0,40);
 var previous=props.getProperty(index);
 if(previous){
  var old=docsRead(previous);
  if(old.sha256!==m.sha256||old.mode!==m.mode||old.bytes!==m.bytes||
     old.orderId!==m.orderId||old.fileId!==m.fileId)throw Error('Identificador en uso');
  return {uploadId:old.uploadId,token:old.token};
 }
 var safeName=m.fileId+'__'+m.name.replace(/[^A-Za-z0-9_. -]/g,'_');
 var folderId=docsFolder(m.orderId);
 var metadata={name:safeName,mimeType:'application/pdf',parents:[folderId],
   appProperties:{source:'SABER_WEB_DOCUMENTS',orderId:m.orderId,fileId:m.fileId}};
 var res=docsApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,mimeType',
  'post',{'Content-Type':'application/json; charset=UTF-8',
          'X-Upload-Content-Type':'application/pdf','X-Upload-Content-Length':String(m.bytes)},
  JSON.stringify(metadata));
 var location=docsHeader(res,'Location');
 if(res.getResponseCode()!==200||!location||
    !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/.test(String(location)))
   throw Error('No se inició Drive');
 var uploadId='DOC-'+Utilities.getUuid(),token=Utilities.getUuid()+Utilities.getUuid();
 var s={uploadId:uploadId,token:token,orderId:m.orderId,fileId:m.fileId,
  name:safeName,mode:m.mode,sha256:m.sha256,bytes:m.bytes,parts:m.parts,
  createdAt:Date.now(),sessionUrl:String(location),offset:0,driveFileId:null,
  receiptState:'receiving'};
 docsSave(s);props.setProperty(index,uploadId);
 return {uploadId:uploadId,token:token};
}
function docsProbe(s){
 if(s.driveFileId)return s.bytes;
 var r=docsApi(s.sessionUrl,'put',{'Content-Range':'bytes */'+s.bytes},'');
 if(r.getResponseCode()===200||r.getResponseCode()===201){
  var data=JSON.parse(r.getContentText());
  if(!data.id)throw Error('No hay archivo');
  s.driveFileId=data.id;s.offset=s.bytes;s.receiptState='uploaded';docsSave(s);return s.bytes;
 }
 if(r.getResponseCode()!==308)throw Error('Sesión Drive no recuperable');
 var h=docsHeader(r,'Range'),m=h&&/^bytes=0-(\d+)$/.exec(String(h));
 var offset=m?Number(m[1])+1:0;
 if(!Number.isSafeInteger(offset)||offset<0||offset>s.bytes)throw Error('Estado Drive inválido');
 s.offset=offset;docsSave(s);return offset;
}
function docsStatus(p){
 var s=docsAuth(p),offset=docsProbe(s);
 var received=offset===s.bytes?s.parts:Math.floor(offset/DOCS_PART);
 return {uploadId:s.uploadId,acceptedParts:Array.from({length:received},function(_,i){return i;}),
  receivedBytes:offset,receiptState:s.receiptState,verified:false};
}
function docsPart(p){
 var s=docsAuth(p);
 if(!Number.isSafeInteger(p.index)||p.index<0||p.index>=s.parts||
  typeof p.dataBase64!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256||''))
  throw Error('Parte inválida');
 var start=p.index*DOCS_PART,end=Math.min(start+DOCS_PART,s.bytes);
 if(p.bytes!==end-start||p.dataBase64.length>Math.ceil(DOCS_PART/3)*4+8)throw Error('Longitud incorrecta');
 var bytes=Utilities.base64Decode(p.dataBase64);
 if(bytes.length!==end-start||docsSha(bytes)!==p.sha256)throw Error('Checksum incorrecto');
 var offset=docsProbe(s);
 if(offset>=end)return {accepted:true,index:p.index};
 if(offset<start)throw Error('Parte fuera de orden');
 var remaining=bytes.slice(offset-start);
 var r=docsApi(s.sessionUrl,'put',
  {'Content-Type':'application/pdf','Content-Range':'bytes '+offset+'-'+(end-1)+'/'+s.bytes},
  remaining);
 if(r.getResponseCode()===200||r.getResponseCode()===201){
  var meta=JSON.parse(r.getContentText());
  if(!meta.id)throw Error('Final sin archivo');
  s.driveFileId=meta.id;s.offset=s.bytes;s.receiptState='uploaded';docsSave(s);
  return {accepted:true,index:p.index};
 }
 if(r.getResponseCode()!==308)throw Error('Drive no confirmó la parte');
 var h=docsHeader(r,'Range'),m=h&&/^bytes=0-(\d+)$/.exec(String(h));
 var committed=m?Number(m[1])+1:0;
 s.offset=committed;docsSave(s);
 if(committed<end)throw Error('Drive recibió sólo parte del bloque');
 return {accepted:true,index:p.index};
}
function docsFinish(p){
 var s=docsAuth(p);
 if(s.sha256!==p.sha256||s.bytes!==p.bytes||s.parts!==p.parts)
   throw Error('Resumen no coincide');
 if(s.receiptState==='bytes_checked')return docsAwaitPages(s);
 if(docsProbe(s)!==s.bytes||!s.driveFileId)throw Error('Carga incompleta');
 var u='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(s.driveFileId)+'?alt=media';
 var downloaded=docsApi(u,'get',{},undefined);
 if(downloaded.getResponseCode()!==200)throw Error('Drive no permitió comprobar el PDF');
 var blob=downloaded.getBlob().getBytes();
 if(blob.length!==s.bytes||docsSha(blob)!==s.sha256)throw Error('El PDF de Drive no coincide');
 s.receiptState='bytes_checked';docsSave(s);
 return docsAwaitPages(s);
}
function docsAwaitPages(s){
 // No declarar el pedido cobrable hasta implementar conteo de páginas en backend.
 return {received:true,verified:false,bytes:s.bytes,sha256:s.sha256,
  receiptId:s.uploadId,pdfPages:null,reason:'pending_server_page_validation'};
}
function docsRun(p){
 if(DOCS_RECEPCION_PUBLICA_HABILITADA!==true)throw Error('Recepción bloqueada en ensayo');
 if(p.op==='start')return docsStart(p);
 if(p.op==='status')return docsStatus(p);
 if(p.op==='part')return docsPart(p);
 if(p.op==='finish')return docsFinish(p);
 throw Error('Operación no permitida');
}
