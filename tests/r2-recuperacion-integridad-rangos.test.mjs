import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verificarObjetoR2Reservado}
 from '../integraciones/autocotizador/recepcion/r2-pdf-integridad-stream.mjs';

const bytes=41*1024*1024;
const orderId='WEB-ENSAYO-'+'A'.repeat(32);
const objectKey='r2-v1/'+orderId+'/12345678-1234-4123-8123-123456789abc.pdf';
const etag='etag-123456789012';
const header=Uint8Array.from([37,80,68,70,45]);
function block(offset,length){
 const content=new Uint8Array(length);
 if(offset===0)content.set(header,0);
 return content;
}
function expectedSha(){
 const h=createHash('sha256');
 for(let off=0;off<bytes;off+=8*1024*1024)
  h.update(block(off,Math.min(8*1024*1024,bytes-off)));
 return h.digest('hex');
}
const sha=expectedSha();
function fixture(){
 let head=0,get=0;
 const bucket={
  async head(key){head++;assert.equal(key,objectKey);return {size:bytes,etag}},
  async get(key,{range,onlyIf}){
   get++;assert.equal(key,objectKey);
   assert.equal(onlyIf.etagMatches,etag);
   return {arrayBuffer:async()=>block(range.offset,range.length).buffer};
  }
 };
 function digestFactory(algorithm){
  assert.equal(algorithm,'SHA-256');
  const h=createHash('sha256');
  let done;
  const digest=new Promise(resolve=>{done=resolve});
  return {digest,getWriter:()=>({
   write:async b=>{h.update(b)},
   close:async()=>{done(h.digest())},
   abort:async()=>{done(Buffer.alloc(32))}
  })};
 }
 const reserva={found:true,objectKey,orderId,fileId:'planoA1',sha256:sha,bytes};
 return {bucket,digestFactory,reserva,get head(){return head},
  get reads(){return get}};
}
test('R2 completo: valida SHA por 6 lecturas acotadas y no autoriza producción',async()=>{
 const f=fixture();
 const d=await verificarObjetoR2Reservado({bucket:f.bucket,reserva:f.reserva,
  digestFactory:f.digestFactory});
 assert.equal(d.sha256Verificado,true);
 assert.equal(d.sha256,sha);assert.equal(d.bytes,bytes);
 assert.equal(d.contenidoPdfVerificado,false);
 assert.equal(d.paymentAuthorized,false);assert.equal(d.listoParaProducir,false);
 assert.equal(f.head,1);assert.equal(f.reads,6);
});
test('SHA incorrecto no permite registrar el PDF recuperado',async()=>{
 const f=fixture();
 await assert.rejects(verificarObjetoR2Reservado({bucket:f.bucket,
  reserva:{...f.reserva,sha256:'0'.repeat(64)},
  digestFactory:f.digestFactory}),/R2_SHA256_NO_COINCIDE/);
});
test('objeto de otra orden se rechaza antes de leer R2',async()=>{
 const f=fixture();
 await assert.rejects(verificarObjetoR2Reservado({bucket:f.bucket,
  reserva:{...f.reserva,orderId:'WEB-ENSAYO-'+'B'.repeat(32)},
  digestFactory:f.digestFactory}),/R2_RESERVA_NO_CONFIABLE/);
 assert.equal(f.head,0);assert.equal(f.reads,0);
});
