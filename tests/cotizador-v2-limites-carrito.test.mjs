import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

test('la UI limita el total acumulado a 30 PDF',()=>{
 const html=paginaCotizadorV2PruebaPrivada('test-turnstile-sitekey-1234567');
 assert.match(html,/all\.reduce\(\(n,item\)=>n\+item\.references\.length,0\)\+p\.pdfDrafts\.length>30/);
});
test('la UI advierte sobre trabajos sin PDF asociado',()=>{
 const html=paginaCotizadorV2PruebaPrivada('test-turnstile-sitekey-1234567');
 assert.match(html,/withoutPdf/);
 assert.match(html,/requieren revisión manual/);
});
