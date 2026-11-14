import test from 'node:test';
import assert from 'node:assert/strict';
import {cotizarArticulosCarritoUnico as quote} from '../integraciones/autocotizador/recepcion/cotizar-articulos-carrito-unico.mjs';

const csv=[
 'Activo,Categoría,Producto,Descripción,Precio,Oferta,Foto,Código,Enlace foto (pegá aquí)',
 'si,Escolar,Resaltador Filgo x4,Pastel,5400,4500,,ESC001,',
 'SI,Oficina,Resma A4,500 hojas,8000,8000,,OFI001,',
 'no,Escolar,Producto desactivado,,2500,,,ESC002,'
].join('\n');
const one=(code='ESC001',qty=1)=>[{code,qty}];
test('precio y oferta salen del CSV, nunca del navegador',()=>{
 const r=quote({csv,items:[...one('ESC001',2),...one('OFI001',1)]});
 assert.equal(r.totalArticulosArs,17000);
 assert.equal(r.lineas[0].precioUnitarioArs,4500);
 assert.equal(r.lineas[0].ofertaAplicada,true);
 assert.equal(r.lineas[1].precioUnitarioArs,8000);
 assert.equal(r.checkoutEnabled,false);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.stockConfirmado,false);
 assert.equal(r.requiereConfirmarStock,true);
});
test('las promociones actualizadas se aplican al recalcular, no se conserva precio viejo',()=>{
 const changed=csv.replace('5400,4500','5400,3900');
 assert.equal(quote({csv:changed,items:one()}).totalArticulosArs,3900);
});
test('la disponibilidad requiere un dato explícito y nunca autoriza cobrar por sí misma',()=>{
 const ok=quote({csv,items:one('ESC001',2),inventario:{ESC001:3}});
 assert.equal(ok.stockConfirmado,true);
 assert.equal(ok.bloqueadoPorStock,false);
 assert.equal(ok.lineas[0].estadoStock,'disponible');
 assert.equal(ok.checkoutEnabled,false);
});
test('stock insuficiente bloquea pedido',()=>{
 const r=quote({csv,items:one('ESC001',2),inventario:{ESC001:1}});
 assert.equal(r.bloqueadoPorStock,true);
 assert.equal(r.lineas[0].estadoStock,'insuficiente');
 assert.equal(r.paymentAuthorized,false);
});
test('SKU desactivado, inexistente o duplicado no se presupuesta',()=>{
 assert.throws(()=>quote({csv,items:one('ESC002')}),/disponible/);
 assert.throws(()=>quote({csv,items:one('NOEXISTE')}),/disponible/);
 assert.throws(()=>quote({csv,items:[...one('ESC001'),...one('esc001')]}),/repetidos/);
});
test('el navegador no puede enviar precios, descuentos o títulos',()=>{
 assert.throws(()=>quote({csv,items:[{code:'ESC001',qty:1,price:1}]}),/inválidos/);
 assert.throws(()=>quote({csv,items:[{code:'ESC001',qty:1,totalArs:1}]}),/inválidos/);
});
test('rechaza cantidades anómalas, inventario inválido y carritos vacíos',()=>{
 for(const qty of [0,-1,1.5,100,'1',null]){
  assert.throws(()=>quote({csv,items:one('ESC001',qty)}),/inválidos/);
 }
 for(const inventory of [{ESC001:-1},{ESC001:'2'},{ESC001:1.1}]){
  assert.throws(()=>quote({csv,items:one(),inventario:inventory}),/Existencias/);
 }
 assert.throws(()=>quote({csv,items:[]}),/entre 1 y 50/);
 assert.throws(()=>quote({csv,items:Array(51).fill({code:'ESC001',qty:1})}),/entre 1 y 50/);
});
test('precio inválido en el origen no se convierte en artículo cobrable',()=>{
 const invalid=csv.replace('5400,4500','NOESUNPRECIO,4500');
 assert.throws(()=>quote({csv:invalid,items:one()}),/disponible/);
});
test('un solo SKU con cantidad 99 no dispara pago ni reserva de stock',()=>{
 const r=quote({csv,items:one('OFI001',99)});
 assert.equal(r.totalArticulosArs,792000);
 assert.equal(r.checkoutEnabled,false);
 assert.equal(r.lineas[0].estadoStock,'sin_confirmar');
});
