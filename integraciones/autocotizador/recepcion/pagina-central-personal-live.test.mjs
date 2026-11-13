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

test('Definir hora usa calendario nativo, respeta agenda y evita cuatro ventanas prompt',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/id="etaDate" type="date"/);
 assert.match(html,/id="etaTime" type="time"/);
 assert.match(html,/id="etaOperator" type="text"/);
 assert.match(html,/id="etaReasonBlock" hidden/);
 assert.match(html,/etaDialog\.showModal\(\)/);
 assert.match(html,/agenda\.weekly/);
 assert.match(html,/agenda\.closedDates/);
 assert.match(html,/time\.addEventListener\('click',\(\)=>openOrderEta\(o\)\)/);
 assert.doesNotMatch(html,/window\.prompt\('Fecha y hora estimada/);
 const js=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(js);
 assert.doesNotThrow(()=>new Function(js[1]),'JavaScript del calendario inválido');
});


test('Central muestra aviso de transferencias informadas automáticamente sin declararlas pagadas',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/id="transferenciasAviso"/);
 assert.match(html,/actualizarAvisosTransferencia/);
 assert.match(html,/customerNotified===true/);
 assert.match(html,/setInterval\(\(\)=>\{if\(!document\.hidden\)void actualizarAvisosTransferencia\(\)\},15000\)/);
 assert.match(html,/\/personal\/api\/live-transferencias-pendientes/);
 assert.match(html,/Transferencias avisadas por clientes/);
});
