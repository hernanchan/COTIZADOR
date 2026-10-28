/**
 * Librería Saber | Receptor independiente de documentos PDF
 * VERSIÓN SEPARADA NO DESPLEGADA. Permite hasta 30 PDF por pedido, 20 MiB
 * por archivo y 60 MiB acumulados por pedido. Mantiene el piloto antiguo
 * en 1 MiB. No reemplazar Apps Script existente ni activar cobros.
 * No modificar el Apps Script de Polaroids.
 *
 * Propiedades privadas requeridas:
 *   DOCS_RELAY_KEY: secreto compartido con Worker (32+ caracteres)
 *   DOCS_ROOT_FOLDER_ID: carpeta privada de Drive para pedidos web
 * Envíos firmados HMAC-SHA256 desde Worker, no acceso directo del cliente.
 * Los PDFs se envían mediante Drive API v3 resumable upload en bloques 512KiB.
 * El Worker privado confirma las páginas reales con pdf-lib tras el SHA.
 * Ni este receptor ni esta mejora autorizan cobro o producción.
 */
var DOCS_MAX=20*1024*1024,DOCS_PILOT_MAX=1024*1024,DOCS_PART=512*1024,DOCS_TTL=6*86400000;
var DOCS_PILOT_ORDER='WEB-PILOTO-UN-PDF-20261020';
var DOCS_PILOT_FILE='pdf-prueba';
var DOCS_PILOT_SLOT='DOCS_PILOTO_UNICO_20261020';
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
 if(!p||typeof p!=='object'||Array.isArray(p)||!['ping','start','status','part','finish','privatePilotInfo','privateReadPart','privateCommitPages','privateVerifiedStatus','multiStart','multiStartBatch','multiPart','multiStatus','multiFinish','multiInfo','multiReadPart','multiCommitPages','multiVerifiedStatus','printDraftStart','printDraftPart','printDraftStatus','printDraftFinish','printDraftCommitPages','printDraftInfo'].includes(p.op))throw Error('Operación inválida');
 return p;
}
function doGet(){return docsJson({ok:false,error:'Servicio privado de documentos'});}
/**
 * Receptor piloto firmado: sólo permite una sesión de un PDF hasta 1 MiB.
 * Impone límites ANTES de crear archivos o iniciar sesiones en Drive.
 * El código de producción no está habilitado ni se toca Polaroids.
 */
