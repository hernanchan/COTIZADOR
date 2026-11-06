import test from 'node:test';
import assert from 'node:assert/strict';
import {abrirRangosR2Privados,R2_RANGE_LIMITS,
 verificarReferenciaR2ParaRangos}
 from '../integraciones/autocotizador/recepcion/r2-lectura-parcial-segura.mjs';

const MiB=1024*1024,bytes=200*MiB;
const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const uuid='12345678-1234-4123-8123-123456789abc';
const key='r2-v1/'+orderId+'/'+uuid+'.pdf';
const receiptId='DOC-'+uuid,etag='etag-original-200MiB-001';
const entry={webOrderId:orderId,receiptId,objectKey:key,
 sha256:'c'.repeat(64),bytes,etag,status:'awaiting_pdf_analysis',
 contenidoPdfVerificado:false,registeredInD1:false,paymentAuthorized:false};
function storage({changeAfterHead=false,trim=false,overflow=false,headSize=bytes}={}){
 const calls=[];
 let reads=0,headCalls=0;
 const bucket={
  head:async k=>{assert.equal(k,key);headCalls++;
   return {size:headSize,etag}},
  get:async(k,opts)=>{
   reads++;assert.equal(k,key);
   assert.equal(opts.onlyIf.etagMatches,etag);
   const {offset,length}=opts.range;
   calls.push({offset,length});
   const transmitted=length+(overflow?1:0)-(trim?1:0);
   const body=new ReadableStream({
    start(controller){
     const b=new Uint8Array(transmitted);
     for(let i=0;i<b.length;i++)b[i]=(offset+i)%251;
     if(offset===0)b.set(new TextEncoder().encode('%PDF-'));
     controller.enqueue(b);controller.close();
    }
   });
   return {size:bytes,etag:changeAfterHead?'etag-different':etag,body};
  }
 };
 return {bucket,calls,get reads(){return reads},get headCalls(){return headCalls}};
}
test('200MiB: leer solo cabecera y cola sin descargar el objeto completo',async()=>{
 const f=storage();
 const reader=await abrirRangosR2Privados({bucket:f.bucket,entry});
 const start=await reader.leerInicio(1024);
 assert.equal(new TextDecoder().decode(start.subarray(0,5)),'%PDF-');
 const end=await reader.leerFinal(1024);
 assert.equal(start.length,1024);assert.equal(end.length,1024);
 assert.deepEqual(f.calls,[{offset:0,length:1024},{offset:bytes-1024,length:1024}]);
 assert.equal(reader.requests,2);
 assert.equal(reader.budget,R2_RANGE_LIMITS.maxTotalReadBytes-2048);
 assert.equal(reader.bytes,bytes);
 assert.equal(f.headCalls,1);
 assert.equal(f.reads,2);
});
test('rechaza rangos invalidos y no consulta R2',async()=>{
 const f=storage(),reader=await abrirRangosR2Privados({bucket:f.bucket,entry});
 for(const [offset,length]of [[-1,1],[0,0],[bytes-5,6],[0,3*MiB],
  [0,NaN],[1.5,2],[Number.MAX_SAFE_INTEGER,1]]){
  await assert.rejects(reader.leer(offset,length),/R2_RANGE_/);
 }
 assert.equal(f.reads,0);
});
test('no supera presupuesto de 64 MiB aunque el PDF ocupe 200 MiB',async()=>{
 const f=storage(),reader=await abrirRangosR2Privados({bucket:f.bucket,entry});
 for(let i=0;i<32;i++){
  await reader.leer(i*2*MiB,2*MiB);
 }
 assert.equal(f.reads,32);assert.equal(reader.budget,0);
 await assert.rejects(reader.leer(100*MiB,1024),/R2_RANGE_PRESUPUESTO_AGOTADO/);
 assert.equal(f.reads,32);
});
test('bloquea D1 de orden ajena, ETag cambio, tramo truncado y bytes de mas',async()=>{
 for(const bad of [
  {...entry,webOrderId:'WEB-OTRO-0001'},
  {...entry,receiptId:'DOC-12345678-1234-4123-8123-223456789abc'},
  {...entry,registeredInD1:true},
  {...entry,paymentAuthorized:true},
  {...entry,bytes:280*MiB}
 ]){
  assert.throws(()=>verificarReferenciaR2ParaRangos(bad),/R2_RANGE_/);
 }
 const wrongHead=storage({headSize:bytes-1});
 await assert.rejects(abrirRangosR2Privados({bucket:wrongHead.bucket,entry}),
  /R2_RANGE_OBJETO_DISTINTO_DE_D1/);
 assert.equal(wrongHead.reads,0);
 for(const settings of [{changeAfterHead:true},{trim:true},{overflow:true}]){
  const f=storage(settings);
  const reader=await abrirRangosR2Privados({bucket:f.bucket,entry});
  await assert.rejects(reader.leer(0,1024),/R2_RANGE_/);
  assert.equal(f.reads,1);
 }
});
test('truncado o ETag viejo bloquea un segundo intento y descuenta presupuesto',async()=>{
 const f=storage({trim:true}),reader=await abrirRangosR2Privados({bucket:f.bucket,entry});
 await assert.rejects(reader.leer(200,2000),/LECTURA_INCOMPLETA/);
 assert.equal(reader.budget,R2_RANGE_LIMITS.maxTotalReadBytes-2000);
});
