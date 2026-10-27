import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';

const dir=new URL('../integraciones/autocotizador/recepcion/',import.meta.url);
const smart=readFileSync(new URL('carga-unica-cliente.mjs',dir),'utf8');
const portal=readFileSync(new URL('pantalla-cotizador-v2-prueba-privada.mjs',dir),'utf8');
const manifest=readFileSync(new URL('preparar-manifiesto-v2-documental.mjs',dir),'utf8');

test('primera etapa: ploteos ingresan a ensayo sin registro comercial',()=>{
 assert.match(smart,/plan\.destino!=='documentos'/);
 assert.match(portal,/allRefs\.some\(d=>d\.ploteo\)/);
 assert.match(portal,/Registro D1 del ploteo: PENDIENTE/);
});
test('primera etapa: no permitir anillado sin contrato backend',()=>{
 assert.match(smart,/e\.anillado!=='ninguno'/);
 assert.match(smart,/El anillado está disponible para cotizar, pero su registro privado todavía requiere validación/);
});
test('primera etapa: manifiesto legado limitado a A4 A3 y sin rollos',()=>{
 assert.match(manifest,/new Set\(\['a4','a3'\]\)/);
 assert.doesNotMatch(manifest,/rolloEstandarAutomatico|papelPoster/);
 assert.match(portal,/SABER_SMART_DOCUMENTS_TO_PRIVATE/);
});
// Estas pruebas son de frontera: NO certifican recepción, precio ni producción de ploteos.
