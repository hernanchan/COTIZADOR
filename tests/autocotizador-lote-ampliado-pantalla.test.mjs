import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paginaLotePdfAmpliado} from '../integraciones/autocotizador/recepcion/pantalla-lote-pdf-ampliado.mjs';

test('pantalla piloto de 30 PDF: un pedido, archivos individuales y endpoints aislados',()=>{
 const html=paginaLotePdfAmpliado('0x4AAAAaa_TEST_SITEKEY_123456');
 assert.match(html,/hasta treinta archivos|treinta archivos|30 PDF/i);
 assert.match(html,/MAX_BATCH_BYTES=60\*1024\*1024/);
 assert.match(html,/batchOrderId/);
 assert.match(html,/const orderId=batchOrderId/);
 assert.match(html,/fileId:'pdf-'\+sha\.slice\(0,24\)/);
 assert.match(html,/file\.size>20\*1048576/);
 assert.match(html,/recibidos\.length>=30/);
 assert.match(html,/\/api\/ensayo-pdf-ampliado/);
 assert.match(html,/\/api\/ensayo-cotizar-lote-ampliado/);
 assert.doesNotMatch(html,/rpc\('\/api\/ensayo-pdf'/);
 assert.doesNotMatch(html,/rpc\('\/api\/ensayo-cotizar-lote'/);
 assert.match(html,/Pagos: DESACTIVADOS/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.ok(script.length>500);
 assert.doesNotThrow(()=>new Function(script));
});
test('pantalla y rutas de ensayo siguen detrás de variable privada',()=>{
 const path=new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url);
 const source=readFileSync(path,'utf8');
 assert.match(source,/page==='\/prueba-cotizador-lote-ampliado'/);
 assert.match(source,/page==='\/api\/ensayo-pdf-ampliado'/);
 assert.match(source,/page==='\/api\/ensayo-cotizar-lote-ampliado'/);
 assert.match(source,/DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY'/);
 assert.match(source,/extended\?30:5/);
 assert.match(source,/maxFiles,maxFileBytes,requireSharedOrder:extended/);
});
