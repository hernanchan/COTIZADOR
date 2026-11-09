/**
 * Continúa EXCLUSIVAMENTE la nueva orden D1 V2 60MiB creada el 09/11/2026.
 * No crea otra orden ni preferencia ni marca pagado. Sin pago MP verificado,
 * sale ANTES de leer/enviar R2. Sólo GitHub Actions privado autorizado.
 */
import {createHash} from 'node:crypto';
import {open,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const password=process.env.SABER_V2_OPERATOR_PASSWORD;
if(typeof password!=='string'||password.length<16)throw Error('TEST_OPERATOR_PASSWORD_MISSING');
const auth='Basic '+Buffer.from('operador:'+password).toString('base64');
const headers={Authorization:auth,Origin:host};
const webOrderId='WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3';
const commercialOrderId='89608817-95b1-41bc-ac88-579da519d32c';
async function post(route,payload){
 const r=await fetch(host+route,{method:'POST',headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(90000)});
 const body=await r.json().catch(()=>({error:'NOT_JSON'}));
 return {http:r.status,data:body};
}
function assertOk(result,where){
 if(result.http!==200||result.data.ok!==true)throw Error(
  'BLOCKER_'+where+'_HTTP_'+result.http+'_'+String(result.data.error||'').slice(0,80));
 return result.data;
}
const h=await fetch(central+'/health',{signal:AbortSignal.timeout(20000)}).then(r=>r.json());
if(h.ok!==true||h.databaseReady!==true||h.paymentsEnabled!==false)
 throw Error('BLOCKER_SANDBOX_HEALTH_OR_REAL_PAYMENT_ENABLED');
const checked=assertOk(await post('/prueba-v2/api/ensayo-r2-prepago-checkout',
 {action:'status',webOrderId,commercialOrderId}),'PAYMENT_STATUS');
if(checked.estado!=='pagado_esperando_archivo'||checked.uploadAuthorized!==true){
 console.log('NEW_V2_SANDBOX_PAYMENT_PENDING='+checked.estado+' NO_R2_UPLOAD_NO_DUPLICATE_CHECKOUT');
 process.exit(0);
}
if(checked.amountArs!==4400)throw Error('BLOCKER_ORDER_AMOUNT_CHANGED');
console.log('MP_SANDBOX_D1_PAYMENT_RECONCILED_ORDER='+commercialOrderId);
const path='/tmp/saber-r2-e2e-60mib.pdf',n=60*1024*1024;
          const f=await open(path,'w');let pos=0;const offsets=[0];
          const put=async data=>{const b=Buffer.isBuffer(data)?data:Buffer.from(data);await f.write(b,0,b.length,pos);pos+=b.length};
          await put('%PDF-1.4\n');
          for(const [id,data] of [[1,'<< /Type /Catalog /Pages 2 0 R >>'],
           [2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
           [3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1683.78 2383.94] /Contents 4 0 R /Resources << >> >>']]){
            offsets[id]=pos;await put(id+' 0 obj\n'+data+'\nendobj\n');
          }
          offsets[4]=pos;await put('4 0 obj\n<< /Length '+n+' >>\nstream\n');
          const blank=Buffer.alloc(1024*1024,32);for(let i=0;i<60;i++)await put(blank);
          await put('\nendstream\nendobj\n');const xref=pos;
          await put('xref\n0 5\n0000000000 65535 f \n');
          for(let i=1;i<=4;i++)await put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
          await put('trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');await f.close();
          const bytes=pos;
          const sha256=await new Promise((resolve,reject)=>{
            const d=createHash('sha256'),stream=createReadStream(path);
            stream.on('data',b=>d.update(b));stream.on('error',reject);
            stream.on('end',()=>resolve(d.digest('hex')));
          });
          if(bytes<=40*1024*1024||bytes>200*1024*1024)throw Error('BLOCKER_PDF_SIZE');
          
const meta={fileId:'planoA1',name:'ENSAYO-A1-SABER-60MiB.pdf',mode:'bn',
 bytes,sha256,pages:1};
const recovered=assertOk(await post('/prueba-v2/api/ensayo-r2/recuperar',
 {orderId:webOrderId,meta}),'SAFE_RECOVERY');
if(recovered.state==='stored_and_staged'&&recovered.result?.sha256Verificado===true&&
 recovered.result.sha256===sha256){
 console.log('R2_ALREADY_STAGED_SAME_SHA_NO_DUPLICATE_UPLOAD');
 await unlink(path);process.exit(0);
}
if(recovered.state!=='not_started'||recovered.alreadyStored!==false||
 recovered.uploadPossible!==true)throw Error('BLOCKER_PRIOR_INCOMPLETE_R2_REVIEW_REQUIRED');
const started=assertOk(await post('/prueba-v2/api/ensayo-r2/iniciar',
 {orderId:webOrderId,meta}),'R2_AFTER_PAYMENT');
const session=started.session;
if(!session?.proof||session.partBytes!==8*1024*1024||
 session.parts!==Math.ceil(bytes/session.partBytes))throw Error('BLOCKER_R2_SESSION_INVALID');
console.log('R2_STARTED_AFTER_CONFIRMED_PAYMENT_PARTS='+session.parts);
const handle=await open(path,'r'),parts=[];
try{
 for(let i=1;i<=session.parts;i++){
  const offset=(i-1)*session.partBytes,len=Math.min(session.partBytes,bytes-offset);
  const buffer=Buffer.alloc(len);
  const read=await handle.read(buffer,0,len,offset);
  if(read.bytesRead!==len)throw Error('BLOCKER_LOCAL_PART_READ_'+i);
  const res=await fetch(host+'/prueba-v2/api/ensayo-r2/parte?n='+i,{
   method:'PUT',headers:{...headers,'X-Saber-R2-Proof':session.proof},
   body:buffer,redirect:'manual',signal:AbortSignal.timeout(120000)});
  const data=await res.json().catch(()=>null);
  if(res.status!==200||data?.ok!==true||data.partNumber!==i||
     typeof data.etag!=='string')
    throw Error('BLOCKER_R2_PART_'+i+'_HTTP_'+res.status+'_'+String(data?.error||''));
  parts.push({partNumber:i,etag:data.etag});
  console.log('R2_PART_CONFIRMED='+i+'/'+session.parts);
 }
}finally{await handle.close()}
const complete=assertOk(await post('/prueba-v2/api/ensayo-r2/completar',
 {proof:session.proof,uploadedParts:parts}),'R2_COMPLETE');
if(complete.result?.storageReady!==true)throw Error('BLOCKER_R2_STORAGE_NOT_READY');
const verify=assertOk(await post('/prueba-v2/api/ensayo-r2/verificar',
 {proof:session.proof}),'R2_SHA_CENTRAL');
if(verify.result?.sha256Verificado!==true||verify.result.sha256!==sha256||
 verify.result.bytes!==bytes||verify.result.stagedForCentral!==true||
 verify.result.contenidoPdfVerificado!==false||
 verify.result.registeredInD1!==false)
 throw Error('BLOCKER_R2_SHA_OR_D1_STAGING_NOT_CONFIRMED');
console.log('REAL_R2_SHA256_AND_CENTRAL_STAGING_CONFIRMED');
const staff=await fetch(host+'/prueba-v2/api/ensayo-r2-descargar-personal',{
 method:'POST',headers:{...headers,'Content-Type':'application/json'},
 body:JSON.stringify({proof:session.proof}),redirect:'manual',
 signal:AbortSignal.timeout(150000)});
if(staff.status!==200||
 !String(staff.headers.get('content-type')||'').startsWith('application/pdf'))
 throw Error('BLOCKER_OPERATOR_DOWNLOAD_HTTP_'+staff.status);
const digest=createHash('sha256');let count=0;
for await(const chunk of staff.body){digest.update(chunk);count+=chunk.length}
const downloadedSha=digest.digest('hex');
if(downloadedSha!==sha256||count!==bytes)
 throw Error('BLOCKER_OPERATOR_DOWNLOAD_HASH_NOT_SAME');
console.log('REAL_CENTRAL_OPERATOR_PDF_DOWNLOAD_SHA_MATCH_BYTES='+count);
console.log('E2E_MP_SANDBOX_PAID_R2_STAGED_STAFF_ACCESS_OK_AWAITING_PREPRESS_REVIEW');
await unlink(path);
