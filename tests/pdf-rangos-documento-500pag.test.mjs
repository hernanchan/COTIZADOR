import test from 'node:test';
import assert from 'node:assert/strict';
import {BIG_PDF_METADATA_LIMITS}
 from '../integraciones/autocotizador/recepcion/medidas-pdf-grande-rangos.mjs';
import {decidirTransportePDF}
 from '../integraciones/autocotizador/recepcion/seleccionar-transporte-pdf.mjs';
import {clasificarDestino}
 from '../integraciones/autocotizador/recepcion/destino-impresion.mjs';
const MiB=1048576;
test('hasta 500 páginas requiere margen razonable de fragmentos sin subir el original',()=>{
 assert.ok(BIG_PDF_METADATA_LIMITS.maxCalls>=500);
 assert.ok(BIG_PDF_METADATA_LIMITS.maxReadBytes<=48*MiB);
 assert.ok(BIG_PDF_METADATA_LIMITS.maxReadBytes<100*MiB);
 assert.equal(BIG_PDF_METADATA_LIMITS.maxPages,2000);
 assert.equal(BIG_PDF_METADATA_LIMITS.initialBytes,65536);
});
test('500 páginas A4 de 100MiB no se convierten en plotter por el transporte',()=>{
 const paginas=Array.from({length:500},(_,i)=>({
  numero:i+1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'
 }));
 assert.equal(clasificarDestino(paginas,'original').destino,'documentos');
 assert.equal(decidirTransportePDF(100*MiB).ruta,'r2');
});
