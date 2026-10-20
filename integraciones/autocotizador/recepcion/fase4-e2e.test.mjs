/**
 * Fase 4. Ensayo completo contra Worker compilado, con Google/Turnstile simulados.
 * Ejecutar después de npm run build:unificado. NO hace envíos reales.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID,webcrypto} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import worker from './dist/saber-documentos-cotizador-fase4.mjs';

globalThis.crypto ??= webcrypto;
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const relayKey='FAKE_key_only_for_mock_0123456789_abcdefghijklmnopqrstuvwxyz';
const env={DOCS_RELAY_KEY:relayKey,DOCS_ALLOWED_ORIGIN:origin,
 DOCS_SCRIPT_URL:'https://script.google.com/macros/s/FAKE_PHASE4/exec',
 DOCS_TURNSTILE_SECRET:'fake-turnstile-secret',DOCS_TURNSTILE_SITE_KEY:'0x4AAAA-test-0123456789',
 DOCS_PING_ENABLED:'false',DOCS_UPLOAD_ENABLED:'false'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sessions=new Map(), orders=new Map();
let pending,googleCalls=0,turnstileSuccess=true;
function auth(p){const s=sessions.get(p.uploadId);
 if(!s||p.token!==s.token)throw Error('Sesión sin autorización');
 return s;}
function receipt(s) {
 return {ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',orderId:s.orderId,fileId:s.fileId,name:s.name,
 mode:s.mode,bytes:s.bytes,sha256:s.sha256,receiptId:s.uploadId,
 pages:s.pages,paymentAuthorized:false};
}
function dispatch(p){
 if(p.op==='multiStart'){
  const m=p.meta;
  assert.match(m.orderId,/^WEB-ENSAYO-[A-F0-9]{16}$/);
  let s=orders.get(m.orderId);
  if(s){
   if(s.sha256!==m.sha256)throw Error('Idempotencia violada');
  }else{
   s={uploadId:'DOC-'+randomUUID(),token:'token-for-test-abcdefghijklmnopqrstuvwxyz',orderId:m.orderId,
      fileId:m.fileId,name:m.fileId+'__'+m.name,mode:m.mode,bytes:m.bytes,
      sha256:m.sha256,parts:m.parts,received:[],pageVerification:null,pages:null};
   orders.set(m.orderId,s);sessions.set(s.uploadId,s);
  }
  return {ok:true,uploadId:s.uploadId,token:s.token,orderId:s.orderId};
 }
 const s=auth(p);
 if(p.op==='multiStatus')return {ok:true,acceptedParts:s.received.map((_,i)=>i),receivedBytes:s.received.reduce((x,b)=>x+b.length,0),verified:false};
 if(p.op==='multiPart'){
  const bytes=Buffer.from(p.dataBase64,'base64');
  if(sha(bytes)!==p.sha256)throw Error('SHA of chunk not valid');
  s.received[p.index]=bytes;
  return {ok:true,accepted:true,index:p.index};
 }
 if(p.op==='multiFinish'){
  const bytes=Buffer.concat(s.received);
  if(bytes.length!==p.bytes||sha(bytes)!==p.sha256)throw Error('File SHA not valid');
  s.stored=bytes;s.receiptState='bytes_checked';
  return {ok:true,received:true,verified:false,receiptId:s.uploadId};
 }
 if(p.op==='multiInfo'){
  if(!s.stored)throw Error('PDF not uploaded yet');
  return {ok:true,receiptId:s.uploadId,orderId:s.orderId,fileId:s.fileId,name:s.name,mode:s.mode,
     bytes:s.bytes,sha256:s.sha256,privateChunkBytes:256*1024,pageVerification:s.pageVerification,pages:s.pages};
 }
 if(p.op==='multiReadPart'){
  if(p.receiptId!==s.uploadId)throw Error('Wrong read ID');
  const chunk=s.stored.subarray(p.offset,p.offset+256*1024);
  return {ok:true,receiptId:s.uploadId,offset:p.offset,length:chunk.length,
   bytes:s.bytes,sha256:s.sha256,chunkSha256:sha(chunk),dataBase64:chunk.toString('base64')};
 }
 if(p.op==='multiCommitPages'){
  if(p.sha256!==s.sha256||p.pages<1)throw Error('Wrong page proof');
  s.pageVerification='server';s.pages=p.pages;
  return receipt(s);
 }
 if(p.op==='multiVerifiedStatus'){
  if(s.pages==null)throw Error('Pages not verified');
  return receipt(s);
 }
 throw Error('Unexpected operation '+p.op);
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,init={})=>{
 const uri=new URL(url);
 if(uri.hostname==='challenges.cloudflare.com'){
  return Response.json({success:turnstileSuccess,action:'documentos',hostname:new URL(origin).hostname});
 }
 if(uri.hostname==='script.google.com'){
  const envBody=JSON.parse(init.body);
  const check=createHmac('sha256',relayKey).update(envBody.timestamp+'\n'+envBody.payloadJson).digest('hex');
  assert.equal(envBody.signature,check,'HMAC envelope must match');
  googleCalls++;pending=JSON.parse(envBody.payloadJson);
  return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?mock'}});
 }
 if(uri.hostname==='script.googleusercontent.com'){
  try{return Response.json(dispatch(pending))}catch(e){return Response.json({ok:false,error:'mock refused'})}
 }
 throw Error('Unexpected outbound destination '+url);
};
const req=(path,data,originHeader=origin)=>new Request(origin+path,{
 method:'POST',headers:{'Content-Type':'application/json',Origin:originHeader,'Sec-Fetch-Site':'same-origin'},
 body:JSON.stringify(data)
});
test('Fase4 real PDF -> HMAC Google mock -> páginas pdf-lib -> precio B/N, pagos cerrados',async()=>{
 const doc=await PDFDocument.create();
 for(let i=0;i<6;i++)doc.addPage([595,842]);
 const bytes=await doc.save();
 const input=Uint8Array.from(bytes),finger=sha(input),partSize=524288,parts=Math.ceil(bytes.length/partSize);
 const meta={orderId:'WEB-ENSAYO-0123456789ABCDEF',fileId:'documento',name:'prueba seis paginas.pdf',
  mode:'bn',bytes:input.length,sha256:finger,partBytes:partSize,parts};
 const page=await worker.fetch(new Request(origin+'/prueba-cotizador-pdf'),env);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('Subir PDF y calcular presupuesto'));
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(js));
 const start=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta,turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal(start.status,200);
 const session=await start.json();assert.equal(session.ok,true);
 const repeated=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta,turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal((await repeated.json()).uploadId,session.uploadId,'idempotent start');
 const status=await worker.fetch(req('/api/ensayo-pdf',{op:'status',uploadId:session.uploadId,token:session.token}),env);
 assert.deepEqual((await status.json()).acceptedParts,[]);
 for(let i=0;i<parts;i++){
  const chunk=input.subarray(i*partSize,Math.min((i+1)*partSize,input.length));
  const r=await worker.fetch(req('/api/ensayo-pdf',{op:'part',uploadId:session.uploadId,token:session.token,
   index:i,bytes:chunk.length,sha256:sha(chunk),dataBase64:Buffer.from(chunk).toString('base64')}),env);
  assert.equal(r.status,200);
 }
 const finish=await worker.fetch(req('/api/ensayo-pdf',{op:'finish',uploadId:session.uploadId,token:session.token,
   sha256:finger,bytes:input.length,parts}),env);
 assert.equal((await finish.json()).received,true);
 const quote=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:session.uploadId,token:session.token,
   formato:'a4',caras:'simple',copias:1,anillado:'ninguno'}),env);
 assert.equal(quote.status,200);
 const q=await quote.json();
 assert.equal(q.pages,6);assert.equal(q.total,600);
 assert.equal(q.paymentAuthorized,false);
 assert.equal(q.receiptId,session.uploadId);
 const doubleQuote=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:session.uploadId,token:session.token,
  formato:'a4',caras:'double',copias:2,anillado:'juntos'}),env);
 assert.equal((await doubleQuote.json()).total,5620);
});
test('Fase4 niega fraude de páginas, solicitudes cruzadas y apertura accidental de uploads',async()=>{
 const count=googleCalls;
 const invalid=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:'DOC-'+randomUUID(),
  token:'good-token-12345678901234',formato:'a4',caras:'simple',copias:1,anillado:'ninguno',pages:99999}),env);
 assert.equal(invalid.status,400);assert.equal(googleCalls,count);
 const wrongOrigin=await worker.fetch(req('/api/ensayo-pdf',{op:'start'},'https://other.example'),env);
 assert.equal(wrongOrigin.status,403);
 turnstileSuccess=false;
 const tokenError=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta:{
  orderId:'WEB-ENSAYO-ABCDEF0123456789',fileId:'documento',name:'sample.pdf',mode:'bn',
  bytes:123,sha256:'a'.repeat(64),partBytes:524288,parts:1
 },turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal(tokenError.status,403);
 turnstileSuccess=true;
 const root=await worker.fetch(req('/',{op:'start'}),{...env,DOCS_UPLOAD_ENABLED:'true'});
 assert.equal(root.status,503);
});
