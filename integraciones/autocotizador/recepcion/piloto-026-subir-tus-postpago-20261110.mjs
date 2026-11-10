/** Post-pago orden 026: ONE TUS PDF A4, no new order or payment. */
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const web='WEB-ENSAYO-2EFC2C991012D0829CB9427C7461757B';
const order='e552cf32-356d-40e3-9736-6fbb8fef5dca';
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;assert.ok(pass?.length>=16,'STAFF_SECRET_ABSENT');
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const headers={Authorization:auth,Origin:host,'Sec-Fetch-Site':'same-origin'};
const sha=b=>createHash('sha256').update(b).digest('hex');
async function post(path,p){
 const res=await fetch(host+path,{method:'POST',
  headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify(p),redirect:'manual',signal:AbortSignal.timeout(80000)});
 const val=await res.json().catch(()=>({}));
 if(res.status!==200&&res.status!==201)
  throw Error('QA_POST_'+path+'_HTTP_'+res.status+'_'+String(val.error||''));
 assert.equal(val.ok,true,'QA_POST_INVALID_'+path);
 return val;
}
async function status(){
 const h=await fetch(central+'/health').then(x=>x.json());
 assert.equal(h.ok,true);assert.equal(h.databaseReady,true);assert.equal(h.paymentsEnabled,false);
 const s=await post('/prueba-v2/api/ensayo-r2-checkout-universal',{
   action:'status',webOrderId:web,commercialOrderId:order
 });
 assert.equal(s.webOrderId,web);assert.equal(s.commercialOrderId,order);
 assert.equal(s.amountArs,4500);assert.equal(s.fileCount,2);
 assert.equal(s.estado,'pagado_esperando_archivos','PAYMENT_NOT_CONFIRMED_STOP');
 assert.equal(s.uploadAuthorized,true);
 return s;
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
const pdf=generatedPdf(595.28,841.89);
assert.equal(pdf.length,441,'DIFFERENT_PDF_BYTES_FROM_QUOTE');
const digest=sha(pdf);
console.log('PILOT_026_TUS_LOCAL_SHA_CONFIRMED='+String(digest.length===64));
const before=await status();
if(before.receivedFileIds.includes('saber_qa_1')){
 console.log('PILOT_026_TUS_ALREADY_RECEIVED_NO_REUPLOAD');
 process.exit(0);
}
assert.equal(before.pendingFiles,2,'UNEXPECTED_FILE_STATE');
const meta={fileId:'saber_qa_1',name:'SABER-QA-A4-1P.pdf',
 mode:'bn',bytes:pdf.length,sha256:digest,pages:1};
const start=await post('/prueba-v2/api/ensayo-tus-universal-iniciar',{orderId:web,metas:[meta]});
assert.equal(start.orderId,web);
assert.equal(start.bucket,'saber-tus-lab');assert.equal(start.sessions?.length,1);
assert.ok(start.publishableKey?.length>25);
assert.match(start.projectRef||'',/^[a-z0-9]{20,}$/);
const signed=start.sessions[0];
assert.equal(signed.fileId,meta.fileId);
assert.equal(signed.bytes,meta.bytes);
assert.equal(signed.pages,meta.pages);
assert.ok(signed.objectName.startsWith('v2/'+web+'/'));
assert.ok(signed.signature?.length>=12);
assert.ok(signed.proof?.length>40);
const serverHost=start.projectRef+'.storage.supabase.co';
const endpoint='https://'+serverHost+'/storage/v1/upload/resumable/sign';
const b64=x=>Buffer.from(x,'utf8').toString('base64');
const metadata={bucketName:start.bucket,objectName:signed.objectName,
 contentType:'application/pdf',cacheControl:'0'};
const uploadMetadata=Object.entries(metadata).map(([k,v])=>k+' '+b64(v)).join(',');
const tusHeaders={
 'Tus-Resumable':'1.0.0',
 'x-signature':signed.signature,
 apikey:start.publishableKey
};
const created=await fetch(endpoint,{method:'POST',headers:{
 ...tusHeaders,'Upload-Length':String(pdf.length),'Upload-Metadata':uploadMetadata
},redirect:'manual',signal:AbortSignal.timeout(45000)});
if(created.status!==201)
 throw Error('TUS_CREATE_HTTP_'+created.status+'_'+(await created.text()).slice(0,130));
const location=created.headers.get('Location');
assert.ok(location,'TUS_LOCATION_MISSING');
const url=new URL(location,endpoint);
assert.equal(url.protocol,'https:');
assert.equal(url.hostname,serverHost,'TUS_UNSAFE_REDIRECT_HOST');
assert.ok(url.pathname.startsWith('/storage/v1/upload/resumable/'));
const offset=created.headers.get('Upload-Offset');
assert.ok(offset===null||offset==='0','TUS_OFFSET_UNEXPECTED');
const patch=await fetch(url.href,{method:'PATCH',headers:{
 ...tusHeaders,'Upload-Offset':'0','Content-Type':'application/offset+octet-stream'
},body:pdf,redirect:'manual',signal:AbortSignal.timeout(60000)});
if(patch.status!==204)
 throw Error('TUS_PATCH_HTTP_'+patch.status+'_'+(await patch.text()).slice(0,130));
assert.equal(Number(patch.headers.get('Upload-Offset')),pdf.length,'TUS_OFFSET_INCOMPLETE');
console.log('PILOT_026_A4_TUS_BYTES_UPLOADED='+pdf.length);
const confirmed=await post('/prueba-v2/api/ensayo-tus-universal-confirmar',{
 orderId:web,entries:[{proof:signed.proof}]
});
assert.equal(confirmed.webOrderId,web);
assert.equal(confirmed.savedFiles,1);
assert.equal(confirmed.receipts?.length,1);
assert.equal(confirmed.receipts[0].fileId,'saber_qa_1');
assert.equal(confirmed.receipts[0].saved,true);
console.log('PILOT_026_A4_TUS_PRIVATE_SHA_PAGES_MEASURED_D1_SAVED');
const after=await status();
assert.ok(after.receivedFileIds.includes('saber_qa_1'));
assert.equal(after.pendingFiles,1);
console.log('PILOT_026_PENDING_R2_COUNT='+after.pendingFiles);
console.log('PILOT_026_NO_NEW_ORDER_NO_NEW_PAYMENT_NO_MAIN_CHANGE');
