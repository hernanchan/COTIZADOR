/** Ensayo de carga extrema, sin fotos reales ni datos de clientes.
 * Inserta segmentos COM JPEG válidos para simular recortes grandes,
 * conservando el JPEG auténtico de 886 x 886 y dimensiones verificables.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {inflateSync} from 'node:zlib';
import {createHash,webcrypto} from 'node:crypto';
import {generarPdfExpress,EXPRESS} from '../integraciones/polaroids/express/motor-pdf.mjs';
const require=createRequire(new URL('../integraciones/polaroids/express/package.json',import.meta.url));
const {PDFDocument,rgb}=require('pdf-lib');
const original=new Uint8Array(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));

// Marcadores FF FE (comentarios JPEG) preceden a los segmentos originales.
function jpegGrande(seed,target=445000){
 const segments=[original.subarray(0,2)];let state=(seed*987654321)>>>0;
 let remaining=target-original.length;
 while(remaining>0){
  const count=Math.min(65000,remaining-4);
  const mark=new Uint8Array(count+4);
  mark[0]=255;mark[1]=254;mark[2]=(count+2)>>>8;mark[3]=(count+2)&255;
  for(let i=4;i<mark.length;i++){
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   mark[i]=state>>>24;
  }
  segments.push(mark);remaining-=mark.length;
 }
 segments.push(original.subarray(2));
 const out=new Uint8Array(segments.reduce((n,x)=>n+x.length,0));
 let offset=0;for(const segment of segments){out.set(segment,offset);offset+=segment.length}
 assert.ok(out.length>=440000&&out.length<=EXPRESS.maxRecorteBytes);
 return out;
}
const hojas=Array.from({length:4},(_,sheet)=>
 Array.from({length:6},(_,i)=>jpegGrande(sheet*6+i+1)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('24 fotos JPG grandes: un PDF real privado bajo 12MB y 4 A4',async()=>{
 assert.equal(hojas.flat().length,24);
 assert.ok(hojas.flat().every(x=>x.length<=450000));
 const result=await generarPdfExpress({hojas,pdfLib:{PDFDocument,rgb}});
 assert.equal(result.hojas,4);assert.equal(result.fotos,24);
 assert.ok(result.pdfBytes.length>8*1024*1024,
  'El ensayo debe usar un PDF de carga importante');
 assert.ok(result.pdfBytes.length<=EXPRESS.maxPdfBytes);
 assert.ok(Math.ceil(result.pdfBytes.length/3)*4<17*1024*1024);
 const doc=await PDFDocument.load(result.pdfBytes);
 assert.equal(doc.getPageCount(),4);
 assert.ok(doc.getPages().every(p=>Math.abs(p.getWidth()-595.2756)<.1));
 assert.ok(doc.getPages().every(p=>Math.abs(p.getHeight()-841.8898)<.1));
});

test('24 fotos JPG grandes: PDF idéntico entre dos reintentos',async()=>{
 const a=await generarPdfExpress({hojas,pdfLib:{PDFDocument,rgb}});
 const b=await generarPdfExpress({hojas,pdfLib:{PDFDocument,rgb}});
 assert.equal(hash(a.pdfBytes),hash(b.pdfBytes));
});
