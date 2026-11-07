import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {consultarPagoR2PreviaCarga}
 from '../integraciones/mercadopago/pruebas/r2-pago-verificado-central.mjs';
import {comprobarPagoR2EnCentral}
 from '../integraciones/autocotizador/recepcion/r2-confirmar-pago-central.mjs';
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const SECRET='secreto-de-puente-correcto-puro-ensayo-1234567890';
const META={fileId:'a1cliente',sha256:'a'.repeat(64),bytes:150*1024*1024};
const TS=1793970000,nonce='12345678-1234-4123-8123-123456789abc';
function fake({missingTable=false,paid=true,review='verified',bank=false,
  bankApproved=true,expectedAmount=15000}={}){
 const sqlCalls=[],queries=[];
 const order={
  web_order_id:ORDER,file_id:META.fileId,sha256:META.sha256,bytes:META.bytes,
  expected_amount:expectedAmount,commercial_order_id:'12345678-1234-4123-8123-223456789abc',
  amount_ars:15000,deposit_ars:15000,status:paid?'paid':'awaiting_payment',
  paid_at:paid?'2026-11-06 13:00:00':null,
  payment_id:bank?null:'12345',preference_id:bank?null:'PREF-4321',
  review_state:review
 };
 const db={prepare(sql){
  sqlCalls.push(sql);
  return {
   first:async()=>sql.includes("sqlite_master")
    ?(sql.includes('central_r2_prepaid_intents')
       ?(missingTable?null:{name:'central_r2_prepaid_intents'})
       :bank?{name:'bank_accreditations'}:null)
    :null,
   bind(...args){
    return {first:async()=>{
     queries.push({sql,args});
     if(sql.includes('FROM central_r2_prepaid_intents')){
      if(args[0]!==ORDER||args[1]!==META.fileId||
         args[2]!==META.sha256||args[3]!==META.bytes||
         !paid||review!=='verified'||expectedAmount!==15000)return null;
      return order;
     }
     if(sql.includes('FROM bank_accreditations'))
      return bankApproved?{amount_ars:15000,bank_reference:'CONFIRMADO_123456'}:null;
     throw Error('unexpected query')
    }};
   }
  };
 }};
 return {db,sqlCalls,queries};
}
function makeBridge(options={}){
 const f=fake(options);
 let requested=0;
 const service={fetch:async request=>{
  requested++;
  const body=await request.clone().text(),ts=request.headers.get('x-saber-ts'),
   rid=request.headers.get('x-saber-request-id'),sig=request.headers.get('x-saber-signature');
  assert.equal(new URL(request.url).pathname,'/internal/central/r2-payment-lookup');
  assert.equal(sig,createHmac('sha256',SECRET).update(ts+'\n'+rid+'\n'+body).digest('hex'));
  return consultarPagoR2PreviaCarga(request,{
   CENTRAL_R2_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',DB:f.db
  },{readSigned:async q=>({payload:await q.json()}),now:()=>TS});
 }};
 const env={
  DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
  SABER_CENTRAL:service
 };
 const call=(meta=META)=>comprobarPagoR2EnCentral({
  env,orderId:ORDER,meta,now:()=>TS,nonce:()=>nonce,
  subtle:webcrypto.subtle
 });
 return {f,env,call,get requests(){return requested}};
}
test('Central: pago MP conciliado con SHA y tamaño EXACTO autoriza solo ese original',async()=>{
 const f=makeBridge(),p=await f.call();
 assert.equal(p.source,'CENTRAL_D1_RECONCILED');
 assert.equal(p.method,'mercadopago');
 assert.equal(p.orderId,ORDER);
 assert.equal(p.fileId,META.fileId);
 assert.equal(p.sha256,META.sha256);
 assert.equal(p.bytes,META.bytes);
 assert.equal(p.amountArs,15000);
 assert.equal(f.requests,1);
 assert.ok(f.f.sqlCalls.some(q=>q.includes("i.state='awaiting_upload_after_payment'")));
 assert.ok(f.f.sqlCalls.some(q=>q.includes("r.state='verified'")));
});
test('sin intento de compra previo o con pago pendiente/revocado, NO autoriza R2',async()=>{
 for(const options of [{missingTable:true},{paid:false},{review:'revoked'},
  {expectedAmount:16000}]){
  const f=makeBridge(options);
  assert.equal(await f.call(),null);
  assert.equal(f.requests,1);
 }
});
test('con otro PDF pagado, un archivo más grande, SHA distinto o ID distinto NO hereda autorización',async()=>{
 const f=makeBridge();
 for(const altered of [
  {...META,fileId:'otro'},
  {...META,sha256:'b'.repeat(64)},
  {...META,bytes:100*1024*1024}
 ])assert.equal(await f.call(altered),null);
 assert.equal(f.requests,3);
});
test('transferencia exige acreditación bancaria real, no comprobante de cliente',async()=>{
 const yes=makeBridge({bank:true}),p=await yes.call();
 assert.equal(p.method,'transferencia');
 assert.equal(p.authority,'BANK_CREDIT_CONFIRMED_BY_STAFF');
 const no=makeBridge({bank:true,bankApproved:false});
 assert.equal(await no.call(),null);
});
test('si faltan flags, la Central o la clave, el bridge no concede acceso',async()=>{
 const f=makeBridge();
 await assert.rejects(comprobarPagoR2EnCentral({env:{
  ...f.env,DOCS_R2_POSTPAY_REQUIRED:'OFF'
 },orderId:ORDER,meta:META}),/NO_CONFIGURADO/);
 assert.equal(f.requests,0);
 const env={...f.env,CENTRAL_TEST_URL:'https://evil.example/internal/central/stage'};
 await assert.rejects(comprobarPagoR2EnCentral({
  env,orderId:ORDER,meta:META
 }),/DESTINO_INVALIDO/);
 assert.equal(f.requests,0);
});
