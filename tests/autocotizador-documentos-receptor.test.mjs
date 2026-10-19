import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Este test simula Drive y Apps Script. NO instala ni envía archivos reales.
const code=await readFile(new URL('../integraciones/autocotizador/recepcion/DocumentosReceiver.gs',import.meta.url),'utf8');
const secret='local-test-secret-12345678901234567890';
const properties=new Map([['DOCS_RELAY_KEY',secret],['DOCS_ROOT_FOLDER_ID','private-root']]);
const data=Buffer.alloc(524288+11);data.write('%PDF-1.7\n');
for(let i=9;i<data.length;i++)data[i]=i%239;
const hash=x=>createHash('sha256').update(x).digest('hex');
let saved=Buffer.alloc(0),uploads=0,failedOnce=false;
const res=(status,body='',headers={})=>({
 getResponseCode:()=>status,getContentText:()=>body,getAllHeaders:()=>headers,
 getBlob:()=>({getBytes:()=>Array.from(saved)})
});
const deps={
 Utilities:{
  DigestAlgorithm:{SHA_256:1},getUuid:()=>randomUUID(),
  newBlob:s=>({getBytes:()=>Array.from(Buffer.from(s))}),
  base64Decode:s=>Array.from(Buffer.from(s,'base64')),
  computeDigest:(_,a)=>Array.from(createHash('sha256').update(Buffer.from(a)).digest()),
  computeHmacSha256Signature:(s,k)=>Array.from(createHmac('sha256',k).update(s).digest())
 },
 PropertiesService:{getScriptProperties:()=>({
  getProperty:k=>properties.get(k)||null,
  setProperty:(k,v)=>properties.set(k,String(v))
 })},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 DriveApp:{getFolderById:()=>({createFolder:n=>({getId:()=> 'folder-'+n})})},
 ScriptApp:{getOAuthToken:()=> 'fake-token'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:b=>({body:b,setMimeType(){return this}})},
 UrlFetchApp:{fetch:(url,opt)=>{
  if(opt.method==='post'&&url.includes('uploadType=resumable')){
   uploads++;return res(200,'',{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test'});
  }
  if(opt.method==='put'&&opt.headers['Content-Range'].startsWith('bytes */')){
   return saved.length===data.length?res(200,JSON.stringify({id:'drive-file'})):
     res(308,'',saved.length?{Range:'bytes=0-'+(saved.length-1)}:{});
  }
  if(opt.method==='put'){
   const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(opt.headers['Content-Range']);
   assert.ok(range);assert.equal(+range[1],saved.length);
   assert.equal(+range[3],data.length);
   saved=Buffer.concat([saved,Buffer.from(opt.payload)]);
   if(!failedOnce&&saved.length===524288){failedOnce=true;throw Error('perdimos respuesta');}
   return saved.length===data.length?res(200,JSON.stringify({id:'drive-file'})):
     res(308,'',{Range:'bytes=0-'+(saved.length-1)});
  }
  if(opt.method==='get'&&url.includes('?alt=media'))return res(200);
  throw Error('Drive recibió una solicitud inesperada');
 }}
};
vm.runInNewContext(code+'\nthis.handler=doPost;',deps);
const envelope=p=>{
 const payloadJson=JSON.stringify(p),timestamp=Date.now();
 const signature=createHmac('sha256',secret).update(timestamp+'\n'+payloadJson).digest('hex');
 return {payloadJson,timestamp,signature};
};
const call=p=>JSON.parse(deps.handler({postData:{contents:JSON.stringify(envelope(p))}}).body);
const meta={orderId:'WEB-123456',fileId:'file01',name:'pdf.pdf',mode:'bn',
 bytes:data.length,sha256:hash(data),parts:2,partBytes:524288};
const first=call({op:'start',meta}),again=call({op:'start',meta});
assert.equal(first.ok,true);assert.equal(first.uploadId,again.uploadId);
assert.equal(uploads,1);
const ctx={uploadId:first.uploadId,token:first.token};
assert.equal(call({op:'status',...ctx}).acceptedParts.length,0);
const part=i=>{
 const bytes=data.subarray(i*524288,Math.min(data.length,(i+1)*524288));
 return call({op:'part',...ctx,index:i,bytes:bytes.length,sha256:hash(bytes),dataBase64:bytes.toString('base64')});
};
assert.equal(part(0).ok,false); // Se guardó en Drive, pero se perdió su respuesta.
assert.equal(call({op:'status',...ctx}).acceptedParts.length,1);
assert.equal(part(0).accepted,true); // Sin subir la misma parte otra vez.
assert.equal(part(1).accepted,true);
const result=call({op:'finish',...ctx,bytes:data.length,sha256:hash(data),parts:2});
assert.equal(result.received,true);assert.equal(result.verified,false);
assert.equal(result.pdfPages,null);assert.equal(saved.equals(data),true);
assert.equal(call({op:'status',uploadId:first.uploadId,token:'incorrecto'}).ok,false);
const forged=envelope({op:'status',...ctx});forged.signature='0'.repeat(64);
assert.equal(JSON.parse(deps.handler({postData:{contents:JSON.stringify(forged)}}).body).ok,false);
console.log('PASS: fragmentos, idempotencia, HMAC, error de red, SHA y pago bloqueado.');
