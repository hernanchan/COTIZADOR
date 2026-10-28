import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
test('una sola llamada explícita envía PDF y registra D1',()=>{
 assert.match(source,/<button id="send-all-pdf"[^>]*>Enviar mi pedido<\/button>/);
 assert.match(source,/register-private"[^>]+hidden aria-hidden="true"/);
 assert.match(source,/async function registrarPedidoVerificado\(\)/);
 assert.match(source,/await registrarPedidoVerificado\(\)/);
 assert.match(source,/if\(!success\)\{[\s\S]*?mostrarEstadoCliente\(null\);[\s\S]*?terminarMedicion\('envio_incompleto'\);return;[\s\S]*?\}/);
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
 assert.match(worker,/comprobanteServidor=recibo\.serverPageMetrics/);
 assert.match(worker,/await crearComprobantePdf/);
 assert.match(worker,/verificacion=await verificarPedidoPorComprobantes/);
 assert.match(worker,/verificacion=await rutaLegada\(\)/);
 assert.match(worker,/serverPageMetrics/);
 assert.match(upload,/comprobanteServidor:linked\.comprobanteServidor/);
 assert.match(source,/comprobanteServidor:d\.confirmacion\.comprobanteServidor/);
 assert.match(signer,/subtle\.verify\('HMAC'/);
 assert.match(signer,/TTL_MS=15\*60\*1000/);
 assert.match(worker,/paymentAuthorized:false,listoParaProducir:false/);
});

test('UX compacta: pantalla de cliente no despliega diagnosticos y reemplaza editor por estado en mismo espacio',()=>{
 assert.match(source,/const modoDiagnostico=new URLSearchParams/);
 assert.match(source,/document.getElementById\('recepcion-avanzada'\).hidden=true/);
 assert.match(source,/document.getElementById\('comparacion-original'\).hidden=true/);
 assert.match(source,/#vista-estado-pedido/);
 assert.match(source,/body\.estado-envio #smart,body\.estado-registro #smart\{display:none\}/);
 assert.match(source,/mostrarEstadoCliente\('enviando'/);
 assert.match(source,/mostrarEstadoCliente\('registrado'/);
 assert.match(source,/ultimoTotalServidor=result\.totalArs/);
 assert.match(source,/mostrarEstadoCliente\(null\)/);
});

test('UX de carga unica: grupos automaticos conservan indices de origen y opciones individuales',()=>{
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(client,/function grupoVisible\(e\)/);
 for(const id of ['a4','a3','cad','poster','mixtos','pendientes'])
  assert.match(client,new RegExp("id:'"+id+"'"));
 assert.match(client,/entries\.forEach\(\(e,i\)=>\{/);
 assert.match(client,/grupos\.get\(cat\.id\)\.indices\.push\(i\)/);
 assert.match(client,/for\(const i of grupo\.indices\)/);
 assert.match(client,/const e=entries\[i\]/);
 assert.match(client,/function controlesComunes\(grupo\)/);
 assert.match(client,/for\(const i of grupo\.indices\)\{/);
 assert.match(client,/if\(campo==='anillado'\)/);
 assert.match(client,/e\.grupoAnillado=''/);
 assert.match(worker,/#presupuesto\{display:none\}/);
 assert.match(client,/files,options,total:totalDocumentos/);
});

test('la compilación de staging exige ensayo completo de sello PDF y Central sin otra descarga',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url),'utf8'));
 assert.match(pkg.scripts['build:unificado'],/node --test \.\/fase4-comprobante-worker-e2e\.test\.mjs/);
 const e2e=readFileSync(new URL('../integraciones/autocotizador/recepcion/fase4-comprobante-worker-e2e.test.mjs',import.meta.url),'utf8');
 assert.match(e2e,/googleCalls\.length,googleBeforeOrder/);
 assert.match(e2e,/stageCount,1/);
 assert.match(e2e,/comprobanteServidor\.payload\.pages=11/);
 assert.match(e2e,/preparedCount,1/);
});
