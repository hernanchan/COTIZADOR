import test from 'node:test';
import assert from 'node:assert/strict';
import {manejarTransferenciaLiveCentral,aprobarTransferenciaLiveCentral,
 listarTransferenciasLiveCentral} from './transferencias-live-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const id='123e4567-e89b-42d3-a456-426614174000';
const web='WEB-ENSAYO-'+'A'.repeat(32);
const amount=2500;
const base={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',MP_LIVE_GATE:GO,
 CENTRAL_LIVE_BRIDGE_ENABLED:GO,CENTRAL_LIVE_ORDER_GATE:GO,
 CENTRAL_LIVE_POSTPAY_GATE:GO,CENTRAL_LIVE_TUS_GATE:GO,
 CENTRAL_LIVE_TRANSFER_GATE:GO,CENTRAL_LIVE_TRANSFER_APPROVAL_GATE:GO,
 CENTRAL_LIVE_TRANSFER_ALIAS:'SABER.CORDOBA'
};
const request=(path='transfer-start',payload={})=>new Request(
 'https://pagos.libreriasaber.com.ar/'+(path.startsWith('admin/')?path:'internal/central/live/'+path),
 {method:'POST',headers:{'Content-Type':'application/json',
  Origin:path.startsWith('admin/')?'https://pagos.libreriasaber.com.ar':undefined},
  body:JSON.stringify(payload)});
const order={ok:true,amountArs:amount,commercialOrderId:id,
 link:{id,status:'awaiting_payment',created_at:'2026-11-11 10:00:00',
  amount_ars:amount,deposit_ars:amount,payment_id:null,preference_id:null},
 rows:[{transport:'tus',bytes:100000}]};
const readSigned=async()=>({payload:{schema:'saber-central-live-transfer-start-v1',
 webOrderId:web,commercialOrderId:id}});
const verifyOrder=async()=>order;
function mockDb({withMpAttempt=false,state='awaiting_payment',paid=false,priorBank=false}={}){
 const sql=[];let noticeExists=false;
 const db={
  prepare(q){
   sql.push(q);
   return {
    bind(){return this},
    async run(){if(q.includes('INSERT OR IGNORE INTO central_live_transfer_customer_notices'))noticeExists=true;return {meta:{changes:1}}},
    async first(){
     if(q.includes("name='live_checkout_attempts'"))return withMpAttempt?{name:'live_checkout_attempts'}:null;
     if(q.includes('SELECT reported_at FROM central_live_transfer_customer_notices'))return noticeExists?{reported_at:'2026-11-11 10:07:00'}:null;
     if(q.includes('FROM live_checkout_attempts WHERE'))return withMpAttempt?{order_id:id}:null;
     if(q.includes('FROM central_live_transfer_requests t JOIN orders o'))
      return {amount_ars:amount,state:'awaiting_bank_verification',
       status:state,payment_id:null,preference_id:null};
     if(q.includes('FROM central_live_bank_accreditations WHERE'))return priorBank?{order_id:id}:null;
     if(q.includes('FROM payment_reviews WHERE'))return null;
     if(q.includes('FROM orders o LEFT JOIN payment_reviews'))
      return {status:state,paid_at:paid?'2026-11-11 10:05:00':null,
       amount_ars:amount,deposit_ars:amount,payment_id:null,preference_id:null,
       review_state:paid?'verified':null,bank_amount:paid?amount:null};
     if(q.includes('FROM orders o JOIN central_r2_universal_order_links'))
      return {web_order_id:web,id,status:state,amount_ars:amount,
       deposit_ars:amount,transfer_amount:amount,payment_id:null,preference_id:null};
     return null;
    },
    async all(){return {results:[]}}
   };
  },
  async batch(queries){sql.push('BATCH');return queries.map(()=>({meta:{changes:1}}))}
 };
 return {db,sql};
}
const signedPayload=(kind)=>async()=>({payload:{
 schema:'saber-central-live-transfer-'+kind+'-v1',webOrderId:web,commercialOrderId:id}});
