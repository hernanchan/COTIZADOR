import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {pdfFotosEnsayoReproducible} from
 '../integraciones/publicacion/pdf-fotos-ensayo-reproducible.mjs';
test('PDF fotográfico QA conserva los bytes tras 3 ejecuciones separadas',async()=>{
 const a=pdfFotosEnsayoReproducible();
 const b=pdfFotosEnsayoReproducible();
 const c=pdfFotosEnsayoReproducible();
 assert.deepEqual(a,b);assert.deepEqual(b,c);
 const h=x=>createHash('sha256').update(x).digest('hex');
 assert.equal(h(a),h(b));assert.equal(h(b),h(c));
 const pdf=await PDFDocument.load(a);
 assert.equal(pdf.getPageCount(),2);
 for(const page of pdf.getPages()){
  assert.ok(Math.abs(page.getWidth()-283.46)<0.01);
  assert.ok(Math.abs(page.getHeight()-425.20)<0.01);
 }
 assert.equal(Buffer.from(a).toString('utf8',0,5),'%PDF-');
});
