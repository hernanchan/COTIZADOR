import test from 'node:test';
import assert from 'node:assert/strict';
import {seleccionarPaginas} from '../integraciones/autocotizador/recepcion/seleccionar-paginas.mjs';
const paginas=Array.from({length:7},(_,i)=>({numero:i+1,anchoCm:42,altoCm:59.4,modo:'cad'}));
test('cliente imprime sólo las tres primeras de siete',()=>{
 assert.deepEqual(seleccionarPaginas(paginas,'1-3').map(p=>p.numero),[1,2,3]);
});
test('rangos mixtos, sin duplicados y conservando orden de PDF',()=>{
 assert.deepEqual(seleccionarPaginas(paginas,'5,1-3,2').map(p=>p.numero),[1,2,3,5]);
});
test('vacío selecciona todas las páginas',()=>{assert.equal(seleccionarPaginas(paginas,'').length,7);});
test('rechaza rangos invertidos, fuera de archivo y expresiones ambiguas',()=>{
 for(const seleccion of ['0','8','6-3','1-8','1,,3','1-3;5','1-'])assert.throws(()=>seleccionarPaginas(paginas,seleccion));
});
