/**
 * Única autorización D1 de recepción ANTICIPADA de originales por transferencia.
 * No acredita pagos: requiere una orden comercial intacta, transfer request,
 * y aviso explícito "Ya transferí"; nunca aplica a Mercado Pago.
 *
 * 72h desde crear el pedido es el plazo MÁXIMO para comenzar una carga.
 * No equivale a un proceso de purga de objetos: eso se implementa por separado.
 * El límite conservador de 200 MiB y 10 PDFs reduce abuso de almacenamiento.
 */
const MIB=1048576;
export const BANK_PREUPLOAD_SQL=(
 "EXISTS(SELECT 1 FROM central_r2_universal_order_links l "+
 "JOIN orders o ON o.id=l.commercial_order_id "+
 "JOIN central_live_transfer_requests t ON t.order_id=o.id "+
 "JOIN central_live_transfer_customer_notices n ON n.order_id=o.id "+
 "WHERE l.web_order_id=central_r2_universal_files.web_order_id "+
 "AND o.status='awaiting_payment' AND o.paid_at IS NULL "+
 "AND o.payment_id IS NULL AND o.preference_id IS NULL "+
 "AND o.amount_ars>0 AND o.amount_ars=o.deposit_ars "+
 "AND t.state='awaiting_bank_verification' "+
 "AND datetime(o.created_at)>=datetime('now','-72 hours') "+
 "AND NOT EXISTS(SELECT 1 FROM central_live_test_exclusions e WHERE e.order_id=o.id) "+
 "AND (SELECT COUNT(*) FROM central_r2_universal_files f "+
 "WHERE f.web_order_id=l.web_order_id)<=10 "+
 "AND (SELECT COALESCE(SUM(bytes),0) FROM central_r2_universal_files f "+
 "WHERE f.web_order_id=l.web_order_id)<=209715200)"
);
export async function puedeRecibirTransferenciaAvisada(env,{commercialOrderId,webOrderId}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    typeof env?.DB?.prepare!=='function'||typeof commercialOrderId!=='string'||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(webOrderId||''))return false;
 const sql=(
  "SELECT o.id FROM central_r2_universal_order_links l "+
  "JOIN orders o ON o.id=l.commercial_order_id "+
  "JOIN central_live_transfer_requests t ON t.order_id=o.id "+
  "JOIN central_live_transfer_customer_notices n ON n.order_id=o.id "+
  "WHERE l.web_order_id=? AND o.id=? "+
  "AND o.status='awaiting_payment' AND o.paid_at IS NULL "+
  "AND o.payment_id IS NULL AND o.preference_id IS NULL "+
  "AND o.amount_ars>0 AND o.amount_ars=o.deposit_ars "+
  "AND t.state='awaiting_bank_verification' "+
  "AND datetime(o.created_at)>=datetime('now','-72 hours') "+
  "AND NOT EXISTS(SELECT 1 FROM central_live_test_exclusions e WHERE e.order_id=o.id) "+
  "AND (SELECT COUNT(*) FROM central_r2_universal_files f "+
  "WHERE f.web_order_id=l.web_order_id)<=10 "+
  "AND (SELECT COALESCE(SUM(bytes),0) FROM central_r2_universal_files f "+
  "WHERE f.web_order_id=l.web_order_id)<=?"
 );
 const row=await env.DB.prepare(sql).bind(webOrderId,commercialOrderId,200*MIB).first();
 return row?.id===commercialOrderId;
}
