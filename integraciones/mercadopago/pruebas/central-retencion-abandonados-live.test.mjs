import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {revisarRetencion48hLive,CONSULTA_RETENCION_48H} from './central-retencion-abandonados-live.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
function fixture(values){
 const sql=[],env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  MP_LIVE_GATE:GO,DB:{prepare(q){sql.push(q);return{
   first:async()=>values
  }}}};
 return {env,sql};
}
test('48h: excluir cobrados y protegidos bancarios del conjunto impago sin aviso',()=>{
 const sql=CONSULTA_RETENCION_48H;
 for(const v of ["datetime(o.created_at)<datetime('now','-48 hours')",
  "o.status='awaiting_payment'","o.paid_at IS NULL",
  'o.payment_id IS NULL','o.preference_id IS NULL',
  'live_checkout_attempts','payment_reviews',
  'central_live_transfer_customer_notices',
  'central_live_transfer_requests','f.received=1'])
  assert.ok(sql.includes(v),'Falta guardia '+v);
 assert.doesNotMatch(sql,/\bDELETE\b|\bUPDATE\b|\bINSERT\b|\bDROP\b/i);
});
test('si no existen originales abandonados no ejecuta ningún borrado',async()=>{
 const f=fixture({impagos_con_archivos_sin_aviso:0,transferencias_protegidas:5,
  abandonados_sin_archivos:1,pagados_excluidos:30});
 const r=await revisarRetencion48hLive(f.env);
 assert.deepEqual(r,{enabled:true,ok:true,unpaidFilesReview:0,
  protectedTransfers:5,abandonedWithoutFiles:1,paidExcluded:30,
  remoteDeletes:0});
 assert.equal(f.sql.length,1);
});
test('si hay archivos impagos dudosos, se advierte, NO se elimina',async()=>{
 const f=fixture({impagos_con_archivos_sin_aviso:2,transferencias_protegidas:1,
  abandonados_sin_archivos:3,pagados_excluidos:1});
 const r=await revisarRetencion48hLive(f.env);
 assert.equal(r.unpaidFilesReview,2);
 assert.equal(r.remoteDeletes,0);
});
test('fuera de producción o D1 no disponible, falla cerrado',async()=>{
 const f=fixture(null);
 assert.equal((await revisarRetencion48hLive(f.env)).ok,false);
 assert.equal((await revisarRetencion48hLive({...f.env,SABER_ENTORNO:'pruebas'})).enabled,false);
 assert.equal((await revisarRetencion48hLive({...f.env,DB:null})).enabled,false);
});
test('cron LIVE reintenta purgas Entregado antes de retornar; Sandbox sigue aislado',()=>{
 const s=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
 const start=s.indexOf(' async scheduled(event,env,ctx)');
 const end=s.indexOf(' async fetch(req,env,ctx)',start);
 const scheduled=s.slice(start,end);
 const firstReturn=scheduled.indexOf("   return;");
 const liveRetry=scheduled.indexOf("SABER_PURGA_ENTREGADOS_REINTENTOS");
 const retention=scheduled.indexOf("SABER_RETENCION_48H_REQUIERE_REVISION");
 assert.ok(liveRetry>0&&liveRetry<firstReturn);
 assert.ok(retention>0&&retention<firstReturn);
 assert.match(scheduled,/CENTRAL_LIVE_PURGE_EXECUTE_GATE/);
 assert.match(scheduled,/reintentarEntregasLive/);
 assert.match(scheduled,/revisarRetencion48hLive/);
});
