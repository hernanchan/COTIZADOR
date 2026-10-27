import test from 'node:test';
import assert from 'node:assert/strict';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';

const precios={
 bnA4:{scales:[{from:1,to:null,simple:100,double:95}]},
 colorA4:{materials:[]},
 bindings:{a4:[{to:200,price:150}]}
};
function archivo(nombre,anillado='ninguno',grupoAnillado=''){
 return {nombre,servicio:'auto',
  paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
  seleccion:'a4',paginasSeleccionadas:'',copias:1,
  modo:'bn',caras:'simple',papelPoster:'obra80',
  anillado,grupoAnillado,materialColor:''};
}
test('excluir un grupo incompleto no desconecta el PDF restante de su precio',()=>{
 const r=cotizarCargaUnica({archivos:[
  archivo('grupo-incompleto.pdf','grupo','1'),
  archivo('trabajo-valido.pdf')
 ],precios});
 assert.equal(r.estado,'INCOMPLETO');
 assert.equal(r.total,null);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.plan.length,1);
 assert.equal(r.detalleImpresiones.length,1);
 assert.equal(r.plan[0].nombre,'trabajo-valido.pdf');
 assert.equal(r.plan[0].id,r.detalleImpresiones[0].id);
 assert.equal(r.plan[0].indice,1);
 assert.equal(r.detalleImpresiones[0].subtotal,100);
});
test('lote sin grupos incompletos conserva identidad de cada precio',()=>{
 const r=cotizarCargaUnica({archivos:[
  archivo('primero.pdf'),archivo('segundo.pdf')
 ],precios});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.total,200);
 assert.equal(r.plan.length,2);
 for(const p of r.plan){
  assert.equal(r.detalleImpresiones.find(x=>x.id===p.id)?.nombre,p.nombre);
 }
});
