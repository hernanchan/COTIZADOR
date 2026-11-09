import test from 'node:test';
import assert from 'node:assert/strict';
import {resolverReferenciaR2Personal} from '../integraciones/autocotizador/recepcion/r2-referencia-personal.mjs';

const orderId='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const fileId='planoA1',sha256='a'.repeat(64),bytes=62915011;
const uid='12345678-1234-4123-8123-123456789abc';
const objectKey='r2-v1/'+orderId+'/'+uid+'.pdf';
const receiptId='DOC-'+uid;
const now=1800000000;
const payment={orderId,source:'CENTRAL_D1_RECONCILED',
 method:'mercadopago',authority:'MERCADOPAGO_API_RECONCILED',
 paymentState:'PAID_CONFIRMED',providerVerified:true,reversed:false,
 refunded:false,currency:'ARS',amountArs:4400,paymentReference:'MP-187570919433',
 verifiedAt:now};
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const uri=base+'/prueba-v2/api/ensayo-r2-referencia-personal';
function fixture({paid=payment,recordKey=objectKey,objectSize=bytes}={}){
 let payCalls=0,reserveCalls=0,lookupCalls=0,headCalls=0;
 const env={DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY',
  SABER_R2_GRANDES:{head:async()=>{headCalls++;return {size:objectSize,etag:'r2etag-123456789'}}}};
 const request=()=>new Request(uri,{method:'POST',headers:{Origin:base,
  'Content-Type':'application/json'},body:JSON.stringify({
   webOrderId:orderId,fileId,sha256,bytes})});
 const opts={authorized:true,now:()=>now,
  payment:async()=>{payCalls++;return paid},
  reserve:async()=>{reserveCalls++;return {found:true,state:'reserved',orderId,
    fileId,objectKey,sha256,bytes}},
  lookup:async()=>{lookupCalls++;return {
   webOrderId:orderId,receiptId,fileId,objectKey:recordKey,sha256,bytes,
   pagesDeclared:1,name:'planoA1.pdf',status:'awaiting_pdf_analysis',
   etag:'r2etag-123456789'
  }}};
 return {env,request,opts,
  get payCalls(){return payCalls},get reserveCalls(){return reserveCalls},
  get lookupCalls(){return lookupCalls},get headCalls(){return headCalls}};
}
test('Basic + pago conciliado + reserva D1 + recibo D1 + ETag es necesario para resolver',async()=>{
 const x=fixture();
 const res=await resolverReferenciaR2Personal(x.request(),x.env,x.opts);
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.receiptId,receiptId);
 assert.equal(data.paidVerified,true);
 assert.equal(data.declaredPages,1);
 assert.equal(data.status,'PREPRENSA_PENDIENTE');
 assert.equal(data.productionAuthorized,false);
 assert.equal(data.readyForPrinting,false);
 assert.equal(x.payCalls,1);
 assert.equal(x.reserveCalls,1);
 assert.equal(x.lookupCalls,1);
 assert.equal(x.headCalls,1);
 assert.equal(JSON.stringify(data).includes(objectKey),false);
});
test('Sin Basic no consulta ninguna reserva ni devuelve recibo',async()=>{
 const x=fixture();const res=await resolverReferenciaR2Personal(x.request(),x.env,{...x.opts,authorized:false});
 assert.equal(res.status,403);assert.equal(x.payCalls,0);assert.equal(x.headCalls,0);
});
test('Pago revocado o no conciliado impide acceder al recibo',async()=>{
 const x=fixture({paid:{...payment,reversed:true}});
 const res=await resolverReferenciaR2Personal(x.request(),x.env,x.opts);
 assert.equal(res.status,402);assert.equal(x.reserveCalls,0);assert.equal(x.headCalls,0);
});
test('Sin hash/ETag coincidente o registro R2 ajeno no entrega referencia',async()=>{
 const x=fixture({recordKey:'r2-v1/'+orderId+'/22345678-1234-4123-8123-123456789abc.pdf'});
 assert.equal((await resolverReferenciaR2Personal(x.request(),x.env,x.opts)).status,409);
 const y=fixture({objectSize:bytes-1});
 assert.equal((await resolverReferenciaR2Personal(y.request(),y.env,y.opts)).status,409);
});
test('Origin CSRF y flag apagado impiden consultas',async()=>{
 const f=fixture();const req=new Request(uri,{method:'POST',headers:{
  Origin:'https://other.example','Content-Type':'application/json'},
  body:JSON.stringify({webOrderId:orderId,fileId,sha256,bytes})});
 assert.equal((await resolverReferenciaR2Personal(req,f.env,f.opts)).status,403);
 assert.equal(f.payCalls,0);
 const y=fixture();y.env.DOCS_R2_POSTPAY_REQUIRED='OFF';
 assert.equal((await resolverReferenciaR2Personal(y.request(),y.env,y.opts)).status,503);
});
