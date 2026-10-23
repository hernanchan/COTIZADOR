import test from 'node:test';
import assert from 'node:assert/strict';
import {componerCarritoPreliminar} from '../integraciones/autocotizador/recepcion/componer-carrito-preliminar.mjs';
const borrador={schema:'saber-pedido-borrador-v1',estado:'PENDIENTE_DE_RECEPCION',filesReceived:false,
 paymentAuthorized:false,totalOrientativo:21000,items:[{nombre:'tarjeta.pdf',servicio:'grafica',estadoArchivo:'SIN_ENVIAR'}]};
test('suma ilustrativa de catálogo y gráfica sin crear un pago',()=>{
 const cart=componerCarritoPreliminar({borrador,articulos:[
  {type:'product',id:'SKU1',name:'Cuaderno',price:4500,qty:2},
  {type:'product',id:'SKU2',name:'Lápiz',price:900,qty:1}
 ]});
 assert.equal(cart.subtotalProductosOrientativo,9900);
 assert.equal(cart.subtotalTrabajosOrientativo,21000);
 assert.equal(cart.totalOrientativo,30900);
 assert.equal(cart.paymentAuthorized,false);
 assert.equal(cart.checkoutEnabled,false);
 assert.equal(cart.serverQuoteVerified,false);
});
test('nunca mezclar un trabajo print heredado sin recibo',()=>{
 assert.throws(()=>componerCarritoPreliminar({borrador,articulos:[{type:'print',id:'OLD',name:'Impresión',price:1000,qty:1}]}),/sin verificación/);
});
test('rechaza totales incompletos y artículos manipulados',()=>{
 assert.throws(()=>componerCarritoPreliminar({borrador:{...borrador,filesReceived:true},articulos:[]}));
 assert.throws(()=>componerCarritoPreliminar({borrador,articulos:[{type:'product',id:'1',name:'Test',price:0,qty:1}]}));
 assert.throws(()=>componerCarritoPreliminar({borrador,articulos:[{type:'product',id:'1',name:'Test',price:1500,qty:-1}]}));
});
