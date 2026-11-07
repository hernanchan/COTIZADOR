/**
 * Un runner GitHub Actions genera dos PDFs sintéticos con formato PDF real y tamaño exacto.
 * Se detiene el proceso tras 3 partes y un segundo proceso lee recibo + ETags
 * para reanudar en R2 REAL. Nunca usa datos de clientes ni habilita cotización.
 */
import {createHash} from 'node:crypto';
import {createReadStream,openSync,closeSync,writeSync,readFileSync,writeFileSync,renameSync,
 unlinkSync,existsSync,statSync} from 'node:fs';
import {open} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const MIB=1024*1024,PART=8*MIB,MIN_STREAM=4;
const [phase,label]=process.argv.slice(2);
const sizeMiB=Number(label);
if(!['first','resume','cleanup'].includes(phase)||![80,200].includes(sizeMiB))
 throw Error('USO: node r2-canaria-benchmark.mjs first|resume|cleanup 80|200');
const base=process.env.CANARY_URL;
const secret=process.env.CANARY_AUTH_SECRET;
const dir=process.env.CANARY_WORKDIR||'/tmp';
const file=dir+'/saber-canario-'+label+'.pdf';
const stateFile=dir+'/saber-canario-'+label+'.json';
const origin=new URL(base).origin;
if(!base||!/\.workers\.dev$/.test(new URL(base).hostname)||!secret||secret.length<32)
 throw Error('CANARY_ENV_NOT_READY');
