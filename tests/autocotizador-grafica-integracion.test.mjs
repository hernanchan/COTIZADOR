import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
function archivo(servicio,props={}){
 const paginas=Array.from({length:props.numPaginas||1},(_,i)=>({numero:i+1,anchoCm:21,altoCm:29.7,modo:'cad'}));
 return {nombre:servicio+'.pdf',paginas,paginasSeleccionadas:props.paginasSeleccionadas||'',seleccion:'a4',
 servicio,copias:props.copias||1,modo:'bn',caras:'simple',materialColor:'',papelPoster:'obra80',
 anillado:props.anillado||'ninguno',grupoAnillado:'',productoFoto:props.productoFoto||'',
 productoGrafica:props.productoGrafica||'',corteVariante:'gt3',corteMetros:1};
}
test('gráfica comercial de 100 tarjetas cuesta 18000 por lote',()=>{
 const d=cotizarCargaUnica({archivos:[archivo('grafica',{productoGrafica:'tarjetas-0'})],precios});
 assert.equal(d.estado,'PRELIMINAR');
 assert.equal(d.subtotalGraficas,18000);
 assert.equal(d.total,18000);
 assert.deepEqual(d.plan[0].paginasElegidas,[1]);
 assert.equal(d.paymentAuthorized,false);
});
test('pedido mixto contabiliza gráfica, stickers, foto y corte',()=>{
 const d=cotizarCargaUnica({archivos:[
  archivo('grafica',{productoGrafica:'recetarios-3',copias:2}),
  archivo('stickers'),archivo('fotos',{productoFoto:'foto_10x15'}),archivo('corte')
 ],precios});
 assert.equal(d.subtotalGraficas,20000);
 assert.equal(d.subtotalStickers,3000);
 assert.equal(d.subtotalFotos,500);
 assert.equal(d.subtotalCortes,31200);
 assert.equal(d.total,54700);
 assert.equal(d.plan.length,4);
});
test('una página elegida de un PDF de varias páginas es un solo diseño',()=>{
 const d=cotizarCargaUnica({archivos:[archivo('grafica',{productoGrafica:'folletos-0',numPaginas:2,paginasSeleccionadas:'2'})],precios});
 assert.equal(d.total,4800);
 assert.deepEqual(d.plan[0].paginasElegidas,[2]);
});
test('si no se eligió variante o hay dos diseños el total queda incompleto',()=>{
 for(const props of [{productoGrafica:''},{productoGrafica:'tarjetas-0',numPaginas:2},{productoGrafica:'tarjetas-0',anillado:'individual'}]){
  const d=cotizarCargaUnica({archivos:[archivo('grafica',props)],precios});
  assert.equal(d.total,null);
  assert.equal(d.estado,'INCOMPLETO');
 }
});
test('variante inexistente nunca devuelve importe cero',()=>{
 assert.throws(()=>cotizarCargaUnica({archivos:[archivo('grafica',{productoGrafica:'falso-999'})],precios}));
});
