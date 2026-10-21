import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarDocumentos} from '../integraciones/autocotizador/pruebas/cotizar-documentos.mjs';

const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const opts={copias:1,formato:'a4',caras:'simple',materialColor:'obra70',anillado:'ninguno',precios};
const pdf=(id,paginas,modo='bn',orden=1)=>({id,paginas,modo,orden});

test('varios PDF B/N compatibles acumulan impresiones para el tramo',()=>{
  const q=cotizarDocumentos({...opts,archivos:[
    pdf('a',20,'bn',1),pdf('b',30,'bn',2),pdf('c',50,'bn',3)
  ]});
  assert.equal(q.bnCantidad,100);
  assert.equal(q.tarifaBN,76);
  assert.equal(q.subtotalBN,7600);
  assert.deepEqual(q.siguienteDescuentoBN,{desde:101,faltan:1,precioUnitario:66,precioUnitarioActual:76});
});
test('límite exacto 10/11: descuento se calcula sobre total agregado',()=>{
  const diez=cotizarDocumentos({...opts,archivos:[pdf('a',4,'bn',1),pdf('b',6,'bn',2)]});
  assert.equal(diez.tarifaBN,100);
  assert.equal(diez.siguienteDescuentoBN.faltan,1);
  const once=cotizarDocumentos({...opts,archivos:[pdf('a',4,'bn',1),pdf('b',7,'bn',2)]});
  assert.equal(once.tarifaBN,84);
  assert.equal(once.siguienteDescuentoBN.desde,31);
  assert.equal(once.siguienteDescuentoBN.faltan,20);
});
test('cantidad de copias multiplica páginas antes de buscar tramo',()=>{
  const q=cotizarDocumentos({...opts,copias:3,archivos:[pdf('a',4,'bn',1)]});
  assert.equal(q.bnCantidad,12);
  assert.equal(q.tarifaBN,84);
  assert.equal(q.siguienteDescuentoBN.faltan,19);
});
test('BN y color mantienen escalas separadas',()=>{
  const q=cotizarDocumentos({...opts,archivos:[pdf('a',8,'bn',1),pdf('b',4,'color',2)]});
  assert.equal(q.bnCantidad,8);
  assert.equal(q.colorCantidad,4);
  assert.equal(q.tarifaBN,100);
  assert.equal(q.tarifaColor,200);
  assert.equal(q.siguienteDescuentoBN.faltan,3);
  assert.equal(q.siguienteDescuentoColor.faltan,7);
});
test('tramo máximo no promete descuentos inexistentes',()=>{
  const q=cotizarDocumentos({...opts,archivos:[pdf('a',350,'bn',1)]});
  assert.equal(q.tarifaBN,49);
  assert.equal(q.siguienteDescuentoBN,null);
});
test('no se inventan descuentos si la tarifa del tramo siguiente no disminuye',()=>{
  const q=cotizarDocumentos({...opts,materialColor:'obra140',archivos:[pdf('c',3,'color',1)]});
  assert.equal(q.tarifaColor,600);
  assert.equal(q.siguienteDescuentoColor.desde,21);
  assert.equal(q.siguienteDescuentoColor.faltan,18);
});
