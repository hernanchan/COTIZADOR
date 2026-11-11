import test from 'node:test';
import assert from 'node:assert/strict';
import {promocionSemanalCotizacion as promo} from './promociones-semanales-cotizacion.mjs';
const when=day=>Date.parse('2026-11-'+String(8+day).padStart(2,'0')+'T15:00:00Z');
const weekly=[
 {day:0,title:'Fin de semana',summary:'20%',kind:'percent',percent:20,enabled:true},
 {day:1,title:'Lunes planos',summary:'10% CAD desde 2 m',kind:'percent',percent:10,minMeters:2,enabled:true},
 {day:2,title:'Martes copias',summary:'10% impresiones',kind:'percent',percent:10,enabled:true},
 {day:3,title:'Miércoles fotos',summary:'Luster al precio normal',kind:'premium_to_normal',enabled:true},
 {day:4,title:'Jueves anillado',summary:'Gratis',kind:'free_binding',enabled:true},
 {day:5,title:'Viernes stickers',summary:'A3 10%',kind:'percent',percent:10,enabled:true},
 {day:6,title:'Fin de semana',summary:'20%',kind:'percent',percent:20,enabled:true}
];
const approved={enabled:true,weekly};
const base={promociones:approved,precios:{photos:{scales:[{from:1,to:19}],products:[
 {id:'luster_10x15',paper:'Luster',size:'10x15'},
 {id:'foto_10x15',paper:'Papel fotográfico',size:'10x15',prices:[500]}
]}}};
test('lunes CAD obra desde 2m, no descuenta póster ni 1.9m',()=>{
 const item=(m,modo='cad')=>({papelPoster:'obra80',paginas:[{modo}],metrosLineales:m,copias:1,subtotal:2000});
 const x=promo({...base,ahora:when(1),subtotalPloteos:6000,
  detallePloteos:[item(2.1),item(1.9),item(3,'poster')]});
 assert.equal(x.descuento,200);
 assert.equal(x.totalFinal,5800);
});
test('martes impresiones excluye anillado',()=>{
 const x=promo({...base,ahora:when(2),subtotalImpresiones:2500,subtotalAnillados:500});
 assert.equal(x.descuento,200);
 assert.equal(x.totalFinal,2300);
});
test('miércoles Luster al precio normal 10x15',()=>{
 const x=promo({...base,ahora:when(3),subtotalFotos:1600,
  detalleFotos:[{productoId:'luster_10x15',cantidad:2,subtotal:1600}]});
 assert.equal(x.descuento,600);
 assert.equal(x.totalFinal,1000);
});
test('jueves anillado gratis sin cambiar impresiones',()=>{
 const x=promo({...base,ahora:when(4),subtotalImpresiones:1700,subtotalAnillados:500});
 assert.equal(x.descuento,500);assert.equal(x.totalFinal,1200);
});
test('viernes 10% sólo stickers A3',()=>{
 const x=promo({...base,ahora:when(5),subtotalStickers:8000,
  detalleStickers:[{formato:'a3',subtotal:5000},{formato:'a4',subtotal:3000}]});
 assert.equal(x.descuento,500);assert.equal(x.totalFinal,7500);
});
test('sábado y domingo 20% del total online',()=>{
 for(const day of [0,6]){
  const x=promo({...base,ahora:when(day),subtotalImpresiones:2000,subtotalGraficas:1000});
  assert.equal(x.descuento,600);assert.equal(x.totalFinal,2400);
 }
});
test('si D1 no habilitó la promoción jamás se inventa descuento',()=>{
 assert.equal(promo({...base,promociones:{...approved,enabled:false},ahora:when(2),
  subtotalImpresiones:2000}),null);
 assert.equal(promo({...base,promociones:{enabled:true,weekly:[]},ahora:when(2),
  subtotalImpresiones:2000}),null);
});
