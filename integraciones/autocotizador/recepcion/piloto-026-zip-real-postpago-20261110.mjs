/** Verify real paid mixed order 026, staff-only originals, and local ZIP. */
import assert from 'node:assert/strict';
import {readFile,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {escribirZipUniversal} from './zip-universal-stream.mjs';
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const web='WEB-ENSAYO-2EFC2C991012D0829CB9427C7461757B';
const order='e552cf32-356d-40e3-9736-6fbb8fef5dca';
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;
assert.ok(pass?.length>=16,'STAFF_SECRET_REQUIRED');
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function post(path,p,{binary=false,timeout=160000}={}){
 const r=await fetch(host+path,{method:'POST',headers:{
  Authorization:auth,Origin:host,'Sec-Fetch-Site':'same-origin',
  'Content-Type':'application/json'
 },body:JSON.stringify(p),redirect:'manual',signal:AbortSignal.timeout(timeout)});
 if(r.status!==200)throw Error('ZIP_STAFF_HTTP_'+r.status+'_'+path);
 if(binary){
  assert.match(r.headers.get('Content-Type')||'',/^application\/pdf/);
  assert.ok(r.body instanceof ReadableStream,'PDF_BODY_NOT_STREAMED');
  return r;
 }
 const x=await r.json().catch(()=>({}));
 assert.equal(x.ok,true,'ZIP_MANIFEST_NOT_APPROVED');
 return x;
}
const health=await fetch(central+'/health').then(r=>r.json());
assert.equal(health.ok,true);assert.equal(health.databaseReady,true);
assert.equal(health.paymentsEnabled,false,'REAL_PAYMENTS_SHOULD_BE_OFF');
const manifest=await post('/prueba-v2/api/ensayo-universal-paquete-personal',{webOrderId:web});
assert.equal(manifest.schema,'saber-central-r2-universal-package-manifest-v1');
assert.equal(manifest.webOrderId,web);
assert.equal(manifest.numeroOrden,'026');
assert.equal(manifest.importe,4500);
assert.equal(manifest.estadoPago,'PAGADO_VERIFICADO');
assert.equal(manifest.pagoVerificado,true);
assert.equal(manifest.preprensaPendiente,true);
assert.equal(manifest.productionAuthorized,false);
assert.equal(manifest.trabajos?.length,2);
assert.deepEqual(manifest.trabajos.map(x=>x.transporte),['tus','r2']);
assert.deepEqual(manifest.trabajos.map(x=>x.fileId),['saber_qa_1','saber_qa_2']);
console.log('PILOT_026_STAFF_MANIFEST_PAID_TWO_PDFS_PREPRESS_PENDING_OK');
const pdfScript=await readFile(new URL('./pdf-orden-tus-cliente.txt',import.meta.url),'utf8');
const clientScript=await readFile(new URL('./paquete-universal-cliente.mjs',import.meta.url),'utf8');
const start=clientScript.indexOf('export function convertirTrabajoZIPUniversal(');
const end=clientScript.indexOf('async function obtenerArchivo(',start);
assert.ok(start>=0&&end>start);
const code=pdfScript+'\n'+
 "const name=i=>'PDF_'+String(i+1).padStart(2,'0')+'.pdf';\n"+
 clientScript.slice(start,end).replace('export function convertirTrabajoZIPUniversal','function convertirTrabajoZIPUniversal')+
 '\ninstruccionesPdf(manifest);';
const instruction=vm.runInNewContext(code,{manifest,Blob,TextEncoder,console},{
 timeout:10000,filename:'saber-zip-instrucciones-browser.js'});
assert.ok(instruction instanceof Blob);
assert.ok(instruction.size>400&&instruction.size<2*1048576);
const instructionBytes=Buffer.from(await instruction.arrayBuffer());
assert.equal(instructionBytes.subarray(0,5).toString(),'%PDF-');
assert.ok(instructionBytes.includes(Buffer.from('/MediaBox [0 0 595 842]')),
 'INSTRUCTION_A4_MISSING');
console.log('PILOT_026_A4_INSTRUCTIONS_PDF_CREATED_FROM_BROWSER_CODE_BYTES='+instruction.size);
const filename='/tmp/SABER_ORDEN_026_POSTPAGO_TEST.zip';
const fh=await open(filename,'w');
let ended=false;
const output={
 async write(chunk){
  const bytes=Buffer.from(chunk);
  let cursor=0;
  while(cursor<bytes.length){
   const res=await fh.write(bytes,cursor,bytes.length-cursor);
   assert.ok(res.bytesWritten>0);cursor+=res.bytesWritten;
  }
 },
 async close(){if(!ended){ended=true;await fh.close()}},
 async abort(){if(!ended){ended=true;await fh.close()}}
};
const entries=manifest.trabajos.map((t,i)=>({
 name:'PDF_'+String(i+1).padStart(2,'0')+'.pdf',
 expectedBytes:t.bytes,expectedSha256:t.sha256,
 open:async()=>{const response=await post('/prueba-v2/api/ensayo-universal-descargar-personal',{
  webOrderId:web,fileId:t.fileId},{binary:true,timeout:200000});
  assert.equal(Number(response.headers.get('Content-Length')),t.bytes);
  return response.body;
 }
}));
entries.push({name:'ORDEN_026_INSTRUCCIONES.pdf',
 expectedBytes:instruction.size,expectedSha256:sha(instructionBytes),
 open:async()=>instruction.stream()});
const res=await escribirZipUniversal({entries,output,
 onProgress:p=>{if(p.file===p.count&&p.bytes===p.totalBytes)
  console.log('PILOT_026_ZIP_STREAM_BYTES_VERIFIED='+p.totalBytes)}
});
assert.equal(res.ok,true);assert.equal(res.files,3);
assert.equal(res.originalBytes,manifest.trabajos[0].bytes+
 manifest.trabajos[1].bytes+instruction.size);
console.log('PILOT_026_ZIP_COMPLETE_3_ENTRIES_BYTES='+res.zipBytes);
console.log('PILOT_026_ZIP_FILE_PATH='+filename);
console.log('PILOT_026_NO_REAL_PAYMENTS_NO_NEW_ORDER_NO_PRODUCTION_AUTH');