test('SIN compuerta LIVE no escribe D1 ni acredita pagos',async()=>{
 const f=mockDb();
 const res=await manejarTransferenciaLiveCentral(request(),{...base,
  CENTRAL_LIVE_TRANSFER_GATE:'NO_GO',DB:f.db},{readSigned,verifyOrder});
 assert.equal(res.status,503);
 assert.equal(f.sql.length,0);
 const approve=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',{
  order_id:id,amount_ars:amount,confirmed:true,operator:'Ana Pérez',bank_reference:'BANK-123456'}),
  {...base,CENTRAL_LIVE_TRANSFER_APPROVAL_GATE:'NO_GO',DB:f.db},
  {authorized:true,verifyOrder});
 assert.equal(approve.status,503);
 assert.equal(f.sql.length,0);
});
test('solicitar transferencia no marca pagado ni habilita originales',async()=>{
 const f=mockDb();
 const res=await manejarTransferenciaLiveCentral(request(),{...base,DB:f.db},
  {readSigned,verifyOrder,now:()=>Date.parse('2026-11-11T10:05:00Z')});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.estado,'transferencia_pendiente');
 assert.equal(data.paymentVerified,false);
 assert.equal(data.uploadAuthorized,false);
 assert.equal(data.productionAuthorized,false);
 assert.equal(data.alias,'SABER.CORDOBA');
 assert.ok(f.sql.some(q=>q.includes('INSERT OR IGNORE INTO central_live_transfer_requests')));
 assert.ok(!f.sql.some(q=>q.includes("UPDATE orders SET status='paid'")));
});
test('con inicio MP previo la solicitud bancaria no se registra',async()=>{
 const f=mockDb({withMpAttempt:true});
 const res=await manejarTransferenciaLiveCentral(request(),{...base,DB:f.db},
  {readSigned,verifyOrder,now:()=>Date.parse('2026-11-11T10:05:00Z')});
 assert.equal(res.status,409);
 assert.ok(!f.sql.some(q=>q.includes('INSERT OR IGNORE INTO central_live_transfer_requests')));
});
test('no ofrecer transferencia a R2 >40 MiB aún cerrado',async()=>{
 const f=mockDb();
 const res=await manejarTransferenciaLiveCentral(request(),{...base,DB:f.db},
  {readSigned,verifyOrder:async()=>({...order,rows:[{transport:'r2',bytes:60*1048576}]})});
 assert.equal(res.status,409);
 assert.equal(f.sql.length,0);
});
test('R2 de producción no genera transferencia sin compuertas de cuota y staging',async()=>{
 const large={...order,rows:[{transport:'r2',bytes:60*1048576}]};
 for(const missing of ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
  'CENTRAL_LIVE_R2_STAGING_GATE']){
  const f=mockDb();
  const gates={...base,CENTRAL_LIVE_R2_GATE:GO,
   CENTRAL_LIVE_R2_QUOTA_GATE:GO,CENTRAL_LIVE_R2_STAGING_GATE:GO,[missing]:'NO_GO'};
  const res=await manejarTransferenciaLiveCentral(request(),{...gates,DB:f.db},
   {readSigned,verifyOrder:async()=>large,now:()=>Date.parse('2026-11-11T10:05:00Z')});
  assert.equal(res.status,409);
  assert.equal(f.sql.length,0);
 }
});
test('R2 con todos los gates GO puede solicitar transferencia sin acreditar ni subir',async()=>{
 const f=mockDb();
 const gates={...base,CENTRAL_LIVE_R2_GATE:GO,
  CENTRAL_LIVE_R2_QUOTA_GATE:GO,CENTRAL_LIVE_R2_STAGING_GATE:GO};
 const large={...order,rows:[{transport:'r2',bytes:60*1048576}]};
 const res=await manejarTransferenciaLiveCentral(request(),{...gates,DB:f.db},
  {readSigned,verifyOrder:async()=>large,
   now:()=>Date.parse('2026-11-11T10:05:00Z')});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.estado,'transferencia_pendiente');
 assert.equal(body.paymentVerified,false);
 assert.equal(body.uploadAuthorized,false);
 const receipt=mockDb();
 const approval=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',{
  order_id:id,amount_ars:amount,confirmed:true,
  operator:'Ana Pérez',bank_reference:'BANK-R2-123456'}),
  {...gates,DB:receipt.db},{authorized:true,verifyOrder:async()=>large});
 assert.equal(approval.status,200);
 assert.equal((await approval.json()).paymentVerified,true);
});
test('un R2 mayor al límite comercial no se cobra aunque los gates estén abiertos',async()=>{
 const f=mockDb();
 const gates={...base,CENTRAL_LIVE_R2_GATE:GO,
  CENTRAL_LIVE_R2_QUOTA_GATE:GO,CENTRAL_LIVE_R2_STAGING_GATE:GO};
 const tooLarge={...order,rows:[{transport:'r2',bytes:220*1048576}]};
 const res=await manejarTransferenciaLiveCentral(request(),{...gates,DB:f.db},
  {readSigned,verifyOrder:async()=>tooLarge});
 assert.equal(res.status,409);assert.equal(f.sql.length,0);
});
test('solo un asiento D1 auditado permite informar pagado al comprador',async()=>{
 const f=mockDb({state:'paid',paid:true});
 const res=await manejarTransferenciaLiveCentral(request('transfer-status'),{...base,DB:f.db},
  {readSigned:signedPayload('status'),verifyOrder});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.estado,'pagado_esperando_archivos');
 assert.equal(data.paymentVerified,true);
 assert.equal(data.uploadAuthorized,true);
 assert.equal(data.productionAuthorized,false);
 const unverified=mockDb({state:'awaiting_payment',paid:false});
 const pending=await manejarTransferenciaLiveCentral(request('transfer-status'),
  {...base,DB:unverified.db},{readSigned:signedPayload('status'),verifyOrder});
 assert.equal((await pending.json()).estado,'transferencia_pendiente');
});
test('no se acredita sin una confirmación humana estricta y referencia bancaria',async()=>{
 const f=mockDb();
 for(const payload of [
  {order_id:id,amount_ars:amount,confirmed:false,operator:'Ana',bank_reference:'BANK-123456'},
  {order_id:id,amount_ars:amount,confirmed:true,operator:'A',bank_reference:'BANK-123456'},
  {order_id:id,amount_ars:amount,confirmed:true,operator:'Ana',bank_reference:'ticket.pdf'}
 ]){
  const r=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',payload),
   {...base,DB:f.db},{authorized:true,verifyOrder});
  assert.equal(r.status,422);
 }
 assert.equal(f.sql.length,0);
});
test('acreditación real exige operador y realiza 3 escrituras D1 atómicas',async()=>{
 const f=mockDb();
 const payload={order_id:id,amount_ars:amount,confirmed:true,operator:'Ana Pérez',
  bank_reference:'BANK-123456'};
 const r=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',payload),
  {...base,DB:f.db},{authorized:true,verifyOrder});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.paymentVerified,true);
 assert.equal(data.productionAuthorized,false);
 assert.ok(f.sql.some(q=>q.includes('INSERT INTO central_live_bank_accreditations')));
 assert.ok(f.sql.some(q=>q.includes("UPDATE orders SET status='paid'")));
 assert.ok(f.sql.some(q=>q.includes('INSERT INTO payment_reviews')));
 assert.ok(f.sql.includes('BATCH'));
});
test('sin sesión administrativa, no exponer transferencias reales',async()=>{
 const f=mockDb();
 const req=new Request('https://pagos.libreriasaber.com.ar/admin/api/central/live-transfers/pending');
 const res=await listarTransferenciasLiveCentral(req,{...base,DB:f.db},{authorized:false});
 assert.equal(res.status,401);
 assert.equal(f.sql.length,0);
});

