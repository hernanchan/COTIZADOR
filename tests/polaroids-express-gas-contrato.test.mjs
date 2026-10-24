import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(
 new URL('../integraciones/polaroids/express/apps-script-solo-pdf.gs',import.meta.url),'utf8');
const digest=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const key='express-pdf-only-key-for-local-gas-contract-2026';
const reference='POL-'+'A'.repeat(24);
const alternate='POL-'+'B'.repeat(24);
const pdf=Buffer.from('%PDF-1.4\n'+
 '1 0 obj\n<< /Type /Catalog >>\nendobj\n'+
 '2 0 obj\n<< /Test (PRIVADO) >>\nendobj\n'+
 'x'.repeat(130)+'\n%%EOF\n');
function setup(){
 const files=new Map();
 let sharing='PRIVATE',creates=0,lockCount=0;
 let nextId=0;
 const makeBlob=(bytes,mimeType='application/pdf',name='test.pdf')=>({
  getBytes:()=>Array.from(bytes),getName:()=>name,getContentType:()=>mimeType
 });
 const folder={
  getSharingAccess(){return sharing},
  getFilesByName(name){
   const found=[...files.values()].filter(x=>!x.trash&&x.name===name);
   let i=0;
   return {hasNext:()=>i<found.length,next:()=>found[i++]};
  },
  createFile(blob){
   const id=String(++nextId);
   const file={id,name:blob.getName(),
    getId(){return id},getMimeType(){return 'application/pdf'},
    getBlob(){return makeBlob(blob.getBytes())},
    setTrashed(value){this.trash=value}
   };
   files.set(id,file);creates++;return file;
  }
 };
 const utilities={
  computeDigest(_algo,bytes){return [...createHash('sha256')
   .update(Buffer.from(bytes.map(n=>(n+256)%256))).digest()]},
  computeHmacSha256Signature(message,secret){return [...createHmac('sha256',secret)
   .update(message).digest()]},
  base64Decode(str){return [...Buffer.from(str,'base64')]},
  base64Encode(bytes){return Buffer.from(bytes.map(n=>(n+256)%256)).toString('base64')},
  newBlob(bytes,mimeType,name){return makeBlob(typeof bytes==='string'?
   [...Buffer.from(bytes,'utf8')]:bytes,mimeType,name)},
  getUuid:randomUUID,
  DigestAlgorithm:{SHA_256:'SHA_256'}
 };
 const context=vm.createContext({
  Utilities:utilities,
  DriveApp:{
   Access:{PRIVATE:'PRIVATE',ANYONE:'ANYONE'},
   getFolderById(id){assert.equal(id,'TEST_FOLDER');return folder},
   getFileById(id){return files.get(id)}
  },
  LockService:{getScriptLock(){return {
   tryLock(){lockCount++;return true},releaseLock(){}
  }}},
  PropertiesService:{getScriptProperties(){return {getProperty(name){
   return {'EXPRESS_PDF_HMAC_KEY':key,
    'EXPRESS_PDF_FOLDER_ID':'TEST_FOLDER'}[name]||null;
  }}}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput(content){
   return {content,setMimeType(){return this}}
  }},
  Logger:{log(){}},
  console
 });
 vm.runInContext(source,context,{filename:'apps-script-solo-pdf.gs'});
 function signed(payload,override={}){
  const timestamp=Math.floor(Date.now()/1000),nonce=randomUUID();
  const payloadJson=JSON.stringify(payload);
  const signature=createHmac('sha256',key)
   .update(timestamp+'\n'+nonce+'\n'+payloadJson).digest('hex');
  const req={timestamp,nonce,payloadJson,signature,...override};
  return JSON.parse(context.doPost({postData:{contents:JSON.stringify(req)}}).content);
 }
 const receipt=(ref=reference,content=pdf)=>({
  op:'guardarPdfExpress',referencia:ref,sha256:digest(content),
  bytes:content.length,paginas:1,fotos:6,pdfBase64:content.toString('base64')
 });
 return {
  context,files,signed,receipt,
  setSharing(value){sharing=value},
  stats(){return {creates,lockCount,live:[...files.values()].filter(x=>!x.trash).length}}
 };
}
test('el mismo PDF firmado se guarda sólo una vez, sin divulgar Drive ID',()=>{
 const h=setup(),data=h.receipt();
 const a=h.signed(data),b=h.signed(data);
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal(a.verified,true);assert.equal(b.verified,true);
 assert.equal(h.stats().creates,1);
 assert.equal(h.stats().live,1);
 for(const response of [a,b]){
  assert.equal('fileId' in response,false);
  assert.equal('url' in response,false);
  assert.equal('pdfBase64' in response,false);
 }
});
test('la lectura privada exige firma y devuelve bytes verificados',()=>{
 const h=setup(),source=h.receipt();
 assert.equal(h.signed(source).verified,true);
 const read=h.signed({op:'leerPdfExpress',referencia:reference,
  sha256:source.sha256,bytes:source.bytes});
 assert.equal(read.verified,true);
 assert.equal(Buffer.from(read.pdfBase64,'base64').compare(pdf),0);
 assert.equal('fileId' in read,false);
});
test('un PDF distinto bajo la misma referencia es rechazado sin duplicar',()=>{
 const h=setup(),first=h.receipt();
 assert.equal(h.signed(first).ok,true);
 const tampered=Buffer.concat([pdf,Buffer.from(' ')]);
 const second=h.signed(h.receipt(reference,tampered));
 assert.equal(second.ok,false);
 assert.equal(h.stats().live,1);
});
test('una carpeta con acceso ANYONE bloquea escritura y lectura',()=>{
 const h=setup();h.setSharing('ANYONE');
 const result=h.signed(h.receipt());
 assert.equal(result.ok,false);
 assert.equal(h.stats().creates,0);
});
test('rechaza firmas inválidas sin crear ni devolver archivos',()=>{
 const h=setup(),p=h.receipt();
 const payloadJson=JSON.stringify(p),timestamp=Math.floor(Date.now()/1000);
 const result=h.signed(p,{signature:'0'.repeat(64)});
 assert.equal(result.ok,false);
 assert.equal(h.stats().creates,0);
});
test('la prueba propia de GAS mantiene un único PDF ficticio en dos ejecuciones',()=>{
 const h=setup();
 const first=h.context.pruebaExpressDriveReal();
 const second=h.context.pruebaExpressDriveReal();
 assert.equal(first.ok,true);
 assert.equal(second.ok,true);
 assert.equal(first.originalFotosGuardadas,0);
 assert.equal(first.recortesSueltosGuardados,0);
 assert.equal(h.stats().creates,1);
});
