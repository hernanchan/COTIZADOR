import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs',import.meta.url),'utf8');
const secret='test-new-gas-private-bridge-secret-2026';
const MiB=1024*1024;
const sha=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');

function setup(){
 const properties=new Map([['DOCS_RELAY_KEY',secret],['DOCS_ROOT_FOLDER_ID','ROOT']]);
 let uploads=0,rangeRequests=0,wrongRange=false,propReads=0,bulkReads=0;
 const payloads=new Map(),uploadParts=new Map();
 const response=(code,headers={},bytes=Buffer.alloc(0),body='')=>({
  getResponseCode:()=>code,getAllHeaders:()=>headers,
  getBlob:()=>({getBytes:()=>Array.from(bytes)}),getContentText:()=>body
 });
 const utilities={
  DigestAlgorithm:{SHA_256:'SHA_256'},getUuid:randomUUID,
  newBlob:s=>({getBytes:()=>Array.from(Buffer.from(s))}),
  base64Decode:s=>Array.from(Buffer.from(s,'base64')),
  base64Encode:a=>Buffer.from(a).toString('base64'),
  computeDigest:(_,v)=>Array.from(createHash('sha256').update(Buffer.from(v)).digest()),
  computeHmacSha256Signature:(message,k)=>Array.from(createHmac('sha256',k).update(message).digest())
 };
 const env={
  Utilities:utilities,Date,Math,JSON,console,
  PropertiesService:{getScriptProperties:()=>({
   getProperty:k=>(propReads++,properties.get(k)||null),
   getProperties:()=> (bulkReads++,Object.fromEntries(properties)),
   setProperty:(k,v)=>properties.set(k,String(v))
  })},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  ScriptApp:{getOAuthToken:()=> 'TEST_OAUTH'},
  DriveApp:{
   Access:{PRIVATE:'private'},
   getFolderById:()=>({getSharingAccess:()=> 'private',
    createFolder:name=>({getId:()=> 'private-'+name})}),
   getFileById:id=>({getBlob:()=>({getBytes:()=>Array.from(payloads.get(id)||[])})})
  },
  ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({
   body,setMimeType(){return this}
  })},
  UrlFetchApp:{fetch(url,opt){
   if(opt.method==='post'&&url.includes('uploadType=resumable')){
    uploads++;
    return response(200,{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id='+uploads});
   }
   if(opt.method==='put'&&url.includes('upload_id=')){
    const id=url.split('upload_id=')[1],header=opt.headers['Content-Range'];
    let uploaded=uploadParts.get(id)||Buffer.alloc(0);
    if(/^bytes \*\/\d+$/.test(header)){
     if(uploaded.length){
      return response(308,{Range:'bytes=0-'+(uploaded.length-1)});
     }
     return response(308);
    }
    const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(header);
    assert.ok(match,'Drive recibió Content-Range inválido: '+header);
    const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);
    assert.equal(start,uploaded.length);
    const part=Buffer.from(opt.payload);
    assert.equal(part.length,end-start+1);
    uploaded=Buffer.concat([uploaded,part]);uploadParts.set(id,uploaded);
    if(uploaded.length===total){
     const fileId='DRAFTFILE'+id;
     payloads.set(fileId,uploaded);
     return response(200,{},Buffer.alloc(0),JSON.stringify({id:fileId}));
    }
    return response(308,{Range:'bytes=0-'+(uploaded.length-1)});
   }
   if(opt.method==='get'&&url.includes('?alt=media')){
    const data=payloads.get(url.split('/files/')[1].split('?')[0]);
    assert.ok(data);
    if(!opt.headers.Range)return response(200,{},data);
    rangeRequests++;
    const match=/^bytes=(\d+)-(\d+)$/.exec(opt.headers.Range);
    assert.ok(match);
    const start=Number(match[1]),end=Number(match[2]);
    assert.ok(end<data.length);
    const headers={'Content-Range':wrongRange?'bytes 0-0/1':'bytes '+start+'-'+end+'/'+data.length};
    return response(206,headers,data.subarray(start,end+1));
   }
   throw Error('No networking in tests: '+url);
  }}
 };
 const ctx=vm.createContext(env);
 vm.runInContext(source,ctx,{filename:'DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs'});
 function call(payload){
  const payloadJson=JSON.stringify(payload),timestamp=Date.now();
  const envelope={payloadJson,timestamp,
   signature:createHmac('sha256',secret).update(timestamp+'\n'+payloadJson).digest('hex')};
  return JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(envelope)}}).body);
 }
 const createMeta=(fileId,{orderId='WEB-PRUEBA-LOTE-20261024',bytes=MiB+5,mode='bn'}={})=>({
  orderId,fileId,name:fileId+'.pdf',mode,bytes,
  sha256:'a'.repeat(64),partBytes:512*1024,parts:Math.ceil(bytes/(512*1024))
 });
 return {call,createMeta,properties,payloads,
  stats:()=>({uploads,rangeRequests,propReads,bulkReads}),
  resetReads:()=>{propReads=0;bulkReads=0},
  brokenRange:value=>{wrongRange=value}};
}
test('30 archivos únicos en el mismo pedido, idempotencia y 31.º bloqueado',()=>{
 const t=setup();
 const first=t.call({op:'multiStart',meta:t.createMeta('archivo01',{mode:'cad'})});
 assert.equal(first.ok,true,JSON.stringify(first));
 assert.equal(first.remainingSlots,29);
 const retry=t.call({op:'multiStart',meta:t.createMeta('archivo01',{mode:'cad'})});
 assert.equal(retry.uploadId,first.uploadId);
 assert.equal(t.stats().uploads,1);
 const different=t.call({op:'multiStart',meta:{...t.createMeta('archivo01',{mode:'cad'}),sha256:'b'.repeat(64)}});
 assert.equal(different.ok,false);
 for(let i=2;i<=30;i++){
  const next=t.call({op:'multiStart',meta:t.createMeta('archivo'+String(i).padStart(2,'0'),{bytes:512*1024})});
  assert.equal(next.ok,true,'Número '+i+': '+JSON.stringify(next));
  assert.equal(next.remainingSlots,30-i);
 }
 assert.equal(t.stats().uploads,30);
 const over=t.call({op:'multiStart',meta:t.createMeta('archivo31',{bytes:512*1024})});
 assert.equal(over.ok,false);
});
test('20 MiB por archivo y límite de 60 MiB por pedido, sin escrituras al fallar',()=>{
 const t=setup();
 for(let i=0;i<3;i++){
  const next=t.call({op:'multiStart',meta:t.createMeta('peso'+i,{bytes:20*MiB,mode:'poster'})});
  assert.equal(next.ok,true,JSON.stringify(next));
 }
 assert.equal(t.call({op:'multiStart',meta:t.createMeta('supera',{bytes:MiB})}).ok,false);
 assert.equal(t.call({op:'multiStart',meta:t.createMeta('muy-grande',
  {orderId:'WEB-OTRA-PRUEBA-20261024',bytes:20*MiB+1})}).ok,false);
 assert.equal(t.stats().uploads,3);
});
test('lectura parcial usa Range 206, checksum y rechaza Content-Range incorrecto',()=>{
 const t=setup(),bytes=Buffer.alloc(MiB+37);
 bytes.write('%PDF-1.7\n');
 for(let i=9;i<bytes.length;i++)bytes[i]=i%221;
 const meta={...t.createMeta('lote01',{bytes:bytes.length}),sha256:sha(bytes)};
 const started=t.call({op:'multiStart',meta});
 assert.equal(started.ok,true);
 const session=JSON.parse(t.properties.get('FILE_'+started.uploadId));
 session.receiptState='bytes_checked';session.driveFileId='DRIVE_PRIVATE_TEST';
 t.properties.set('FILE_'+started.uploadId,JSON.stringify(session));
 t.payloads.set(session.driveFileId,bytes);
 const req={uploadId:started.uploadId,token:started.token,receiptId:started.uploadId};
 const info=t.call({op:'multiInfo',...req});
 assert.equal(info.ok,true);
 assert.equal(info.privateChunkBytes,256*1024);
 const result=t.call({op:'multiReadPart',...req,offset:256*1024});
 assert.equal(result.ok,true);
 const fragment=bytes.subarray(256*1024,512*1024);
 assert.equal(Buffer.from(result.dataBase64,'base64').compare(fragment),0);
 assert.equal(result.chunkSha256,sha(fragment));
 assert.equal(t.stats().rangeRequests,1);
 t.brokenRange(true);
 assert.equal(t.call({op:'multiReadPart',...req,offset:0}).ok,false);
 assert.equal(t.call({op:'multiReadPart',...req,offset:17}).ok,false);
});


