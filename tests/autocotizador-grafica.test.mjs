import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAFICA_COMERCIAL,cotizarGrafica} from '../integraciones/autocotizador/recepcion/cotizar-grafica.mjs';
test('catálogo público contiene 14 variantes comerciales',()=>assert.equal(GRAFICA_COMERCIAL.length,14));
test('tarjetas, recetarios y folletos mantienen precio por lote',()=>{
 assert.equal(cotizarGrafica({productoId:'tarjetas-0',lotes:1}).subtotal,18000);
 assert.equal(cotizarGrafica({productoId:'recetarios-3',lotes:2}).subtotal,20000);
 assert.equal(cotizarGrafica({productoId:'folletos-4',lotes:1}).subtotal,87000);
});
test('rechazar producto desconocido y lotes fraccionarios',()=>{
 assert.throws(()=>cotizarGrafica({productoId:'tarjetas-99',lotes:1}));
 assert.throws(()=>cotizarGrafica({productoId:'tarjetas-0',lotes:1.5}));
});
