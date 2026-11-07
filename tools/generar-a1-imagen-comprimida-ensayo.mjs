#!/usr/bin/env node
/* Ensayo negativo: A1 con imagen YA comprimida (no JPEG, sin calidad perdida).
 * El optimizador lossless no debe prometer reducirla ni entregar copia falsa.
 * Solo datos aleatorios de laboratorio. ~16MiB.
 */
import {randomBytes} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {open,stat} from 'node:fs/promises';
const path=process.argv[2];
if(process.argv.length!==3||!/\.pdf$/i.test(path||''))
 throw Error('Uso: node tools/generar-a1-imagen-comprimida-ensayo.mjs salida.pdf');
const width=2048,height=2730,raw=randomBytes(width*height*3);
const compressed=deflateSync(raw,{level:6});
const fd=await open(path,'wx',0o600);
let offset=0;const positions={};
async function push(data){
 const bytes=Buffer.isBuffer(data)?data:Buffer.from(data,'ascii');
 let written=0;
 while(written<bytes.length){
  const r=await fd.write(bytes,written,bytes.length-written);
  if(!r.bytesWritten)throw Error('ENSAYO_ESCRITURA_INCOMPLETA');
  written+=r.bytesWritten;
 }
 offset+=bytes.length;
}
async function object(n,content){positions[n]=offset;await push(n+' 0 obj\n'+content+'\nendobj\n')}
try{
 await push('%PDF-1.4\n');
 await object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 await object(2,'<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
 await object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1683.78 2383.94] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
 const commands='q\n1683.78 0 0 2383.94 0 0 cm\n/Im0 Do\nQ\n';
 positions[4]=offset;
 await push('4 0 obj\n<< /Length '+Buffer.byteLength(commands)+' >>\nstream\n');
 await push(commands);
 await push('endstream\nendobj\n');
 positions[5]=offset;
 await push('5 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter /FlateDecode /Length '+compressed.length+' >>\nstream\n');
 await push(compressed);
 await push('\nendstream\nendobj\n');
 const startxref=offset;
 const xref=n=>String(positions[n]).padStart(10,'0')+' 00000 n \n';
 await push('xref\n0 6\n0000000000 65535 f \n'+
  xref(1)+xref(2)+xref(3)+xref(4)+xref(5)+
  'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+startxref+'\n%%EOF\n');
}finally{await fd.close()}
const total=(await stat(path)).size;
if(total<12*1024*1024||total>20*1024*1024)throw Error('ENSAYO_NO_INCOMPRESIBLE');
console.log('PDF_A1_IMAGEN_FLATE_COMPRIMIDA_VALIDO sizeBytes='+total);
