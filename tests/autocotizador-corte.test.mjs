import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarCorte} from '../integraciones/autocotizador/recepcion/cotizar-corte.mjs';
const x=(variante,metros)=>cotizarCorte({variante,metros,precios});
test('mínimo comercial de corte, no inferir metros',()=>{
 assert.equal(x('gt3',0.1).subtotal,5000);
 assert.throws(()=>x('gt3',undefined));
});
test('redondeo idéntico al cotizador público',()=>{
 assert.equal(x('gt3',1).subtotal,31200);
 assert.equal(x('lt3',0.2).subtotal,7800);
 assert.equal(x('solo',1).subtotal,24000);
});
test('rechaza metraje y variantes inválidas',()=>{
 assert.throws(()=>x('xxx',1));
 assert.throws(()=>x('gt3',-1));
});
