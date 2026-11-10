import test from 'node:test';
import assert from 'node:assert/strict';
import {stageR2Compatible} from '../integraciones/autocotizador/recepcion/r2-stage-compatible-clasico-universal.mjs';

const claim={orderId:'WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF',
 fileId:'planoA1',sha256:'a'.repeat(64),bytes:60*1048576};
const env={DOCS_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_R2_POSTPAY_REQUIRED:'PRIVATE_TEST_ONLY'};
const args={env,claim,verified:{sha256Verificado:true}};

test('pedido clasico con pago verificado no se registra en cola universal',async()=>{
 let universal=0,lookups=0;
 const r=await stageR2Compatible(args,{
  stageHistorico:async()=>({stagedForCentral:true,receiptId:'DOC-123'}),
  verificarPagoHistorico:async p=>{lookups++;assert.equal(p.orderId,claim.orderId);
   assert.deepEqual(p.meta,{fileId:claim.fileId,sha256:claim.sha256,bytes:claim.bytes});
   return {verified:true};},
  registrarUniversal:async()=>{universal++;throw Error('NO_DEBE_LLAMARSE')}
 });
 assert.equal(r.stagedForCentral,true);assert.equal(lookups,1);assert.equal(universal,0);
});
test('pedido universal sin comprobante clasico exige registro universal confirmado',async()=>{
 let universal=0;
 const r=await stageR2Compatible(args,{
  stageHistorico:async()=>({stagedForCentral:true}),
  verificarPagoHistorico:async()=>null,
  registrarUniversal:async()=>{universal++;return {universal:true,saved:true}}
 });
 assert.equal(r.stagedForCentral,true);assert.equal(universal,1);
});
test('sin staging historico confirmado no se acepta confirmacion',async()=>{
 let lookups=0,universal=0;
 const r=await stageR2Compatible(args,{
  stageHistorico:async()=>({stagedForCentral:false}),
  verificarPagoHistorico:async()=>{lookups++;return {}},
  registrarUniversal:async()=>{universal++}
 });
 assert.equal(r.stagedForCentral,false);assert.equal(lookups,0);assert.equal(universal,0);
});
test('fallo en prueba clasica no omite el registro universal',async()=>{
 await assert.rejects(stageR2Compatible(args,{
  stageHistorico:async()=>({stagedForCentral:true}),
  verificarPagoHistorico:async()=>{throw Error('CENTRAL_NO_RESPONDE')},
  registrarUniversal:async()=>{throw Error('NO_DEBE_LLAMARSE')}
 }),/CENTRAL_NO_RESPONDE/);
});
test('fallo universal no se transforma en recibo confirmado',async()=>{
 await assert.rejects(stageR2Compatible(args,{
  stageHistorico:async()=>({stagedForCentral:true}),
  verificarPagoHistorico:async()=>null,
  registrarUniversal:async()=>{throw Error('UNIVERSAL_PENDIENTE')}
 }),/UNIVERSAL_PENDIENTE/);
});
test('flag universal OFF mantiene staging clasico sin segunda consulta',async()=>{
 const off={...args,env:{...env,DOCS_R2_UNIVERSAL_POSTPAY_ENABLED:'OFF'}};
 const r=await stageR2Compatible(off,{
  stageHistorico:async()=>({stagedForCentral:true}),
  verificarPagoHistorico:async()=>{throw Error('NO_CONSULTAR')},
  registrarUniversal:async()=>{throw Error('NO_REGISTRAR')}
 });
 assert.equal(r.stagedForCentral,true);
});
