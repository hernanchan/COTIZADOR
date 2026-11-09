import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decidirTransportePDF,LIMITE_TUS_PDF_BYTES,LIMITE_R2_PDF_BYTES} from '../integraciones/autocotizador/recepcion/seleccionar-transporte-pdf.mjs';
const MIB=1024*1024;
test('Todo PDF >40 MiB va a R2 por tamaño, independientemente de A4/A3/CAD/Póster',()=>{
 for(const tipo of ['apuntes A4','documento A3','plano CAD','póster']){
  assert.deepEqual(decidirTransportePDF(80*MIB),{ruta:'r2',pagoPrevio:true},tipo);
 }
});
test('Límites conservan TUS hasta 40 y R2 hasta 200 MiB',()=>{
 assert.equal(LIMITE_TUS_PDF_BYTES,40*MIB);
 assert.equal(LIMITE_R2_PDF_BYTES,200*MIB);
 assert.equal(decidirTransportePDF(40*MIB).ruta,'tus');
 assert.equal(decidirTransportePDF(40*MIB+1).ruta,'r2');
 assert.equal(decidirTransportePDF(200*MIB).ruta,'r2');
 assert.equal(decidirTransportePDF(200*MIB+1).ruta,'supera_cupo');
 assert.equal(decidirTransportePDF(4).ruta,'invalido');
});
test('La pantalla no expone explicación técnica al comprador',()=>{
 const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
 assert.match(source,/decidirTransportePDF\(file\.size\)/);
 assert.doesNotMatch(source,/Un único ploteo PDF de 40–200 MiB/);
 assert.match(source,/Si algún archivo necesita recepción especial/);
});
test('Se mantiene bloqueado el pago de un documento grande con backend de ploteos',()=>{
 const server=readFileSync(new URL('../integraciones/autocotizador/recepcion/r2-prepago-documentos.mjs',import.meta.url),'utf8');
 assert.match(server,/quote\.plan\[0\]\.destino!=='ploteos'/);
});
