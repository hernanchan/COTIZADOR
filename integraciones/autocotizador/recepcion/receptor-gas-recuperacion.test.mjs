/**
 * Contrato del receptor GAS sin desplegar: prueba las funciones REALES del .gs
 * dentro de un VM con Drive API, PropertiesService y DriveApp simulados.
 * Ninguna solicitud va a Google; si cambia el protocolo de reanudación falla CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';

const SOURCE=readFileSync(new URL('./DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs',import.meta.url),'utf8');
const PART=512*1024;
const sha=b=>createHash('sha256').update(b).digest('hex');
function environment({n=PART*2+37}={}){
 const bytes=Buffer.alloc(n);
 for(let i=0;i<bytes.length;i++)bytes[i]=(i*19+(i>>10)*13)%256;
 bytes.set(Buffer.from('%PDF-'),0);
 const props=new Map();
 const s={uploadId:'DOC-'+randomUUID(),token:'SIMULATED_SECRET_TOKEN_12345678901234567',
  orderId:'WEB-PRUEBA-GAS-RECUPERACION',fileId:'pdf-ensayo',
  name:'pdf-ensayo__archivo.pdf',mode:'bn',bytes:bytes.length,
  sha256:sha(bytes),parts:Math.ceil(bytes.length/PART),createdAt:Date.now(),
  sessionUrl:'https://upload-drive.test/session/123',offset:0,
  driveFileId:null,receiptState:'receiving'};
 props.set('FILE_'+s.uploadId,JSON.stringify(s));
 props.set('DOCS_MULTI_INDEX_LOTE_20261024',JSON.stringify([s.uploadId]));
 let remote=Buffer.alloc(0),probeCount=0,putCount=0,shaDownloads=0,legacyDownloads=0;
 let readCorrupted=false;
 const response=(status,{headers={},body='',blob=null}={})=>({
  getResponseCode:()=>status,
  getAllHeaders:()=>headers,
  getContentText:()=>typeof body==='string'?body:JSON.stringify(body),
  getBlob:()=>({getBytes:()=>Array.from(blob||remote)})
 });
 const UrlFetchApp={fetch:(url,params)=>{
  const range=params.headers?.['Content-Range']||null;
  if(url===s.sessionUrl&&params.method==='put'){
   if(range===`bytes */${bytes.length}`){
    probeCount++;
    if(remote.length===bytes.length)return response(200,{body:{id:'stored-pdf-123'}});
    return response(308,{headers:remote.length?{Range:'bytes=0-'+(remote.length-1)}:{}});
   }
   putCount++;
   const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(range||'');
   if(!match)throw Error('Rango mal formado');
   const [,a,b,total]=match.map(Number);
   if(total!==bytes.length||a!==remote.length)return response(400);
   const chunk=Buffer.from(params.payload||[]);
   if(chunk.length!==b-a+1)return response(400);
   remote=Buffer.concat([remote,chunk]);
   if(remote.length===bytes.length)return response(200,{body:{id:'stored-pdf-123'}});
   return response(308,{headers:{Range:'bytes=0-'+(remote.length-1)}});
  }
  if(url.includes('https://www.googleapis.com/drive/v3/files/')&&params.method==='get'){
   shaDownloads++;
   if(readCorrupted){
    const corrupt=Buffer.from(remote);
    corrupt[7]^=1;
    return response(200,{blob:corrupt});
   }
   return response(200,{blob:remote});
  }
  throw Error('Solicitud inesperada a Google simulada: '+url);
 }};
 const PropertiesService={getScriptProperties:()=>({
  getProperty:k=>props.get(k)||null,
  setProperty:(k,v)=>props.set(k,v),
  getProperties:()=>Object.fromEntries(props)
 })};
 const DriveApp={getFileById:id=>{
  assert.equal(id,'stored-pdf-123');
  legacyDownloads++;
  return {getBlob:()=>({getBytes:()=>Array.from(remote)})};
 }};
 const Utilities={
  DigestAlgorithm:{SHA_256:'SHA_256'},
  computeDigest:(_a,v)=>Array.from(createHash('sha256').update(Buffer.from(v)).digest()),
  base64Decode:v=>Array.from(Buffer.from(v,'base64')),
  base64Encode:v=>Buffer.from(v).toString('base64')
 };
 const sandbox=vm.createContext({PropertiesService,DriveApp,UrlFetchApp,Utilities,
  ScriptApp:{getOAuthToken:()=>'simulated-token'},console});
 vm.runInContext(SOURCE,sandbox,{filename:'DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs'});
 const state=()=>JSON.parse(props.get('FILE_'+s.uploadId));
 const setState=p=>props.set('FILE_'+s.uploadId,JSON.stringify({...state(),...p}));
 const part=i=>{
  const start=i*PART;
  const fragment=bytes.subarray(start,Math.min(start+PART,bytes.length));
  return {uploadId:s.uploadId,token:s.token,index:i,bytes:fragment.length,
   sha256:sha(fragment),dataBase64:fragment.toString('base64')};
 };
 const finish=()=>({uploadId:s.uploadId,token:s.token,sha256:s.sha256,
  bytes:s.bytes,parts:s.parts});
 const commit=(pages=12)=>({uploadId:s.uploadId,token:s.token,
  receiptId:s.uploadId,sha256:s.sha256,bytes:s.bytes,
  parserVersion:'pdf-lib-1.17.1',pages});
 const counters=()=>({probeCount,putCount,shaDownloads,legacyDownloads});
 const api={sandbox,s,state,setState,part,finish,commit,counters,
  corrupt:()=>{readCorrupted=true},
  addRemote:()=>{throw Error('Not supported')}
 };
 return api;
}

test('3 fragmentos consecutivos no hacen consultas de estado antes de escribir; finish verifica SHA sólo una vez',()=>{
 const x=environment();const {sandbox:g}=x;
 for(let i=0;i<x.s.parts;i++){
  const result=g.docsMultiRun(x.part(i),'part');
  assert.equal(result.accepted,true);
  assert.equal(result.index,i);
 }
 assert.equal(x.counters().probeCount,0,'sin consultas redundantes por bloque');
 assert.equal(x.counters().putCount,x.s.parts);
 assert.equal(x.state().offset,x.s.bytes);
 assert.equal(x.state().receiptState,'uploaded');
 const response=g.docsMultiRun(x.finish(),'finish');
 assert.equal(response.received,true);
 assert.equal(response.verified,false);
 assert.equal(x.state().receiptState,'bytes_checked');
 assert.equal(x.state().storageSha256Checked,x.s.sha256);
 assert.ok(Number.isFinite(x.state().storageSha256CheckedAt));
 assert.equal(x.counters().shaDownloads,1,'SHA completo REAL desde Drive al finalizar');
 const pageResponse=g.docsMultiCommitPages(x.commit());
 assert.equal(pageResponse.status,'verified');
 assert.equal(pageResponse.pages,12);
 assert.equal(pageResponse.paymentAuthorized,false);
 assert.equal(x.counters().shaDownloads,1,'commit de páginas NO descarga otro PDF');
 assert.equal(x.counters().legacyDownloads,0,'no se usa DriveApp.getBlob en el nuevo flujo');
 assert.equal(g.docsMultiCommitPages(x.commit()).status,'verified','confirmar páginas es idempotente');
 assert.equal(x.counters().legacyDownloads,0);
});

test('saltarse un bloque obliga a consultar Drive y rechaza partes fuera de orden',()=>{
 const x=environment();
 assert.throws(()=>x.sandbox.docsMultiRun(x.part(1),'part'),/Parte fuera de orden/);
 assert.equal(x.counters().probeCount,1);
 assert.equal(x.counters().putCount,0);
});

test('reintento después de perder ACK consulta la realidad de Drive y no duplica bloques',()=>{
 const x=environment();
 x.sandbox.docsMultiRun(x.part(0),'part');
 // Simula que Google aceptó el primer bloque pero GAS perdió su guardado.
 x.setState({offset:0,receiptState:'receiving'});
 assert.equal(x.sandbox.docsMultiRun(x.part(0),'part').accepted,true);
 assert.equal(x.counters().probeCount,1,'respuesta 400 de duplicado activa probe seguro');
 assert.equal(x.state().offset,PART,'el probe restituye el offset real');
 assert.equal(x.counters().putCount,2,'un único intento de bloque duplicado');
 for(let i=1;i<x.s.parts;i++)assert.equal(x.sandbox.docsMultiRun(x.part(i),'part').accepted,true);
 assert.equal(x.sandbox.docsMultiRun(x.finish(),'finish').received,true);
 assert.equal(x.sandbox.docsMultiCommitPages(x.commit()).status,'verified');
});

test('reanudación explícita consulta Drive y reconoce partes ya almacenadas',()=>{
 const x=environment();
 x.sandbox.docsMultiRun(x.part(0),'part');
 x.setState({offset:0});
 const remote=x.sandbox.docsMultiRun({uploadId:x.s.uploadId,token:x.s.token},'status');
 assert.equal(remote.receivedBytes,PART);
 assert.deepEqual(Array.from(remote.acceptedParts),[0]);
 assert.equal(x.counters().probeCount,1);
 for(let i=1;i<x.s.parts;i++)x.sandbox.docsMultiRun(x.part(i),'part');
 assert.equal(x.sandbox.docsMultiRun(x.finish(),'finish').received,true);
});

test('SHA de fragmento adulterado no pasa; SHA completo de Drive adulterado no marca bytes_checked',()=>{
 const x=environment();
 const wrong={...x.part(0),sha256:'a'.repeat(64)};
 assert.throws(()=>x.sandbox.docsMultiRun(wrong,'part'),/Checksum incorrecto/);
 assert.equal(x.counters().putCount,0);
 for(let i=0;i<x.s.parts;i++)x.sandbox.docsMultiRun(x.part(i),'part');
 x.corrupt();
 assert.throws(()=>x.sandbox.docsMultiRun(x.finish(),'finish'),/PDF de Drive no coincide/);
 assert.equal(x.state().receiptState,'uploaded');
 assert.equal(x.state().storageSha256Checked,undefined);
 assert.throws(()=>x.sandbox.docsMultiCommitPages(x.commit()),/Conteo de páginas no autorizado/);
});

test('confirmación con páginas o SHA no coincidentes se rechaza y no registra páginas',()=>{
 const x=environment();
 for(let i=0;i<x.s.parts;i++)x.sandbox.docsMultiRun(x.part(i),'part');
 x.sandbox.docsMultiRun(x.finish(),'finish');
 assert.throws(()=>x.sandbox.docsMultiCommitPages({...x.commit(),sha256:'f'.repeat(64)}),/no autorizado/);
 assert.throws(()=>x.sandbox.docsMultiCommitPages({...x.commit(),bytes:x.s.bytes+1}),/no autorizado/);
 assert.equal(x.state().receiptState,'bytes_checked');
 assert.equal(x.sandbox.docsMultiCommitPages(x.commit()).status,'verified');
 assert.throws(()=>x.sandbox.docsMultiCommitPages(x.commit(13)),/incompatibles/);
});

test('sesiones antiguas sin marca SHA pasan por una lectura de compatibilidad y luego no repiten',()=>{
 const x=environment();
 for(let i=0;i<x.s.parts;i++)x.sandbox.docsMultiRun(x.part(i),'part');
 x.sandbox.docsMultiRun(x.finish(),'finish');
 x.setState({storageSha256Checked:undefined,storageSha256CheckedAt:undefined});
 assert.equal(x.sandbox.docsMultiCommitPages(x.commit()).status,'verified');
 assert.equal(x.counters().legacyDownloads,1,'sólo sesión antigua comprueba Drive una vez');
 assert.equal(x.sandbox.docsMultiCommitPages(x.commit()).status,'verified');
 assert.equal(x.counters().legacyDownloads,1);
});

test('GAS indica newSession:true sólo si crea realmente un recibo nuevo',()=>{
 const x=environment();
 const original={orderId:x.s.orderId,fileId:x.s.fileId,name:'archivo.pdf',
  mode:'bn',bytes:x.s.bytes,sha256:x.s.sha256,
  parts:x.s.parts,partBytes:PART};
 const reused=x.sandbox.docsMultiStart({meta:original});
 assert.equal(reused.uploadId,x.s.uploadId);
 assert.equal(reused.newSession,false,'idempotencia nunca saltea el status');
 x.sandbox.docsStart=function({meta}){
  const start={...x.state(),...meta,uploadId:'DOC-'+randomUUID(),
   token:'SECOND_TEST_TOKEN_abcdefghijklmnopqrstuvwxyz',
   name:meta.fileId+'__'+meta.name,offset:0,driveFileId:null,
   receiptState:'receiving',createdAt:Date.now()};
  x.sandbox.docsSave(start);
  return {uploadId:start.uploadId,token:start.token};
 };
 const fresh=x.sandbox.docsMultiStart({meta:{
  ...original,orderId:'WEB-ENSAYO-OTRO-PEDIDO',fileId:'pdf-new'
 }});
 assert.equal(fresh.newSession,true);
 assert.notEqual(fresh.uploadId,reused.uploadId);
 assert.ok(fresh.remainingSlots>0);
});

test('multiStartBatch crea tres recibos separados y permite reintento idempotente después de un inicio parcial',()=>{
 const x=environment();
 let created=0;
 x.sandbox.docsStart=function({meta}){
  created++;
  const item={...x.state(),...meta,
   uploadId:'DOC-'+randomUUID(),token:'BATCH_TEST_TOKEN_0123456789_abcdefghijk',
   name:meta.fileId+'__'+meta.name,offset:0,
   createdAt:Date.now(),sessionUrl:'https://upload-drive.test/session/'+created,
   receiptState:'receiving',driveFileId:null};
  x.sandbox.docsSave(item);
  return {uploadId:item.uploadId,token:item.token};
 };
 const meta=i=>({orderId:x.s.orderId,fileId:'pdf-test-'+i,
  name:'documento'+i+'.pdf',mode:'bn',bytes:100+i,
  sha256:sha(Buffer.from('documento'+i)),parts:1,partBytes:PART});
 const metas=[meta(1),meta(2),meta(3)];
 const a=x.sandbox.docsMultiStartBatch({metas});
 assert.equal(a.sessions.length,3);
 assert.equal(new Set(a.sessions.map(v=>v.uploadId)).size,3);
 assert.equal(a.paymentAuthorized,false);
 assert.ok(a.sessions.every(v=>v.newSession===true));
 const b=x.sandbox.docsMultiStartBatch({metas});
 assert.equal(created,3,'Repetir el lote no duplica sesiones Drive');
 assert.ok(b.sessions.every(v=>v.newSession===false));
 assert.deepEqual(Array.from(b.sessions.map(v=>v.uploadId)),
  Array.from(a.sessions.map(v=>v.uploadId)));
 assert.throws(()=>x.sandbox.docsMultiStartBatch({metas:[meta(1),meta(1)]}),/Tanda privada inválida/);
 assert.throws(()=>x.sandbox.docsMultiStartBatch({metas:[meta(1),
  {...meta(2),orderId:'WEB-OTRO-PEDIDO'}]}),/Tanda privada inválida/);
 assert.throws(()=>x.sandbox.docsMultiStartBatch({metas:Array.from({length:11},(_,i)=>meta(i+10))}),/fuera de límites/);
});

test('bloqueo GAS sólo para crear cupos; partes, finish y commit no mantienen lock global',()=>{
 const x=environment();
 let locked=0;
 x.sandbox.LockService={getScriptLock:()=>({
  tryLock:()=>{locked++;return true},
  releaseLock:()=>{}
 })};
 x.sandbox.docsVerifyEnvelope=o=>o;
 x.sandbox.docsPilotDispatch=o=>({op:o.op});
 x.sandbox.docsJson=o=>o;
 const send=op=>x.sandbox.doPost({postData:{contents:JSON.stringify({op})}});
 for(const op of ['multiPart','multiStatus','multiFinish','multiCommitPages',
   'multiReadPart','multiInfo','multiVerifiedStatus']){
  const r=send(op);
  assert.equal(r.ok,true);
  assert.equal(locked,0,'La operación '+op+' no debe bloquear otros PDF');
 }
 assert.equal(send('multiStartBatch').ok,true);
 assert.equal(locked,1,'El lote sí debe proteger cupos e índice');
 assert.equal(send('multiStart').ok,true);
 assert.equal(locked,2);
});

test('lecturas de índice de archivos existentes no pueden sobreescribir cupos durante cargas concurrentes',()=>{
 const x=environment();
 const src=SOURCE.slice(SOURCE.indexOf('function docsMultiIds('),
  SOURCE.indexOf('function docsMultiKnown('));
 assert.match(src,/if\(cleanup===true&&valid\.length!==list\.length\)/);
 assert.match(SOURCE,/var used=docsMultiIds\(true\);/);
 assert.match(SOURCE,/function docsMultiAuth\(p\)\{[\s\S]*?docsMultiIds\(\)/);
});
