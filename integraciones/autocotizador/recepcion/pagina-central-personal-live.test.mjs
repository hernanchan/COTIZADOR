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


test('MP y transferencia comparten ZIP sin TUS/R2 en la operación diaria',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/o\.zipEnabled===true&&o\.pendingCount===0/);
 assert.match(html,/Descargar ZIP \+ instrucciones/);
 assert.match(html,/Pago acreditado\. Esperando el envío/);
 assert.match(html,/Archivos PDF recibidos/);
 assert.doesNotMatch(html,/Inspeccionar PDF R2 almacenado/);
 assert.doesNotMatch(html,/TUS '\+o\.tusCount|R2 '\+o\.r2Count/);
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Function(match[1]));
});

test('operación diaria: aviso bancario automático y estados en un formulario, sin ventanas múltiples',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/id="transferNewTitle"/);
 assert.match(html,/id="transferNewList"/);
 assert.match(html,/id="stageDialog"/);
 assert.match(html,/id="stageOperator"/);
 assert.match(html,/id="stageConfirmed"/);
 assert.match(html,/revisé los originales|Revisé los originales/);
 assert.match(html,/id="stageSave"/);
 assert.match(html,/setInterval\(\(\)=>\{if\(!document\.hidden\)void refresh\(\)\},15000\)/);
 assert.doesNotMatch(html,/window\.prompt\('Nombre de quien realiza el cambio de estado'/);
 assert.match(html,/o\.zipEnabled===true/);
});

test('al entregar, la Central oculta la columna Entregados pero conserva alertas de purga',()=>{
 const html=paginaCentralPersonalLive();
 assert.match(html,/\['listo','Listos'\]/);
 assert.doesNotMatch(html,/\['entregado','Entregados'\]/);
 assert.match(html,/entregado:'Confirmar entrega y borrar originales'/);
 assert.match(html,/Entregado · borrar originales/);
 assert.match(html,/data\.cleanupPendingCount/);
 assert.match(html,/originales pendientes de eliminación/);
 const js=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(js);
 assert.doesNotThrow(()=>new Function(js[1]));
});