test('cada lectura privada usa un índice compacto aunque existan 110 sesiones',()=>{
 const t=setup();
 const bytes=Buffer.alloc(1024*1024+29);
 bytes.write('%PDF-1.7\n');
 const meta={...t.createMeta('principal',{bytes:bytes.length}),sha256:sha(bytes)};
 const created=t.call({op:'multiStart',meta});
 assert.equal(created.ok,true);
 const state=JSON.parse(t.properties.get('FILE_'+created.uploadId));
 state.receiptState='bytes_checked';
 state.driveFileId='RANGE_FILE';
 t.properties.set('FILE_'+created.uploadId,JSON.stringify(state));
 t.payloads.set('RANGE_FILE',bytes);
 const ids=[created.uploadId];
 for(let i=0;i<109;i++){
  const uploadId='DOC-'+randomUUID();
  ids.push(uploadId);
  t.properties.set('FILE_'+uploadId,JSON.stringify({
   uploadId,orderId:'WEB-OTRO-LOTE-20261024',fileId:'f'+i,
   bytes:1200,createdAt:Date.now(),receiptState:'receiving'
  }));
 }
 t.properties.set('DOCS_MULTI_INDEX_LOTE_20261024',JSON.stringify(ids));
 t.resetReads();
 const result=t.call({op:'multiReadPart',uploadId:created.uploadId,
  token:created.token,receiptId:created.uploadId,offset:0});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(t.stats().bulkReads,1);
 assert.ok(t.stats().propReads<=3,
  'No se debe leer una propiedad por cada sesión activa');
 assert.equal(t.stats().rangeRequests,1);
 assert.equal(Buffer.from(result.dataBase64,'base64').length,256*1024);
 assert.ok(!JSON.stringify(result).includes(secret),'Nunca exponer clave HMAC');
});



