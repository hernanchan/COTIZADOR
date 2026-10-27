import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {componerDocumentoPdfPrivado} from '../integraciones/autocotizador/recepcion/componer-pdf-documentos-privado.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument,PDFName,degrees,rgb}=require('pdf-lib');
async function original({count=5,rotation=0}={}){
 const doc=await PDFDocument.create();
 for(let i=0;i<count;i++){
  const p=doc.addPage([595.2756,841.8898]);
  p.drawText('DOCUMENTO ORIGINAL PAGINA '+(i+1),{
   x:35,y:700,size:16,color:rgb(0.1,0.3,0.8)
  });
  p.drawRectangle({x:15,y:15,width:500,height:750,borderWidth:0.6,
   borderColor:rgb(0.5,0.1,0.4)});
  if(rotation&&i===0)p.setRotation(degrees(rotation));
 }
 return doc.save();
}
const approx=(a,b)=>Math.abs(a-b)<.1;
test('1 por cara: se incrusta PDF vectorial con orden de páginas elegido',async()=>{
 const pdfOriginal=await original();
 const res=await componerDocumentoPdfPrivado({pdfOriginal,paginas:[5,2,3]});
 const out=await PDFDocument.load(res.pdfBytes);
 assert.equal(out.getPageCount(),3);
 assert.equal(res.ficha.paginasOriginales,5);
 assert.deepEqual(res.ficha.paginasElegidas,[5,2,3]);
 assert.deepEqual(res.ficha.caras.map(c=>c.paginas.map(p=>p.paginaOriginal)),[[5],[2],[3]]);
 assert.ok(approx(out.getPage(0).getWidth(),595.2756));
 assert.ok(approx(out.getPage(0).getHeight(),841.8898));
 assert.equal(res.ficha.hojasFisicas,3);
 assert.equal(res.ficha.pdfImprimibleVerificado,false);
 assert.equal(res.ficha.guardadoEnDrive,false);
 assert.equal(res.ficha.paymentAuthorized,false);
 assert.equal(res.ficha.listoParaProducir,false);
});
test('2 por cara en A3 horizontal: incrusta dos originales sin recorte',async()=>{
 const r=await componerDocumentoPdfPrivado({
  pdfOriginal:await original(),paginas:[1,2,3,4,5],
  formatoHoja:'a3',orientacion:'horizontal',paginasPorCara:2
 });
 const out=await PDFDocument.load(r.pdfBytes);
 assert.equal(out.getPageCount(),3);
 assert.ok(approx(out.getPage(0).getWidth(),1190.551181));
 assert.ok(approx(out.getPage(0).getHeight(),841.889764));
 assert.deepEqual(r.ficha.caras.map(c=>c.paginas.map(p=>p.paginaOriginal)),[
  [1,2],[3,4],[5]
 ]);
 for(const face of r.ficha.caras)for(const p of face.paginas){
  assert.ok(p.x>=0&&p.y>=0);
  assert.ok(p.x+p.ancho<=1190.56);
  assert.ok(p.y+p.alto<=841.90);
 }
});
test('4 y 9 por cara respetan exactamente selección y distribución',async()=>{
 const pdfOriginal=await original({count:10});
 for(const grid of [4,9]){
  const r=await componerDocumentoPdfPrivado({pdfOriginal,
   paginas:[10,9,8,7,6,5,4,3,2,1],paginasPorCara:grid});
  const out=await PDFDocument.load(r.pdfBytes);
  assert.equal(out.getPageCount(),Math.ceil(10/grid));
  const grouped=r.ficha.caras.flatMap(x=>x.paginas.map(p=>p.paginaOriginal));
  assert.deepEqual(grouped,[10,9,8,7,6,5,4,3,2,1]);
  assert.equal(new Set(grouped).size,10);
 }
});
test('doble faz no mezcla reversos de juegos diferentes',async()=>{
 const r=await componerDocumentoPdfPrivado({
  pdfOriginal:await original(),paginas:[1,2,3],copias:2,dobleFaz:true,paginasPorCara:1
 });
 assert.equal(r.ficha.carasTotales,8);
 assert.equal(r.ficha.hojasFisicas,4);
 assert.deepEqual(r.ficha.caras.map(c=>[c.juego,c.lado,c.enBlanco]),[
  [1,'frente',false],[1,'dorso',false],
  [1,'frente',false],[1,'dorso',true],
  [2,'frente',false],[2,'dorso',false],
  [2,'frente',false],[2,'dorso',true]
 ]);
 assert.equal((await PDFDocument.load(r.pdfBytes)).getPageCount(),8);
});
test('PDF original no se rasteriza: páginas incrustadas como XObjects',async()=>{
 const r=await componerDocumentoPdfPrivado({pdfOriginal:await original({count:1}),paginas:[1]});
 const d=await PDFDocument.load(r.pdfBytes);
 const page=d.getPage(0),resource=page.node.Resources();
 const xobjects=resource.lookup(PDFName.of('XObject'));
 assert.ok(xobjects,'El PDF debe contener el recurso vectorial de la página original');
 assert.ok(r.pdfBytes.length>300);
});
test('rechazar páginas repetidas, cantidad fuera de rango y PDF inválido',async()=>{
 const pdfOriginal=await original();
 for(const options of [
  {paginas:[1,1]},{paginas:[0]},{paginas:[7]},
  {paginas:[1],paginasPorCara:6},{paginas:[1],copias:0},
  {paginas:[1],copias:201},{paginas:[1],margenMm:26},
  {paginas:[1],formatoHoja:'a0'},{paginas:[1],orientacion:'automatica'},
  {paginas:[1],dobleFaz:'si'}
 ]){
  await assert.rejects(componerDocumentoPdfPrivado({
   pdfOriginal,paginas:[1],...options
  }));
 }
 await assert.rejects(componerDocumentoPdfPrivado({
  pdfOriginal:new Uint8Array(120),paginas:[1]
 }),/PDF/);
});
test('rechazar rotación especial antes de producir una hoja incorrecta',async()=>{
 await assert.rejects(componerDocumentoPdfPrivado({
  pdfOriginal:await original({rotation:90}),paginas:[1,2]
 }),/rotadas/);
});
test('presupuesto de caras: rechazar trabajo excesivo antes de reservar memoria',async()=>{
 await assert.rejects(componerDocumentoPdfPrivado({
  pdfOriginal:await original({count:20}),
  paginas:Array.from({length:20},(_,i)=>i+1),
  copias:200, paginasPorCara:1
 }),/máximo de caras/);
});

test('PDF válido con página en blanco sin /Contents no falla ni cambia orden',async()=>{
 const d=await PDFDocument.create();
 d.addPage([595.2756,841.8898]);
 d.addPage([595.2756,841.8898]).drawText('PÁGINA 2',{x:40,y:700,size:20});
 d.addPage([595.2756,841.8898]);
 const res=await componerDocumentoPdfPrivado({
  pdfOriginal:await d.save(),paginas:[1,2,3],
  paginasPorCara:2,dobleFaz:true
 });
 assert.equal((await PDFDocument.load(res.pdfBytes)).getPageCount(),2);
 assert.equal(res.ficha.hojasFisicas,1);
 assert.deepEqual(res.ficha.caras.flatMap(c=>c.paginas.map(p=>p.paginaOriginal)),[1,2,3]);
 assert.equal(res.ficha.caras[0].paginas[0].enBlanco,true);
 assert.equal(res.ficha.caras[0].paginas[1].enBlanco,undefined);
 assert.equal(res.ficha.caras[1].paginas[0].enBlanco,true);
 assert.equal(res.ficha.listoParaProducir,false);
});
