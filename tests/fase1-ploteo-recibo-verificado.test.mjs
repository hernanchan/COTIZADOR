import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarPloteoReciboVerificado as quote} from '../integraciones/autocotizador/recepcion/cotizar-ploteo-recibo-verificado.mjs';
const receipt={ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',paymentAuthorized:false,name:'MUNICIPAL.pdf',mode:'color',pages:3};
const medidas={pageCount:3,pageMetrics:[
 {anchoCm:84.1,altoCm:118.9,modo:'sin-clasificar'},
 {anchoCm:59.4,altoCm:84.1,modo:'sin-clasificar'},
 {anchoCm:84.1,altoCm:118.9,modo:'sin-clasificar'}]};
const clasificacionCliente=medidas.pageMetrics.map((x,i)=>({
 numero:i+1,anchoCm:x.anchoCm,altoCm:x.altoCm,modo:i===1?'poster':'cad'
}));
const calc=(changes={})=>quote({recibo:receipt,medidas,
 clasificacionCliente,copias:2,papelPoster:'recubierto',precios,...changes});
test('PDF mixto 3 paginas clasifica 2 CAD obra y 1 poster recubierto; precio del servidor',()=>{
 const r=calc();
 assert.equal(r.estado,'PRELIMINAR_VERIFICADA_SIN_PEDIDO');
 assert.equal(r.paginasOriginales,3);
 assert.deepEqual(r.paginas.map(x=>x.modo),['cad','poster','cad']);
 assert.deepEqual(r.paginas.map(x=>x.papel),['obra80','recubierto','obra80']);
 assert.match(r.paginas[0].rollo,/^rollo\d+$/);
 assert.match(r.paginas[1].rollo,/^rec\d+$/);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.checkoutEnabled,false);
 assert.ok(Number.isSafeInteger(r.totalArs)&&r.totalArs>0);
});
test('rechaza que el navegador altere ancho, numero, clase o longitud',()=>{
 for(const instructions of [
  clasificacionCliente.map((x,i)=>i?x:{...x,anchoCm:10}),
  clasificacionCliente.map((x,i)=>i?x:{...x,numero:3}),
  clasificacionCliente.map((x,i)=>i?x:{...x,modo:'foo'}),
  clasificacionCliente.slice(0,2)
 ])assert.throws(()=>calc({clasificacionCliente:instructions}));
});
test('sin recibo firmado o con paginas alteradas no cotiza',()=>{
 assert.throws(()=>calc({recibo:{...receipt,verified:false}}));
 assert.throws(()=>calc({medidas:{...medidas,pageCount:2}}));
 assert.throws(()=>calc({papelPoster:'desconocido'}));
 assert.throws(()=>calc({copias:201}));
});
test('no acepta documento A4 en ruta de ploteos',()=>{
 assert.throws(()=>quote({recibo:{...receipt,pages:1},
  medidas:{pageCount:1,pageMetrics:[{anchoCm:21,altoCm:29.7}]},
  clasificacionCliente:[{numero:1,anchoCm:21,altoCm:29.7,modo:'poster'}],
  copias:1,papelPoster:'obra80',precios}),/no requiere ploteo/);
});
