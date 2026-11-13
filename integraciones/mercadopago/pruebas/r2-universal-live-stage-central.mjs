/** Recepción definitiva de bytes R2 con SHA verificado por Worker documental.
 * Exige pago D1 y reserva existente. Habilita la descarga del ZIP de originales,
 * NUNCA autoriza impresión: la preprensa sigue siendo responsabilidad del operador.
 */
import {validarPreRecepcionR2} from './r2-grandes-central-pendientes.mjs';
import {r2GateGeneralOCanary} from './r2-live-canary-order.mjs';
import {verificarPedidoUniversalCobrable,estadoPagoUniversal}
 from './r2-universal-checkout-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const respond=(v,status=200)=>Response.json(v,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function registrarR2LivePendiente(request,env,{
 readSigned,subtle=crypto.subtle,
 verify=verificarPedidoUniversalCobrable,payment=estadoPagoUniversal
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
   env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
   env?.CENTRAL_LIVE_POSTPAY_GATE!==GO||
   (env?.CENTRAL_LIVE_R2_GATE!==GO||env?.CENTRAL_LIVE_R2_STAGING_GATE!==GO)&&
   env?.CENTRAL_R2_CANARY_MODE!=='SOLO_PEDIDO_R2_CONTROLADO'||
   env?.CENTRAL_LIVE_ORDER_GATE!==GO||
   typeof env?.DB?.prepare!=='function'||typeof env?.DB?.batch!=='function')
  return respond({ok:false,error:'LIVE_R2_STAGE_OFF'},503);
 if(typeof readSigned!=='function')
  return respond({ok:false,error:'LIVE_R2_STAGE_HMAC_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'LIVE_R2_STAGE_HMAC'},signed.status||401);
 let p;try{p=validarPreRecepcionR2(signed.payload)}catch{
  return respond({ok:false,error:'LIVE_R2_STAGE_MANIFIESTO'},422);
 }
 if(p.bytes>200*MIB||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.orderId))
  return respond({ok:false,error:'LIVE_R2_STAGE_TAMANO'},422);
 if(!r2GateGeneralOCanary(env,p.orderId,
   ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_STAGING_GATE']))
  return respond({ok:false,error:'LIVE_R2_STAGE_PEDIDO_NO_HABILITADO'},503);
 const db=env.DB;
 let valid,paid;
 try{
  const link=await db.prepare(
   'SELECT commercial_order_id FROM central_r2_universal_order_links WHERE web_order_id=?'
  ).bind(p.orderId).first();
  if(!link)return respond({ok:false,error:'LIVE_R2_STAGE_ORDEN_AJENA'},404);
  valid=await verify(env,link.commercial_order_id,{
   webOrderId:p.orderId,subtle});
  if(!valid.ok)return respond({ok:false,error:'LIVE_R2_STAGE_FICHA_D1'},409);
  const work=valid.works.find(x=>x.fileId===p.fileId);
  const row=valid.rows.find(x=>x.file_id===p.fileId);
  if(!row||!work||row.transport!=='r2'||![0,1].includes(row.received)||
    row.name!==p.name||row.sha256!==p.sha256||row.bytes!==p.bytes||
    !Array.isArray(work.configuracion?.paginas)||
    work.configuracion.paginas.length!==p.pagesDeclaradas)
   return respond({ok:false,error:'LIVE_R2_STAGE_ORIGINAL_AJENO'},409);
  paid=await payment(env,link.commercial_order_id);
  if(!paid.verified||paid.revoked)
   return respond({ok:false,error:'LIVE_R2_STAGE_PAGO_NO_CONCILIADO'},402);
  const reserve=await db.prepare(
   'SELECT web_order_id,file_id,sha256,bytes,state FROM central_r2_large_reservations '+
   'WHERE object_key=?'
  ).bind(p.objectKey).first();
  if(!reserve||reserve.web_order_id!==p.orderId||
   reserve.file_id!==p.fileId||reserve.sha256!==p.sha256||
   reserve.bytes!==p.bytes||reserve.state!=='reserved')
   return respond({ok:false,error:'LIVE_R2_STAGE_SIN_RESERVA'},409);
  const old=await db.prepare(
   'SELECT web_order_id,file_id,object_key,name,bytes,sha256,etag,pages_claimed,status '+
   'FROM central_r2_large_pending WHERE receipt_id=? OR (web_order_id=? AND file_id=?)'
  ).bind(p.receiptId,p.orderId,p.fileId).first();
  if(old){
   const same=old.web_order_id===p.orderId&&old.file_id===p.fileId&&
    old.object_key===p.objectKey&&old.name===p.name&&old.bytes===p.bytes&&
    old.sha256===p.sha256&&old.etag===p.etag&&
    old.pages_claimed===p.pagesDeclaradas&&old.status==='awaiting_pdf_analysis';
   if(!same)return respond({ok:false,error:'LIVE_R2_STAGE_CONFLICTO'},409);
   // Si la subida anterior quedó staged por una versión vieja, completar
   // su recepción con la misma prueba SHA verificada, sin repetir la carga.
   if(row.received===0){
    const marked=await db.prepare(
     "UPDATE central_r2_universal_files SET received=1 WHERE web_order_id=? "+
     "AND file_id=? AND transport='r2' AND received=0 AND sha256=? AND bytes=? "+
     "AND EXISTS(SELECT 1 FROM central_r2_large_pending s "+
     "JOIN central_r2_large_reservations q ON q.object_key=s.object_key "+
     "WHERE s.web_order_id=? AND s.file_id=? AND s.receipt_id=? "+
     "AND s.object_key=? AND s.sha256=? AND s.etag=? AND s.bytes=? "+
     "AND s.status='awaiting_pdf_analysis' AND q.state='reserved' "+
     "AND q.web_order_id=s.web_order_id AND q.file_id=s.file_id "+
     "AND q.sha256=s.sha256 AND q.bytes=s.bytes)")
     .bind(p.orderId,p.fileId,p.sha256,p.bytes,
      p.orderId,p.fileId,p.receiptId,p.objectKey,p.sha256,p.etag,p.bytes).run();
    if(marked?.meta?.changes!==1)
     return respond({ok:false,error:'LIVE_R2_STAGE_RECIBO_NO_CONFIRMADO'},409);
   }
   return respond({ok:true,saved:true,idempotent:true,
    webOrderId:p.orderId,fileId:p.fileId,status:'awaiting_pdf_analysis',
    originalReceived:true,stagedForCentral:true,
    registeredInD1:false,productionAuthorized:false});
  }
  // D1 ya concilió el cobro. Persistencia atómica exige el mismo método,
  // sin confiar en un comprobante del navegador.
  if(!['mercadopago','transferencia'].includes(paid.method))
   return respond({ok:false,error:'LIVE_R2_STAGE_METODO_NO_VERIFICADO'},402);
  const bank=paid.method==='transferencia';
  if(bank){
   const table=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
    "AND name='central_live_bank_accreditations'").first();
   if(!table)return respond({ok:false,error:'LIVE_R2_STAGE_BANCO_SIN_AUDITORIA'},409);
  }
  const paymentCondition=bank?
   'AND o.payment_id IS NULL AND o.preference_id IS NULL '+
   'AND EXISTS (SELECT 1 FROM central_live_bank_accreditations a WHERE '+
   'a.order_id=o.id AND a.amount_ars=o.amount_ars '+
   'AND length(a.bank_reference)>=6 AND length(a.operator)>=2)':
   'AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL';
  const sql='INSERT INTO central_r2_large_pending '+
   '(receipt_id,web_order_id,file_id,object_key,sha256,etag,bytes,name,pages_claimed) '+
   'SELECT ?,?,?,?,?,?,?,?,? WHERE '+
   'EXISTS (SELECT 1 FROM central_r2_large_reservations q WHERE '+
   "q.object_key=? AND q.web_order_id=? AND q.file_id=? AND q.state='reserved' "+
   'AND q.sha256=? AND q.bytes=?) AND '+
   'EXISTS (SELECT 1 FROM central_r2_universal_order_links l '+
   'JOIN orders o ON o.id=l.commercial_order_id '+
   'JOIN payment_reviews pr ON pr.order_id=o.id '+
   "WHERE l.web_order_id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
   "AND pr.state='verified' AND o.amount_ars=o.deposit_ars "+
   paymentCondition+')';
  // La recepción R2 se confirma transaccionalmente con el asiento de
  // almacenamiento: nunca dejar el operador obligado a verificar TUS/R2.
  const markReceived="UPDATE central_r2_universal_files SET received=1 "+
   "WHERE web_order_id=? AND file_id=? AND transport='r2' "+
   "AND received=0 AND sha256=? AND bytes=? "+
   "AND EXISTS(SELECT 1 FROM central_r2_large_pending s "+
   "JOIN central_r2_large_reservations q ON q.object_key=s.object_key "+
   "WHERE s.web_order_id=? AND s.file_id=? AND s.receipt_id=? "+
   "AND s.object_key=? AND s.sha256=? AND s.etag=? AND s.bytes=? "+
   "AND s.status='awaiting_pdf_analysis' AND q.state='reserved' "+
   "AND q.web_order_id=s.web_order_id AND q.file_id=s.file_id "+
   "AND q.sha256=s.sha256 AND q.bytes=s.bytes) "+
   "AND EXISTS(SELECT 1 FROM central_r2_universal_order_links l "+
   "JOIN orders o ON o.id=l.commercial_order_id "+
   "JOIN payment_reviews pr ON pr.order_id=o.id "+
   "WHERE l.web_order_id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
   "AND pr.state='verified' AND o.amount_ars=o.deposit_ars "+paymentCondition+")";
  const writes=await db.batch([
   db.prepare(sql).bind(p.receiptId,p.orderId,p.fileId,
    p.objectKey,p.sha256,p.etag,p.bytes,p.name,p.pagesDeclaradas,
    p.objectKey,p.orderId,p.fileId,p.sha256,p.bytes,p.orderId),
   db.prepare(markReceived).bind(p.orderId,p.fileId,p.sha256,p.bytes,
    p.orderId,p.fileId,p.receiptId,p.objectKey,p.sha256,p.etag,p.bytes,p.orderId)
  ]);
  if(writes?.length!==2||writes.some(w=>w?.meta?.changes!==1))
   return respond({ok:false,error:'LIVE_R2_STAGE_RECIBO_NO_CONFIRMADO'},409);
 }catch{return respond({ok:false,error:'LIVE_R2_STAGE_D1'},503)}
 return respond({ok:true,saved:true,idempotent:false,
  webOrderId:p.orderId,fileId:p.fileId,status:'awaiting_pdf_analysis',
  originalReceived:true,stagedForCentral:true,
  registeredInD1:false,productionAuthorized:false},201);
}
