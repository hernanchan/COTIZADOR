import test from 'node:test';
import assert from 'node:assert/strict';
import {puedeRecibirTransferenciaAvisada,BANK_PREUPLOAD_SQL}
 from './central-transferencia-recepcion-anticipada.mjs';

const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const commercialOrderId='123e4567-e89b-42d3-a456-426614174000';
const env=(found,sqls=[])=>({
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DB:{prepare(sql){sqls.push(sql);return {
  bind(...params){
   assert.deepEqual(params,[webOrderId,commercialOrderId,200*1048576]);
   return {first:async()=>found?{id:commercialOrderId}:null};
  }
 }}}
});
test('una transferencia informada puede autorizar RECIBIR, no pago ni impresión',async()=>{
 const sqls=[];
 assert.equal(await puedeRecibirTransferenciaAvisada(env(true,sqls),
  {commercialOrderId,webOrderId}),true);
 assert.equal(sqls.length,1);
 const sql=sqls[0];
 for(const part of ["o.status='awaiting_payment'",
  'o.paid_at IS NULL','o.payment_id IS NULL',
  'o.preference_id IS NULL', "t.state='awaiting_bank_verification'",
  'central_live_transfer_customer_notices',"datetime('now','-72 hours')",
  'central_live_test_exclusions','<=10','<=?'])
  assert.ok(sql.includes(part),'Falta guardia: '+part);
 assert.match(BANK_PREUPLOAD_SQL,/central_r2_universal_files.web_order_id/);
 assert.match(BANK_PREUPLOAD_SQL,/central_live_transfer_customer_notices/);
});
test('sin aviso verificado por D1 o ambiente productivo autorizado no habilita recepción',async()=>{
 assert.equal(await puedeRecibirTransferenciaAvisada(env(false),
  {commercialOrderId,webOrderId}),false);
 const inactive=env(true);inactive.SABER_ENTORNO='prueba';
 assert.equal(await puedeRecibirTransferenciaAvisada(inactive,
  {commercialOrderId,webOrderId}),false);
 assert.equal(await puedeRecibirTransferenciaAvisada(env(true),
  {commercialOrderId,webOrderId:'WEB-OTRO'}),false);
});
