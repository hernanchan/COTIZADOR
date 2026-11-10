import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
test('Central muestra recepción LIVE dentro del panel autenticado existente',()=>{
 assert.match(source,/id="liveRecepcionPanel"/);
 assert.match(source,/id="refreshLiveRecepcion"/);
 assert.match(source,/await api\("\/admin\/api\/central\/live-recepcion"\)/);
 assert.match(source,/liveRecepcionButton\.addEventListener\("click",actualizarRecepcionLive\)/);
});
test('panel sólo lectura: ninguna mutación y ningún botón de preparación automática',()=>{
 const first=source.indexOf('async function actualizarRecepcionLive(){');
 const last=source.indexOf('liveRecepcionButton.addEventListener("click",actualizarRecepcionLive);');
 assert.ok(first>0&&last>first);
 const script=source.slice(first,last);
 assert.doesNotMatch(script,/apiPost\(|fetch\([^\n]*method:.*POST/);
 assert.match(script,/o\.readyForProduction!==false\|\|o\.zipEnabled!==false/);
 assert.match(script,/liveRecepcionList\.replaceChildren\(\)/);
 assert.match(script,/document\.createElement\("li"\)/);
 assert.doesNotMatch(script,/innerHTML|insertAdjacentHTML|window\.open|location\.assign/);
});

test('Central enlaza ZIP staff sólo tras recibir todos los originales; no imprime',()=>{
 const from=source.indexOf('async function actualizarRecepcionLive(){');
 const to=source.indexOf('liveRecepcionButton.addEventListener("click",actualizarRecepcionLive);');
 assert.ok(to>from);
 const script=source.slice(from,to);
 assert.match(script,/o\.estado==="ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE"/);
 assert.match(script,/o\.pendingCount===0&&o\.receivedCount===o\.fileCount/);
 assert.match(script,/WEB-ENSAYO-\[A-F0-9\]\{32\}/);
 assert.match(script,/\/personal\/paquete\?webOrderId=/);
 assert.match(script,/link\.rel="noopener noreferrer"/);
 assert.match(script,/instrucciones para preprensa/);
 assert.doesNotMatch(script,/listoParaProducir=true|readyForProduction=true/);
});
