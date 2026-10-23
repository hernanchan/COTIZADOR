import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarStickersPdf} from '../integraciones/autocotizador/recepcion/cotizar-stickers.mjs';
const calcular=(formato,paginas,copias)=>cotizarStickersPdf({formato,paginas,copias,precios});
test('una plancha A4 incluye precorte y cuesta lo mismo que catálogo público',()=>{
 assert.equal(calcular('a4',1,1).subtotal,3000);
 assert.equal(calcular('a3',1,1).subtotal,5000);
});
test('escala vigente desde 21 planchas, incluye varias páginas',()=>{
 assert.equal(calcular('a4',7,3).subtotal,21*2700);
 assert.equal(calcular('a3',10,2).subtotal,20*5000);
 assert.equal(calcular('a3',7,3).subtotal,21*4500);
});
test('impide formatos no comercializados y cantidades incorrectas',()=>{
 for(const formato of ['a5','original','a2'])assert.throws(()=>calcular(formato,1,1));
 assert.throws(()=>calcular('a4',0,1));
 assert.throws(()=>calcular('a4',1,501));
});
