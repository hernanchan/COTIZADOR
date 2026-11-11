import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizarLive} from './pagina-cotizar-live.mjs';
const url='https://pedidos.libreriasaber.com.ar/cotizar';
const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,
 DOCS_MP_LIVE_GATE:gate,DOCS_LIVE_SESSION_GATE:gate,
 DOCS_LIVE_TURNSTILE_SITE_KEY:'0x4AAAAABBBBBCCCCCDDDD123456789'};
test('sin gate ni host productivo el portal no se publica',()=>{
 for(const [where,patch] of [
  [url,{DOCS_LIVE_UI_GATE:'NO_GO'}],
  [url,{DOCS_MP_LIVE_GATE:'NO_GO'}],
  [url,{SABER_ENTORNO:'preparacion'}],
  ['https://saber-documentos-pruebas.workers.dev/cotizar',{}]
 ]){
  const result=paginaCotizarLive(new Request(where),{...env,...patch},{authorized:true});
  assert.equal(result.status,404);
 }
});
test('ingreso productivo exige Turnstile exclusivo del comprador',async()=>{
 const result=paginaCotizarLive(new Request(url),env,{authorized:false});
 assert.equal(result.status,200);
 const html=await result.text();
 assert.match(html,/saber_pedido_live/);
 assert.match(html,/\/api\/pedido\/live\/sesion/);
 assert.doesNotMatch(html,/prueba-v2|sandbox|MP_TEST/);
 assert.match(result.headers.get('Content-Security-Policy'),/challenges.cloudflare.com/);
});
test('portal autenticado reutiliza motor PDF pero no habilita pago sin recepción productiva',async()=>{
 const res=paginaCotizarLive(new Request(url),env,{authorized:true});
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/iframe id="pdf"/);
 assert.match(html,/src="\/cotizar\/archivos"/);
 assert.match(html,/import \{crearFlujoPresupuestoLive\} from '\/cotizar\/flujo-live.js'/);
 assert.match(html,/const enabled=false/);
 assert.doesNotMatch(html,/prueba-v2|ensayo-r2|pago de prueba/i);
});
test('recepción activa solo bajo gate LIVE exacto; la pantalla no acredita pagos',async()=>{
 const res=paginaCotizarLive(new Request(url),{
 ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
 DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 const html=await res.text();
 assert.match(html,/const enabled=true/);
 assert.match(html,/SABER_SMART_PREPARAR_ENVIO/);
 assert.match(html,/flow\.preparar\(\)/);
 assert.match(html,/flow\.iniciarPago\(\)/);
 assert.doesNotMatch(html,/uploadR2|sendOriginal|pagoAutorizado=true/);
});

test('la pantalla autenticada autoriza SOLO su propio módulo JS con nonce CSP',async()=>{
 const out=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 assert.equal(out.status,200);
 const html=await out.text();
 const tag=html.match(/<script type="module" nonce="([a-f0-9]{32})">/);
 assert.ok(tag,'MODULO_SIN_NONCE');
 const csp=out.headers.get('Content-Security-Policy');
 assert.ok(csp.includes("script-src 'self' 'nonce-"+tag[1]+"'"),'CSP_BLOQUEA_SCRIPT');
 assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
 assert.match(html,/crearFlujoPresupuestoLive/);
});
