import test from 'node:test';
import assert from 'node:assert/strict';
import {validarEventoPolaroid,cotizarPedidoPolaroid} from './integracion-carrito.mjs';
const origen='https://pruebas.ejemplo.test';
const iframe={};
function evento(hojas=2) {return {source:iframe,origin:origen,data:{
  type:'SABER_POLAROID_READY',format:'85x90_6up_A4_v1.1',
  reference:'PS-261015-ABC1234',sheets:hojas,photos:hojas*6,price:1}};}
test('acepta únicamente respuesta del iframe y origen esperados',()=>{
  assert.ok(validarEventoPolaroid(evento(),iframe,origen));
  assert.equal(validarEventoPolaroid({...evento(),origin:'https://atacante.test'},iframe,origen),null);
  assert.equal(validarEventoPolaroid({...evento(),source:{}},iframe,origen),null);
});
test('requiere referencia y cantidad válidas, 1 a 10 hojas',()=>{
  for (const n of [1,2,3,10])assert.equal(validarEventoPolaroid(evento(n),iframe,origen).hojas,n);
  for (const n of [0,11,1.5])assert.equal(validarEventoPolaroid(evento(n),iframe,origen),null);
  const fake=evento();fake.data.photos=11;
  assert.equal(validarEventoPolaroid(fake,iframe,origen),null);
  fake.data.photos=12;fake.data.reference='PS-invalida';
  assert.equal(validarEventoPolaroid(fake,iframe,origen),null);
});
test('cobra por hoja de seis y seña del 50%, sin precio del editor',()=>{
  for (const [n,total] of [[1,3000],[2,6000],[3,9000],[10,30000]]) {
    const v=validarEventoPolaroid(evento(n),iframe,origen);
    const item=cotizarPedidoPolaroid(v,3000);
    assert.equal(item.type,'print');assert.equal(item.price,total);
    assert.equal(item.deposit,total/2);assert.equal(item.qty,1);
    assert.match(item.detail,/PS-261015-ABC1234/);
  }
});
test('no permite precio inexistente ni hojas incoherentes',()=>{
  const v=validarEventoPolaroid(evento(),iframe,origen);
  assert.throws(()=>cotizarPedidoPolaroid(v,0));
  assert.throws(()=>cotizarPedidoPolaroid({...v,fotos:1},3000));
});