test('Ya transferí registra aviso único SIN acreditar dinero ni autorizar el envío',async()=>{
 const f=mockDb();
 for(let i=0;i<2;i++){
  const res=await manejarTransferenciaLiveCentral(request('transfer-notify'),{...base,DB:f.db},
   {readSigned:signedPayload('notify'),verifyOrder});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.estado,'transferencia_informada');
  assert.equal(data.customerNotified,true);
  assert.equal(data.paymentVerified,false);
  assert.equal(data.uploadAuthorized,false);
  assert.equal(data.productionAuthorized,false);
 }
 assert.ok(f.sql.some(x=>x.includes('INSERT OR IGNORE INTO central_live_transfer_customer_notices')));
 assert.ok(!f.sql.some(x=>x.includes("UPDATE orders SET status='paid'")));
 assert.ok(!f.sql.some(x=>x.includes('INSERT INTO payment_reviews')));
 assert.ok(!f.sql.some(x=>x.includes('INSERT INTO central_live_bank_accreditations')));
 const status=await manejarTransferenciaLiveCentral(request('transfer-status'),{...base,DB:f.db},
  {readSigned:signedPayload('status'),verifyOrder});
 assert.equal((await status.json()).estado,'transferencia_informada');
});
test('un notify sin firma HMAC nunca llega a D1',async()=>{
 const f=mockDb();
 const res=await manejarTransferenciaLiveCentral(request('transfer-notify'),{...base,DB:f.db},
  {readSigned:async()=>({error:'firma incorrecta',status:401}),verifyOrder});
 assert.equal(res.status,401);
 assert.equal(f.sql.length,0);
});