function docsPilotDispatch(p){
 if(p.op==='ping'){
  if(p.purpose!=='saber-docs-hmac-v1')throw Error('Ping no autorizado');
  return {service:'saber-docs-handshake',signed:true,
          receptionEnabled:false,apiVersion:'ping-v1'};
 }
 if(p.op==='multiStart')return docsMultiStart(p);
 if(p.op==='multiStartBatch')return docsMultiStartBatch(p);
 if(p.op==='multiPart')return docsMultiRun(p,'part');
 if(p.op==='multiStatus')return docsMultiRun(p,'status');
 if(p.op==='multiFinish')return docsMultiRun(p,'finish');
 if(p.op==='multiInfo')return docsMultiInfo(p);
 if(p.op==='multiReadPart')return docsMultiReadPart(p);
 if(p.op==='multiCommitPages')return docsMultiCommitPages(p);
 if(p.op==='multiVerifiedStatus')return docsMultiVerifiedStatus(p);
 if(p.op==='printDraftStart')return docsPrintDraftStart(p);
 if(p.op==='printDraftPart')return docsPrintDraftRun(p,'part');
 if(p.op==='printDraftStatus')return docsPrintDraftRun(p,'status');
 if(p.op==='printDraftFinish')return docsPrintDraftRun(p,'finish');
 if(p.op==='printDraftCommitPages')return docsPrintDraftCommitPages(p);
 if(p.op==='printDraftInfo')return docsPrintDraftInfo(p);
 if(p.op==='privatePilotInfo')return docsPrivatePilotInfo(p);
 if(p.op==='privateReadPart')return docsPrivateReadPart(p);
 if(p.op==='privateCommitPages')return docsPrivateCommitPages(p);
 if(p.op==='privateVerifiedStatus')return docsPrivateVerifiedStatus(p);
 var store=docsStore(),used=store.getProperty(DOCS_PILOT_SLOT);
 if(p.op==='start'){
  var m=p.meta;
  if(!m||m.orderId!==DOCS_PILOT_ORDER||m.fileId!==DOCS_PILOT_FILE||
    typeof m.name!=='string'||m.name.length>120||
    !/\.pdf$/i.test(m.name)||!Number.isSafeInteger(m.bytes)||
    m.bytes<5||m.bytes>DOCS_PILOT_MAX||!['bn','color'].includes(m.mode))
    throw Error('Solicitud piloto fuera del cupo');
  if(used){
   var existing=docsRead(used);
   if(existing.orderId!==m.orderId||existing.fileId!==m.fileId||
      existing.sha256!==m.sha256||existing.bytes!==m.bytes||
      existing.mode!==m.mode)
     throw Error('Cupo piloto ya utilizado');
   return {uploadId:existing.uploadId,token:existing.token,
           pilot:true,receiptOnly:true};
  }
  var started=docsStart(p);
  // docsStart persistió la sesión y su huella del PDF.
  store.setProperty(DOCS_PILOT_SLOT,started.uploadId);
  return {uploadId:started.uploadId,token:started.token,
          pilot:true,receiptOnly:true};
 }
 if(!['status','part','finish'].includes(p.op))throw Error('Operación cerrada');
 if(!used||p.uploadId!==used)throw Error('Sesión fuera de piloto');
 var state=docsAuth(p);
 if(state.orderId!==DOCS_PILOT_ORDER||state.fileId!==DOCS_PILOT_FILE||
   state.bytes>DOCS_MAX)throw Error('Sesión fuera de piloto');
 var answer=docsRun(p);
 if(p.op==='finish'&&answer.received){
  answer.pilot=true;
  answer.verified=false;
  answer.pdfPages=null;
 }
 return answer;
}
/** Código de diagnóstico acotado: nunca devolver el mensaje interno ni tokens.
 * Sólo se invoca después de la autenticación HMAC en doPost.
 */
function docsReceptionReasonCode(e){
 var m=String(e&&e.message||'');
 if(m==='Cupo global de ensayo agotado')return 'GLOBAL_CAP';
 if(m==='Límite de 30 archivos o 60 MiB por pedido excedido')return 'ORDER_CAP';
 if(m==='Índice de cupo inconsistente'||m==='Índice sin estado de sesión'||
    m==='Índice con recibo dañado'||m==='Índice de recibo inválido')
   return 'INDEX_INVALID';
 if(m==='Identificador de ensayo en uso')return 'FILE_ID_CONFLICT';
 if(m==='Metadatos de ensayo incorrectos')return 'BAD_META';
 if(m==='Piloto ocupado')return 'BUSY';
 return 'RECEPTOR_ERROR';
}
/** Ejecutable manualmente desde el editor privado de Apps Script.
 * No altera la cuota ni borra recibos; no incluye nombres o credenciales.
 */
function docsMultiCapacityDiagnostico(){
 var sessions=docsMultiIds();
 var orders={};
 for(var i=0;i<sessions.length;i++){
  var s=docsRead(sessions[i]);
  orders[s.orderId]=(orders[s.orderId]||0)+1;
 }
 return {used:sessions.length,globalLimit:DOCS_MULTI_GLOBAL_CAP,
  activeOrders:Object.keys(orders).length,
  maxFilesPerOrder:DOCS_MULTI_CAP,expiryDays:DOCS_TTL/86400000,
  status:sessions.length>=DOCS_MULTI_GLOBAL_CAP?'GLOBAL_CAP':'AVAILABLE'};
}
function doPost(e){
 var lock=LockService.getScriptLock(),signed=false;
 try{
  if(!e||!e.postData||!e.postData.contents)throw Error('Solicitud vacía');
  var p=docsVerifyEnvelope(JSON.parse(e.postData.contents));
  signed=true;
  // Límite de cupo e índice global: sólo multiStart / multiStartBatch
  // necesitan el lock para impedir sobreasignación de sesiones.
  // Cada archivo tiene una única secuencia de carga por el cliente,
  // clave FILE_<uploadId> independiente y sesión Drive independiente.
  // Las operaciones de archivos ya creados pueden progresar a la vez.
  if(['multiInfo','multiReadPart','multiVerifiedStatus',
      'multiPart','multiStatus','multiFinish','multiCommitPages'].includes(p.op))
    return docsJson(Object.assign({ok:true},docsPilotDispatch(p)));
  if(!lock.tryLock(20000))throw Error('Piloto ocupado');
  try{return docsJson(Object.assign({ok:true},docsPilotDispatch(p)));}
  finally{lock.releaseLock();}
 }catch(err){return docsJson({ok:false,receptionEnabled:false,
  error:'La recepción privada no pudo aceptar la operación.',
  errorCode:signed?docsReceptionReasonCode(err):'UNAUTHORIZED'});}
}


