import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const proxy=readFileSync(new URL('../integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs',import.meta.url),'utf8');
const portal=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
const ctx={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal,
 fetch:()=>{throw Error('Blocked in test')}};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const html=vm.runInContext('adminHtml',ctx);
const tracking=vm.runInContext('clientTrackingHtml',ctx);
const adminScript=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
const customerScript=tracking.slice(tracking.indexOf('<script>')+8,tracking.indexOf('</script>'));
const order='b69f8ef5-63eb-4728-a967-584c63f39c41';
const origin='https://saber-pagos-pruebas.libreriasaber.workers.dev';
let reads=0;
const env={DB:{prepare(sql){let args=[];return{
 bind(...values){args=values;return this},
 async run(){if(sql.startsWith('CREATE '))return {meta:{changes:0}};throw Error(sql)},
 async first(){reads++;
  if(sql.includes('p.state AS review_state'))return {id:order,status:'paid',paid_at:'2026-11-04 12:00:00',
   amount_ars:600,deposit_ars:600,number:25,stage:'pendiente',review_state:'verified',
   manifest_json:JSON.stringify({trabajos:[{servicio:'documentos',copias:1,paginasElegidas:[1,2,3]}]})};
  if(sql.includes('FROM central_preparation_estimates WHERE order_id=?'))return null;
  if(sql.includes('FROM central_eta_settings WHERE id=1'))return {base_minutes:60,parallel_orders:3,revision:1};
  if(sql.includes('SELECT COUNT(*) AS ahead'))return {ahead:7};
  throw Error(sql);
 }}}},
 CENTRAL_BRIDGE_KEY:'long-test-only-bridge-key-not-for-production-12345',
 DEMO_ADMIN_KEY:'PANEL_TEST',MP_TEST_ACCESS_TOKEN:'FAKE',
 MP_TEST_SELLER_ID:'test',TEST_WEBHOOK_URL:'https://test.invalid/webhook',
 MP_WEBHOOK_SECRET:'FAKE',CENTRAL_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY'};
const token=async()=>order+'.'+await vm.runInContext('trackingMac',ctx)(env,order);
const request=url=>ctx.worker.fetch(new Request(origin+url),env);
test('panel y seguimiento compilables sin exponer datos',()=>{
 new vm.Script(adminScript);new vm.Script(customerScript);
 assert.match(adminScript,/etaHours/);assert.match(adminScript,/etaCapacity/);
 assert.match(tracking,/id="steps"/);assert.match(portal,/Seguir mi pedido/);
 assert.doesNotMatch(tracking,/MP_TEST_ACCESS_TOKEN|bank_reference|customer_phone/);
});
test('sin token válido no lee la base D1',async()=>{
 reads=0;
 assert.equal((await request('/seguimiento/api/estado')).status,404);
 assert.equal((await request('/seguimiento/api/estado?token='+order+'.'+'0'.repeat(64))).status,404);
 assert.equal(reads,0);
});
test('enlace firmado muestra estado y cola configurable, sin datos privados',async()=>{
 const tok=await token();assert.match(tok,/^[a-f0-9-]{36}\.[a-f0-9]{64}$/);
 const link=await vm.runInContext('trackingUrl',ctx)(env,order,origin+'/internal/central/payment-sandbox-client');
 assert.equal(new URL(link).searchParams.get('token'),tok);
 const res=await request('/seguimiento/api/estado?token='+tok);
 assert.equal(res.status,200);
 const d=await res.json();
 assert.equal(d.orderNumber,'025');assert.equal(d.payment,'pagado');
 assert.equal(d.estimate.minutes,180);assert.equal(d.estimate.parallelOrders,3);
 assert.deepEqual(Object.keys(d).sort(),['ok','orderNumber','payment','stage','phase','estimate'].sort());
});
test('API de ajuste de demora no es accesible sin clave de operador',async()=>{
 assert.equal((await request('/admin/api/central/eta-settings')).status,401);
});
test('el enlace se valida también por el proxy del portal documental',()=>{
 assert.match(proxy,/tracking\.hostname===central\.hostname/);
 assert.match(proxy,/seguimientoUrl/);
 assert.match(portal,/seguimiento\.hidden=false/);
});
