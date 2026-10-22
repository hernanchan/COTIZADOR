import test from 'node:test';
import assert from 'node:assert/strict';
import {clasificarDestino} from '../integraciones/autocotizador/recepcion/destino-impresion.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
test('A2 de IA no se cobra automáticamente como ploteo si el cliente elige A4',()=>{
 const p=[{anchoCm:42,altoCm:59.4}];
 const previo=clasificarDestino(p);
 assert.equal(previo.confirmado,false);
 assert.equal(previo.superaA3,true);
 const a4=clasificarDestino(p,'a4');
 assert.equal(a4.destino,'documentos');assert.equal(a4.cambioEscala,true);
 assert.equal(a4.ajuste,'proporcional_sin_recorte');
 assert.equal(clasificarDestino(p,'original').destino,'ploteo');
});
test('PDF mixto marca advertencia, los A4 originales no fuerzan ploteo',()=>{
 const p=[{anchoCm:21,altoCm:29.7},{anchoCm:29.7,altoCm:42}];
 assert.equal(clasificarDestino(p).mixtas,true);
 assert.equal(clasificarDestino(p,'original').destino,'documentos');
 assert.equal(clasificarDestino(p,'a5').tamanoFinal,'a5');
 assert.throws(()=>clasificarDestino(p,'rollo90'));
});
test('pantalla aislada, sin recepción ni pagos',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/prueba-carga-unica.js/);
 assert.match(html,/Sin envío de originales, cotización, pedidos ni pagos/);
 assert.doesNotMatch(html,/api\/ensayo-pdf|checkout|mercadopago/i);
});
