import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function apiPrepararDocumentosV2Lote(');
const end=source.indexOf('/**\n * Ensayo mismo origen',start);
const body=source.slice(start,end);
test('registro privado falla cerrado y clasifica la fase 422 sin datos internos',()=>{
 assert.ok(start>=0&&end>start);
 for(const stage of ['VERIFICACION_RECIBOS','RELECTURA_DRIVE','CONCILIACION_MANIFIESTO','PREPARACION_CENTRAL'])
  assert.match(body,new RegExp(stage));
 assert.match(body,/console\.warn\('saber_v2_registro_pendiente',etapaRegistro\)/);
 assert.match(body,/reasonCode:etapaRegistro/);
 assert.match(body,/paymentAuthorized:false,listoParaProducir:false\},422\)/);
 assert.doesNotMatch(body,/error:_error\.message/);
 assert.doesNotMatch(body,/console\.warn\([^\n]*_error/);
});
