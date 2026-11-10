/** Cola LIVE de documentos universales. Lectura solamente, nunca crea
 * números, modifica órdenes, acredita pagos ni autoriza preprensa/ZIP.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function listarRecepcionUniversalLive(request,env,{authorized=false}={}){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.pathname!=='/admin/api/central/live-recepcion'||
    u.search||u.hash)return reply({ok:false,error:'LIVE_LISTA_RUTA'},405);
 if(!authorized)return reply({ok:false,error:'LIVE_LISTA_ACCESO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.CENTRAL_LIVE_BOARD_GATE!==GO||env?.MP_LIVE_GATE!==GO||
    env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
    typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'LIVE_LISTA_OFF'},503);
 let rows;
 try{
  rows=await env.DB.prepare(
   'SELECT l.commercial_order_id AS order_id,l.web_order_id AS web_order_id,'+
   'n.number AS work_number,d.file_count AS file_count,d.total_ars AS total_ars,'+
   'o.paid_at AS paid_at,'+
   'SUM(CASE WHEN f.received=1 THEN 1 ELSE 0 END) AS received_count,'+
   'SUM(CASE WHEN f.received=0 THEN 1 ELSE 0 END) AS pending_count,'+
   "SUM(CASE WHEN f.transport='tus' THEN 1 ELSE 0 END) AS tus_count,"+
   "SUM(CASE WHEN f.transport='r2' THEN 1 ELSE 0 END) AS r2_count,"+
   "SUM(CASE WHEN f.transport='r2' AND f.received=0 AND EXISTS ("+
   "SELECT 1 FROM central_r2_large_pending r WHERE "+
   "r.web_order_id=f.web_order_id AND r.file_id=f.file_id "+
   "AND r.sha256=f.sha256 AND r.bytes=f.bytes "+
   "AND r.status='awaiting_pdf_analysis') THEN 1 ELSE 0 END) AS staged_r2_count "+
   'FROM central_r2_universal_order_links l '+
   'JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id '+
   'JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id '+
   'JOIN orders o ON o.id=l.commercial_order_id '+
   "JOIN payment_reviews p ON p.order_id=o.id AND p.state='verified' "+
   'LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id '+
   "WHERE o.status='paid' AND o.paid_at IS NOT NULL "+
   'AND o.amount_ars=o.deposit_ars AND o.amount_ars=l.amount_ars '+
   'AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL '+
   'GROUP BY l.commercial_order_id,l.web_order_id,n.number,'+
   'd.file_count,d.total_ars,o.paid_at '+
   'ORDER BY o.paid_at DESC LIMIT 100'
  ).all();
 }catch{return reply({ok:false,error:'LIVE_LISTA_D1_INDISPONIBLE'},503)}
 const ready=[];
 for(const x of rows?.results||[]){
  if(!Number.isSafeInteger(x.file_count)||x.file_count<1||x.file_count>10||
     !Number.isSafeInteger(x.total_ars)||x.total_ars<1||
     !Number.isSafeInteger(x.received_count)||x.received_count<0||
     !Number.isSafeInteger(x.pending_count)||x.pending_count<0||
     x.received_count+x.pending_count!==x.file_count||
     !Number.isSafeInteger(x.tus_count)||!Number.isSafeInteger(x.r2_count)||
     x.tus_count+x.r2_count!==x.file_count||
     !Number.isSafeInteger(x.staged_r2_count)||x.staged_r2_count<0||
     x.staged_r2_count>x.r2_count||
     x.staged_r2_count>x.pending_count||
     !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(x.web_order_id||'')||
     !/^[a-f0-9-]{36}$/i.test(x.order_id||'')||
     !Number.isSafeInteger(x.work_number)||x.work_number<1)
   return reply({ok:false,error:'LIVE_LISTA_DATOS_INCONSISTENTES'},409);
  ready.push({orderId:x.order_id,webOrderId:x.web_order_id,
   numeroOrden:String(x.work_number).padStart(3,'0'),
   amountArs:x.total_ars,fileCount:x.file_count,
   receivedCount:x.received_count,pendingCount:x.pending_count,
   tusCount:x.tus_count,r2Count:x.r2_count,
   stagedR2Count:x.staged_r2_count,paidAt:x.paid_at,
   estado:x.pending_count===0?'ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE':
    x.pending_count===x.staged_r2_count?
    'R2_ALMACENADO_PENDIENTE_ANALISIS_PDF':
    'PAGADO_ESPERANDO_ORIGINALES',
   lane:'pendiente',readyForProduction:false,zipEnabled:false});
 }
 return reply({ok:true,orders:ready,source:'production-d1-verified-payments-only',
  productionAuthorized:false,downloadAuthorized:false});
}
