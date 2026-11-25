import test from 'node:test';
import assert from 'node:assert/strict';
import {resumirSubtotalesTrabajos} from '../integraciones/autocotizador/recepcion/resumir-subtotales-trabajos.mjs';

const works=[{id:'w1',nombre:'Apuntes',indices:[0,1]},{id:'w2',nombre:'Planos y fotos',indices:[2,3]}];
const quote={estado:'PRELIMINAR',total:4700,promocion:{aplicada:true},
 subtotalImpresiones:900,subtotalPloteos:3000,subtotalStickers:0,subtotalFotos:500,subtotalCortes:0,subtotalGraficas:0,
 plan:[{indice:0,id:'pdf1',destino:'documentos'},{indice:1,id:'pdf2',destino:'documentos'},
  {indice:2,id:'pl1',destino:'ploteos'},{indice:3,id:'foto1',destino:'fotos'}],
 detalleImpresiones:[{id:'pdf1',subtotal:300},{id:'pdf2',subtotal:400}],
 detallePloteos:[{id:'pl1',subtotal:3000}],detalleStickers:[],detalleFotos:[{id:'foto1',subtotal:500}],detalleCortes:[],detalleGraficas:[],
 detalleArmados:[{archivos:['pdf1','pdf2'],subtotal:200}]};

test('agrupa importes devueltos por el motor y suma el anillado agrupado al trabajo',()=>{
 const result=resumirSubtotalesTrabajos({cotizacion:quote,trabajos:works,cantidadArchivos:4});
 assert.deepEqual(result,[
  {id:'w1',nombre:'Apuntes',archivos:2,subtotal:900,antesDePromocion:true},
  {id:'w2',nombre:'Planos y fotos',archivos:2,subtotal:3500,antesDePromocion:true}
 ]);
});

test('no inventa subtotales si los grupos de anillado cruzan trabajos',()=>{
 const mixed={...quote,detalleArmados:[{archivos:['pdf1','pl1'],subtotal:200}]};
 assert.equal(resumirSubtotalesTrabajos({cotizacion:mixed,trabajos:works,cantidadArchivos:4}),null);
});

test('rechaza un reparto que no reconcilia con los subtotales del motor',()=>{
 const changed={...quote,detallePloteos:[{id:'pl1',subtotal:2999}]};
 assert.equal(resumirSubtotalesTrabajos({cotizacion:changed,trabajos:works,cantidadArchivos:4}),null);
});
