import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
test('una sola llamada explícita envía PDF y registra D1',()=>{
 assert.match(source,/<button id="send-all-pdf"[^>]*>Enviar mi pedido<\/button>/);
 assert.match(source,/register-private"[^>]+hidden aria-hidden="true"/);
 assert.match(source,/async function registrarPedidoVerificado\(\)/);
 assert.match(source,/await registrarPedidoVerificado\(\)/);
 assert.match(source,/if\(!success\)\{terminarMedicion\('envio_incompleto'\);return;\}/);
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
 assert.match(client,/const sendable=estado==='listo'&&anillados\.every\(e=>e\.anillado==='individual'\)/);
 assert.match(client,/className='tamano-rapido'/);
 assert.match(client,/\['a4','A4'\]/);
 assert.match(client,/coincide\(p,21,29\.7,1\)/);
 assert.match(source,/smartBlockedReason/);
 assert.match(source,/event\.data\.sendable===true/);
});

test('el registro D1 conserva anillado individual y no admite grupo parcial',()=>{
 assert.match(source,/anillado:plot\?'ninguno':q\.anillado/);
 assert.match(source,/\['ninguno','individual'\]\.includes\(opt\.anillado\)/);
 assert.match(source,/d\.opcionesInteligentes\.anillado\|\|'ninguno'/);
});

test('los detalles técnicos quedan cerrados, incluso durante el envío',()=>{
 assert.doesNotMatch(source,/document\.getElementById\('recepcion-avanzada'\)\.open\s*=\s*true/);
 assert.match(source,/<details id="recepcion-avanzada"/);
 assert.match(source,/<div id="seguridad-privada"/);
 assert.equal((source.match(/data-action="documentos"/g)||[]).length,1,
  'Un único widget de seguridad, visible fuera del acordeón técnico');
 assert.ok(source.indexOf('id="seguridad-privada"')<source.indexOf('<details id="recepcion-avanzada"'));
 assert.doesNotMatch(source,/Falta pulsar «Enviar todos los PDF del pedido»/);
});

test('los tiempos quedan solo en memoria local y distinguen etapas del circuito',()=>{
 assert.match(source,/function iniciarMedicion\(/);
 assert.match(source,/function marcarFasePdf\(/);
 assert.match(source,/function terminarMedicion\(/);
 assert.match(source,/ultimoAnalisisMs/);
 assert.match(source,/marcarTiempo\('preparacion_inicio'\)/);
 assert.match(source,/marcarTiempo\('pdf_inicio'/);
 assert.match(source,/marcarTiempo\('central_inicio'\)/);
 assert.match(source,/marcarTiempo\('central_fin'\)/);
 assert.match(source,/marcarFasePdf\(d,p\)/);
 assert.match(source,/__saberRendimientoPrivado/);
 assert.match(source,/diagnostico'\)==='1'/);
 assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*Rendimiento/);
});

test('optimización privada: lecturas GAS independientes con concurrencia máxima 3, envío de bloques sigue en serie',()=>{
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 const reader=readFileSync(new URL('../integraciones/autocotizador/recepcion/leer-pdf-fase4-privado.mjs',import.meta.url),'utf8');
 const upload=readFileSync(new URL('../integraciones/autocotizador/recepcion/subir-vincular-pdf-v2-privado.mjs',import.meta.url),'utf8');
 assert.match(worker,/Math\.min\(3,offsets\.length\)/);
 assert.match(reader,/Math\.min\(3,offsets\.length\)/);
 assert.match(worker,/safeHash\(chunk\)!==part\.chunkSha256/);
 assert.match(reader,/checksum!==part\.chunkSha256/);
 assert.match(reader,/actual!==sha256/);
 assert.match(upload,/for\(let index=0;index<parts;index\+\+\)/);
 assert.match(worker,/checkoutEnabled:false,paymentAuthorized:false/);
});

test('una verificación firmada de PDF puede reutilizarse para D1 sin segunda descarga',()=>{
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 const upload=readFileSync(new URL('../integraciones/autocotizador/recepcion/subir-vincular-pdf-v2-privado.mjs',import.meta.url),'utf8');
 const signer=readFileSync(new URL('../integraciones/autocotizador/recepcion/comprobante-pdf-servidor.mjs',import.meta.url),'utf8');
 assert.match(worker,/comprobanteServidor=await crearComprobantePdf/);
 assert.match(worker,/verificacion=await verificarPedidoPorComprobantes/);
 assert.match(worker,/verificacion=await rutaLegada\(\)/);
 assert.match(worker,/serverPageMetrics/);
 assert.match(upload,/comprobanteServidor:linked\.comprobanteServidor/);
 assert.match(source,/comprobanteServidor:d\.confirmacion\.comprobanteServidor/);
 assert.match(signer,/subtle\.verify\('HMAC'/);
 assert.match(signer,/TTL_MS=15\*60\*1000/);
 assert.match(worker,/paymentAuthorized:false,listoParaProducir:false/);
});
