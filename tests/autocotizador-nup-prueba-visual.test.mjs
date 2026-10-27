/** Pruebas visuales reproducibles N-up sin usar PDF de clientes ni redes externas.
 * Emite PDF vectorial etiquetado en artifacts/nup-control para inspección humana.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {componerDocumentoPdfPrivado} from '../integraciones/autocotizador/recepcion/componer-pdf-documentos-privado.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument,rgb,StandardFonts}=require('pdf-lib');
const output=new URL('../artifacts/nup-control/',import.meta.url);
async function source(count){
 const doc=await PDFDocument.create();
 const font=await doc.embedFont(StandardFonts.HelveticaBold);
 for(let i=1;i<=count;i++){
  const p=doc.addPage([595.275591,841.889764]);
  const color=rgb(((i*2)%7+1)/9,((i*3)%7+1)/9,((i*5)%7+1)/9);
  p.drawRectangle({x:16,y:16,width:563,height:810,borderWidth:3,borderColor:color});
  p.drawText('PAGINA ORIGINAL '+String(i).padStart(2,'0'),{
   x:65,y:690,size:32,font,color
  });
  p.drawText('ARRIBA  |  LIBRERIA SABER  |  CONTROL VECTORIAL',{
   x:65,y:790,size:12,font,color:rgb(.2,.2,.2)
  });
  p.drawText('ABAJO  |  revisar orden y orientacion',{
   x:65,y:40,size:12,font,color:rgb(.2,.2,.2)
  });
 }
 return new Uint8Array(await doc.save());
}
const runs=[
 {name:'01-A4-vertical-2porcara-simple',num:5,nup:2,format:'a4',orientation:'vertical',copies:1,duplex:false,expectedFaces:3,expectedSheets:3},
 {name:'02-A4-horizontal-2porcara-simple',num:5,nup:2,format:'a4',orientation:'horizontal',copies:1,duplex:false,expectedFaces:3,expectedSheets:3},
 {name:'03-A4-vertical-4porcara-doble-dosjuegos',num:5,nup:4,format:'a4',orientation:'vertical',copies:2,duplex:true,expectedFaces:4,expectedSheets:2},
 {name:'04-A3-horizontal-9porcara-doble',num:19,nup:9,format:'a3',orientation:'horizontal',copies:1,duplex:true,expectedFaces:4,expectedSheets:2}
];
for(const c of runs){
 test('control vectorial '+c.name,async()=>{
  const orig=await source(c.num);
  const res=await componerDocumentoPdfPrivado({
   pdfOriginal:orig,paginas:Array.from({length:c.num},(_,i)=>i+1),
   formatoHoja:c.format,orientacion:c.orientation,
   paginasPorCara:c.nup,copias:c.copies,dobleFaz:c.duplex
  });
  const out=await PDFDocument.load(res.pdfBytes);
  assert.equal(out.getPageCount(),c.expectedFaces);
  assert.equal(res.ficha.hojasFisicas,c.expectedSheets);
  assert.equal(res.ficha.caras.length,c.expectedFaces);
  assert.equal(res.ficha.caras.filter(x=>x.enBlanco).length,
   c.duplex&&Math.ceil(c.num/c.nup)%2?c.copies:0);
  assert.equal(res.ficha.paymentAuthorized,false);
  assert.equal(res.ficha.listoParaProducir,false);
  assert.equal(res.ficha.guardadoEnDrive,false);
  const placed=res.ficha.caras.flatMap(f=>f.paginas.map(p=>p.paginaOriginal));
  assert.equal(placed.length,c.num*c.copies);
  for(let copy=0;copy<c.copies;copy++)
   assert.deepEqual(placed.slice(copy*c.num,(copy+1)*c.num),
    Array.from({length:c.num},(_,i)=>i+1));
  const size=out.getPage(0).getSize();
  for(const face of res.ficha.caras){
   for(const pos of face.paginas){
    assert.ok(pos.x>=0&&pos.y>=0&&pos.x+pos.ancho<=size.width+.01&&
     pos.y+pos.alto<=size.height+.01,'Caja fuera de hoja');
   }
  }
  mkdirSync(output,{recursive:true});
  writeFileSync(new URL(c.name+'.pdf',output),res.pdfBytes);
 });
}
