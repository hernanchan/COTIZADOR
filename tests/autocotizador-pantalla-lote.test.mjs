import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaLotePdf} from '../integraciones/autocotizador/recepcion/pantalla-lote-pdf.mjs';

test('pantalla multifichero integra controles reales y JavaScript válido',()=>{
 const key='0x4AAAAaa_TEST_SITEKEY_123456';
 const html=paginaLotePdf(key);
 assert.match(html,/Presupuesto conjunto de varios PDF/);
 assert.match(html,/id="file"/);
 assert.match(html,/type="file"[^>]*multiple/);
 assert.match(html,/id="drop"/);
 assert.match(html,/id="pending"/);
 assert.match(html,/Preparados para enviar/);
 assert.match(html,/Enviar próximo PDF preparado/);
 assert.match(html,/drop\.addEventListener\('drop'/);
 assert.match(html,/preparados\.shift\(\)/);
 assert.match(html,/mode\.addEventListener\('change'/);
 assert.match(html,/mode\.addEventListener\('change'/);
 assert.match(html,/id="quote"/);
 assert.match(html,/\/api\/ensayo-cotizar-lote/);
 assert.match(html,/data-sitekey="0x4AAAAaa_TEST_SITEKEY_123456"/);
 assert.match(html,/Pagos: DESACTIVADOS/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.ok(script.length>200);
 assert.doesNotThrow(()=>new Function(script));
});
test('no se puede abrir el formulario sin clave Turnstile',()=>{
 assert.throws(()=>paginaLotePdf(''),/Turnstile/);
 assert.throws(()=>paginaLotePdf('<invalid>'),/Turnstile/);
});
