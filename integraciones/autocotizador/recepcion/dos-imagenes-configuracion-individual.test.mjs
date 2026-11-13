import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';

const precios=JSON.parse(readFileSync(new URL('../../../precios-web.json',import.meta.url),'utf8'));
const doc=(nombre,modo,copias,materialColor)=>({
 nombre,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 paginasSeleccionadas:'',seleccion:'a4',servicio:'auto',
 copias,modo,caras:'simple',paginasPorHoja:1,materialColor,
 papelPoster:'obra80',anillado:'ninguno',grupoAnillado:''
});
test('dos imágenes son dos conceptos independientes: obra 180 color x12 y BN común x1',()=>{
 const color=doc('imagen-01-diseno-color.pdf','color',12,'obra180');
 const negro=doc('imagen-02-texto-bn.pdf','bn',1,'');
 const juntos=cotizarCargaUnica({archivos:[color,negro],precios,ahora:Date.UTC(2026,10,13)});
 const unicoColor=cotizarCargaUnica({archivos:[color],precios,ahora:Date.UTC(2026,10,13)});
 const unicoBn=cotizarCargaUnica({archivos:[negro],precios,ahora:Date.UTC(2026,10,13)});
 assert.equal(juntos.estado,'PRELIMINAR');
 assert.equal(juntos.plan.length,2);
 assert.deepEqual(juntos.plan.map(x=>x.nombre),[color.nombre,negro.nombre]);
 assert.deepEqual(juntos.plan.map(x=>x.paginasElegidas),[[1],[1]]);
 assert.ok(juntos.detalleImpresiones.length>=2);
 assert.ok(juntos.subtotalImpresiones>0);
 assert.ok(unicoColor.subtotalImpresiones>unicoBn.subtotalImpresiones);
 assert.equal(juntos.subtotalImpresiones,
  unicoColor.subtotalImpresiones+unicoBn.subtotalImpresiones,
  'No debe mezclar cantidades ni materiales entre archivos');
 assert.ok(precios.colorA4.materials.some(m=>m.id==='obra180'));
});
