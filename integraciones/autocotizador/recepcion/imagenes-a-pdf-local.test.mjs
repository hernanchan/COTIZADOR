import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {PDFDocument} from 'pdf-lib';
import {normalizarArchivosImpresion} from './imagenes-a-pdf-local.mjs';
function crc32(bytes){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let k=0;k<8;k++)
  crc=(crc>>>1)^(crc&1?0xedb88320:0)}
 return (crc^0xffffffff)>>>0;
}
const u32=n=>Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
function png(width,height){
 const chunk=(type,bytes)=>{
  const label=Buffer.from(type);
  return Buffer.concat([u32(bytes.length),label,bytes,u32(crc32(Buffer.concat([label,bytes])))]);
 };
 const head=Buffer.concat([u32(width),u32(height),Buffer.from([8,2,0,0,0])]);
 const raw=Buffer.alloc((width*3+1)*height,0);
 for(let y=0;y<height;y++)raw[y*(width*3+1)]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),
  chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const photo=(name='foto.png')=>new File([png(16,12)],name,{type:'image/png'});
test('11 imágenes crean 2 PDF (10+1) con páginas íntegramente embebidas',async()=>{
 const a=await normalizarArchivosImpresion(Array.from({length:11},(_,i)=>photo('foto'+i+'.png')),{agruparImagenes:true});
 assert.equal(a.images,11);assert.equal(a.files.length,2);
 const pdf1=await PDFDocument.load(await a.files[0].arrayBuffer());
 const pdf2=await PDFDocument.load(await a.files[1].arrayBuffer());
 assert.equal(pdf1.getPageCount(),10);assert.equal(pdf2.getPageCount(),1);
 for(const f of a.files){assert.equal(f.type,'application/pdf');assert.match(f.name,/\.pdf$/)}
});
test('los PDF existentes no se modifican y el orden se conserva',async()=>{
 const original=new File([Buffer.from('%PDF-1.5 mock')],'apunte.pdf',{type:'application/pdf'});
 const a=await normalizarArchivosImpresion([photo(),original,photo('dos.png')]);
 assert.equal(a.files.length,3);assert.equal(a.files[1],original);
});
test('rechaza extensión que no coincida con bytes, SVG y exceso de imágenes',async()=>{
 await assert.rejects(normalizarArchivosImpresion([
  new File([Buffer.from('test')],'falsa.png',{type:'image/png'})
 ]),/fuera del máximo|no coincide/);
 await assert.rejects(normalizarArchivosImpresion([
  new File([Buffer.from('<svg></svg>')],'vector.svg',{type:'image/svg+xml'})
 ]),/Sólo se admiten/);
 await assert.rejects(normalizarArchivosImpresion(
  Array.from({length:31},()=>photo())),/Máximo 30/);
});

test('configuraciones separadas: dos JPG/PNG generan dos PDF individuales y nombres distintos',async()=>{
 const a=await normalizarArchivosImpresion([photo('COLOR OBRA 180.png'),photo('BN COMUN.png')]);
 assert.equal(a.images,2);
 assert.equal(a.files.length,2);
 assert.match(a.files[0].name,/COLOR OBRA 180/);
 assert.match(a.files[1].name,/BN COMUN/);
 assert.notEqual(a.files[0].name,a.files[1].name);
 for(const file of a.files){
  const doc=await PDFDocument.load(await file.arrayBuffer());
  assert.equal(doc.getPageCount(),1,'Cada imagen debe tener una ficha individual');
 }
});
test('dos fotos de mismo nombre se diferencian por índice en modo individual',async()=>{
 const a=await normalizarArchivosImpresion([photo('imagen.png'),photo('imagen.png')]);
 assert.notEqual(a.files[0].name,a.files[1].name);
 assert.equal(a.files.length,2);
});
test('configuración común explícita sigue permitiendo grupos de 10 fotos',async()=>{
 const a=await normalizarArchivosImpresion(Array.from({length:21},(_,i)=>photo('img'+i+'.png')),
  {agruparImagenes:true});
 assert.equal(a.files.length,3);
 const pages=await Promise.all(a.files.map(async f=>
  (await PDFDocument.load(await f.arrayBuffer())).getPageCount()));
 assert.deepEqual(pages,[10,10,1]);
});
