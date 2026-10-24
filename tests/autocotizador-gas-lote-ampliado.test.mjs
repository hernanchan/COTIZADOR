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
 let uploads=0,rangeRequests=0,wrongRange=false;
 const payloads=new Map();
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
   getProperty:k=>properties.get(k)||null,
   setProperty:(k,v)=>properties.set(k,String(v))
  })},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  ScriptApp:{getOAuthToken:()=> 'TEST_OAUTH'},
  DriveApp:{getFolderById:()=>({createFolder:name=>({getId:()=> 'private-'+name})})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({
   body,setMimeType(){return this}
  })},
  UrlFetchApp:{fetch(url,opt){
   if(opt.method==='post'&&url.includes('uploadType=resumable')){
    uploads++;
    return response(200,{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id='+uploads});
   }
   if(opt.method==='get'&&url.includes('?alt=media')){
    assert.ok(opt.headers.Range,'Se debe pedir un fragmento, no el PDF entero');
    rangeRequests++;
    const match=/^bytes=(\d+)-(\d+)$/.exec(opt.headers.Range);
    assert.ok(match);
    const data=payloads.get(url.split('/files/')[1].split('?')[0]);
    assert.ok(data);
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
 return {call,createMeta,properties,payloads,stats:()=>({uploads,rangeRequests}),
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
