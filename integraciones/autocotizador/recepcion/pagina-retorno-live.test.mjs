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
 assert.match(html,/Volviste a Librería Saber/);
 assert.match(html,/no significa que el pago ya esté acreditado/);
 assert.match(html,/action:'status'/);
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/uploadAuthorized===true/);
 assert.doesNotMatch(html,/\b123\b|\b777\b/);
 assert.equal(r.headers.get('Cache-Control'),'no-store, private');
 assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);
});
