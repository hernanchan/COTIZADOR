import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
test('ruta comercial V2 lote es exclusivamente el endpoint privado previsto',()=>{
 assert.match(source,/if\(page==='\/api\/ensayo-preparar-documentos-v2-lote'\)return apiPrepararDocumentosV2Lote\(request,env\)/);
 assert.match(source,/async function apiPrepararDocumentosV2Lote\(request,env\)/);
});
test('bloqueo por 4 compuertas y por contraseña de operador antes de acceder a GAS',()=>{
 const section=source.slice(source.indexOf('async function apiPrepararDocumentosV2Lote('),
  source.indexOf('Ensayo mismo origen del cotizador V2 original.'));
 assert.match(section,/request.method!=='POST'/);
 assert.match(section,/!allowed\(request,env\)/);
 assert.match(section,/DOCS_V2_RECEIPT_LINK_ENABLED/);
 assert.match(section,/DOCS_EXTENDED_RECEIVER_ENABLED/);
 assert.match(section,/DOCS_CENTRAL_SYNC_ENABLED/);
 assert.match(section,/DOCS_ORDER_PREPARE_ENABLED/);
 assert.match(section,/DOCS_CENTRAL_ADMIN_KEY/);
 assert.ok(section.indexOf('v2PrivateBrowserAuthorized(request,env)')<section.indexOf('fase4FichaCentralLotePrivada('));
 assert.match(section,/if\(difference&&v2PrivateBrowserAuthorized\(request,env\)!=='allow'\)/);
 assert.ok(section.indexOf('fase4FichaCentralLotePrivada(')<section.indexOf('registrarManifiestoV2EnCentral('));
 assert.ok(section.indexOf('registrarManifiestoV2EnCentral(')<section.indexOf('prepararDocumentosCentralFirmado('));
 assert.match(section,/checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false/);
});
