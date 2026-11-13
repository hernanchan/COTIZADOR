/**
 * Auditoría LIVE automática de órdenes de más de 48 horas.
 * No elimina archivos sin bloquear primero la posibilidad de cobrar:
 * orders.status solo admite awaiting_payment / paid. Sin estado terminal,
 * una purga podría destruir un original minutos antes de acreditarse.
 * El flujo regular solo sube tras pago o aviso bancario, y todas las
 * transferencias pendientes quedan protegidas.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
export const CONSULTA_RETENCION_48H=[
 'SELECT',
 "COUNT(DISTINCT CASE WHEN o.status='awaiting_payment' AND o.paid_at IS NULL",
 ' AND o.payment_id IS NULL AND o.preference_id IS NULL',
 ' AND NOT EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id)',
 ' AND NOT EXISTS(SELECT 1 FROM live_checkout_attempts m WHERE m.order_id=o.id)',
 ' AND NOT EXISTS(SELECT 1 FROM central_live_transfer_requests t WHERE t.order_id=o.id)',
 ' AND NOT EXISTS(SELECT 1 FROM central_live_transfer_customer_notices n WHERE n.order_id=o.id)',
 ' AND f.received=1 THEN o.id END) AS impagos_con_archivos_sin_aviso,',
 "COUNT(DISTINCT CASE WHEN o.status='awaiting_payment' AND o.paid_at IS NULL",
 ' AND EXISTS(SELECT 1 FROM central_live_transfer_requests t WHERE t.order_id=o.id)',
 ' THEN o.id END) AS transferencias_protegidas,',
 "COUNT(DISTINCT CASE WHEN o.status='awaiting_payment' AND o.paid_at IS NULL",
 ' AND NOT EXISTS(SELECT 1 FROM central_live_transfer_requests t WHERE t.order_id=o.id)',
 ' AND NOT EXISTS(SELECT 1 FROM central_live_transfer_customer_notices n WHERE n.order_id=o.id)',
 ' AND f.received=0 THEN o.id END) AS abandonados_sin_archivos,',
 "COUNT(DISTINCT CASE WHEN o.status='paid' THEN o.id END) AS pagados_excluidos",
 'FROM orders o',
 'JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id',
 'JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id',
 "WHERE datetime(o.created_at)<datetime('now','-48 hours')"
].join(' ');
export async function revisarRetencion48hLive(env){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.MP_LIVE_GATE!==GO||!env?.DB?.prepare)
  return {enabled:false};
 try{
  const record=await env.DB.prepare(CONSULTA_RETENCION_48H).first();
  if(!record)return {enabled:true,ok:false,reason:'NO_SQL_RESULT'};
  const nums=['impagos_con_archivos_sin_aviso','transferencias_protegidas',
   'abandonados_sin_archivos','pagados_excluidos'];
  if(nums.some(k=>!Number.isSafeInteger(record[k])||record[k]<0))
   return {enabled:true,ok:false,reason:'INVALID_COUNTS'};
  return {enabled:true,ok:true,
   unpaidFilesReview:record.impagos_con_archivos_sin_aviso,
   protectedTransfers:record.transferencias_protegidas,
   abandonedWithoutFiles:record.abandonados_sin_archivos,
   paidExcluded:record.pagados_excluidos,
   remoteDeletes:0};
 }catch{return {enabled:true,ok:false,reason:'D1_UNAVAILABLE'}}
}
