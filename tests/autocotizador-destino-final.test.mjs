import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {clasificarDestino} from '../integraciones/autocotizador/recepcion/destino-impresion.mjs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
const p=(anchoCm,altoCm,modo='poster',numero=1)=>({anchoCm,altoCm,modo,numero});
const archivo=(paginas,seleccion='a4',extra={})=>({
 nombre:'test.pdf',paginas,seleccion,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',...extra
});
test('A2 de IA elegido A4 usa tarifa de documento y no ploteo',()=>{
 const a=archivo([p(42,59.4)]);
 assert.equal(clasificarDestino(a.paginas,'a4').destino,'documentos');
 const q=cotizarCargaUnica({archivos:[a],precios});
 assert.equal(q.estado,'PRELIMINAR');
 assert.equal(q.detalleImpresiones[0].formato,'a4');
 assert.equal(q.subtotalPloteos,0);
 assert.equal(q.paymentAuthorized,false);
 assert.equal(q.plan[0].ajuste,'proporcional_sin_recorte');
});
test('A2 original se calcula como ploteo y toma rollo compatible',()=>{
 const q=cotizarCargaUnica({archivos:[archivo([p(42,59.4)],'original')],precios});
 assert.equal(q.estado,'PRELIMINAR');
 assert.equal(q.detallePloteos[0].paginasTotales,1);
 assert.ok(q.subtotalPloteos>0);
});
test('A5 no hereda tarifa de A4 y no habilita total engañoso',()=>{
 const q=cotizarCargaUnica({archivos:[archivo([p(42,59.4)],'a5')],precios});
 assert.equal(q.total,null);assert.equal(q.pendientes.length,1);
});
test('PDF mixto original exige revisión y documento sin modo visual no se rechaza',()=>{
 const q=cotizarCargaUnica({archivos:[archivo([p(21,29.7),p(29.7,42,'cad',2)],'original')],precios});
 assert.equal(q.total,null);assert.equal(q.pendientes.length,1);
 const c=cotizarCargaUnica({archivos:[archivo([p(21,29.7,'sin-clasificar')],'a4')],precios});
 assert.ok(c.total>0);
});
test('CAD/póster sin clasificar no tiene total cobrable',()=>{
 const q=cotizarCargaUnica({archivos:[archivo([p(42,59.4,'sin-clasificar')],'original')],precios});
 assert.equal(q.total,null);assert.equal(q.paymentAuthorized,false);
});
test('suma impresiones y ploteos con base única',()=>{
 const q=cotizarCargaUnica({archivos:[archivo([p(42,59.4)],'a4'),archivo([p(42,59.4)],'original')],precios});
 assert.equal(q.total,q.subtotalImpresiones+q.subtotalPloteos);
});
test('página privada sin enviar PDF ni activar compras',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/prueba-carga-unica.js/);
 assert.match(html,/Sin envío de originales, pedidos ni pagos/);
 assert.doesNotMatch(html,/api\/ensayo-pdf|checkout|mercadopago/i);
});
