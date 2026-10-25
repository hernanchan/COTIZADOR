import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {leerPaginasPdfCotizador,montarAsistentePdf}
 from '../cotizador-v2-ensayo-archivos.mjs';

const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const cotizador=readFileSync(new URL('../cotizador-web-v2.html',import.meta.url),'utf8');
const shaOriginal='4bb9c519f0df5efea6c1e9bd3eff3f96fbed759e';
const flag="const archivosEnsayoEnabled=new URLSearchParams(location.search).get('ensayoArchivos')==='1';";
const extra="document.getElementById('calc').onclick=calcPrint;if(archivosEnsayoEnabled)import('./cotizador-v2-ensayo-archivos.mjs').then(m=>m.montarAsistentePdf(app)).catch(()=>{if(app.querySelector('#pages'))console.warn('El lector PDF de ensayo no está disponible. La cotización manual sigue operativa.');});}";
const original="document.getElementById('calc').onclick=calcPrint}";
async function sample(pages){
 const doc=await PDFDocument.create();
 for(let i=0;i<pages;i++)doc.addPage([595.276,841.89]);
 const buffer=Buffer.from(await doc.save());
 return {name:'archivo.pdf',size:buffer.length,arrayBuffer:async()=>Uint8Array.from(buffer).buffer};
}
test('Cotizador V2: al revertir sólo los dos puntos opt-in, hash Git original idéntico',()=>{
 assert.equal(cotizador.split(flag).length-1,1);
 assert.equal(cotizador.split(extra).length-1,1);
 const restored=cotizador.replace('\n'+flag,'').replace(extra,original);
 const blob=Buffer.from('blob '+Buffer.byteLength(restored)+'\0'+restored);
 assert.equal(createHash('sha1').update(blob).digest('hex'),shaOriginal);
});
test('Cotizador V2 conserva las seis familias, motor de precios, promociones y carrito',()=>{
 for(const id of ['impresiones','fotos','stickers','ploteos','corte','grafica']){
  assert.match(cotizador,new RegExp("\\['"+id+"'"),"Falta familia "+id);
 }
 for(const fn of ['calcPrint','applyDaily','finishItem','renderResult','renderPhotos','renderPlot','renderCut','loadPromos']){
  assert.ok(cotizador.includes('function '+fn+'('),"Falta función "+fn);
 }
 assert.match(cotizador,/const archivosEnsayoEnabled=new URLSearchParams/);
 assert.match(cotizador,/if\(archivosEnsayoEnabled\)import/);
 assert.equal(cotizador.split('ensayoArchivos').length-1,1);
});
test('Lector opcional: 7 páginas de PDF real, sin transmisión ni confirmación de pago',async()=>{
 const file=await sample(7);
 let calls=0;
 const result=await leerPaginasPdfCotizador(file,{
  obtenerLibreria:async()=>{calls++;return {PDFDocument}}
 });
 assert.equal(calls,1);
 assert.deepEqual(result,{
  nombre:'archivo.pdf',paginas:7,bytes:file.size,
  verificacion:'LOCAL_PRELIMINAR',subido:false,pagoAutorizado:false
 });
 assert.equal(Object.isFrozen(result),true);
});
test('Lector opcional: no puede sobreescribir el campo si el PDF no es válido',async()=>{
 let calls=0;
 const invalid=[
  {name:'imagen.png',size:200,arrayBuffer:async()=>new ArrayBuffer(200)},
  {name:'falso.pdf',size:200,arrayBuffer:async()=>new ArrayBuffer(200)},
  {name:'pesado.pdf',size:21*1024*1024,arrayBuffer:async()=>{calls++;return new ArrayBuffer(200)}},
  {name:'cero.pdf',size:0,arrayBuffer:async()=>new ArrayBuffer(0)}
 ];
 for(const f of invalid){
  await assert.rejects(leerPaginasPdfCotizador(f,{obtenerLibreria:async()=>({PDFDocument})}));
 }
 assert.equal(calls,0,'No leer archivos que ya exceden la cuota');
});
test('Lector opcional: PDF sintácticamente inválido rechaza sin inventar páginas',async()=>{
 const file={name:'roto.pdf',size:200,
  arrayBuffer:async()=>Uint8Array.from(Buffer.from('%PDF-1.7\n'+'x'.repeat(191))).buffer};
 await assert.rejects(leerPaginasPdfCotizador(file,{
  obtenerLibreria:async()=>({PDFDocument})
 }),/No pudimos leer/);
});
test('El montaje sin formulario de impresiones no modifica otros servicios',()=>{
 assert.equal(montarAsistentePdf(null),false);
 assert.equal(montarAsistentePdf({isConnected:false,querySelector:()=>null}),false);
 assert.equal(montarAsistentePdf({isConnected:true,querySelector:()=>null}),false);
});
