import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararVistaDisenoPrivada,prepararVistaDisenoAbierta} from '../integraciones/autocotizador/recepcion/saber-directo-vista-previa.mjs';

const root=new URL('../',import.meta.url);
const main=readFileSync(new URL('vidriera/index.html',root),'utf8');
const offers=readFileSync(new URL('vidriera/ofertas.html',root),'utf8');
const worker=readFileSync(new URL('integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',root),'utf8');
const route='/prueba-v2/diseno-saber-directo';

test('portada de revisión conserva promo y catálogo, sin rutas comerciales relativas rotas',()=>{
 const html=prepararVistaDisenoPrivada(main);
 assert.match(html,/VISTA PREVIA PRIVADA DE DISEÑO/);
 assert.match(html,/robots" content="noindex,nofollow,noarchive"/);
 assert.match(html,/class="hero hero-direct"/);
 assert.match(html,/id="promoTitle"/);
 assert.match(html,/productsCsvUrl/);
 assert.match(html,/href="\/prueba-v2\/"/);
 assert.match(html,/href="\/prueba-v2\/diseno-saber-directo\/ofertas\.html\?categoria=/);
 assert.doesNotMatch(html,/href="cotizar\.html"/);
 assert.match(html,/stopImmediatePropagation/);
 assert.match(html,/sendWhatsApp/);
});

test('ofertas de prueba vuelven a portada privada, sin enlace a web comercial',()=>{
 const html=prepararVistaDisenoPrivada(offers,{ofertas:true});
 assert.match(html,/href="\/prueba-v2\/diseno-saber-directo"/);
 assert.match(html,/VISTA PREVIA PRIVADA DE DISEÑO/);
});

test('las dos rutas dependen de la compuerta Basic o sesión privada existente',()=>{
 assert.match(worker,/if\(page==='\/prueba-v2\/diseno-saber-directo'/);
 assert.match(worker,/return v2PrivateBrowserResponse\(request,env,page\)/);
 assert.match(worker,/if\(status==='deny'&&!allowMobile&&!buyerOK\)return new Response\('Autenticación privada requerida'/);
 assert.match(worker,/if\(status==='off'&&!buyerOK\)return testResponse/);
 assert.match(worker,/prepararVistaDisenoPrivada\(ofertas\?ofertasSaberDirectoHtml:portadaSaberDirectoHtml/);
 assert.match(worker,/Content-Security-Policy/);
 assert.match(worker,/style-src 'unsafe-inline'/);
 assert.match(worker,/form-action 'none'/);
});


test('la portada anónima nunca deriva Cotizar a producción aunque el portal TUS esté cerrado',()=>{
 const html=prepararVistaDisenoAbierta(main,{pedidoTUS:false});
 assert.match(html,/href="\/prueba-v2\/cotizar-cliente"/);
 assert.doesNotMatch(html,/href="https:\/\/libreriasaber\.com\.ar\/cotizar"/);
 assert.doesNotMatch(html,/href="cotizar\.html"/);
});

test('la portada anónima habilitada lleva Cotizar al pedido TUS de Sandbox',()=>{
 const html=prepararVistaDisenoAbierta(main,{pedidoTUS:true});
 assert.match(html,/href="\/prueba-v2\/pedido-cliente"/);
 assert.doesNotMatch(html,/href="https:\/\/libreriasaber\.com\.ar\/cotizar"/);
});
