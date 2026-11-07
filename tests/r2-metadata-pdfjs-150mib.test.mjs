import test from 'node:test';
import assert from 'node:assert/strict';
import {open,stat} from 'node:fs/promises';
import pdfjsImport from 'pdfjs-dist/legacy/build/pdf.js';
import {inspeccionarMedidasPdfGrandePorRangos,BIG_PDF_METADATA_LIMITS}
 from '../integraciones/autocotizador/recepcion/medidas-pdf-grande-rangos.mjs';
const pdfjs=pdfjsImport.default??pdfjsImport;
const path=process.env.SABER_TEST_A1_150MIB;
if(!path)throw Error('SABER_TEST_A1_150MIB requerido');
test('A1 150 MiB: PDF.js obtiene medida y paginas leyendo <8 MiB, no rasteriza',async()=>{
 const fd=await open(path,'r');
 let requests=0,bytesRead=0;
 try{
  const size=(await stat(path)).size;
  assert.equal(size,150*1024*1024);
  const reader={bytes:size,maxReadBytes:2*1024*1024,
   async leer(offset,length){
    requests++;bytesRead+=length;
    assert.ok(offset>=0&&offset+length<=size);
    assert.ok(length<=2*1024*1024);
    const buffer=Buffer.alloc(length);
    let read=0;
    while(read<length){
     const data=await fd.read(buffer,read,length-read,offset+read);
     if(!data.bytesRead)throw Error('ENSAYO_EOF');
     read+=data.bytesRead;
    }
    return new Uint8Array(buffer);
   }
  };
  const result=await inspeccionarMedidasPdfGrandePorRangos({reader,pdfjs});
  assert.equal(result.total,1);
  assert.equal(result.paginas.length,1);
  assert.ok(Math.abs(result.paginas[0].anchoCm-59.4)<0.1);
  assert.ok(Math.abs(result.paginas[0].altoCm-84.1)<0.1);
  assert.equal(result.bytes,size);
  assert.ok(result.bytesLeidos<=BIG_PDF_METADATA_LIMITS.maxReadBytes);
  assert.ok(result.solicitudesRango<=BIG_PDF_METADATA_LIMITS.maxCalls);
  assert.equal(result.bytesLeidos,bytesRead);
  assert.equal(result.solicitudesRango,requests);
  assert.equal(result.aptoParaCobro,false);
  assert.equal(result.impresionAutomaticaAutorizada,false);
  console.log('R2_PDF150_A1_METADATA_ONLY bytes_total='+size+
   ' bytes_read='+bytesRead+' calls='+requests+
   ' page='+result.paginas[0].anchoCm+'x'+result.paginas[0].altoCm+'cm');
 }finally{await fd.close()}
});
test('no acepta cabecera falsa ni metadatos con permiso de cobro',async()=>{
 await assert.rejects(inspeccionarMedidasPdfGrandePorRangos({
  reader:{bytes:150*1024*1024,leer:async()=>new Uint8Array(65536)},
  pdfjs
 }),/R2_PDF_CABECERA_NO_VALIDA/);
 assert.equal(BIG_PDF_METADATA_LIMITS.maxReadBytes,8*1024*1024);
});

test('contrato D1+R2: parser por rangos con ETag estable y sin leer 150 MiB',async()=>{
 const {abrirRangosR2Privados}=await import('../integraciones/autocotizador/recepcion/r2-lectura-parcial-segura.mjs');
 const order='WEB-ENSAYO-R2-20261107',uuid='12345678-1234-4123-8123-123456789abc';
 const key='r2-v1/'+order+'/'+uuid+'.pdf',etag='etag-real-reader-20261107';
 const size=(await stat(path)).size;
 const entry={webOrderId:order,receiptId:'DOC-'+uuid,objectKey:key,
  sha256:'a'.repeat(64),bytes:size,etag,status:'awaiting_pdf_analysis',
  contenidoPdfVerificado:false,registeredInD1:false,paymentAuthorized:false};
 const fd=await open(path,'r');
 let getCalls=0,getBytes=0;
 const bucket={
  head:async requested=>{
   assert.equal(requested,key);return {size,etag};
  },
  get:async(requested,opts)=>{
   assert.equal(requested,key);
   assert.equal(opts.onlyIf.etagMatches,etag);
   const {offset,length}=opts.range;
   assert.ok(offset>=0&&length>0&&length<=2*1024*1024);
   getCalls++;getBytes+=length;
   const bytes=new Uint8Array(length);
   let read=0;
   while(read<length){
    const result=await fd.read(bytes,read,length-read,offset+read);
    if(!result.bytesRead)throw Error('ENSAYO_EOF');
    read+=result.bytesRead;
   }
   return {size,etag,body:new ReadableStream({start(ctrl){
    ctrl.enqueue(bytes);ctrl.close()
   }})};
  }
 };
 try{
  const reader=await abrirRangosR2Privados({bucket,entry});
  const result=await inspeccionarMedidasPdfGrandePorRangos({reader,pdfjs});
  assert.equal(result.total,1);
  assert.ok(Math.abs(result.paginas[0].anchoCm-59.4)<0.1);
  assert.ok(Math.abs(result.paginas[0].altoCm-84.1)<0.1);
  assert.equal(reader.requests,getCalls);
  assert.equal(result.bytesLeidos,getBytes);
  assert.ok(result.bytesLeidos<1024*1024);
  assert.equal(result.aptoParaCobro,false);
  console.log('R2_ETAG_D1_ADAPTER_A1_150_METADATA_OK read_bytes='+getBytes+' get_calls='+getCalls);
 }finally{await fd.close()}
});
