import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pagoTUSSandboxCliente} from '../integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs';

const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const ids={
 action:'start',
 clientOrderId:'4bc1b7a0-2c88-4b1b-8ca2-17e4ece93c51',
 commercialOrderId:'e2d76c8b-ce1c-4daf-9030-4bd402295a68',
 webOrderId:'WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF'
};
const paymentUrl='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test';
const baseEnv=()=>({
 DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'test-only-key-for-private-bridge-00001',
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
 SABER_CENTRAL:{fetch:async req=>{
  assert.equal(req.url,'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/payment-sandbox-client');
  assert.equal(req.headers.get('x-saber-signature')?.length,64);
  assert.match(req.headers.get('x-saber-ts')||'',/^\d{10}$/);
  const body=await req.json();assert.deepEqual(body,ids);
  return new Response(JSON.stringify({ok:true,commercialOrderId:ids.commercialOrderId,checkoutUrl:paymentUrl}),{status:200});
 }}
});
const request=(data=ids,origin=host)=>new Request(host+'/prueba-v2/api/ensayo-tus-pago-sandbox',{
 method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)
});

test('Nunca prepara checkout con autorización ausente o bandera apagada',async()=>{
 const denied=await pagoTUSSandboxCliente(request(),baseEnv(),{authorized:false});
 assert.equal(denied.status,401);
 const off=await pagoTUSSandboxCliente(request(),{...baseEnv(),DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'OFF'},{authorized:true});
 assert.equal(off.status,503);
});
test('Exige mismo origen y asociación de tres identificadores',async()=>{
 const origin=await pagoTUSSandboxCliente(request(ids,'https://otro-ejemplo.com'),baseEnv(),{authorized:true});
 assert.equal(origin.status,403);
 const bad=await pagoTUSSandboxCliente(request({...ids,commercialOrderId:'14'}),baseEnv(),{authorized:true});
 assert.equal(bad.status,400);
});
test('HMAC inter-Worker y enlace MP permitido sin claves en respuesta',async()=>{
 const response=await pagoTUSSandboxCliente(request(),baseEnv(),{authorized:true});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.deepEqual(result,{ok:true,estado:'pendiente',checkoutUrl:paymentUrl,orderId:ids.commercialOrderId});
 assert.ok(!JSON.stringify(result).includes('test-only-key'));
});
test('Rechaza URL externa y no abre un enlace de pago falsificado',async()=>{
 const env=baseEnv();
 env.SABER_CENTRAL.fetch=async()=>new Response(JSON.stringify({
  ok:true,commercialOrderId:ids.commercialOrderId,
  checkoutUrl:'https://evil.example/robo'}));
 const response=await pagoTUSSandboxCliente(request(),env,{authorized:true});
 assert.equal(response.status,502);
});
test('Estado es exclusivamente conciliación de Central, nunca del navegador',async()=>{
 const env=baseEnv();
 env.SABER_CENTRAL.fetch=async r=>{
  const p=await r.json();assert.equal(p.action,'status');
  return new Response(JSON.stringify({ok:true,commercialOrderId:ids.commercialOrderId,estado:'pagado'}));
 };
 const response=await pagoTUSSandboxCliente(request({...ids,action:'status'}),env,{authorized:true});
 assert.deepEqual((await response.json()).estado,'pagado');
});
test('Centro conserva pago documental cerrado sin flag sandbox y valida pertenencia D1',()=>{
 const s=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
 assert.match(s,/async function centralClientSandboxPayment/);
 assert.match(s,/JOIN cart_requests c ON c.order_id=o.id/);
 assert.match(s,/JOIN central_document_manifests m ON m.commercial_order_id=o.id/);
 assert.match(s,/env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY"/);
 assert.match(s,/documentSandboxEligibility\(env,belongs.id,true\)/);
 assert.match(s,/payment_reviews WHERE order_id/);
});
test('Portal de cliente no incluye token MP/admin y retiene verificación del servidor',()=>{
 const s=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
 assert.match(s,/Pagar con Mercado Pago \(prueba\)/);
 assert.match(s,/data\.estado==='pagado'|result\.estado==='pagado'/);
 assert.doesNotMatch(s,/MP_TEST_ACCESS_TOKEN|DEMO_ADMIN_KEY/);
});