const key='Bearer '+secret;
function addBytes(filename,buf){
 const f=openSync(filename,'a');
 try{writeSync(f,buf);}finally{closeSync(f)}
}
function prefix(streamLength){
 const chunks=[];let position=0;
 const offsets={};
 function append(value){const b=Buffer.from(value,'utf8');chunks.push(b);position+=b.length}
 function obj(n,body){offsets[n]=position;append(n+' 0 obj\n'+body+'\nendobj\n')}
 append('%PDF-1.4\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>');
 offsets[4]=position;
 append('4 0 obj\n<< /Length '+streamLength+' >>\nstream\n');
 return {buffer:Buffer.concat(chunks),offsets};
}
function suffix(offsets,prefixLength,streamLength){
 const after='\nendstream\nendobj\n';
 const start=prefixLength+streamLength+Buffer.byteLength(after);
 const line=n=>String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(after+
  'xref\n0 5\n0000000000 65535 f \n'+
  line(offsets[1])+line(offsets[2])+line(offsets[3])+line(offsets[4])+
  'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n');
}
function synthesizePdf(){
 const target=sizeMiB*MIB;
 let len=target-500,before,after;
 for(let i=0;i<15;i++){
  const data=prefix(len);
  const end=suffix(data.offsets,data.buffer.length,len);
  const needed=target-data.buffer.length-end.length;
  if(needed===len){before=data.buffer;after=end;break}
  len=needed;
 }
 if(!before||len<MIN_STREAM)throw Error('PDF_SIZE_CONVERGENCE_FAILED');
 const fd=openSync(file,'w',0o600);
 try{
  writeSync(fd,before);
  writeSync(fd,Buffer.from('q\nQ\n'));
  let remain=len-MIN_STREAM;
  const filler=Buffer.alloc(MIB,0x20);
  while(remain>0){const n=Math.min(remain,filler.length);writeSync(fd,filler,0,n);remain-=n}
  writeSync(fd,after);
 }finally{closeSync(fd)}
 if(statSync(file).size!==target)throw Error('PDF_EXACT_SIZE_FAILED');
}
async function hashPdf(){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
}
async function call(route,method='POST',data=null,extraHeaders={}){
 const headers={'Authorization':key,Origin:origin,...extraHeaders};
 let body;
 if(data!==null){
  if(Buffer.isBuffer(data)){body=data}
  else{body=JSON.stringify(data);headers['Content-Type']='application/json'}
 }
 const started=performance.now();
 const res=await fetch(base+'/__saber-r2-canario/'+route,{
  method,headers,body,signal:AbortSignal.timeout(180000),redirect:'error'});
 const raw=await res.text();
 let reply=null;
 try{reply=JSON.parse(raw)}catch{}
 if(!res.ok||reply?.ok!==true){
  // No registrar tokens, proofs, URL ni cabeceras de autenticacion.
  console.error('CANARY_HTTP_DIAGNOSTIC route='+route.split('?')[0]+
   ' status='+res.status+' contentType='+(res.headers.get('content-type')||'unknown')+
   ' provider='+((res.headers.get('server')||'unknown').slice(0,30))+
   ' errorCode='+(reply?.error||'non-json')+
   ' responseHead='+raw.slice(0,250).replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));
  throw Error('CANARY_HTTP_'+res.status+'_'+(reply?.error||route));
 }
 return {body:reply,elapsedMs:Math.round(performance.now()-started)};
}
function save(state){
 const temp=stateFile+'.new';
 writeFileSync(temp,JSON.stringify(state),{mode:0o600});
 renameSync(temp,stateFile);
}
function load(){
 const value=JSON.parse(readFileSync(stateFile,'utf8'));
 if(value.miB!==sizeMiB||!value.proof||!value.sha256||!value.fileId)
  throw Error('CANARY_STATE_INVALID');
 return value;
}
async function part(state,n){
 const offset=(n-1)*PART,bytes=Math.min(PART,sizeMiB*MIB-offset);
 const handle=await open(file,'r');
 const buffer=Buffer.allocUnsafe(bytes);
 try{
  let count=0;
  while(count<bytes){
   const {bytesRead}=await handle.read(buffer,count,bytes-count,offset+count);
   if(!bytesRead)throw Error('CANARY_EOF_PART_'+n);
   count+=bytesRead;
  }
 }finally{await handle.close()}
 const result=await call('part?n='+n,'PUT',buffer,{'X-Saber-R2-Proof':state.proof});
 if(result.body.partNumber!==n||typeof result.body.etag!=='string'||result.body.bytes!==bytes)
  throw Error('CANARY_PART_INVALID_'+n);
 state.parts[String(n)]=result.body.etag;
 save(state);
 return result.elapsedMs;
}
async function uploadGroup(state,numbers){
 const begin=performance.now();
 let cursor=0;
 const workers=Array.from({length:Math.min(3,numbers.length)},async()=>{
  while(cursor<numbers.length){const n=numbers[cursor++];await part(state,n)}
 });
 await Promise.all(workers);
 return Math.round(performance.now()-begin);
}
async function first(){
 synthesizePdf();
 const sha256=await hashPdf();
 const meta={fileId:'r2-canario-'+label,name:'canario-'+label+'.pdf',mode:'bn',
  bytes:sizeMiB*MIB,sha256,pages:1};
 const orderId='WEB-ENSAYO-R2-CANARIO-'+process.env.GITHUB_RUN_ID;
 const r=await call('start','POST',{orderId,meta});
 const session=r.body.session;
 if(session?.parts!==sizeMiB/8||session?.partBytes!==PART||
    session?.paymentAuthorized!==false)throw Error('CANARY_SESSION_INVALID');
 const state={v:1,miB:sizeMiB,sha256,fileId:meta.fileId,
  proof:session.proof,parts:{},initialUploadMs:0,initialParts:3};
 save(state);
 state.initialUploadMs=await uploadGroup(state,[1,2,3]);
 save(state);
 console.log('R2_CANARY_INTERRUPTED_AFTER_REAL_PARTS='+3+' SIZE_MIB='+sizeMiB+
  ' INITIAL_UPLOAD_WALL_MS='+state.initialUploadMs);
}
async function resume(){
 const state=load();
 if(!existsSync(file)||statSync(file).size!==sizeMiB*MIB||
    (await hashPdf())!==state.sha256)throw Error('CANARY_FILE_SHA_CHANGED');
 for(let i=1;i<=3;i++)if(!state.parts[String(i)])throw Error('CANARY_FIRST_PART_MISSING');
 const missing=Array.from({length:sizeMiB/8},(_,i)=>i+1)
  .filter(n=>!state.parts[String(n)]);
 const restMs=await uploadGroup(state,missing);
 const parts=Array.from({length:sizeMiB/8},(_,i)=>({partNumber:i+1,etag:state.parts[String(i+1)]}));
 if(parts.some(p=>!p.etag))throw Error('CANARY_PARTS_INCOMPLETE');
 const complete=await call('finish','POST',{proof:state.proof,parts});
 if(complete.body.result?.storageReady!==true||
    complete.body.result?.sha256Verificado!==false)throw Error('CANARY_FINISH_INVALID');
 // Exigir el verificador de produccion experimental, sin fallback canario.
 const verification=await call('verify','POST',{proof:state.proof});
 const method='core-ranges-8m';
 const result=verification.body.verified;
 if(!result||result.sha256!==state.sha256||result.bytes!==sizeMiB*MIB||
    result.sha256Verificado!==true||result.contenidoPdfVerificado!==false||
    result.paymentAuthorized!==false)throw Error('CANARY_SHA256_VERIFICATION_FAILED');
 const cleanup=await call('cleanup','POST',{proof:state.proof});
 if(cleanup.body.objectAbsent!==true||cleanup.body.deleted!==true)
  throw Error('CANARY_R2_OBJECT_DELETE_NOT_VERIFIED');
 const totalMs=state.initialUploadMs+restMs;
 console.log('R2_CANARY_REAL_OK_SIZE_MIB='+sizeMiB+' PARTS='+parts.length+
  ' RESUMED_PARTS='+missing.length+
  ' TRANSFER_WALL_MS='+totalMs+
  ' EFFECTIVE_MIB_PER_SECOND='+(sizeMiB/(totalMs/1000)).toFixed(2)+
  ' SHA_METHOD='+method+' R2_SHA256_READ_MS='+verification.elapsedMs+
  ' R2_OBJECT_DELETED_CONFIRMED=true');
 unlinkSync(stateFile);unlinkSync(file);
}
async function cleanup(){
 if(!existsSync(stateFile)){console.log('CANARY_NO_LOCAL_STATE_TO_CLEAN_'+sizeMiB);return}
 const state=load();
 const done=await call('cleanup','POST',{proof:state.proof});
 if(done.body.objectAbsent!==true)throw Error('CANARY_OBJECT_REMAINS');
 console.log('R2_CANARY_CLEANUP_CONFIRMED_SIZE_MIB='+sizeMiB);
 if(existsSync(stateFile))unlinkSync(stateFile);
 if(existsSync(file))unlinkSync(file);
}
if(phase==='first')await first();
else if(phase==='resume')await resume();
else await cleanup();
