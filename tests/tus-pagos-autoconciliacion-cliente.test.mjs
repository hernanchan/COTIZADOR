import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const start=src.indexOf('async function reconcileCustomerPaymentIfDue(env,orderId){');
const end=src.indexOf('async function syncPendingPayments(env){',start);
assert.ok(start>=0&&end>start);
const scope=src.slice(start,end);
const uuid='e2d76c8b-ce1c-4daf-9030-4bd402295a68';
function suite({state='awaiting_payment',preference='pref-id',paymentStatus='approved',shouldFail=false}={}){
 let count=0,marked=false,requests=[],auditEvents=[],current=state;
 const db={prepare(sql){
  let args=[];
  const stmt={bind(...v){args=v;return stmt},async first(){
   assert.match(sql,/SELECT status,preference_id FROM orders WHERE id=\?/);
   assert.equal(args[0],uuid);return {status:current,preference_id:preference};
  },async run(){
   if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
   if(sql.includes('INSERT INTO customer_payment_rechecks')){
    count++;
    return {meta:{changes:count===1?1:0}};
   }
   throw Error('D1 unexpected write: '+sql);
  }};
  return stmt;
 }};
 const provider=async (env,query)=>{
  requests.push(query);
  assert.equal(new URL('https://example.invalid'+query).searchParams.get('external_reference'),uuid);
  if(shouldFail)throw Error('Mercado Pago temporalmente no disponible');
  return {results:[{id:'123456',external_reference:uuid,status:paymentStatus}]};
 };
 const recon=async (env,paymentId)=>{
  assert.equal(paymentId,'123456');
  marked=true;current='paid';
  return {registered:true};
 };
 const audit=async (env,event,detail)=>{auditEvents.push(event)};
 const maker=new Function('mp','reconcilePayment','audit','URLSearchParams','console',scope+'\nreturn reconcileCustomerPaymentIfDue;');
 const fn=maker(provider,recon,audit,URLSearchParams,{warn(){}});
 return {fn,env:{DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',DB:db},get:()=>({count,marked,requests,auditEvents})};
}
test('consulta MP para la misma orden sin botón administrativo y marca pago solo desde conciliación',async()=>{
 const x=suite();assert.equal(await x.fn(x.env,uuid),true);
 assert.equal(x.get().marked,true);
 assert.equal(x.get().requests.length,1);
 assert.deepEqual(x.get().auditEvents,['client_payment_confirmed']);
 assert.equal(await x.fn(x.env,uuid),false);
 assert.equal(x.get().requests.length,1);
});
test('pago no aprobado no se libera',async()=>{
 const x=suite({paymentStatus:'pending'});
 assert.equal(await x.fn(x.env,uuid),false);
 assert.equal(x.get().marked,false);
});
test('sin preferencia, impago no corresponde o flag OFF no consulta a MP',async()=>{
 for(const config of [{preference:null},{state:'paid'},{}]){
  const x=suite(config);const env=config.preference===undefined&&config.state===undefined?{...x.env,DOCS_SANDBOX_CHECKOUT_ENABLED:'OFF'}:x.env;
  assert.equal(await x.fn(env,uuid),false);
  assert.equal(x.get().requests.length,0);
 }
});
test('fallo de red no genera un falso pago, conserva estado pendiente y audita el error',async()=>{
 const x=suite({shouldFail:true});
 assert.equal(await x.fn(x.env,uuid),false);
 assert.equal(x.get().marked,false);
 assert.deepEqual(x.get().auditEvents,['client_payment_recheck_failed']);
});
test('estado mostrado solo tras relectura D1, revisión verified y ruta HMAC',()=>{
 const route=src.slice(src.indexOf('async function centralClientSandboxPayment('),src.indexOf('async function documentSandboxEligibility('));
 assert.match(route,/await reconcileCustomerPaymentIfDue\(env,belongs.id\)/);
 assert.match(route,/const fresh=await env.DB.prepare/);
 assert.match(route,/fresh\?\.status==="paid"&&r\?\.state==="verified"/);
 assert.match(route,/JOIN cart_requests c ON c.order_id=o.id/);
 assert.match(route,/JOIN central_document_manifests m ON m.commercial_order_id=o.id/);
 assert.match(src,/Nuevos · pagos confirmados/);
 assert.match(src,/Transferencias por verificar · Acreditación bancaria manual/);
});
