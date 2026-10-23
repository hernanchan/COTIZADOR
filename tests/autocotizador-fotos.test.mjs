import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarFotosPdf} from '../integraciones/autocotizador/recepcion/cotizar-fotos.mjs';
const cot=(productoId,paginas,copias)=>cotizarFotosPdf({productoId,paginas,copias,precios});
test('fotos 10x15 por cantidad',()=>{
 assert.equal(cot('foto_10x15',1,1).subtotal,500);
 assert.equal(cot('foto_10x15',20,1).subtotal,20*475);
 assert.equal(cot('foto_10x15',50,1).subtotal,50*450);
});
test('Luster 13x18 y A4 conservan precio de catalogo',()=>{
 assert.equal(cot('luster_13x18',1,1).subtotal,1200);
 assert.equal(cot('luster_a4',3,10).subtotal,30*2375);
});
test('carnet son planchas de seis fotos',()=>{
 assert.equal(cot('foto_carnet',1,3).subtotal,3000);
 assert.match(cot('foto_carnet',1,1).unidadComercial,/plancha/);
});
test('Polaroids sigue fuera de este modulo',()=>{
 assert.throws(()=>cot('foto_polaroid',1,1));
 assert.throws(()=>cot('luster_polaroid',1,1));
});
