import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorTUSClientePruebas}
 from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

const sitekey='sitekey-example-abcdefghijklmnopqrst';
const render=r2=>paginaCotizadorTUSClientePruebas(sitekey,true,null,true,r2);

test('el portal del comprador oculta R2 cuando el gate privado está apagado',()=>{
 const html=render(false);
 assert.match(html,/const R2_PREPAY_UI_ENABLED=false;/);
 assert.doesNotMatch(html,/\\?r2Prepago=1/);
});

test('el portal comprador habilitado conecta iframe y recuperación postpago',()=>{
 const html=render(true);
 assert.match(html,/const R2_PREPAY_UI_ENABLED=true;/);
 assert.match(html,/\\?r2Prepago=1/);
 assert.match(html,/r2-prepago-recuperar-file/);
 assert.match(html,/r2-prepago-panel/);
});

test('la pantalla de comprador sin quinto argumento permanece bloqueada',()=>{
 const html=paginaCotizadorTUSClientePruebas(sitekey,true,null,true);
 assert.match(html,/const R2_PREPAY_UI_ENABLED=false;/);
});