// Sólo se accede desde el Worker, en un POST HMAC válido a doPost.
// No hay ninguna ruta del Worker que exponga esta operación o devuelva bytes al navegador.
var DOCS_PRIVATE_CHUNK_BYTES=256*1024;
function docsPilotState(){
 var id=docsStore().getProperty(DOCS_PILOT_SLOT);
 if(!id)throw Error('El piloto todavía no tiene PDF');
 var s=docsRead(id);
 if(s.orderId!==DOCS_PILOT_ORDER||s.fileId!==DOCS_PILOT_FILE||
    !s.driveFileId||s.receiptState!=='bytes_checked'&&s.receiptState!=='pages_verified'||
    !Number.isSafeInteger(s.bytes)||s.bytes<5||s.bytes>DOCS_PILOT_MAX)
    throw Error('PDF piloto no apto para validar');
 return s;
}
function docsPilotBlob(s){
 var bytes=DriveApp.getFileById(s.driveFileId).getBlob().getBytes();
 if(bytes.length!==s.bytes||docsSha(bytes)!==s.sha256)
   throw Error('El contenido de Drive cambió o no coincide');
 return bytes;
}
function docsPrivatePilotInfo(p){
 var s=docsPilotState();
 return {receiptId:s.uploadId,orderId:s.orderId,fileId:s.fileId,
   name:s.name,mode:s.mode,bytes:s.bytes,sha256:s.sha256,
   receiptState:s.receiptState,
   pageVerification:s.pageVerification||null,
   pages:s.pdfPages||null,privateChunkBytes:DOCS_PRIVATE_CHUNK_BYTES};
}
function docsPrivateReadPart(p){
 var s=docsPilotState(),offset=p.offset;
 if(p.receiptId!==s.uploadId||
   !Number.isSafeInteger(offset)||offset<0||offset>=s.bytes||
   offset%DOCS_PRIVATE_CHUNK_BYTES!==0)
   throw Error('Fragmento privado no autorizado');
 var bytes=docsPilotBlob(s),end=Math.min(offset+DOCS_PRIVATE_CHUNK_BYTES,s.bytes);
 var chunk=bytes.slice(offset,end);
 return {privateChunk:true,receiptId:s.uploadId,
   orderId:s.orderId,fileId:s.fileId,name:s.name,mode:s.mode,
   bytes:s.bytes,sha256:s.sha256,offset:offset,length:chunk.length,
   chunkSha256:docsSha(chunk),dataBase64:Utilities.base64Encode(chunk),
   receiptState:s.receiptState};
}
function docsPrivateCommitPages(p){
 var s=docsPilotState();
 if(s.uploadId!==p.receiptId||p.sha256!==s.sha256||p.bytes!==s.bytes||
    !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>20000||
    p.parserVersion!=='pdf-lib-1.17.1')
   throw Error('Validación de páginas inválida');
 // Siempre revalidar los bytes de Drive antes de confirmar páginas.
 docsPilotBlob(s);
 if(s.pageVerification==='server'){
   if(s.pdfPages!==p.pages)throw Error('Conteo diferente de una verificación previa');
 }else{
   s.pdfPages=p.pages;s.pageVerification='server';
   s.pageVerifier='cloudflare-pdf-lib-1.17.1';
   s.pageVerifiedAt=Date.now();
   s.receiptState='pages_verified';docsSave(s);
 }
 return docsPrivateVerifiedStatus({receiptId:s.uploadId});
}
function docsPrivateVerifiedStatus(p){
 var s=docsPilotState();
 if(s.uploadId!==p.receiptId)throw Error('Comprobante ajeno al piloto');
 if(s.pageVerification!=='server'||!Number.isSafeInteger(s.pdfPages)||s.pdfPages<1)
   return {status:'received',verified:false,pages:null,receiptId:s.uploadId,paymentAuthorized:false};
 return {status:'verified',verified:true,
   storageVerified:true,pageVerification:'server',
   orderId:s.orderId,fileId:s.fileId,name:s.name,mode:s.mode,
   bytes:s.bytes,sha256:s.sha256,receiptId:s.uploadId,
   pages:s.pdfPages,paymentAuthorized:false};
}


