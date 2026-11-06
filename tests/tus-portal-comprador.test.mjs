import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 manejarPortalPedidosCliente,autorizadoPedidoCliente,
 cookiePedidoClienteVinculado,autorizadoPedidoClienteVinculado,
 manejarCotizadorCliente
} from '../integraciones/autocotizador/recepcion/cotizador-cliente-publico.mjs';
import {paginaCotizadorTUSClientePruebas}
 from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente';
const now=1793962800000;
const env={
 DOCS_PUBLIC_QUOTE_GATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_PUBLIC_ORDER_GATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TURNSTILE_SITE_KEY:'0x4AAAAAAAEXAMPLEPUBLICQUOTEKEY',
 DOCS_TURNSTILE_SECRET:'TURNSTILE_TEST_SECRET_NOT_FOR_PRODUCTION_123456',
 DOCS_V2_PRIVATE_UI_SECRET:'OPERATOR_SECRET_'+'A'.repeat(32),
 DOCS_CENTRAL_ADMIN_KEY:'ADMIN_SECRET_'+'B'.repeat(32),
 CENTRAL_BRIDGE_KEY:'BRIDGE_SECRET_'+'C'.repeat(32)
};
const opts={
 now,subtle:webcrypto.subtle,random:()=>new Uint8Array(16).fill(8),
 paginaPedido:()=>paginaCotizadorTUSClientePruebas(env.DOCS_TURNSTILE_SITE_KEY,true,{invalidos:[]},true)
};
const request=(method='GET',cookies='',token='VALID_TOKEN_FROM_BROWSER_12345',requestUrl=url)=>{
 const headers={...(cookies?{Cookie:cookies}:{}),...(method==='POST'?{
  Origin:new URL(requestUrl).origin,'Content-Type':'application/json'}:{})};
 return new Request(requestUrl,{method,headers,...(method==='POST'?{body:JSON.stringify({token})}:{})});
};
const verification=(action='saber_pedido')=>async(target,options)=>{
 assert.match(target,/turnstile\/v0\/siteverify/);
 assert.equal(options.body.get('secret'),env.DOCS_TURNSTILE_SECRET);
 return Response.json({success:true,hostname:new URL(url).hostname,action});
};
test('acceso de pedidos apagado por defecto, sin cookie ni TUS',async()=>{
 const off={...env,DOCS_PUBLIC_ORDER_GATE_ENABLED:'OFF'};
 const response=await manejarPortalPedidosCliente(request(),off,opts);
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Set-Cookie'),null);
 assert.equal(await autorizadoPedidoCliente(request(),off,opts),false);
});
test('entrada sin credencial usa Turnstile para pedidos, sin contenido ni clave de operador',async()=>{
 const response=await manejarPortalPedidosCliente(request(),env,opts);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/data-action="saber_pedido"/);
 assert.match(html,/Enviá tus PDF/);
 assert.doesNotMatch(html,/ensayo-tus-iniciar|saber_v2_session|DOCS_CENTRAL_ADMIN_KEY/);
 assert.equal(response.headers.get('Set-Cookie'),null);
});
test('la verificación exige origen, token, host y action propio',async()=>{
 const failOrigin=new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({token:'VALID_TOKEN_FROM_BROWSER_12345'})});
 assert.equal((await manejarPortalPedidosCliente(failOrigin,env,{...opts,fetcher:verification()})).status,403);
 assert.equal((await manejarPortalPedidosCliente(request('POST','','x'),env,{...opts,fetcher:verification()})).status,422);
 assert.equal((await manejarPortalPedidosCliente(request('POST'),env,{...opts,fetcher:verification('saber_quote')})).status,403);
 assert.equal((await manejarPortalPedidosCliente(request('POST'),env,{...opts,
  fetcher:async()=>Response.json({success:true,hostname:'otro.ejemplo.com',action:'saber_pedido'})})).status,403);
});
test('sesión comprador firmada HttpOnly permite la misma pantalla TUS, no el portal privado',async()=>{
 const response=await manejarPortalPedidosCliente(request('POST'),env,{...opts,fetcher:verification()});
 assert.equal(response.status,200);
 assert.equal((await response.json()).mode,'pedido-prueba');
 const setCookie=response.headers.get('Set-Cookie');
 assert.match(setCookie,/saber_pedido_client_v1=/);
 assert.match(setCookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.match(setCookie,/Max-Age=3600/);
 assert.doesNotMatch(setCookie,/saber_v2_session|saber_quote_client_v1/);
 const cookie=setCookie.split(';')[0];
 const authenticated=request('GET',cookie);
 assert.equal(await autorizadoPedidoCliente(authenticated,env,opts),true);
 const browser=await manejarPortalPedidosCliente(authenticated,env,opts);
 assert.equal(browser.status,200);
 const html=await browser.text();
 assert.match(html,/id="send-all-pdf"/);
 assert.match(html,/id="cliente-telefono"/);
 assert.match(html,/pagoSandboxEnRecibo/);
 assert.match(html,/prueba-v2\/pedido-cliente/);
 assert.doesNotMatch(html,/DOCS_V2_PRIVATE_UI_SECRET|saber_v2_session/);
 assert.equal(browser.headers.get('Set-Cookie'),null,'No debe emitir cookies de personal');
 assert.equal(await autorizadoPedidoCliente(authenticated,env,{...opts,now:now+3601000}),false);
 assert.equal(await autorizadoPedidoCliente(request('GET',cookie.slice(0,-1)+'0'),env,opts),false);
});
test('una orden sólo admite recuperar, registrar o pagar desde sesión vinculada',async()=>{
 const response=await manejarPortalPedidosCliente(request('POST'),env,{...opts,fetcher:verification()});
 const buyerCookie=response.headers.get('Set-Cookie').split(';')[0];
 const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
 const otherOrder='WEB-ENSAYO-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
 const buyerReq=request('GET',buyerCookie);
 assert.equal(await autorizadoPedidoClienteVinculado(buyerReq,env,orderId,opts),false);
 const linked=await cookiePedidoClienteVinculado(buyerReq,env,orderId,opts);
 assert.match(linked,/saber_pedido_orden_v1=WEB-ENSAYO-/);
 assert.match(linked,/HttpOnly; SameSite=Strict/);
 const all=buyerCookie+'; '+linked.split(';')[0];
 assert.equal(await autorizadoPedidoClienteVinculado(request('GET',all),env,orderId,opts),true);
 assert.equal(await autorizadoPedidoClienteVinculado(request('GET',all),env,otherOrder,opts),false);
 const tampered=all.replace(/.$/,all.endsWith('0')?'1':'0');
 assert.equal(await autorizadoPedidoClienteVinculado(request('GET',tampered),env,orderId,opts),false);
 const anotherSession=buyerCookie.replace(/\.(?:[a-f0-9]{64})$/,'.'+'f'.repeat(64));
 assert.equal(await autorizadoPedidoClienteVinculado(request('GET',anotherSession+'; '+linked.split(';')[0]),env,orderId,opts),false);
});
test('la cookie de presupuesto nunca es sesión de pedidos y ZIP/download sigue limitado a staff',async()=>{
 const quoteUrl=url.replace('pedido-cliente','cotizar-cliente');
 const quoteReq=request('POST','','VALID_TOKEN_FROM_BROWSER_12345',quoteUrl);
 const q=await manejarCotizadorCliente(quoteReq,env,{...opts,
  fetcher:verification('saber_quote')});
 assert.equal(q.status,200);
 const quoteCookie=q.headers.get('Set-Cookie').split(';')[0];
 assert.equal(await autorizadoPedidoCliente(request('GET',quoteCookie),env,opts),false);
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(worker,/V2_BUYER_PUBLIC_ASSETS/);
 assert.doesNotMatch(worker.slice(worker.indexOf('const V2_BUYER_PUBLIC_ASSETS'),worker.indexOf('async function v2PrivateBrowserResponse')),/orden-paquete|personal-descargar|admin-tarifario/);
 assert.match(worker,/page==='\/api\/ensayo-tus-descargar'\?basic/);
 assert.match(worker,/autorizadoPedidoClienteVinculado/);
 assert.match(worker,/if\(page==='\/prueba-v2\/api\/ensayo-tus-canaria-checkout'\)/);
});
