import test from 'node:test';
import assert from 'node:assert/strict';
import {open,stat} from 'node:fs/promises';
import pdfjsImport from 'pdfjs-dist/legacy/build/pdf.js';
import {leerMedidasPdfGrandeLocal}
 from '../integraciones/autocotizador/recepcion/medidas-pdf-file-local-rangos.mjs';
const pdfjs=pdfjsImport.default??pdfjsImport;
const path=process.env.SABER_TEST_A1_150MIB;
if(!path)throw Error('SABER_TEST_A1_150MIB obligatorio para ensayo local');
test('cotización local A1 150 MiB con file.slice sin subir a R2 ni cargar completo',async()=>{
 const fd=await open(path,'r');
 let calls=0,totalBytes=0;
 try{
  const size=(await stat(path)).size;
  assert.equal(size,150*1024*1024);
  const file={
   name:'panel-A1.pdf',size,
   arrayBuffer(){throw Error('PROHIBIDO_FILE_ARRAYBUFFER_COMPLETO')},
   slice(start,end){
    const length=end-start;
    assert.ok(start>=0&&length<=2*1024*1024&&end<=size);
    return {size:length,async arrayBuffer(){
     calls++;totalBytes+=length;
     const result=Buffer.alloc(length);
     let read=0;
     while(read<length){
      const r=await fd.read(result,read,length-read,start+read);
      if(r.bytesRead<=0)throw Error('ENSAYO_EOF');
      read+=r.bytesRead;
     }
     return result.buffer.slice(result.byteOffset,result.byteOffset+length);
    }};
   }
  };
  const metrics=await leerMedidasPdfGrandeLocal(file,{pdfjs});
  assert.equal(metrics.total,1);
  assert.equal(metrics.lector,'PDFJS_FILE_SLICE');
  assert.ok(Math.abs(metrics.paginas[0].anchoCm-59.4)<0.1);
  assert.ok(Math.abs(metrics.paginas[0].altoCm-84.1)<0.1);
  assert.equal(metrics.bytesAnalizados,totalBytes);
  assert.equal(metrics.fragmentosLeidos,calls);
  assert.ok(totalBytes<1024*1024);
  assert.equal(metrics.r2UploadPerformed,false);
  assert.equal(metrics.aptoParaCobro,false);
  console.log('COTIZADOR_LOCAL_A1_150MIB_NO_R2 bytes_read='+totalBytes+' slices='+calls);
 }finally{await fd.close()}
});