/**
 * RECEPTOR AMPLIADO EN PRUEBAS: 30 archivos únicos por pedido, <= 20 MiB.
 * Cuenta protegida por LockService en doPost y secreto HMAC ya instalado.
 * NO es receptor de clientes en producción. Sin pagos. No toca el piloto anterior.
 */
var DOCS_MULTI_CAP=30,DOCS_MULTI_GLOBAL_CAP=120,
 DOCS_MULTI_ORDER_MAX_BYTES=60*1024*1024,
 DOCS_MULTI_INDEX='DOCS_MULTI_INDEX_LOTE_20261024';
function docsMultiIds(cleanup){
 // Una lectura de propiedades para todo el índice. Sin esta instantánea,
 // cada bloque de 256 KiB producía hasta 120 lecturas individuales de GAS.
 var store=docsStore(),snapshot=store.getProperties();
 var raw=snapshot[DOCS_MULTI_INDEX]||'[]',list=JSON.parse(raw);
 if(!Array.isArray(list)||list.length>DOCS_MULTI_GLOBAL_CAP)
   throw Error('Índice de cupo inconsistente');
 var seen={},valid=[],now=Date.now();
 for(var i=0;i<list.length;i++){
   var id=list[i];
   if(typeof id!=='string'||!/^DOC-[a-f0-9-]{36}$/i.test(id)||seen[id])
     throw Error('Índice de recibo inválido');
   seen[id]=true;
   var saved=snapshot['FILE_'+id];
   if(!saved)throw Error('Índice sin estado de sesión');
   var state=JSON.parse(saved);
   if(state.uploadId!==id||!Number.isFinite(state.createdAt)||
      !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(state.orderId||'')||
      !Number.isSafeInteger(state.bytes)||state.bytes<5||state.bytes>DOCS_MAX)
     throw Error('Índice con recibo dañado');
   if(now-state.createdAt<=DOCS_TTL)valid.push(id);
 }
 // Sólo el creador de sesiones, con el lock global tomado, puede
 // sanear el índice. No sobrescribirlo desde transferencias paralelas.
 if(cleanup===true&&valid.length!==list.length)
   store.setProperty(DOCS_MULTI_INDEX,JSON.stringify(valid));
 return valid;
}
function docsMultiKnown(id){
 if(!docsMultiIds().includes(id))throw Error('Recibo ajeno a fase 4');
 return docsRead(id);
}
function docsMultiStart(p){
 var m=p.meta;
 if(!m||!/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
    !/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')||typeof m.name!=='string'||m.name.length>120||
    !/\.pdf$/i.test(m.name)||!['bn','color','cad','poster'].includes(m.mode)||
    !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>DOCS_MAX||
    !/^[a-f0-9]{64}$/.test(m.sha256||'')||
    m.partBytes!==DOCS_PART||m.parts!==Math.ceil(m.bytes/DOCS_PART))
   throw Error('Metadatos de ensayo incorrectos');
 var used=docsMultiIds(true);
 // Idempotencia: mismo pedido y mismo PDF vuelven a la sesión existente.
 for(var i=0;i<used.length;i++){
   var old=docsRead(used[i]);
   if(old.orderId===m.orderId&&old.fileId===m.fileId){
     if(old.sha256!==m.sha256||old.bytes!==m.bytes||
        old.name!==m.fileId+'__'+m.name.replace(/[^A-Za-z0-9_. -]/g,'_')||
        old.mode!==m.mode)
       throw Error('Identificador de ensayo en uso');
     return {uploadId:old.uploadId,token:old.token,orderId:old.orderId,
       fileId:old.fileId,newSession:false,
       remainingSlots:DOCS_MULTI_CAP-used.filter(function(id){return docsRead(id).orderId===m.orderId;}).length};
   }
 }
 if(used.length>=DOCS_MULTI_GLOBAL_CAP)
   throw Error('Cupo global de ensayo agotado');
 var count=0,totalBytes=0;
 for(var j=0;j<used.length;j++){
   var receipt=docsRead(used[j]);
   if(receipt.orderId===m.orderId){count++;totalBytes+=receipt.bytes;}
 }
 if(count>=DOCS_MULTI_CAP||totalBytes+m.bytes>DOCS_MULTI_ORDER_MAX_BYTES)
   throw Error('Límite de 30 archivos o 60 MiB por pedido excedido');
 var started=docsStart({meta:m});
 used.push(started.uploadId);
 docsStore().setProperty(DOCS_MULTI_INDEX,JSON.stringify(used));
 // Sólo una sesión recién creada no tiene partes recibidas.
 // Sesiones reanudadas o idempotentes siguen consultando el estado real.
 return {uploadId:started.uploadId,token:started.token,
   orderId:m.orderId,fileId:m.fileId,newSession:true,
   remainingSlots:DOCS_MULTI_CAP-count-1};
}
/**
 * Una sola solicitud HMAC por tanda de hasta 10 archivos.
 * La misma firma Turnstile se comprueba una sola vez en el Worker.
 * Se invoca con lock de cupo GLOBAL; si falla a mitad, reintentar con
 * los mismos fileId es idempotente y recupera los recibos ya creados.
 * No recibe blobs ni cobra: sólo prepara sesiones privadas de Drive.
 */
