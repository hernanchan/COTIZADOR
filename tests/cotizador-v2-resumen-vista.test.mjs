import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

test('el resumen del carrito privado aparece al abrir y al restaurar',()=>{
 const html=paginaCotizadorV2PruebaPrivada('turnstile-site-key-test-2026');
 assert.match(html,/id="order-summary"/);
 assert.match(html,/function updateSummary\(\)/);
 const init=html.indexOf('updateSummary();\nregisterButton.addEventListener');
 assert.ok(init>0,'el resumen se calcula aun si no se agregaron archivos');
 assert.match(html,/Cotización del servidor para archivos verificados:/);
 assert.match(html,/Registro en Central D1: PENDIENTE/);
 assert.match(html,/Pago y producción: DESACTIVADOS/);
});
test('la pantalla mantiene presentación adaptable y prohíbe exponer credenciales de Central',()=>{
 const html=paginaCotizadorV2PruebaPrivada('turnstile-site-key-test-2026');
 assert.match(html,/@media\(max-width:840px\)/);
 assert.doesNotMatch(html,/DOCS_CENTRAL_ADMIN_KEY|CENTRAL_BRIDGE_KEY|Bearer /);
 assert.match(html,/sessionStorage/);
 assert.match(html,/save\(\);updateSummary\(\)/);
});
