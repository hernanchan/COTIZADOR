import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {iniciarR2Grande} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs';
import {verificarIntegridadR2Grande} from '../integraciones/autocotizador/recepcion/r2-pdf-integridad-stream.mjs';

const chunkBytes=1024*1024;
const makeParts=(n,{corrupt=false,pdf=true,short=false}={})=>{
 let count=0;
 return new ReadableStream({pull(controller){
  if(count>=n-(short?1:0)){controller.close();return;}
  const block=new Uint8Array(chunkBytes);
  if(count===0&&pdf)block.set(new TextEncoder().encode('%PDF-'));
  if(count===1&&corrupt)block[17]=71;
  controller.enqueue(block);
  count++;
 }});
};
const hashForParts=(n,{corrupt=false,pdf=true}={})=>{
 const h=createHash('sha256');const block=new Uint8Array(chunkBytes);
 for(let i=0;i<n;i++){
  block.fill(0);
  if(i===0&&pdf)block.set(new TextEncoder().encode('%PDF-'));
  if(i===1&&corrupt)block[17]=71;
  h.update(block);
 }
 return h.digest('hex');
};
const digestFactory=()=>{
 const h=createHash('sha256');
 let resolve,reject;
 const digest=new Promise((yes,no)=>{resolve=yes;reject=no});
 const writer=new WritableStream({
  write(chunk){h.update(chunk)},
  close(){resolve(h.digest())},
  abort(e){reject(e)}
 });
 writer.digest=digest;
 return writer;
};
const secret='saber-pruebas-clave-R2-ensayo-hash-falso-para-pruebas-64';
const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const now=()=>1793970000;
const uuid=()=> '12345678-1234-4123-8123-123456789abc';
async function setup(n,opts={}){
 const bytes=n*chunkBytes,sha=hashForParts(n);
 const meta={fileId:'pdf-grande',name:'PDF_Original.pdf',mode:'bn',
  bytes,pages:25,sha256:sha};
 const key='r2-v1/'+orderId+'/'+uuid()+'.pdf';
 const bucket={
  createMultipartUpload:async()=>({uploadId:'ensayo-r2-hash'}), 
  get:async name=>{
   assert.equal(name,key);
   return {size:opts.size??bytes,body:makeParts(n,opts)};
  }
 };
 const s=await iniciarR2Grande({bucket,orderId,meta,secret,now,uuid,subtle:webcrypto.subtle});
 return {bucket,proof:s.proof,secret,now,subtle:webcrypto.subtle,digestFactory};
}
test('R2 200 MiB: hash SHA-256 desde flujo de 1 MiB, sin buffer entero',async()=>{
 const input=await setup(200);
 const result=await verificarIntegridadR2Grande(input);
 assert.equal(result.bytes,200*chunkBytes);
 assert.equal(result.sha256Verificado,true);
 assert.equal(result.storageReady,true);
 assert.equal(result.contenidoPdfVerificado,false);
 assert.equal(result.registeredInD1,false);
 assert.equal(result.paymentAuthorized,false);
});
test('80 MiB adulterados: SHA distinto no acredita pedido',async()=>{
 const input=await setup(80,{corrupt:true});
 await assert.rejects(verificarIntegridadR2Grande(input),/R2_SHA256_NO_COINCIDE/);
});
test('carga incompleta o tipo diferente nunca es PDF verificado',async()=>{
 await assert.rejects(verificarIntegridadR2Grande(await setup(45,{short:true})),/R2_LONGITUD_INCORRECTA/);
 await assert.rejects(verificarIntegridadR2Grande(await setup(45,{pdf:false})),/R2_NO_ES_PDF/);
 await assert.rejects(verificarIntegridadR2Grande(await setup(45,{size:10})),/R2_OBJETO_INCOMPLETO/);
});

async function setupRango(n,opts={}){
 const input=await setup(n),etag='etag-seguro-r2-rangos-2026';
 const ranges=[];
 input.bucket.head=async()=>({size:n*chunkBytes,etag});
 input.bucket.get=async(name,options)=>{
  assert.equal(typeof name,'string');
  const {offset,length}=options?.range||{};
  assert.equal(options?.onlyIf?.etagMatches,etag);
  assert.ok(Number.isInteger(offset)&&offset>=0);
  assert.ok(length>0&&length<=8*chunkBytes);
  ranges.push({offset,length});
  if(opts.etagCambia&&offset>=8*chunkBytes)return null;
  const bytes=new Uint8Array(length-(opts.truncado?1:0));
  if(offset===0&&!opts.noPdf)bytes.set(new TextEncoder().encode('%PDF-'));
  if(offset===8*chunkBytes&&opts.alterado)bytes[19]=101;
  return {arrayBuffer:async()=>bytes.buffer};
 };
 return {...input,ranges};
}
test('R2 realista 200 MiB: 25 rangos de 8 MiB, ETag fijo y SHA completo',async()=>{
 const f=await setupRango(200);
 const result=await verificarIntegridadR2Grande(f);
 assert.equal(f.ranges.length,25);
 assert.equal(f.ranges[24].offset,192*chunkBytes);
 assert.equal(f.ranges[24].length,8*chunkBytes);
 assert.equal(result.bytes,200*chunkBytes);
 assert.equal(result.sha256,hashForParts(200));
 assert.equal(result.etag,'etag-seguro-r2-rangos-2026');
 assert.equal(result.sha256Verificado,true);
 assert.equal(result.contenidoPdfVerificado,false);
 assert.equal(result.registeredInD1,false);
 assert.equal(result.paymentAuthorized,false);
});
test('R2 rangos rechaza ETag cambiante, truncamiento, corrupción y cabecera ajena',async()=>{
 for(const [flags,pattern] of [
  [{etagCambia:true},/R2_ETAG_O_RANGO_INCORRECTO/],
  [{truncado:true},/R2_LONGITUD_INCORRECTA/],
  [{alterado:true},/R2_SHA256_NO_COINCIDE/],
  [{noPdf:true},/R2_NO_ES_PDF/]
 ]){
  const f=await setupRango(80,flags);
  await assert.rejects(verificarIntegridadR2Grande(f),pattern);
 }
});