test('una referencia usada en otro movimiento es conflicto específico, sin modificar D1',async()=>{
 const f=mockDb();
 const original=f.db.prepare;
 let batches=0;
 f.db.prepare=sql=>{
  if(sql.startsWith("SELECT order_id FROM central_live_bank_accreditations ")&&
     sql.includes("REPLACE(bank_reference,' ','-')")){
   return {bind(){return this},first:async()=>({order_id:'123e4567-e89b-42d3-a456-426614174999'})};
  }
  return original(sql);
 };
 f.db.batch=async()=>{batches++;throw Error('BATCH_NO_DEBE_EJECUTARSE')};
 const r=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',{
  order_id:id,amount_ars:amount,confirmed:true,operator:'Ana Pérez',
  bank_reference:'BANK-EXISTENTE-011'
 }),{...base,DB:f.db},{authorized:true,verifyOrder});
 assert.equal(r.status,409);
 assert.equal((await r.json()).error,'TRANSFER_LIVE_REFERENCIA_YA_UTILIZADA');
 assert.equal(batches,0);
});
test('error SQL genérico no se confunde con referencia repetida ni acredita pedido',async()=>{
 const f=mockDb();
 let batches=0;
 f.db.batch=async()=>{batches++;throw Error('database temporarily unavailable')};
 const oldError=console.error;
 const errors=[];console.error=(...args)=>errors.push(args);
 try{
  const r=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',{
   order_id:id,amount_ars:amount,confirmed:true,operator:'Ana Pérez',
   bank_reference:'BANK-NUEVA-013'
  }),{...base,DB:f.db},{authorized:true,verifyOrder});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'TRANSFER_LIVE_ACREDITACION_NO_COMPLETADA');
  assert.equal(batches,1);
  assert.equal(errors.length,1);
  assert.doesNotMatch(JSON.stringify(errors),/BANK-NUEVA-013/);
 }finally{console.error=oldError}
});

test('acreditar sin referencia manual crea identificador INTERNO exclusivo, conserva comprobación humana',async()=>{
 const f=mockDb();
 let storedReference=null;
 const prepare=f.db.prepare.bind(f.db);
 f.db.prepare=sql=>{
  const statement=prepare(sql);
  if(sql.startsWith('INSERT INTO central_live_bank_accreditations')){
   const bind=statement.bind;
   statement.bind=function(...args){
    storedReference=args[1];
    return bind.apply(this,args);
   };
  }
  return statement;
 };
 const result=await aprobarTransferenciaLiveCentral(request('admin/api/central/live-transfers/approve',{
  order_id:id,amount_ars:amount,confirmed:true,operator:'Ana Pérez'
 }),{...base,DB:f.db},{authorized:true,verifyOrder});
 assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 assert.equal((await result.json()).paymentVerified,true);
 assert.ok(f.sql.some(q=>q.includes('INSERT INTO central_live_bank_accreditations')));
 assert.equal(f.sql.includes('BATCH'),true);
 assert.equal(storedReference,'SABER-INT-'+id.toUpperCase());
});
