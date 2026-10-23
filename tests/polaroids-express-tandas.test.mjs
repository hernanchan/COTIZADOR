import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {prepararTandasExpress} from '../integraciones/polaroids/express/preparar-tandas.mjs';
import {generarPdfExpress} from '../integraciones/polaroids/express/motor-pdf.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const pdfLib=require('pdf-lib');
const jpeg=new Uint8Array(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const photos=n=>Array.from({length:Math.ceil(n/6)},(_,h)=>
 Array.from({length:Math.min(6,n-h*6)},(_,i)=>({idx:h*6+i})));
const blob=new Blob([jpeg],{type:'image/jpeg'});
test('procesa 24 fotografías secuencialmente por hojas de seis',async()=>{
 const stages=[];let calls=0;
 const result=await prepararTandasExpress({
  hojas:photos(24),recortarFoto:async p=>{calls++;return blob},
  onAvance:x=>stages.push(x)
 });
 assert.equal(result.fotos,24);assert.equal(result.hojasA4,4);
 assert.equal(result.precioOrientativo,12000);
 assert.deepEqual(result.hojas.map(x=>x.length),[6,6,6,6]);
 assert.equal(stages.length,24);assert.equal(calls,24);
 assert.equal(stages[5].hoja,1);assert.equal(stages[6].hoja,2);
 assert.equal(stages[23].fotosPreparadas,24);
 assert.equal(result.originalesEnviados,false);
 assert.equal(result.pdfEnDispositivo,false);
 const pdf=await generarPdfExpress({hojas:result.hojas,pdfLib});
 assert.equal((await pdfLib.PDFDocument.load(pdf.pdfBytes)).getPageCount(),4);
});
test('puede comprimir con calidad adaptativa y aceptar última hoja incompleta',async()=>{
 let calls=0;
 const result=await prepararTandasExpress({hojas:photos(19),
  recortarFoto:async (p,quality)=>{
   calls++;
   return p.idx===0&&quality===.82?
    new Blob([new Uint8Array(800000)],{type:'image/jpeg'}):blob;
  }});
 assert.deepEqual(result.hojas.map(x=>x.length),[6,6,6,1]);
 assert.equal(calls,20);
});
test('bloquea 25 fotos, tandas incompletas y cancelación a mitad',async()=>{
 await assert.rejects(prepararTandasExpress({
  hojas:photos(25),recortarFoto:async()=>blob
 }));
 await assert.rejects(prepararTandasExpress({
  hojas:[photos(5)[0],photos(6)[0]],recortarFoto:async()=>blob
 }));
 let checked=0;
 await assert.rejects(prepararTandasExpress({
  hojas:photos(12),recortarFoto:async()=>blob,cancelado:()=>++checked>5
 }),/cancelada/);
 await assert.rejects(prepararTandasExpress({
  hojas:photos(6),recortarFoto:async()=>new Blob([new Uint8Array(900000)],{type:'image/jpeg'})
 }),/peso/);
});
