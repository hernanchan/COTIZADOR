/** One already-paid A1 R2 original for Sandbox order 026; no new order/payment. */
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {enviarArchivoR2Grande} from './r2-pdf-grandes-cliente.mjs';
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const web='WEB-ENSAYO-2EFC2C991012D0829CB9427C7461757B';
const order='e552cf32-356d-40e3-9736-6fbb8fef5dca';
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;assert.ok(pass?.length>=16);
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function status(){
 const h=await fetch(central+'/health').then(x=>x.json());
 assert.equal(h.ok,true);assert.equal(h.databaseReady,true);assert.equal(h.paymentsEnabled,false);
 const r=await fetch(host+'/prueba-v2/api/ensayo-r2-checkout-universal',{
  method:'POST',headers:{Authorization:auth,Origin:host,
   'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},
  body:JSON.stringify({action:'status',webOrderId:web,commercialOrderId:order}),
  redirect:'manual',signal:AbortSignal.timeout(30000)});
 const v=await r.json().catch(()=>({}));
 assert.equal(r.status,200,'SANDBOX_STATUS_HTTP_'+r.status);
 assert.equal(v.ok,true);assert.equal(v.webOrderId,web);
 assert.equal(v.commercialOrderId,order);assert.equal(v.amountArs,4500);
 assert.equal(v.fileCount,2);
 assert.equal(v.estado,'pagado_esperando_archivos','SANDBOX_NOT_PAID');
 assert.equal(v.uploadAuthorized,true,'SANDBOX_UPLOAD_GATE');
 assert.ok(Array.isArray(v.receivedFileIds));
 return v;
}
function generatedPdf(width,height,{big=false}={}){
 const chunks=[],offs=[0];let n=0;
 const put=x=>{const bytes=Buffer.isBuffer(x)?x:Buffer.from(x,'utf8');chunks.push(bytes);n+=bytes.length};
 put('%PDF-1.4\n');
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+width+' '+height+'] /Contents 4 0 R /Resources << >> >>'
 ];
 for(let i=0;i<objs.length;i++){offs[i+1]=n;put((i+1)+' 0 obj\n'+objs[i]+'\nendobj\n')}
 offs[4]=n;
 const content=big?Buffer.alloc(60*1048576,32):Buffer.from('q\nQ\n');
 put('4 0 obj\n<< /Length '+content.length+' >>\nstream\n');
 put(content);
 put('\nendstream\nendobj\n');
 const xref=n;
 put('xref\n0 5\n0000000000 65535 f \n');
 for(let i=1;i<5;i++)put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
 put('trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 return Buffer.concat(chunks,n);
}
const pre=await status();
assert.ok(pre.receivedFileIds.includes('saber_qa_1'),'A4_TUS_NOT_RECEIVED_STOP');
if(pre.receivedFileIds.includes('saber_qa_2')){
 assert.equal(pre.pendingFiles,0);
 console.log('PILOT_026_R2_ALREADY_RECEIVED_NO_REUPLOAD');
 process.exit(0);
}
assert.equal(pre.pendingFiles,1);
const big=generatedPdf(1683.78,2383.94,{big:true});
assert.equal(big.length,62915011,'A1_PDF_SIZE_MISMATCH');
const hash=sha(big);
const meta={fileId:'saber_qa_2',name:'SABER-QA-A1-60MiB.pdf',
 mode:'bn',bytes:big.length,sha256:hash,pages:1};
const upload=(route,init={})=>{
 assert.ok(typeof route==='string'&&route.startsWith('/prueba-v2/api/ensayo-r2/'));
 return fetch(host+route,{...init,
  headers:{...(init.headers||{}),Authorization:auth,Origin:host,
    'Sec-Fetch-Site':'same-origin'},redirect:'manual',
  signal:init.signal||AbortSignal.timeout(140000)});
};
console.log('PILOT_026_R2_BYTES_LOCAL='+big.length);
let lastStep='';
const result=await enviarArchivoR2Grande({
 file:new Blob([big],{type:'application/pdf'}),
 orderId:web,meta,fetcher:upload,storage:null,
 requireCentralStaging:true,mode:'sandbox',
 concurrency:2,retries:1,
 onProgress:s=>{
  if(s.phase!==lastStep){
   lastStep=s.phase;
   console.log('PILOT_026_R2_PHASE='+s.phase);
  }
 }
});
assert.equal(result.sha256Verificado,true);
assert.equal(result.sha256,hash);
assert.equal(result.bytes,big.length);
assert.equal(result.stagedForCentral,true);
console.log('PILOT_026_R2_SHA_60MIB_STAGED_CENTRAL_OK');
const after=await status();
assert.equal(after.pendingFiles,0,'R2_RECEIPT_NOT_IN_D1');
assert.equal(after.receivedFileIds.length,2,'R2_PAID_ORDER_MISSING_FILE');
assert.ok(after.receivedFileIds.includes('saber_qa_2'));
console.log('PILOT_026_TWO_ORIGINALS_RECEIVED_ON_ONE_PAID_ORDER');
console.log('NO_NEW_MP_CHECKOUT_NO_NEW_ORDER_NO_PUBLIC_CHANGE');
