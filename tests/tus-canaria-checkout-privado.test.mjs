import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {checkoutCanarioTUSPersonal} from '../integraciones/autocotizador/recepcion/tus-canaria-checkout-privado.mjs';

const CANARY='WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4';
const COMMERCIAL='f5bddab7-6078-4f00-9fba-61f2210b0b20';
const DOCS='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const SECRET='secret_for_testing_central_tus_canary_checkout_only_123456';
const NOW=1800000000,NONCE='123e4567-e89b-42d3-a456-426614174000';
const link='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=TEST-024';
const req=(action='start',order=CANARY,origin=DOCS)=>new Request(DOCS+'/prueba-v2/api/ensayo-tus-canaria-checkout',{
 method:'POST',headers:{'Content-Type':'application/json',Origin:origin},
 body:JSON.stringify({action,webOrderId:order})
});
const env=(service)=>({
 DOCS_TUS_PURGE_CANARY_ORDER:CANARY,
 DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
 CENTRAL_BRIDGE_KEY:SECRET,
 SABER_CENTRAL:{fetch:service}
});
const opt=(authorized=true)=>({authorized,now:()=>NOW,uuid:()=>NONCE,subtle:webcrypto.subtle});
async function validCall(request){
 const payload=await request.text();
 const d=JSON.parse(payload);
 assert.deepEqual(d,{action:'start',schema:'saber-central-tus-canary-checkout-v1',webOrderId:CANARY});
 assert.equal(request.headers.get('Origin'),null);
 assert.equal(request.headers.get('Authorization'),null);
 assert.equal(request.headers.get('x-saber-request-id'),NONCE);
 assert.equal(request.headers.get('x-saber-ts'),String(NOW));
 assert.equal(new URL(request.url).pathname,'/internal/central/canary-checkout');
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const sig=request.headers.get('x-saber-signature');
 assert.equal(sig.length,64);
 const bytes=Uint8Array.from(sig.match(/../g).map(h=>parseInt(h,16)));
 assert.ok(await webcrypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(NOW+'\n'+NONCE+'\n'+payload)));
 return Response.json({ok:true,webOrderId:CANARY,commercialOrderId:COMMERCIAL,amountArs:100,checkoutUrl:link});
}

test('sin operador Basic, jamás llama a Central',async()=>{
 let n=0;
 const response=await checkoutCanarioTUSPersonal(req(),env(async()=>{n++}),opt(false));
 assert.equal(response.status,401);assert.equal(n,0);
});
test('sin coincidencia canaria, no invoca pagos ni permite otro pedido',async()=>{
 let n=0;
 const e=env(async()=>{n++});
 assert.equal((await checkoutCanarioTUSPersonal(req('start','WEB-ENSAYO-'+'A'.repeat(32)),e,opt())).status,503);
 assert.equal((await checkoutCanarioTUSPersonal(req('start',CANARY,'https://sitio-falso.net'),e,opt())).status,403);
 assert.equal((await checkoutCanarioTUSPersonal(req('deliver'),e,opt())).status,422);
 assert.equal((await checkoutCanarioTUSPersonal(req(),{...e,DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'OFF'},opt())).status,503);
 assert.equal(n,0);
});
test('consulta realmente firmada y acceso únicamente a checkout de MP',async()=>{
 const r=await checkoutCanarioTUSPersonal(req(),env(validCall),opt());
 assert.equal(r.status,200);
 const d=await r.json();
 assert.deepEqual(d,{ok:true,webOrderId:CANARY,commercialOrderId:COMMERCIAL,amountArs:100,checkoutUrl:link,mode:'sandbox-only'});
 assert.ok(!JSON.stringify(d).includes(SECRET));
});
test('rechaza checkout remoto hacia terceros',async()=>{
 const r=await checkoutCanarioTUSPersonal(req(),env(async()=>Response.json({
  ok:true,webOrderId:CANARY,commercialOrderId:COMMERCIAL,amountArs:100,checkoutUrl:'https://sitio-falso.net/pago'
 })),opt());
 assert.equal(r.status,503);
});
test('consulta de estado no crea pagos ni devuelve enlace',async()=>{
 const r=await checkoutCanarioTUSPersonal(req('status'),env(async request=>{
  assert.equal((await request.json()).action,'status');
  return Response.json({ok:true,webOrderId:CANARY,commercialOrderId:COMMERCIAL,amountArs:100,estado:'pendiente'});
 }),opt());
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.estado,'pendiente');assert.equal(d.checkoutUrl,undefined);
});
test('la Central reusa exactamente preflight Sandbox y guarda identidad de canaria',()=>{
 const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
 assert.match(src,/async function centralCanarySandboxPrivate/);
 assert.match(src,/env\.CENTRAL_TUS_PURGE_CANARY_ORDER!==p\.webOrderId/);
 assert.match(src,/documentSandboxEligibility\(env,order\.id,true\)/);
 assert.match(src,/\/admin\/api\/central\/payment-sandbox-prepare/);
 assert.match(src,/\/internal\/central\/canary-checkout/);
 assert.doesNotMatch(src,/async function centralCanarySandboxPrivate[\s\S]*?async function centralClientSandboxPayment[\s\S]*?DIRECT_STORAGE_DELETE/);
});
