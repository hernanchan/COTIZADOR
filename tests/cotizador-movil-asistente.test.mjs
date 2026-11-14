import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizarLive} from '../integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
import {prepararCotizadorArchivosLive} from '../integraciones/autocotizador/recepcion/pagina-archivos-live.mjs';
import fs from 'node:fs';
const gate='GO_COMERCIAL_CONFIRMADO';
const base='https://pedidos.libreriasaber.com.ar/cotizar';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,DOCS_MP_LIVE_GATE:gate,
 DOCS_LIVE_SESSION_GATE:gate,DOCS_LIVE_ORDER_GATE:gate,DOCS_LIVE_PRICING_GATE:gate};
const clientJs=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/asistente-movil-live.txt',import.meta.url),'utf8');
test('un mismo origen, cotizador y estado comercial LIVE para PC y móvil',async()=>{
 const response=paginaCotizarLive(new Request(base),env,{authorized:true});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/src="\/cotizar\/archivos"/);
 assert.match(html,/id="barra-movil"/);
 assert.match(html,/id="barra-continuar"/);
 assert.match(html,/SABER_SMART_PRICE_STATE/);
 assert.match(html,/SABER_SMART_PREPARAR_ENVIO/);
 assert.match(html,/flow\.preparar\(\)/);
 assert.match(html,/flow\.iniciarPago\(\)/);
 assert.match(html,/SABER_MOBILE_PRICE_CONFIRM/);
 assert.match(html,/SABER_MOBILE_STAGE/);
 assert.match(html,/const enabled=true/);
 assert.match(html,/mobileGo\.disabled=!enabled\|\|!mobileSendable\|\|working\|\|next\.disabled/);
 assert.ok(html.includes("body.mobile-wizard-ready #siguiente{display:none}"),
   'si el asistente no carga, el botón original debe seguir visible');
 assert.doesNotMatch(html,/https:\/\/pagos\.libreriasaber\.com\.ar\/admin/);
});
test('la vista móvil es una capa sin reemplazar archivo, cotización ni handoff existente',()=>{
 const html=prepararCotizadorArchivosLive(paginaCargaUnica());
 assert.match(html,/id="lista"/);
 assert.match(html,/id="archivos"/);
 assert.match(html,/src="\/cotizar\/archivos.js"/);
 assert.match(html,/src="\/cotizar\/movil.js"/);
 assert.match(html,/SABER_SMART_RESIZE/);
 assert.match(html,/SABER_SMART_RESIZE_REQUEST/);
 assert.doesNotMatch(html,/src="\/prueba-carga-unica.js"/);
});
test('el asistente funciona únicamente dentro del iframe comprador y en ancho móvil',()=>{
 assert.match(clientJs,/location\.pathname !== '\/cotizar\/archivos'/);
 assert.match(clientJs,/window\.parent === window/);
 assert.match(clientJs,/matchMedia\('\(max-width: 720px\)'\)/);
 assert.match(clientJs,/media\.matches/);
 assert.match(clientJs,/body\.classList\.remove\('saber-mobile'\)/);
 assert.match(clientJs,/SABER_MOBILE_STAGE/);
 assert.match(clientJs,/SABER_MOBILE_PRICE_CONFIRM/);
 assert.match(clientJs,/event\.origin!==location\.origin/);
 assert.doesNotMatch(clientJs,/\/api\/pedido\/live\/orden|\/api\/pedido\/live\/checkout|mercadopago\.com\/checkout/i);
});
test('sin sesión comercial no se habilitan pago ni subida ni modifica seguridad',()=>{
 const result=paginaCotizarLive(new Request(base),
  {...env,DOCS_MP_LIVE_GATE:'NO_GO'},{authorized:true});
 assert.notEqual(result.status,200);
});
test('fotos y stickers usan exactamente el mismo flujo móvil y rutas de venta',async()=>{
 for(const servicio of ['fotos','stickers']){
  const html=await paginaCotizarLive(new Request(base+'?servicio='+servicio),
   env,{authorized:true}).text();
  assert.match(html,new RegExp('src="/cotizar/archivos\\?servicio='+servicio+'"'));
  assert.match(html,/id="barra-movil"/);
 }
});
