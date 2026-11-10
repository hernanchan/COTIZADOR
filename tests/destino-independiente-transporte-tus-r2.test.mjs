import test from 'node:test';
import assert from 'node:assert/strict';
import {clasificarDestino} from '../integraciones/autocotizador/recepcion/destino-impresion.mjs';
import {decidirTamanoCliente} from '../integraciones/autocotizador/recepcion/decision-tamano-impresion.mjs';
import {decidirTransportePDF,LIMITE_TUS_PDF_BYTES,LIMITE_R2_PDF_BYTES}
 from '../integraciones/autocotizador/recepcion/seleccionar-transporte-pdf.mjs';
const MiB=1024*1024;
const page=(n,w,h,modo='sin-clasificar')=>({numero:n,anchoCm:w,altoCm:h,modo});
const total=(count,w,h,modo)=>Array.from({length:count},(_,i)=>page(i+1,w,h,modo));
function decidir(paginas,bytes){
 const seleccion=decidirTamanoCliente(paginas).seleccionInicial;
 return {destino:clasificarDestino(paginas,seleccion),transporte:decidirTransportePDF(bytes)};
}
test('500 páginas A4 que pesan 100 MiB → documentos A4 por R2, no plotter',()=>{
 const {destino,transporte}=decidir(total(500,21,29.7),100*MiB);
 assert.equal(destino.destino,'documentos');
 assert.equal(destino.tamanoFinal,'a4');
 assert.equal(transporte.ruta,'r2');assert.equal(transporte.pagoPrevio,true);
});
test('panel A0 de 2 MiB → plotter por TUS, no documentos por ser liviano',()=>{
 const {destino,transporte}=decidir([page(1,84.1,118.9,'cad')],2*MiB);
 assert.equal(destino.destino,'ploteo');
 assert.equal(destino.tamanoFinal,'original');
 assert.equal(transporte.ruta,'tus');
});
test('plano A1 150 MiB → plotter por R2 y apunte A4 5 MiB → documentos TUS',()=>{
 assert.equal(decidir([page(1,59.4,84.1,'cad')],150*MiB).destino.destino,'ploteo');
 assert.equal(decidirTransportePDF(150*MiB).ruta,'r2');
 assert.equal(decidir(total(15,21,29.7),5*MiB).destino.destino,'documentos');
 assert.equal(decidirTransportePDF(5*MiB).ruta,'tus');
});
test('mismas medidas y contenido producen igual destino al cruzar 40 MiB',()=>{
 for(const paginas of [total(500,21,29.7),[page(1,84.1,118.9,'poster')],
    [page(1,300,60,'cad')]]){
  const a=decidir(paginas,2*MiB),b=decidir(paginas,100*MiB);
  assert.deepEqual(a.destino,b.destino);
  assert.notEqual(a.transporte.ruta,b.transporte.ruta);
 }
});
test('40 MiB inclusive TUS; 40 MiB + 1 byte R2; 200 MiB es límite de interfaz',()=>{
 assert.equal(LIMITE_TUS_PDF_BYTES,40*MiB);
 assert.equal(LIMITE_R2_PDF_BYTES,200*MiB);
 assert.equal(decidirTransportePDF(40*MiB).ruta,'tus');
 assert.equal(decidirTransportePDF(40*MiB+1).ruta,'r2');
 assert.equal(decidirTransportePDF(200*MiB).ruta,'r2');
 assert.equal(decidirTransportePDF(200*MiB+1).ruta,'supera_cupo');
});