function docsMultiStartBatch(p){
 var metas=p.metas;
 if(!Array.isArray(metas)||metas.length<1||metas.length>10)
   throw Error('Tanda privada fuera de límites');
 var orderId=null,used=Object.create(null),total=0;
 for(var i=0;i<metas.length;i++){
   var m=metas[i];
   if(!m||typeof m!=='object'||Array.isArray(m)||
      !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
      !/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')||
      !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>DOCS_MAX||
      m.partBytes!==DOCS_PART||m.parts!==Math.ceil(m.bytes/DOCS_PART)||
      !/^[a-f0-9]{64}$/.test(m.sha256||'')||
      !['bn','color','cad','poster'].includes(m.mode)||
      typeof m.name!=='string'||m.name.length>120||!/\.pdf$/i.test(m.name)||
      (orderId!==null&&m.orderId!==orderId)||used[m.fileId])
      throw Error('Tanda privada inválida');
   orderId=m.orderId;used[m.fileId]=true;total+=m.bytes;
 }
 if(total>DOCS_MULTI_ORDER_MAX_BYTES)
   throw Error('Tanda excede 60 MiB');
 // Preflight DEL LOTE antes de abrir sesiones Drive: no consumir cupos de
 // una tanda que no entra en el pedido o excede la cuota global.
 var index=docsMultiIds(true),oldCount=0,oldBytes=0,newCount=0,newBytes=0;
 var existing=Object.create(null);
 for(var j=0;j<index.length;j++){
   var previous=docsRead(index[j]);
   if(previous.orderId!==orderId)continue;
   oldCount++;oldBytes+=previous.bytes;
   existing[previous.fileId]=previous;
 }
 for(var k=0;k<metas.length;k++){
   var candidate=metas[k],found=existing[candidate.fileId];
   if(found){
     if(found.sha256!==candidate.sha256||found.bytes!==candidate.bytes||
        found.mode!==candidate.mode||
        found.name!==candidate.fileId+'__'+candidate.name.replace(/[^A-Za-z0-9_. -]/g,'_'))
       throw Error('Identificador de ensayo en uso');
   }else{newCount++;newBytes+=candidate.bytes;}
 }
 if(index.length+newCount>DOCS_MULTI_GLOBAL_CAP||
    oldCount+newCount>DOCS_MULTI_CAP||
    oldBytes+newBytes>DOCS_MULTI_ORDER_MAX_BYTES)
   throw Error('La tanda supera los cupos privados del pedido');
 var sessions=[];
 for(var j=0;j<metas.length;j++){
   var response=docsMultiStart({meta:metas[j]});
   sessions.push({fileId:response.fileId,orderId:response.orderId,
     uploadId:response.uploadId,token:response.token,
     newSession:response.newSession===true});
 }
 return {sessions:sessions,orderId:orderId,receiptOnly:true,
   paymentAuthorized:false};
}
function docsMultiAuth(p){
 var s=docsAuth(p);
 if(!docsMultiIds().includes(s.uploadId)||
    !/^[A-Za-z0-9_-]{1,80}$/.test(s.fileId)||
    !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(s.orderId)||
    s.bytes>DOCS_MAX)throw Error('Sesión fuera del ensayo');
 return s;
}
function docsMultiRun(p,action){
 var s=docsMultiAuth(p),body={uploadId:s.uploadId,token:p.token};
 if(action==='part')return docsPart(p);
 if(action==='status')return docsStatus(body);
 if(action==='finish'){
   if(s.receiptState==='pages_verified')return {received:true,verified:true,
     bytes:s.bytes,sha256:s.sha256,receiptId:s.uploadId,pdfPages:s.pdfPages,
     paymentAuthorized:false};
   return docsFinish(p);
 }
 throw Error('Operación no prevista');
}
function docsMultiInfo(p){
 var s=docsMultiAuth(p);
 if(s.receiptState!=='bytes_checked'&&s.receiptState!=='pages_verified')
   throw Error('PDF todavía no comprobado en Drive');
 if(!s.driveFileId)throw Error('No existe archivo Drive comprobado');
 return {receiptId:s.uploadId,orderId:s.orderId,fileId:s.fileId,
   name:s.name,mode:s.mode,bytes:s.bytes,sha256:s.sha256,
   pages:s.pdfPages||null,pageVerification:s.pageVerification||null,
   receiptState:s.receiptState,privateChunkBytes:DOCS_PRIVATE_CHUNK_BYTES};
}
function docsMultiReadPart(p){
 var s=docsMultiAuth(p),offset=p.offset;
 if(p.receiptId!==s.uploadId||!s.driveFileId||
    s.receiptState!=='bytes_checked'&&s.receiptState!=='pages_verified'||
    !Number.isSafeInteger(offset)||offset<0||offset>=s.bytes||
    offset%DOCS_PRIVATE_CHUNK_BYTES!==0)throw Error('Lectura no autorizada');
 // Drive API v3 entrega rangos de archivos PDF tipo blob (HTTP 206).
 // No descargar el PDF entero decenas de veces para leer 256 KiB.
 var end=Math.min(s.bytes,offset+DOCS_PRIVATE_CHUNK_BYTES);
 var url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(s.driveFileId)+'?alt=media';
 var response=docsApi(url,'get',{'Range':'bytes='+offset+'-'+(end-1)},undefined);
 if(response.getResponseCode()!==206)
   throw Error('Google no confirmó una descarga parcial privada');
 var range=String(docsHeader(response,'Content-Range')||'');
 if(range!=='bytes '+offset+'-'+(end-1)+'/'+s.bytes)
   throw Error('Rango de Drive incoherente con el recibo');
 var chunk=response.getBlob().getBytes();
 if(chunk.length!==end-offset)throw Error('Fragmento privado incompleto');
 return {receiptId:s.uploadId,offset:offset,length:chunk.length,
   bytes:s.bytes,sha256:s.sha256,chunkSha256:docsSha(chunk),
   dataBase64:Utilities.base64Encode(chunk)};
}
function docsMultiCommitPages(p){
 var s=docsMultiAuth(p);
 if(s.uploadId!==p.receiptId||p.bytes!==s.bytes||p.sha256!==s.sha256||
    p.parserVersion!=='pdf-lib-1.17.1'||!Number.isSafeInteger(p.pages)||
    p.pages<1||p.pages>20000||
    s.receiptState!=='bytes_checked'&&s.receiptState!=='pages_verified')
   throw Error('Conteo de páginas no autorizado');
 // docsFinish ya comprobó SHA-256 de bytes REALES de Drive y lo guardó.
 // El Worker HMAC volvió a leer íntegramente el PDF para contar sus páginas.
 // No descargar otra vez todo el archivo en el commit de esas páginas.
 // Sesiones antiguas sin marca SHA: una última verificación para compatibilidad.
 if(!s.driveFileId||s.offset!==s.bytes)
   throw Error('PDF sin finalización íntegra en Drive');
 if(s.storageSha256Checked!==s.sha256||
    !Number.isFinite(s.storageSha256CheckedAt)){
   docsPilotBlob(s);
   s.storageSha256Checked=s.sha256;
   s.storageSha256CheckedAt=Date.now();
   docsSave(s);
 }
 if(s.pageVerification==='server'){
   if(s.pdfPages!==p.pages)throw Error('Conteos de páginas incompatibles');
 }else{
   s.pdfPages=p.pages;s.pageVerification='server';
   s.pageVerifier='cloudflare-pdf-lib-1.17.1';s.pageVerifiedAt=Date.now();
   s.receiptState='pages_verified';docsSave(s);
 }
 return docsMultiVerifiedStatus({uploadId:s.uploadId,token:p.token});
}
function docsMultiVerifiedStatus(p){
 var s=docsMultiAuth(p);
 if(s.pageVerification!=='server'||!Number.isSafeInteger(s.pdfPages)||s.pdfPages<1||
    s.receiptState!=='pages_verified')
   return {status:'received',verified:false,receiptId:s.uploadId,
     pages:null,paymentAuthorized:false};
 return {status:'verified',verified:true,storageVerified:true,
   pageVerification:'server',orderId:s.orderId,fileId:s.fileId,
   name:s.name,mode:s.mode,bytes:s.bytes,sha256:s.sha256,
   receiptId:s.uploadId,pages:s.pdfPages,paymentAuthorized:false};
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
 // Fast path: cada ACK de Drive actualiza y guarda el offset.
 // Consultar al servidor sólo ante reintentos, saltos o estados dudosos.
 var known=Number.isSafeInteger(s.offset)&&s.offset>=0&&s.offset<=s.bytes;
 var directo=known&&s.offset===start&&s.receiptState==='receiving'&&
   typeof s.sessionUrl==='string'&&s.sessionUrl.length>0&&!s.driveFileId;
 var offset=directo?start:docsProbe(s);
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
 if(r.getResponseCode()!==308){
  // Si se perdió el ACK previo, Drive pudo avanzar mientras GAS no guardó
  // ese avance. Consultar el estado REAL antes de rechazar o reintentar.
  var real=docsProbe(s);
  if(real>=end)return {accepted:true,index:p.index};
  throw Error('Drive no confirmó la parte');
 }
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
 // Checkpoint de integridad persistente; no lo inventa el navegador.
 s.storageSha256Checked=s.sha256;s.storageSha256CheckedAt=Date.now();
 s.receiptState='bytes_checked';docsSave(s);
 return docsAwaitPages(s);
}
function docsAwaitPages(s){
 // No declarar el pedido cobrable hasta implementar conteo de páginas en backend.
 return {received:true,verified:false,bytes:s.bytes,sha256:s.sha256,
  receiptId:s.uploadId,pdfPages:null,reason:'pending_server_page_validation'};
}
function docsRun(p){
 if(p.op==='start')return docsStart(p);
 if(p.op==='status')return docsStatus(p);
 if(p.op==='part')return docsPart(p);
 if(p.op==='finish')return docsFinish(p);
 throw Error('Operación no permitida');
}


