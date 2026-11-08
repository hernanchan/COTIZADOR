import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarReservaR2Central}
 from '../integraciones/mercadopago/pruebas/r2-reserva-consulta-central.mjs';
const orderId='WEB-ENSAYO-'+'A'.repeat(32);
const fileId='planoA1',sha256='f'.repeat(64),bytes=100*1024*1024;
const objectKey='r2-v1/'+orderId+'/12345678-1234-4123-8123-123456789abc.pdf';
const payload={schema:'saber-central-r2-reservation-lookup-v1',
 webOrderId:orderId,fileId,sha256,bytes};
function fixture(){
 let row={object_key:objectKey,web_order_id:orderId,file_id:fileId,
  sha256,bytes,state:'reserved'},table=true;
 let queries=0;
 const DB={prepare(sql){
  return {bind(...params){
   return {first:async()=>{
    queries++;
    if(sql.includes('sqlite_master'))return table?{name:'central_r2_large_reservations'}:null;
    if(sql.includes('SELECT object_key')){assert.deepEqual(params,[orderId,fileId]);return row}
    throw Error('Consulta inesperada');
   }};
  },first:async()=>{
   queries++;return table?{name:'central_r2_large_reservations'}:null
  }};
 }};
 const env={CENTRAL_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',DB};
 const run=async(pay=payload,authenticated=true)=>consultarReservaR2Central(
  new Request('https://saber-pagos-pruebas.workers.dev/internal/central/r2-reservation-lookup',{
   method:'POST',body:'{}'}),
  env,{readSigned:async()=>authenticated?{payload:pay}:{error:'firma',status:401}}
 );
 return {env,run,setRow:r=>{row=r},setTable:v=>{table=v},get queries(){return queries}};
}
test('reserva exacta se consulta sin mutar D1 ni exponer uploadId',async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.found,true);assert.equal(d.state,'reserved');
 assert.equal(d.objectKey,objectKey);
 assert.equal(d.paymentAuthorized,false);
 assert.equal(d.productionAuthorized,false);
 assert.equal(Object.hasOwn(d,'uploadId'),false);
});
test('sin reserva distingue no iniciado y nunca concede pago',async()=>{
 const f=fixture();f.setRow(null);
 let d=await (await f.run()).json();assert.equal(d.found,false);
 assert.equal(d.state,'not_started');
 f.setTable(false);
 d=await (await f.run()).json();assert.equal(d.found,false);
 assert.equal(d.state,'not_started');
 assert.equal(d.paymentAuthorized,false);
});
test('identidad distinta o reserva liberada no habilitan nueva carga',async()=>{
 const f=fixture();
 for(const changed of [{sha256:'0'.repeat(64)},{bytes:bytes+1},{state:'released'},
  {object_key:'r2-v1/'+('WEB-ENSAYO-'+'B'.repeat(32))+'/12345678-1234-4123-8123-123456789abc.pdf'}]){
  f.setRow({object_key:objectKey,web_order_id:orderId,file_id:fileId,
   sha256,bytes,state:'reserved',...changed});
  assert.equal((await f.run()).status,409);
 }
});
test('sin firma, flag apagado o payload manipulado, nunca se filtra objeto',async()=>{
 const f=fixture();
 assert.equal((await f.run(payload,false)).status,401);
 assert.equal((await f.run({...payload,sha256:'0'})).status,422);
 f.env.CENTRAL_R2_QUOTA_ENABLED='OFF';
 assert.equal((await f.run()).status,503);
});
