import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararVistaDisenoAbierta} from '../integraciones/autocotizador/recepcion/saber-directo-vista-previa.mjs';

const home=readFileSync(new URL('../vidriera/index.html',import.meta.url),'utf8');
const offers=readFileSync(new URL('../vidriera/ofertas.html',import.meta.url),'utf8');
for (const [name,html] of [['portada',home],['ofertas',offers]]){
 test('Diseño abierto sanitiza completamente JS, datos sensibles y enlaces de '+name,()=>{
  const rendered=prepararVistaDisenoAbierta(html,{ofertas:name==='ofertas'});
  assert.match(rendered,/VISTA DE DISEÑO · SIN CONTRASEÑA/);
  assert.match(rendered,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(rendered,/localStorage|sendWhatsApp|productsCsvUrl|libreriasaber\.mp|20-22792046|MercadoPago|MP_TEST_ACCESS_TOKEN/);
  assert.doesNotMatch(rendered,/https:\/\/wa\.me\//);
  assert.doesNotMatch(rendered,/onclick=|onerror=/i);
  assert.doesNotMatch(rendered,/href="cotizar\.html"/);
  if(name==='portada')assert.match(rendered,/href="#preview-aviso"/);
  else assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave"/);
  assert.match(rendered,/class="brand"/);
  if(name==='portada')assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave\/ofertas\.html\?categoria=/);
  else assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave#categorias"/);
 });
}
const workerSrc=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
test('Solo dos rutas públicas y CSP impide lecturas a APIs',()=>{
 assert.match(workerSrc,/if\(page==='\/prueba-v2\/diseno-sin-clave'\|\|page==='\/prueba-v2\/diseno-sin-clave\/ofertas.html'\)/);
 assert.match(workerSrc,/connect-src 'none'/);
 assert.match(workerSrc,/form-action 'none'/);
 assert.match(workerSrc,/page==='\/prueba-v2\/'\|\|page==='\/prueba-v2\/orden-paquete'/);
});
