import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {registrarIntencionR2Prepaga}
 from '../integraciones/mercadopago/pruebas/r2-prepago-intencion-central.mjs';
import {checkoutR2PrepaidSandboxCentral}
 from '../integraciones/mercadopago/pruebas/r2-prepago-checkout-sandbox-central.mjs';
import {consultarPagoR2PreviaCarga}
 from '../integraciones/mercadopago/pruebas/r2-pago-verificado-central.mjs';
import {manejarR2GrandePrivado}
 from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-api-privada.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const FILE='A1GRANDE',SHA='a'.repeat(64),BYTES=150*1024*1024;
const UUID='12345678-1234-4123-8123-123456789abc';
const OBJ='12345678-1234-4123-8123-223456789abc';
const NOW=1794070000;
const ORIGIN='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const SECRET='r2-payment-secret-32-characters-for-fixtures-only';
const payload={schema:'saber-central-r2-prepaid-intent-v1',webOrderId:WEB,
 fileId:FILE,sha256:SHA,bytes:BYTES,declaredPages:1,
 quoteSha256:'b'.repeat(64),quoteRevision:'d1-approved-revision-3',
 amountArs:15000};
const meta={fileId:FILE,name:'Panel A1.pdf',mode:'bn',
 bytes:BYTES,sha256:SHA,pages:1};
function store(){
 const orders=[],intents=[],lines=[],stats={requestsR2:0,objectsR2:0,reservations:0,checkouts:0};
 let review='pending';
 const DB={prepare(sql){
  const o={bind(...args){this.args=args;return this;},
   async run(){return {meta:{changes:1}}},
   async first(){
    const args=this.args||[];
    if(sql.includes('SELECT i.web_order_id,i.file_id')){
     const i=intents.find(x=>x.web_order_id===args[0]&&x.file_id===args[1]);
     return i?{...i,order_status:orders.find(x=>x.id===i.commercial_order_id)?.status}:null;
    }
    if(sql.includes('FROM central_r2_prepaid_intents i JOIN orders o')&&
       sql.includes('JOIN order_items line')){
     const i=intents.find(x=>x.web_order_id===args[1]&&x.commercial_order_id===args[2]);
     const order=orders.find(x=>x.id===i?.commercial_order_id);
     return i&&order&&lines.some(x=>x.order_id===order.id&&x.sku===args[0])?
      {web_order_id:i.web_order_id,amount_ars:i.amount_ars,state:i.state,
       id:order.id,order_total:order.amount_ars,deposit_ars:order.deposit_ars,
       status:order.status,paid_at:order.paid_at,payment_id:order.payment_id,
       preference_id:order.preference_id,
       order_created_at:'2026-11-07 16:18:00'}:null;
    }
    if(sql.includes("sqlite_master"))return sql.includes('central_r2_prepaid_intents')?
      {name:'central_r2_prepaid_intents'}:null;
    if(sql.includes('FROM central_r2_prepaid_intents i')&&
       sql.includes('JOIN payment_reviews r')){
      const i=intents.find(x=>x.web_order_id===args[0]&&x.file_id===args[1]&&
       x.sha256===args[2]&&x.bytes===args[3]);
      const order=orders.find(x=>x.id===i?.commercial_order_id);
      if(!i||!order||order.status!=='paid'||review!=='verified')return null;
      return {commercial_order_id:order.id,amount_ars:order.amount_ars,
       expected_amount:i.amount_ars,deposit_ars:order.deposit_ars,
       payment_id:order.payment_id,preference_id:order.preference_id};
    }
    throw Error('Mock D1: query no admitida: '+sql);
   }};
  return o;
 },async batch(batch){
  assert.equal(batch.length,3);
  const [a,b,c]=batch;
  const order={id:a.args[0],amount_ars:a.args[2],deposit_ars:a.args[3],
   status:'awaiting_payment',paid_at:null,payment_id:null,preference_id:null};
  orders.push(order);
  intents.push({web_order_id:b.args[0],file_id:b.args[1],sha256:b.args[2],
   bytes:b.args[3],amount_ars:b.args[4],declared_pages:b.args[5],
   quote_sha256:b.args[6],quote_revision:b.args[7],
   commercial_order_id:order.id,state:'awaiting_upload_after_payment'});
  lines.push({order_id:c.args[0],sku:'R2_PREPAID_PLOT'});
  return [];
 }};
 const central={
  CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_PREPAY_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',DB,
  DEMO_ADMIN_KEY:'test-only-password-12345678901234567890'
 };
 const bucket={createMultipartUpload:async()=>{stats.objectsR2++;
  return {uploadId:'upload-343-characters-simulados'}} ,
  resumeMultipartUpload:()=>({})};
 const docs={DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY',
  DOCS_R2_RECEIPT_KEY:SECRET,SABER_R2_GRANDES:bucket};
 const signed=async req=>({payload:await req.json()});
 const req=(url,data)=>new Request(url,{
  method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN},
  body:JSON.stringify(data)});
 const route=ORIGIN+'/prueba-v2/api/ensayo-r2/iniciar';
 const pay=async()=>{
  const response=await consultarPagoR2PreviaCarga(
   new Request('https://central.example/internal/central/r2-payment-lookup',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     schema:'saber-central-r2-payment-lookup-v1',orderId:WEB,
     fileId:FILE,bytes:BYTES,sha256:SHA
    })}),central,{readSigned:signed,now:()=>NOW});
  if(!response.ok)return null;
  const data=await response.json();
  return data.receipt;
 };
 const begin=()=>manejarR2GrandePrivado(req(route,{orderId:WEB,meta}),docs,{
  autorizadoIniciar:async()=>true,comprobarPagoCentral:pay,
  reserve:async()=>{stats.reservations++;
   return {reserved:true,objectUUID:OBJ,orderId:WEB,
    bytes:BYTES,paymentAuthorized:false}},
  uuid:()=>OBJ,now:()=>NOW,subtle:webcrypto.subtle
 });
 return {orders,intents,lines,central,docs,stats,signed,req,pay,begin,
  approve(){
   const order=orders[0];assert.ok(order);
   order.status='paid';order.paid_at='2026-11-07 16:20:00';
   order.payment_id='12345';order.preference_id='PRE-12345';review='verified';
  }
 };
}
test('A1 150 MiB: abandono sin pagar deja CERO R2; pagar habilita UNA carga',async()=>{
 const f=store();
 const created=await registrarIntencionR2Prepaga(new Request('https://central.example',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
 }),f.central,{readSigned:f.signed,uuid:()=>UUID});
 assert.equal(created.status,201,await created.text());
 assert.equal(f.orders.length,1);
 assert.equal(f.stats.objectsR2,0);
 // Consultar precio, preparar pedido y abandonar: no iniciar siquiera multipart.
 let pending=await f.begin();
 assert.equal(pending.status,402);
 assert.equal(f.stats.reservations,0);
 assert.equal(f.stats.objectsR2,0);
 const fakeRedirect=await f.begin();
 assert.equal(fakeRedirect.status,402);
 assert.equal(f.stats.objectsR2,0);
 // Pago confirmado por Central en sandbox sintético, no MP real.
 f.approve();
 assert.equal((await f.pay())?.method,'mercadopago');
 const admitted=await f.begin();
 assert.equal(admitted.status,200,await admitted.text());
 assert.equal(f.stats.reservations,1);
 assert.equal(f.stats.objectsR2,1);
 assert.equal(f.intents[0].state,'awaiting_upload_after_payment');
 console.log('R2_CERO_OBJETOS_SIN_PAGO_LUEGO_AUTORIZA_PRIMER_MULTIPART');
});
