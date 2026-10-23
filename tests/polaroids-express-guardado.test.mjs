import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {inflateSync} from 'node:zlib';
import {createHmac,createHash,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {guardarPedidoPdfExpress} from '../integraciones/polaroids/express/motor-pdf.mjs';
import {guardarPdfPrivadoEnGAS} from '../integraciones/polaroids/express/guardar-pdf-privado.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const pdfLib=require('pdf-lib');
const jpg=new Uint8Array(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const hojas=()=>[Array(6).fill(jpg),Array(6).fill(jpg)];
const reference='POL-'+'C'.repeat(24);
const hmacKey='express-independent-server-secret-0123456789ABCDE';
const GAS_URL='https://script.google.com/macros/s/AKfycbTESTEXPRESS012345678901234567890123/exec';
const env={EXPRESS_PDF_ENABLED:'PRIVATE_TEST_ONLY',
 EXPRESS_PDF_HMAC_KEY:hmacKey,EXPRESS_PDF_SCRIPT_URL:GAS_URL};
const files=new Map(),byId=new Map();
let created=0,requestPayload,postCalls=0;
const signedBytes=a=>Array.from(a).map(x=>x>127?x-256:x);
const binary=a=>Buffer.from(a.map(x=>x&255));
function blobFromBytes(bytes,name){
 return {getBytes:()=>bytes,name,getName:()=>name};
}
const folder={
 getSharingAccess:()=> 'PRIVATE',
 getFilesByName:name=>{
  const hits=[...files.values()].filter(f=>f.name===name);let i=0;
  return {hasNext:()=>i<hits.length,next:()=>hits[i++]};
 },
 createFile:b=>{
  const id='file-'+(++created);
  const f={id,name:b.name,blob:b,getId:()=>id,getBlob:()=>b,
   setTrashed:()=>{files.delete(id);byId.delete(id)}};
  files.set(id,f);byId.set(id,f);return f;
 }
};
const Utilities={
 DigestAlgorithm:{SHA_256:'sha256'},
 computeDigest:(algorithm,bytes)=>signedBytes(createHash('sha256').update(binary(bytes)).digest()),
 computeHmacSha256Signature:(message,secret)=>signedBytes(createHmac('sha256',secret).update(message).digest()),
 base64Decode:s=>signedBytes(Buffer.from(s,'base64')),
 base64Encode:bytes=>binary(bytes).toString('base64'),
 newBlob:(bytes,type,name)=>({bytes,name,getBytes:()=>bytes,type})
};
const sandbox={Utilities,DriveApp:{Access:{PRIVATE:'PRIVATE'},getFolderById:()=>folder,
 getFileById:id=>byId.get(id)},PropertiesService:{getScriptProperties:()=>({
 getProperty:key=>key==='EXPRESS_PDF_HMAC_KEY'?hmacKey:key==='EXPRESS_PDF_FOLDER_ID'?'private-folder':null
 })},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 ContentService:{MimeType:{JSON:'application/json'},
 createTextOutput:text=>({text,setMimeType(){return this}})},console};
vm.createContext(sandbox);
const gs=readFileSync(new URL('../integraciones/polaroids/express/apps-script-solo-pdf.gs',import.meta.url),'utf8');
assert.doesNotThrow(()=>new vm.Script(gs));
vm.runInContext(gs,sandbox);
let nextReply=null;
const fetcher=async(url,options)=>{
 if(url.startsWith('https://script.google.com')){
  postCalls++;
  const envelope=JSON.parse(options.body);
  assert.equal(options.redirect,'manual');
  const expected=createHmac('sha256',hmacKey)
   .update(envelope.timestamp+'\n'+envelope.nonce+'\n'+envelope.payloadJson).digest('hex');
  assert.equal(envelope.signature,expected);
  requestPayload=JSON.parse(envelope.payloadJson);
  assert.equal(requestPayload.op,'guardarPdfExpress');
  assert.equal('original' in requestPayload,false);
  assert.equal('printJpeg' in requestPayload,false);
  assert.equal('crop' in requestPayload,false);
  assert.equal('jsonEncuadres' in requestPayload,false);
  const response=sandbox.doPost({postData:{contents:options.body}});
  nextReply=response.text;
  return new Response(null,{status:302,headers:{
   Location:'https://script.googleusercontent.com/macros/echo?fake'
  }});
 }
 assert.match(url,/^https:\/\/script\.googleusercontent\.com\/macros\/echo/);
 assert.equal(options.method,'GET');return new Response(nextReply,{status:200});
};
const save=async data=>guardarPdfPrivadoEnGAS({...data,env,fetcher,
 subtle:webcrypto.subtle,nonce:()=>randomUUID()});
test('12 fotos: genera PDF servidor, guarda UN archivo privado sin fotos ni recortes',async()=>{
 const result=await guardarPedidoPdfExpress({
  referencia:reference,hojas:hojas(),pdfLib,subtle:webcrypto.subtle,
  guardarPdfPrivado:save
 });
 assert.equal(result.ok,true);
 assert.equal(result.hojas,2);
 assert.equal(result.fotos,12);
 assert.equal(result.pdfPrivadoVerificado,true);
 assert.equal(result.permiteDescargaCliente,false);
 assert.equal(files.size,1);
 const stored=[...files.values()][0];
 assert.equal(stored.name,reference+'_IMPRIMIR.pdf');
 assert.equal(stored.blob.type,'application/pdf');
 const raw=binary(stored.blob.getBytes());
 assert.equal(String(raw.subarray(0,5)),'%PDF-');
 const parsed=await pdfLib.PDFDocument.load(raw);
 assert.equal(parsed.getPageCount(),2);
 assert.ok(!JSON.stringify(result).includes('pdfBase64'));
 assert.ok(!JSON.stringify(result).includes('file-1'));
 assert.equal(requestPayload.pdfBase64.length>100,true);
});
test('reintento idempotente: mismo pedido sigue teniendo un único PDF',async()=>{
 const result=await guardarPedidoPdfExpress({
  referencia:reference,hojas:hojas(),pdfLib,subtle:webcrypto.subtle,guardarPdfPrivado:save
 });
 assert.equal(result.ok,true);
 assert.equal(created,1);
 assert.equal(files.size,1);
 assert.equal(postCalls,2);
});
test('otro PDF para la misma referencia es rechazado; jamás se sustituye',async()=>{
 const corrupt=new Uint8Array(jpg);
 corrupt[corrupt.length-5]^=1;
 const response=await guardarPedidoPdfExpress({
  referencia:reference,hojas:[Array(6).fill(corrupt)],pdfLib,
  subtle:webcrypto.subtle,guardarPdfPrivado:save
 }).catch(e=>e);
 assert.ok(response instanceof Error);
 assert.equal(files.size,1);
});
test('claves ausentes y redirección externa rechazan almacenamiento',async()=>{
 await assert.rejects(guardarPdfPrivadoEnGAS({
  referencia:reference,contenidoPdf:new Uint8Array(200),bytes:200,
  sha256:'0'.repeat(64),paginas:1,fotos:6,
  env:{...env,EXPRESS_PDF_ENABLED:''},subtle:webcrypto.subtle,fetcher
 }),/deshabilitada/i);
 const original=files.values().next().value.blob.getBytes();
 const bytes=new Uint8Array(original.map(x=>x&255));
 const sha256=createHash('sha256').update(bytes).digest('hex');
 await assert.rejects(guardarPdfPrivadoEnGAS({
  referencia:'POL-'+'D'.repeat(24),contenidoPdf:bytes,bytes:bytes.length,
  sha256,paginas:2,fotos:12,env,subtle:webcrypto.subtle,
  fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/steal'}})
 }),/redirección/i);
 assert.equal(files.size,1);
});

test('GAS entrega PDF completo sólo ante solicitud HMAC firmada',()=>{
 const stored=files.values().next().value;
 const bytes=binary(stored.blob.getBytes());
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const signedRead=(secret,reference=reference)=>{
  const payloadJson=JSON.stringify({op:'leerPdfExpress',referencia:reference,
   bytes:bytes.length,sha256});
  const timestamp=Math.floor(Date.now()/1000),nonce=randomUUID();
  const signature=createHmac('sha256',secret).update(timestamp+'\n'+nonce+'\n'+payloadJson).digest('hex');
  return {postData:{contents:JSON.stringify({timestamp,nonce,payloadJson,signature})}};
 };
 const response=JSON.parse(sandbox.doPost(signedRead(hmacKey)).text);
 assert.equal(response.ok,true);
 assert.equal(response.verified,true);
 assert.equal(response.referencia,reference);
 assert.equal(response.sha256,sha256);
 assert.equal(response.bytes,bytes.length);
 assert.deepEqual(Buffer.from(response.pdfBase64,'base64'),bytes);
 assert.equal(files.size,1);
 const invalid=JSON.parse(sandbox.doPost(signedRead('clave-incorrecta')).text);
 assert.equal(invalid.ok,false);
 assert.equal('pdfBase64' in invalid,false);
 const missing=JSON.parse(sandbox.doPost(signedRead(hmacKey,'POL-'+'F'.repeat(24))).text);
 assert.equal(missing.ok,false);
 assert.equal('pdfBase64' in missing,false);
});