/**
 * Canal PRIVADO exclusivamente para PDF compuesto sin pago.
 * HMAC backend + DOCS_PRINT_DRAFT_ENABLED, siempre apagado por defecto.
 * No consume los 30 cupos destinados a PDF originales del cliente.
 */
function docsPrintDraftEnabled(){
 if(docsStore().getProperty('DOCS_PRINT_DRAFT_ENABLED')!=='PRIVATE_TEST_ONLY')
  throw Error('Almacenamiento de PDF compuesto deshabilitado');
}
function docsPrintDraftSession(p){
 docsPrintDraftEnabled();
 var s=docsAuth(p);
 if(s.kind!=='production_draft'||!/^prod-[A-Za-z0-9_-]{1,70}$/.test(s.fileId)||
    !/^DOC-[a-f0-9-]{36}$/i.test(s.originalReceiptId||'')||
    !Number.isSafeInteger(s.expectedPages)||s.expectedPages<1||s.expectedPages>2000)
  throw Error('Sesión no corresponde a un borrador de impresión');
 return s;
}
function docsPrintDraftStart(p){
 docsPrintDraftEnabled();
 var m=p.meta;
 if(!m||!/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
    !/^[A-Za-z0-9_-]{1,70}$/.test(m.fileId||'')||
    !/^DOC-[a-f0-9-]{36}$/i.test(m.originalReceiptId||'')||
    !Number.isSafeInteger(m.pages)||m.pages<1||m.pages>2000||
    !Number.isSafeInteger(m.bytes)||m.bytes<100||m.bytes>DOCS_MAX||
    !/^[a-f0-9]{64}$/.test(m.sha256||'')||
    m.partBytes!==DOCS_PART||m.parts!==Math.ceil(m.bytes/DOCS_PART))
  throw Error('Metadatos del PDF compuesto fuera del contrato');
 var original=docsMultiAuth({uploadId:m.originalReceiptId,token:p.originalToken});
 if(original.kind||original.orderId!==m.orderId||original.fileId!==m.fileId||
    original.receiptState!=='pages_verified'||original.pageVerification!=='server')
  throw Error('El PDF compuesto no corresponde al original verificado');
 var root=DriveApp.getFolderById(docsProp('DOCS_ROOT_FOLDER_ID'));
 if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)
  throw Error('Carpeta de almacenamiento no privada');
 var result=docsStart({meta:{orderId:m.orderId,fileId:'prod-'+m.fileId,
  name:'BORRADOR_IMPRIMIR.pdf',mode:original.mode,bytes:m.bytes,
  sha256:m.sha256,parts:m.parts,partBytes:DOCS_PART}});
 var state=docsRead(result.uploadId);
 if(state.kind&&state.kind!=='production_draft')
  throw Error('Identificador reservado en otra sesión');
 if(state.kind==='production_draft'){
  if(state.originalReceiptId!==original.uploadId||state.expectedPages!==m.pages)
   throw Error('Ya existe otro borrador de este documento');
 }else{
  state.kind='production_draft';state.originalReceiptId=original.uploadId;
  state.originalSha256=original.sha256;state.expectedPages=m.pages;
  docsSave(state);
 }
 return {uploadId:state.uploadId,token:result.token,orderId:state.orderId,
  verified:false,guardadoEnDrive:false,paymentAuthorized:false};
}
function docsPrintDraftRun(p,action){
 var s=docsPrintDraftSession(p);
 if(action==='part')return docsPart(p);
 if(action==='status')return docsStatus(p);
 if(action==='finish'){
  if(s.receiptState==='pages_verified')return Object.assign({received:true},docsPrintDraftInfo(p));
  return docsFinish(p);
 }
 throw Error('Operación de borrador desconocida');
}
function docsPrintDraftCommitPages(p){
 var s=docsPrintDraftSession(p);
 if(s.receiptState!=='bytes_checked'&&s.receiptState!=='pages_verified')
  throw Error('El archivo todavía no fue comprobado en Drive');
 if(p.receiptId!==s.uploadId||p.sha256!==s.sha256||p.bytes!==s.bytes||
    p.parserVersion!=='pdf-lib-1.17.1'||p.pages!==s.expectedPages)
  throw Error('El compositor y el PDF recibido no coinciden');
 // Descargar desde Drive, verificar SHA real y nunca aceptar sólo un OK.
 docsPilotBlob(s);
 if(s.receiptState==='pages_verified'){
  if(s.pdfPages!==p.pages)throw Error('Conteo final incompatible');
 }else{
  s.pdfPages=p.pages;s.pageVerification='server';
  s.receiptState='pages_verified';s.pageVerifiedAt=Date.now();docsSave(s);
 }
 return docsPrintDraftInfo(p);
}
function docsPrintDraftInfo(p){
 var s=docsPrintDraftSession(p);
 if(!s.driveFileId||s.receiptState!=='pages_verified'||
    s.pageVerification!=='server'||s.pdfPages!==s.expectedPages)
  throw Error('PDF privado todavía no verificado');
 return {receiptId:s.uploadId,orderId:s.orderId,
  fileId:s.fileId.substring(5),originalReceiptId:s.originalReceiptId,
  sha256:s.sha256,bytes:s.bytes,pages:s.pdfPages,
  status:'stored_private_draft',storageVerified:true,
  guardadoEnDrive:true,pdfImprimibleVerificado:false,
  paymentAuthorized:false,listoParaProducir:false,
  descargaPrivadaHabilitada:false};
}
