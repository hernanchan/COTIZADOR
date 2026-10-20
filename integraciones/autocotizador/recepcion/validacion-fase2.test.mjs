import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { verificarPdfAlmacenado } from './verificacion-pdf-drive-servidor.mjs';

const base={receiptState:'bytes_checked',
  receiptId:'DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9',
  orderId:'WEB-PILOTO-UN-PDF-20261020',fileId:'pdf-prueba',
  name:'pdf-prueba__ensayo.pdf',mode:'bn'};
const sha=b=>createHash('sha256').update(b).digest('hex');
async function sample(pages) {
  const doc=await PDFDocument.create();
  for(let i=0;i<pages;i++) doc.addPage([595,842]);
  const bytes=await doc.save();
  return {bytes,receipt:{...base,bytes:bytes.byteLength,sha256:sha(bytes)}};
}
test('PDF real generado: 1, 3 y 11 páginas',async()=>{
  for(const n of [1,3,11]){
    const {bytes,receipt}=await sample(n);
    const result=await verificarPdfAlmacenado({driveBytes:bytes,reciboServidor:receipt});
    assert.equal(result.pages,n);
    assert.equal(result.status,'verified');
    assert.equal(result.pageVerification,'server');
    assert.equal(result.storageVerified,true);
  }
});
test('No acepta bytes modificados aunque el cliente declare páginas',async()=>{
 const {bytes,receipt}=await sample(3);
 const changed=Uint8Array.from(bytes);
 changed[changed.length-20]^=1;
 await assert.rejects(
  verificarPdfAlmacenado({driveBytes:changed,reciboServidor:receipt}),
  /difiere del original/);
});
test('No acepta estado recibido sin integridad, ni cantidad inventada',async()=>{
 const {bytes,receipt}=await sample(2);
 await assert.rejects(verificarPdfAlmacenado({
   driveBytes:bytes,reciboServidor:{...receipt,receiptState:'receiving'}
 }),/comprobante íntegro/);
 await assert.rejects(verificarPdfAlmacenado({
   driveBytes:bytes,reciboServidor:{...receipt,bytes:bytes.length+1}
 }),/comprobante de Drive/);
});
test('Un PDF corrupto que conserve su hash NO se considera verificado',async()=>{
 const corrupt=Uint8Array.from('%PDF-1.4\nEsto no es un PDF valido',c=>c.charCodeAt(0));
 await assert.rejects(verificarPdfAlmacenado({
   driveBytes:corrupt,reciboServidor:{...base,bytes:corrupt.length,sha256:sha(corrupt)}
 }),/estructura de páginas/);
});
