import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 manejarPortalPedidosCliente,autorizadoPedidoCliente,
 autorizadoPedidoClienteVinculado,cookieRecuperacionR2Comprador,
 autorizadoRecuperacionR2Comprador
} from '../integraciones/autocotizador/recepcion/cotizador-cliente-publico.mjs';

const ORIGIN='https://saber-documentos-pruebas.example.test';
const ORDER='WEB-ENSAYO-'+'A'.repeat(32);
const OTHER='WEB-ENSAYO-'+'B'.repeat(32);
const COMMERCIAL='12345678-1234-4123-8123-123456789abc';
const OTHER_COMMERCIAL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const T0=1794168000000;
const M=60*1000;
const H=60*M;
const env={
 DOCS_PUBLIC_QUOTE_GATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_PUBLIC_ORDER_GATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TURNSTILE_SITE_KEY:'sitekey-abcdefghijklmnopqrstuvwxyz',
 DOCS_TURNSTILE_SECRET:'test-only-turnstile-secret-min-32-chars',
 DOCS_V2_PRIVATE_UI_SECRET:'other-private-secret',
 DOCS_CENTRAL_ADMIN_KEY:'other-admin-secret',
 CENTRAL_BRIDGE_KEY:'other-bridge-secret'
};
function req(cookies=''){
 return new Request(ORIGIN+'/prueba-v2/api/ensayo-r2-prepago-checkout',{
  headers:{Cookie:cookies}
 });
}
function rawCookie(setCookie){return setCookie.split(';',1)[0]}
async function buyerLogin(now){
 const request=new Request(ORIGIN+'/prueba-v2/pedido-cliente',{
  method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},
  body:JSON.stringify({token:'test-only-token-123456'})
 });
 const response=await manejarPortalPedidosCliente(request,env,{
  now,subtle:webcrypto.subtle,
  random:()=>new Uint8Array(16).fill(7),
  fetcher:async()=>Response.json({success:true,
   hostname:new URL(ORIGIN).hostname,action:'saber_pedido'})
 });
 assert.equal(response.status,200);
 return rawCookie(response.headers.get('Set-Cookie'));
}
const opts=now=>({now,subtle:webcrypto.subtle});
async function issued(){
 const buyer=await buyerLogin(T0);
 const recovery=await cookieRecuperacionR2Comprador(req(buyer),env,
  ORDER,COMMERCIAL,opts(T0));
 assert.ok(recovery);
 return {buyer,recovery,cookie:rawCookie(recovery)};
}

test('reutiliza exclusivamente la orden de pago después de 70 minutos y un nuevo Turnstile',async()=>{
 const r=await issued();
 const t=T0+70*M;
 assert.equal(await autorizadoPedidoCliente(req(r.buyer),env,opts(t)),false);
 assert.equal(await autorizadoRecuperacionR2Comprador(req(r.cookie),env,
  ORDER,{...opts(t),commercialOrderId:COMMERCIAL}),false);
 const newBuyer=await buyerLogin(t);
 const current=req(newBuyer+'; '+r.cookie);
 assert.equal(await autorizadoRecuperacionR2Comprador(current,env,
  ORDER,{...opts(t),commercialOrderId:COMMERCIAL}),true);
 assert.equal(await autorizadoPedidoClienteVinculado(current,env,ORDER,opts(t)),false);
});

test('el vínculo no habilita pedidos ni identificadores comerciales ajenos',async()=>{
 const r=await issued(),t=T0+H,newBuyer=await buyerLogin(t);
 const current=req(newBuyer+'; '+r.cookie);
 assert.equal(await autorizadoRecuperacionR2Comprador(current,env,
  OTHER,{...opts(t),commercialOrderId:COMMERCIAL}),false);
 assert.equal(await autorizadoRecuperacionR2Comprador(current,env,
  ORDER,{...opts(t),commercialOrderId:OTHER_COMMERCIAL}),false);
});

test('la cookie de recuperación es HttpOnly, estricta y de alcance limitado',async()=>{
 const r=await issued();
 assert.match(r.recovery,/Path=\/prueba-v2\/api\/ensayo-r2;/);
 assert.match(r.recovery,/Max-Age=86400/);
 assert.match(r.recovery,/Secure; HttpOnly; SameSite=Strict/);
 assert.equal(await cookieRecuperacionR2Comprador(req(''),env,
  ORDER,COMMERCIAL,opts(T0)),null);
 const off={...env,DOCS_R2_PREPAY_DRAFT_ENABLED:'OFF'};
 assert.equal(await cookieRecuperacionR2Comprador(req(r.buyer),off,
  ORDER,COMMERCIAL,opts(T0)),null);
});

test('firma alterada, 24 horas vencidas y autenticación vieja: fail-closed',async()=>{
 const r=await issued(),t=T0+H,newBuyer=await buyerLogin(t);
 const changed=r.cookie.slice(0,-1)+(r.cookie.endsWith('f')?'e':'f');
 assert.equal(await autorizadoRecuperacionR2Comprador(req(newBuyer+'; '+changed),
  env,ORDER,{...opts(t),commercialOrderId:COMMERCIAL}),false);
 const after=T0+25*H,freshBuyer=await buyerLogin(after);
 assert.equal(await autorizadoRecuperacionR2Comprador(req(freshBuyer+'; '+r.cookie),
  env,ORDER,{...opts(after),commercialOrderId:COMMERCIAL}),false);
});
