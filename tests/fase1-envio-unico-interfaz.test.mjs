import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
test('una sola llamada explícita envía PDF y registra D1',()=>{
 assert.match(source,/<button id="send-all-pdf"[^>]*>Enviar mi pedido<\/button>/);
 assert.match(source,/register-private"[^>]+hidden aria-hidden="true"/);
 assert.match(source,/async function registrarPedidoVerificado\(\)/);
 assert.match(source,/await registrarPedidoVerificado\(\)/);
 assert.match(source,/if\(!success\)return;/);
 assert.match(source,/if\(allEntries.some\(d=>!d.confirmacion\)\)/);
 assert.match(source,/const pending=allEntries.filter\(d=>!d.confirmacion\)/);
 assert.match(source,/if\(registeredOrder\)/);
});
test('se conservan SHA, recepción protegida, idempotencia y prohibición de pagos',()=>{
 assert.match(source,/subirYVincularPdfCotizadorV2/);
 assert.match(source,/prepararManifiestoDocumentalV2/);
 assert.match(source,/\/api\/ensayo-preparar-documentos-v2-lote/);
 assert.match(source,/result.paymentAuthorized!==false/);
 assert.match(source,/window.turnstile/);
});
test('plantilla JavaScript del portal compila de forma aislada',()=>{
 const body=source.slice(source.indexOf('return `')+8,source.lastIndexOf('`;'));
 const js=body.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js?.length>2000);
 new Function(js.replace(/^import .*;$/gm,''));
});

test('el clic único pide al analizador preparar archivos y espera confirmación',()=>{
 assert.match(source,/SABER_SMART_PREPARAR_ENVIO/);
 assert.match(source,/SABER_SMART_HANDOFF_READY/);
 assert.match(source,/await prepararDesdeCotizador\(\)/);
 assert.match(source,/smartReady=status==='listo'/);
});

test('anillado no se ofrece falsamente como enviable y tamaño A4 puede elegirse sin abrir editor',()=>{
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
 assert.match(client,/const sendable=estado==='listo'&&anillados\.length===0/);
 assert.match(client,/className='tamano-rapido'/);
 assert.match(client,/\['a4','A4'\]/);
 assert.match(client,/coincide\(p,21,29\.7,1\)/);
 assert.match(source,/smartBlockedReason/);
 assert.match(source,/event\.data\.sendable===true/);
});
