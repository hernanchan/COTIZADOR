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
 assert.match(html,/const enabled=(true|false)/);
 assert.match(html,/mobileGo.disabled=!enabled/);
 assert.match(html,/mobileGo\.disabled=!enabled\|\|!mobileSendable\|\|working\|\|next\.disabled/);
 assert.ok(html.includes("body.mobile-wizard-ready #siguiente{display:none}"),
   'si el asistente no carga, el botón original debe seguir visible');
 assert.doesNotMatch(html,/https:\/\/pagos\.libreriasaber\.com\.ar\/admin/);
});
test('la vista móvil es una capa sin reemplazar archivo, cotización ni handoff existente',()=>{
 const html=prepararCotizadorArchivosLive(paginaCargaUnica(),{previewMovil:true});
 assert.match(html,/id="lista"/);
 assert.match(html,/id="archivos"/);
 assert.match(html,/src="\/cotizar\/archivos.js"/);
 assert.match(html,/src="\/cotizar\/movil.js"/);
 assert.match(html,/SABER_SMART_RESIZE/);
 assert.match(html,/SABER_SMART_RESIZE_REQUEST/);
 assert.doesNotMatch(html,/src="\/prueba-carga-unica.js"/);
});
test('el asistente funciona únicamente dentro del iframe comprador y en ancho móvil',()=>{
 assert.match(clientJs,/location\.pathname\s*!==\s*'\/cotizar\/archivos'/);
 assert.match(clientJs,/window\.parent\s*===\s*window/);
 assert.match(clientJs,/matchMedia\('\(max-width: 720px\), \(max-width: 1024px\) and \(pointer: coarse\)'\)/);
 assert.match(clientJs,/const forced\s*=\s*new URLSearchParams\(location.search\).get\('vista'\)\s*===\s*'movil'/);
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

test('vista móvil REAL muestra mismo iframe y precios, pero nunca autoriza checkout',async()=>{
 const response=paginaCotizarLive(new Request(base+'?vista=movil'),env,{authorized:true});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/src="\/cotizar\/archivos\?vista=movil"/);
 assert.match(html,/Prueba móvil con precios reales/);
 assert.match(html,/No genera pedidos ni permite pagar/);
 assert.match(html,/const enabled=false/);
 assert.match(html,/const enabled=false,bankEnabled=false/);
 assert.match(html,/SABER_SMART_PRICE_STATE/);
 assert.match(html,/id="precio"/);
 assert.match(html,/id="plazo-orientativo"/);
 assert.match(html,/id="barra-precio"/);
 assert.match(html,/Sin pago en esta prueba/);
 assert.doesNotMatch(html,/src="\/cotizar\/archivos\?servicio=(?!fotos|stickers)/);
});
test('sesión inicial preserva ?vista=movil, sin bypass de Turnstile',async()=>{
 const r=paginaCotizarLive(new Request(base+'?vista=movil'),{
  ...env,DOCS_LIVE_TURNSTILE_SITE_KEY:'abcdefghijklmnopqrstuvwx123456789'
 },{authorized:false});
 const html=await r.text();
 assert.equal(r.status,200);
 assert.match(html,/cf-turnstile/);
 assert.match(html,/location.replace\('\/cotizar\?vista=movil'\)/);
});
test('el comprador normal y PC conserva adaptador sin asistente, con gate original',async()=>{
 const regular=prepararCotizadorArchivosLive(paginaCargaUnica());
 assert.match(regular,/src="\/cotizar\/movil.js"/);
 assert.match(clientJs,/const active = \(\) => forced \|\| media.matches/);
 const current=await paginaCotizarLive(new Request(base),env,{authorized:true}).text();
 assert.match(current,/src="\/cotizar\/archivos"/);
 assert.doesNotMatch(current,/Prueba móvil con precios reales/);
 assert.match(current,/const enabled=(true|false)/);
});
test('fotos/stickers mantienen la selección y la modalidad de prueba en mismo origen',async()=>{
 for(const servicio of ['fotos','stickers']){
  const html=await paginaCotizarLive(new Request(base+'?servicio='+servicio+'&vista=movil'),
    env,{authorized:true}).text();
  assert.ok(html.includes('src="/cotizar/archivos?servicio='+servicio+'&vista=movil"'));
  assert.match(html,/const enabled=false/);
 }
});

test('cada archivo tiene cuatro pantallas específicas, sin clonar controles ni crear pagos',()=>{
 assert.match(clientJs,/PASO '\+stage\+' DE 6'/);
 for(const heading of ['Tamaño y tipo','Color y papel','Caras y distribución','Copias y terminación','Revisá tu presupuesto'])
  assert.ok(clientJs.includes(heading),'Falta pantalla '+heading);
 assert.match(clientJs,/fieldPart|partFor/);
 assert.match(clientJs,/child\.dataset\.mobileHidden/);
 assert.match(clientJs,/activeFile<numFiles\(\)-1/);
 assert.match(clientJs,/stage===6/);
 assert.match(clientJs,/querySelector\('.panel-edicion'\)/);
 assert.doesNotMatch(clientJs,/fetch\s*\(|\.submit\s*\(|iniciarPago|mercadopago\.com/i);
});

test('circuito comercial habilitado para cotizador normal, preview no cobra',async()=>{
 const live={...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_TRANSFER_GATE:gate,DOCS_LIVE_TUS_GATE:gate};
 const regular=await paginaCotizarLive(new Request(base),live,{authorized:true}).text();
 assert.match(regular,/const enabled=true,bankEnabled=true,previewMode=false/);
 assert.match(regular,/src="\\/cotizar\\/archivos"/);
 assert.match(regular,/mobileGo\.addEventListener\('click'/);
 assert.match(regular,/if\(!mobileGo\.disabled&&!next\.disabled\)next\.click\(\)/);
 assert.match(regular,/SABER_SMART_PREPARAR_ENVIO/);
 assert.match(regular,/SABER_SMART_UNIVERSAL_PDF/);
 const preview=await paginaCotizarLive(new Request(base+'?vista=movil'),live,{authorized:true}).text();
 assert.match(preview,/const enabled=false,bankEnabled=false,previewMode=true/);
 assert.match(preview,/src="\\/cotizar\\/archivos\\?vista=movil"/);
});
