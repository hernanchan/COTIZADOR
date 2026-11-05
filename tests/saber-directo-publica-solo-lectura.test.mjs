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
  if(name==='ofertas'){
    assert.equal((rendered.match(/class="v3-sample-offer"/g)||[]).length,2);
    assert.match(rendered,/Resaltador Filgo x 4 pastel/);
    assert.match(rendered,/planilla MODELO/);
    assert.match(rendered,/drive\.google\.com\/thumbnail\?id=/);
  }
  if(name==='portada')assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave\/ofertas\.html\?categoria=/);
  else assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave#categorias"/);
 });
}
const workerSrc=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
test('Solo dos rutas públicas y CSP impide lecturas a APIs',()=>{
 assert.match(workerSrc,/if\(page==='\/prueba-v2\/diseno-sin-clave'\|\|page==='\/prueba-v2\/diseno-sin-clave\/ofertas.html'\)/);
 assert.match(workerSrc,/connect-src 'none'/);
 assert.match(workerSrc,/form-action 'none'/);
 assert.match(workerSrc,/img-src https:\/\/cdn\.jsdelivr\.net https:\/\/drive\.google\.com https:\/\/\*\.googleusercontent\.com https:\/\/images\.unsplash\.com data:/);
 assert.match(workerSrc,/page==='\/prueba-v2\/'\|\|page==='\/prueba-v2\/orden-paquete'/);
});

test('Planilla modelo: categorías, fotos públicas y sin descuentos ficticios',()=>{
 const escolar=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Escolar'});
 const oficina=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Oficina'});
 const novedades=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Novedades'});
 assert.equal((escolar.match(/class="v3-sample-offer"/g)||[]).length,3);
 assert.match(escolar,/Resaltador Filgo x 4 pastel/);
 assert.match(oficina,/Resma A4 P AMPA 70 g/);
 assert.doesNotMatch(oficina,/<del>/);
 assert.doesNotMatch(novedades,/class="v3-sample-offer"/);
 assert.match(novedades,/no tiene artículos activos/);
 const portada=prepararVistaDisenoAbierta(home);
 assert.match(portada,/Resaltador Filgo x 4 pastel/);
 assert.match(portada,/Resma A4 P AMPA 70 g/);
 assert.doesNotMatch(portada,/Kit Sharpie Lettering/);
 assert.doesNotMatch(portada,/sendWhatsApp|productsCsvUrl|libreriasaber\.mp/);
});

test('Carrito visible en la muestra, independiente de compras y pedidos reales',()=>{
 for(const [html,opts] of [[home,{}],[offers,{ofertas:true,categoria:'Escolar'}]]){
  const rendered=prepararVistaDisenoAbierta(html,opts);
  assert.match(rendered,/data-demo-open/);
  assert.match(rendered,/data-demo-drawer/);
  assert.match(rendered,/data-demo-add="ESC001"/);
  assert.match(rendered,/data-demo-total/);
  assert.match(rendered,/data-demo-step/);
  assert.match(rendered,/sessionStorage/);
  assert.match(rendered,/Enviar pedido \(próximamente\)<\/button>/);
  assert.doesNotMatch(rendered,/fetch\(|XMLHttpRequest|sendWhatsApp|https:\/\/wa\.me\/|payments\/|MercadoPago|localStorage/);
 }
});

test('Ensayo prepara resumen de compra sin enviar mensajes, pagos ni pedidos',()=>{
 const rendered=prepararVistaDisenoAbierta(home);
 assert.match(rendered,/Preparar pedido para WhatsApp \(prueba\)/);
 assert.match(rendered,/data-demo-preview disabled/);
 assert.match(rendered,/data-demo-summary hidden/);
 assert.match(rendered,/TOTAL ORIENTATIVO/);
 assert.match(rendered,/confirmar disponibilidad y precio vigente/);
 assert.match(rendered,/Enviar pedido \(desactivado\)/);
 assert.doesNotMatch(rendered,/https:\/\/wa\.me\/|sendWhatsApp|MercadoPago|fetch\(|XMLHttpRequest/);
});
