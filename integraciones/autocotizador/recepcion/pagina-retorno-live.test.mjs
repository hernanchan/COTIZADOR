import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaRetornoLive} from './pagina-retorno-live.mjs';
const host='https://pedidos.libreriasaber.com.ar/pedido/estado';
const on={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO'};
test('retorno cerrado no expone pagina ni consulta pagos',async()=>{
 for(const [url,env,method] of [
  [host,{...on,DOCS_MP_LIVE_GATE:'NO_GO'},'GET'],
  [host,{...on,SABER_ENTORNO:'preparacion'},'GET'],
  ['https://saber-documentos-pruebas.workers.dev/pedido/estado',on,'GET'],
  ['http://pedidos.libreriasaber.com.ar/pedido/estado',on,'GET'],
  [host,on,'POST']
 ]){
  const response=paginaRetornoLive(new Request(url,{method}),env);
  assert.equal(response.status,404);
 }
});
test('retorno LIVE no acredita pago por argumentos de Mercado Pago',async()=>{
 const r=paginaRetornoLive(new Request(host+'?status=approved&payment_id=123&merchant_order_id=777'),on);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Seguimiento de tu pedido/);
 assert.match(html,/Consultando pago y estado del trabajo en Librería Saber/);
 assert.match(html,/action:'status'/);
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/uploadAuthorized===true/);
 assert.match(html,/response.status===401/);
 assert.match(html,/location.replace\('\/pedido\/continuar'\)/);
 assert.doesNotMatch(html,/\b123\b|\b777\b/);
 assert.equal(r.headers.get('Cache-Control'),'no-store, private');
 assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);
});

test('retorno de pago incluye seguimiento real, orden y archivos pendientes sin admitir acreditación por URL',async()=>{
 const on={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',DOCS_LIVE_TUS_GATE:'GO_COMERCIAL_CONFIRMADO',DOCS_LIVE_RECEPCION_GATE:'GO_COMERCIAL_CONFIRMADO'};
 const response=paginaRetornoLive(new Request('https://pedidos.libreriasaber.com.ar/pedido/estado?status=approved&payment_id=9999'),on);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Seguimiento de tu pedido/);
 assert.match(html,/id="numeroPedido"/);
 assert.match(html,/id="estadoTrabajo"/);
 assert.match(html,/id="resumenArchivos"/);
 assert.match(html,/id="fechaRetiro"/);
 assert.match(html,/actualizarSeguimiento\(data\)/);
 assert.match(html,/setInterval\(\(\)=>\{if\(!document\.hidden\)void revisar\(\)\},15000\)/);
 assert.match(html,/\/api\/pedido\/live\/checkout/);
 assert.doesNotMatch(html,/searchParams\.get\('payment_id'\)/);
});
