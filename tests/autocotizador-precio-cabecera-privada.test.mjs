import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

const html=paginaCotizadorV2PruebaPrivada('test-turnstile-sitekey-1234567');
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');

test('el portal muestra el precio preliminar en su propio encabezado fijo',()=>{
 assert.match(html, /id="precio-smart"/);
 assert.match(html, /#precio-smart\{position:sticky;top:0/);
 assert.match(html, /Total preliminar:/);
 assert.match(html, /Sin cobro autorizado/);
});
test('acepta información de precio solo desde iframe confiable y mismo origen',()=>{
 assert.match(html,/event\.origin!==location\.origin/);
 assert.match(html,/event\.source===smart\.contentWindow&&event\.data\?\.type==='SABER_SMART_PRICE_STATE'/);
 assert.match(html,/Number\.isSafeInteger\(price\)&&price>0/);
});
test('la carga descarta el precio viejo al cambiar y no autoriza cobros',()=>{
 assert.match(source,/function informarPrecioPrivado\(estado,total=null\)/);
 assert.match(source,/window\.parent\.postMessage\(\{type:'SABER_SMART_PRICE_STATE'/);
 assert.match(source,/informarPrecioPrivado\('calculando'\)/);
 assert.match(source,/informarPrecioPrivado\(d\.estado==='PRELIMINAR'\?'listo':'incompleto',d\.total\)/);
 assert.doesNotMatch(source,/informarPrecioPrivado\([^)]*paymentAuthorized/);
});