test('borrador compuesto: original verificado → subida por bloques → SHA Drive → reintento',async()=>{
 const {webcrypto}=await import('node:crypto');
 const {guardarPdfCompuestoPrivado}=await import('../integraciones/autocotizador/recepcion/guardar-pdf-compuesto-privado.mjs');
 const t=setup(),orderId='WEB-PRUEBA-LOTE-20261024';
 const m=t.createMeta('original-v1',{orderId,bytes:1024*1024+1});
 const original=t.call({op:'multiStart',meta:m});
 assert.equal(original.ok,true,JSON.stringify(original));
 const originState=JSON.parse(t.properties.get('FILE_'+original.uploadId));
 originState.receiptState='pages_verified';originState.pageVerification='server';
 originState.pdfPages=3;originState.driveFileId='FILE_ORIGINAL';
 t.properties.set('FILE_'+original.uploadId,JSON.stringify(originState));
 const composed=Buffer.alloc(590000,32);
 composed.write('%PDF-1.7\n');
 composed.write('%%EOF',composed.length-5);
 const digest=sha(composed);
 const ficha={schema:'saber-borrador-pdf-impresion-privado-v1',
  estado:'COMPUESTO_EN_MEMORIA_PENDIENTE_DE_DRIVE',
  orderId,fileId:m.fileId,documentoRecibo:original.uploadId,
  compuestoSha256:digest,compuestoBytes:composed.length,compuestoPaginas:4,
  guardadoEnDrive:false,pdfImprimibleVerificado:false,
  descargaPrivadaHabilitada:false,paymentAuthorized:false,listoParaProducir:false};
 const consultarFirmado=async p=>t.call(p);
 const args={pdfBytes:new Uint8Array(composed),ficha,
  sesionOriginal:{uploadId:original.uploadId,token:original.token},
  consultarFirmado,habilitado:'PRIVATE_TEST_ONLY',subtle:webcrypto.subtle};
 const countBefore=t.stats().uploads;
 await assert.rejects(guardarPdfCompuestoPrivado({...args,habilitado:''}),/no autorizado/);
 assert.equal(t.stats().uploads,countBefore);
 assert.equal(t.call({op:'printDraftStart',originalToken:original.token,meta:{
  orderId,fileId:m.fileId,originalReceiptId:original.uploadId,
  sha256:digest,bytes:composed.length,pages:4,partBytes:512*1024,parts:2
 }}).ok,false,'La guarda en Apps Script también comienza apagada');
 assert.equal(t.stats().uploads,countBefore);
 t.properties.set('DOCS_PRINT_DRAFT_ENABLED','PRIVATE_TEST_ONLY');
 const saved=await guardarPdfCompuestoPrivado(args);
 assert.equal(saved.schema,'saber-pdf-compuesto-drive-privado-v1');
 assert.equal(saved.orderId,orderId);
 assert.equal(saved.originalReceiptId,original.uploadId);
 assert.equal(saved.sha256,digest);
 assert.equal(saved.bytes,composed.length);
 assert.equal(saved.pages,4);
 assert.equal(saved.guardadoEnDrive,true);
 assert.equal(saved.pdfImprimibleVerificado,false);
 assert.equal(saved.paymentAuthorized,false);
 assert.equal(saved.descargaPrivadaHabilitada,false);
 assert.equal(saved.listoParaProducir,false);
 assert.equal(t.stats().uploads,countBefore+1);
 const savedState=JSON.parse(t.properties.get('FILE_'+saved.borradorReceiptId));
 assert.equal(savedState.kind,'production_draft');
 assert.equal(savedState.originalReceiptId,original.uploadId);
 assert.equal(savedState.receiptState,'pages_verified');
 assert.equal(savedState.pdfPages,4);
 assert.ok(t.payloads.has(savedState.driveFileId));
 assert.equal(sha(t.payloads.get(savedState.driveFileId)),digest);
 const again=await guardarPdfCompuestoPrivado(args);
 assert.equal(again.borradorReceiptId,saved.borradorReceiptId);
 assert.equal(t.stats().uploads,countBefore+1,'No duplicar borrador al reintentar');
 const receipt=t.call({op:'printDraftInfo',uploadId:saved.borradorReceiptId,
  token:savedState.token});
 assert.equal(receipt.ok,true);
 assert.equal(receipt.status,'stored_private_draft');
 assert.ok(!JSON.stringify(saved).includes(savedState.token));
 assert.ok(!JSON.stringify(receipt).includes(savedState.driveFileId));
});
test('rechazar composición alterada y un PDF de otro original antes de tocar Drive',async()=>{
 const {webcrypto}=await import('node:crypto');
 const {guardarPdfCompuestoPrivado}=await import('../integraciones/autocotizador/recepcion/guardar-pdf-compuesto-privado.mjs');
 const t=setup();
 t.properties.set('DOCS_PRINT_DRAFT_ENABLED','PRIVATE_TEST_ONLY');
 const bytes=Uint8Array.from(Buffer.from('%PDF-1.7\n'+' '.repeat(200)+'%%EOF'));
 const sha256=sha(bytes);
 const source={uploadId:'DOC-aaaaaaaa-1234-4234-8234-1234567890ab',token:'source-secret-not-real'};
 const ficha={schema:'saber-borrador-pdf-impresion-privado-v1',
  estado:'COMPUESTO_EN_MEMORIA_PENDIENTE_DE_DRIVE',
  orderId:'WEB-PRUEBA-LOTE-20261024',fileId:'f1',
  documentoRecibo:source.uploadId,compuestoSha256:sha256,
  compuestoBytes:bytes.length,compuestoPaginas:1,
  guardadoEnDrive:false,pdfImprimibleVerificado:false,
  descargaPrivadaHabilitada:false,paymentAuthorized:false,listoParaProducir:false};
 await assert.rejects(guardarPdfCompuestoPrivado({
  pdfBytes:Uint8Array.from(bytes,b=>b===37?38:b),ficha,
  sesionOriginal:source,consultarFirmado:async p=>t.call(p),
  habilitado:'PRIVATE_TEST_ONLY',subtle:webcrypto.subtle
 }),/cambió/);
 const changed={...ficha,documentoRecibo:'DOC-bbbbbbbb-1234-4234-8234-1234567890ab'};
 await assert.rejects(guardarPdfCompuestoPrivado({
  pdfBytes:bytes,ficha:changed,sesionOriginal:source,
  consultarFirmado:async p=>t.call(p),habilitado:'PRIVATE_TEST_ONLY',
  subtle:webcrypto.subtle
 }),/no autorizado/);
 assert.equal(t.stats().uploads,0);
});
