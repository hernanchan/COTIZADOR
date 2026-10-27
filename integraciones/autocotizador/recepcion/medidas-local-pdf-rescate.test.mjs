import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,degrees} from 'pdf-lib';
import {leerMedidasPloteo,recuperarMedidasConPdfJs,
 requiereClasificacionVisualPloteo} from './medidas-local-pdf.mjs';

function archivo(bytes,name='prueba.pdf'){
 const data=Uint8Array.from(bytes);
 return {name,size:data.byteLength,
  arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
}

test('pdf-lib reconoce A4 sin red y conserva rotación de hoja',async()=>{
 const pdf=await PDFDocument.create();
 pdf.addPage([595.2756,841.8898]);
 const rotado=pdf.addPage([595.2756,841.8898]);
 rotado.setRotation(degrees(90));
 const r=await leerMedidasPloteo(archivo(await pdf.save()));
 assert.equal(r.lector,'PDF_LIB_PRINCIPAL');
 assert.equal(r.total,2);
 assert.equal(r.aptoParaCobro,false);
 assert.ok(Math.abs(r.paginas[0].anchoCm-21)<0.02);
 assert.ok(Math.abs(r.paginas[0].altoCm-29.7)<0.02);
 assert.ok(Math.abs(r.paginas[1].anchoCm-29.7)<0.02);
 assert.ok(Math.abs(r.paginas[1].altoCm-21)<0.02);
 assert.equal(requiereClasificacionVisualPloteo(r.paginas),false);
});

test('lector alternativo recupera tamaños de PDF complejo no interpretable por pdf-lib',async()=>{
 let destruido=false,limpias=0,copia=false;
 const pdfjs={
  getDocument(options){
   assert.equal(options.isEvalSupported,false);
   assert.equal(options.disableFontFace,true);
   const entrada=options.data;
   copia=entrada instanceof Uint8Array && entrada.length>6;
   return {promise:Promise.resolve({
    numPages:2,
    getPage:async i=>({
     getViewport:()=>i===1?{width:595.2756,height:841.8898}:{width:841.8898,height:1190.551},
     cleanup:()=>{limpias++}
    }),
    destroy:async()=>{destruido=true}
   })};
  }
 };
 const r=await leerMedidasPloteo(
  archivo(new TextEncoder().encode('%PDF-archivo-especial')),
  {pdfjs});
 assert.equal(r.lector,'PDFJS_ALTERNATIVO');
 assert.equal(r.total,2);
 assert.ok(Math.abs(r.paginas[0].anchoCm-21)<0.02);
 assert.ok(Math.abs(r.paginas[1].anchoCm-29.7)<0.02);
 assert.ok(Math.abs(r.paginas[1].altoCm-42)<0.02);
 assert.equal(requiereClasificacionVisualPloteo(r.paginas),false);
 assert.equal(r.aptoParaCobro,false);
 assert.equal(destruido,true);
 assert.equal(limpias,2);
 assert.equal(copia,true);
});

test('el lector alternativo libera recursos si una medida es peligrosa',async()=>{
 let destruido=false;
 const pdfjs={getDocument:()=>({promise:Promise.resolve({
  numPages:1,getPage:async()=>({getViewport:()=>({width:90000000,height:200}),
   cleanup(){}}),destroy:async()=>{destruido=true}
 })})};
 await assert.rejects(
  recuperarMedidasConPdfJs(new ArrayBuffer(10),{pdfjs}),
  /Tamaño físico fuera del rango/);
 assert.equal(destruido,true);
});

test('no aceptar encabezado falso ni inventar páginas',async()=>{
 let called=false;
 const pdfjs={getDocument:()=>{called=true;throw Error('No') }};
 await assert.rejects(leerMedidasPloteo(
  archivo(new TextEncoder().encode('NO ES PDF')), {pdfjs}),
  /No se pudo leer el archivo PDF completo/);
 assert.equal(called,false);
});

test('si ambos lectores fallan, PDF se marca para revisión',async()=>{
 const pdfjs={getDocument:()=>({
  promise:Promise.reject(Error('Escaneo incompleto')),
  destroy:async()=>{}
 })};
 await assert.rejects(leerMedidasPloteo(
  archivo(new TextEncoder().encode('%PDF-malformado')), {pdfjs}),
  /No fue posible leer las dimensiones/);
});

test('documentos A4 y A3 no requieren renderizado visual, A2 sí',()=>{
 assert.equal(requiereClasificacionVisualPloteo([
  {anchoCm:21,altoCm:29.7},{anchoCm:29.7,altoCm:42}]),false);
 assert.equal(requiereClasificacionVisualPloteo([
  {anchoCm:42,altoCm:59.4}]),true);
 assert.equal(requiereClasificacionVisualPloteo([
  {anchoCm:21,altoCm:29.7},{anchoCm:59.4,altoCm:84.1}]),true);
 assert.throws(()=>requiereClasificacionVisualPloteo([]),/Sin páginas/);
});
