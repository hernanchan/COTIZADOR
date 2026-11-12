import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCentralPersonalLive} from './pagina-central-personal-live.mjs';

test('Central LIVE avisa cuando el horario guardado no coincide con el comunicado al cliente',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/id="previsionCliente" role="status"/);
 assert.match(html,/revisarPlazoVisibleAlCliente/);
 assert.match(html,/fetch\('\/api\/pedido\/plazo'/);
 assert.match(html,/saved!==data.mode/);
 assert.match(html,/pero el cliente ve/);
 assert.match(html,/Revisá la previsión antes de recibir un nuevo trabajo/);
 assert.match(html,/void revisarPlazoVisibleAlCliente\(\)/);
});
test('aviso no modifica la previsión, órdenes, precios, ni el tablero; script sigue siendo JS válido',()=>{
 const html=paginaCentralPersonalLive();
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'Central sin JavaScript');
 assert.doesNotThrow(()=>new Function(match[1]),'Script de Central inválido');
 assert.match(html,/\/personal\/api\/live-forecast/);
 assert.match(html,/\/personal\/api\/live-calendar/);
 assert.match(html,/\/personal\/api\/live-board/);
 assert.match(html,/id="previsionGuardar"/);
 assert.match(html,/id="tablero"/);
});
