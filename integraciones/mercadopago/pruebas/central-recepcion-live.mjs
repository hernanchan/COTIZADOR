/** Cola LIVE de documentos universales. Lectura solamente, nunca crea
 * números, modifica órdenes, acredita pagos ni autoriza preprensa/ZIP.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function listarRecepcionUniversalLive(request,env,{authorized=false,r2StaffOnly=false,staffAll=false}={}){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.pathname!=='/admin/api/central/live-recepcion'||
    u.search||u.hash)return reply({ok:false,error:'LIVE_LISTA_RUTA'},405);
 if(!authorized)return reply({ok:false,error:'LIVE_LISTA_ACCESO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    !(env?.CENTRAL_LIVE_BOARD_GATE===GO||
      (r2StaffOnly||staffAll)&&env?.CENTRAL_LIVE_R2_INSPECTION_GATE===GO)||
    env?.MP_LIVE_GATE!==GO||
    env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
    typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'LIVE_LISTA_OFF'},503);
 let rows,hasProduction=false,hasPurge=false;
 try{
  const existing=(await env.DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('central_live_bank_accreditations','central_order_contacts','central_order_customer_details','central_live_order_archives','central_live_purge_files','central_live_test_exclusions')"
  ).all()).results||[];
  const names=new Set(existing.map(v=>v.name));
  const bank=names.has('central_live_bank_accreditations');
  const hasArchives=names.has('central_live_order_archives');
  const hasTestExclusions=names.has('central_live_test_exclusions');
  hasPurge=names.has('central_live_purge_files');
  const hasPhone=names.has('central_order_contacts');
  const hasCustomer=names.has('central_order_customer_details');
  hasProduction=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_live_production_states'").first())!=null;
  const paymentClause=bank?
   "AND ((o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL) OR "+
   "(o.payment_id IS NULL AND o.preference_id IS NULL AND EXISTS "+
   "(SELECT 1 FROM central_live_bank_accreditations b WHERE b.order_id=o.id "+
   "AND b.amount_ars=o.amount_ars))) ":
   'AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL ';
  const selectContact=(hasPhone?'c.phone':'NULL')+" AS telefono_contacto,"+
   (hasCustomer?'k.name':'NULL')+" AS nombre_cliente,"+
   (hasCustomer?'k.address':'NULL')+" AS direccion_cliente,";
  const joinContact=(hasPhone?'LEFT JOIN central_order_contacts c ON c.order_id=o.id ':'')+
   (hasCustomer?'LEFT JOIN central_order_customer_details k ON k.order_id=o.id ':'');
  const selectProduction=hasProduction?'COALESCE(s.state,\'pendiente\') AS estado_produccion,COALESCE(s.version,0) AS version_produccion,':
   "'pendiente' AS estado_produccion,0 AS version_produccion,";
  const joinProduction=hasProduction?'LEFT JOIN central_live_production_states s ON s.order_id=o.id ':'';
  const selectPurge=hasPurge?
   "(SELECT COUNT(*) FROM central_live_purge_files q WHERE q.order_id=o.id) AS purge_total,"+
   "(SELECT COUNT(*) FROM central_live_purge_files q WHERE q.order_id=o.id AND q.state='deleted') AS purge_deleted,":
   "0 AS purge_total,0 AS purge_deleted,";
  rows=await env.DB.prepare(
   'SELECT l.commercial_order_id AS order_id,l.web_order_id AS web_order_id,'+
   'n.number AS work_number,d.file_count AS file_count,d.total_ars AS total_ars,'+
   'o.paid_at AS paid_at,'+selectContact+selectProduction+selectPurge+
   'SUM(CASE WHEN f.received=1 THEN 1 ELSE 0 END) AS received_count,'+
   'SUM(CASE WHEN f.received=0 THEN 1 ELSE 0 END) AS pending_count,'+
   "SUM(CASE WHEN f.transport='tus' THEN 1 ELSE 0 END) AS tus_count,"+
   "SUM(CASE WHEN f.transport='r2' THEN 1 ELSE 0 END) AS r2_count,"+
   "SUM(CASE WHEN f.transport='r2' AND f.received=0 AND EXISTS ("+
   "SELECT 1 FROM central_r2_large_pending r WHERE "+
   "r.web_order_id=f.web_order_id AND r.file_id=f.file_id "+
   "AND r.sha256=f.sha256 AND r.bytes=f.bytes "+
   "AND r.status='awaiting_pdf_analysis') THEN 1 ELSE 0 END) AS staged_r2_count,"+
   "GROUP_CONCAT(CASE WHEN f.transport='r2' AND f.received=0 AND EXISTS ("+
   "SELECT 1 FROM central_r2_large_pending st WHERE st.web_order_id=f.web_order_id "+
   "AND st.file_id=f.file_id AND st.sha256=f.sha256 AND st.bytes=f.bytes "+
   "AND st.status='awaiting_pdf_analysis') THEN f.file_id ELSE NULL END) AS staged_r2_ids "+
   'FROM central_r2_universal_order_links l '+
   'JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id '+
   'JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id '+
   'JOIN orders o ON o.id=l.commercial_order_id '+
   "JOIN payment_reviews p ON p.order_id=o.id AND p.state='verified' "+
   'LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id '+joinContact+joinProduction+
   "WHERE o.status='paid' AND o.paid_at IS NOT NULL "+
   'AND o.amount_ars=o.deposit_ars AND o.amount_ars=l.amount_ars '+
   paymentClause+
   // Entregados salen del tablero, pero la historia permanece en D1.
   (hasProduction?"AND (s.state IS NULL OR s.state!='entregado') ":'')+
   (hasArchives?'AND NOT EXISTS(SELECT 1 FROM central_live_order_archives a WHERE a.order_id=o.id) ':'')+
   (hasTestExclusions?'AND NOT EXISTS(SELECT 1 FROM central_live_test_exclusions e WHERE e.order_id=o.id) ':'')+
   'GROUP BY l.commercial_order_id,l.web_order_id,n.number'+
   (hasPhone?',c.phone':'')+(hasCustomer?',k.name,k.address':'')+
   (hasProduction?',s.state,s.version':'')+','+
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
  // El puente R2 sólo enumera pedidos con archivos R2 y sigue requiriendo
  // sesión de personal + HMAC. La lista comercial normal no cambia.
  if(!['pendiente','en_preparacion','en_espera','listo','entregado'].includes(x.estado_produccion||'pendiente')||
     !Number.isSafeInteger(x.version_produccion)||x.version_produccion<0)
   return reply({ok:false,error:'LIVE_LISTA_ESTADO_INCONSISTENTE'},409);
  if(r2StaffOnly&&!staffAll&&x.r2_count===0)continue;
  const stagedIds=typeof x.staged_r2_ids==='string'&&x.staged_r2_ids?
   x.staged_r2_ids.split(','):[];
  if(stagedIds.some(id=>!/^[A-Za-z0-9_-]{1,80}$/.test(id))||
    new Set(stagedIds).size!==stagedIds.length||
    (typeof x.staged_r2_ids==='string'&&stagedIds.length!==x.staged_r2_count))
   return reply({ok:false,error:'LIVE_LISTA_R2_IDS_INCONSISTENTES'},409);
  ready.push({orderId:x.order_id,webOrderId:x.web_order_id,
   numeroOrden:String(x.work_number).padStart(3,'0'),
   amountArs:x.total_ars,fileCount:x.file_count,
   receivedCount:x.received_count,pendingCount:x.pending_count,
   tusCount:x.tus_count,r2Count:x.r2_count,
   stagedR2Count:x.staged_r2_count,stagedR2FileIds:stagedIds,paidAt:x.paid_at,
   nombreCliente:x.nombre_cliente||null,telefonoContacto:x.telefono_contacto||null,
   direccionCliente:x.direccion_cliente||null,
   estado:x.pending_count===0?'ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE':
    x.pending_count===x.staged_r2_count?
    'R2_ALMACENADO_PENDIENTE_ANALISIS_PDF':
    'PAGADO_ESPERANDO_ORIGINALES',
   lane:x.estado_produccion||'pendiente',productionState:x.estado_produccion||'pendiente',
   productionVersion:x.version_produccion||0,
   purgeStatus:x.estado_produccion!=='entregado'?'not_applicable':
    x.purge_total===x.file_count&&x.purge_deleted===x.file_count?'deleted':
    x.purge_total===x.file_count?'pending_retry':'missing_queue',
   deliveryEnabled:env.CENTRAL_LIVE_PURGE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
    env.CENTRAL_LIVE_PURGE_EXECUTE_GATE==='GO_COMERCIAL_CONFIRMADO',
   readyForProduction:false,
   zipEnabled:x.pending_count===0});
 }
 // Monitor seguro: si la purga TUS/R2 queda incompleta la Central avisa
 // del total sin volver a listar las órdenes entregadas ni exponer archivos.
 let cleanupPendingCount=null;
 if(hasProduction){
  try{
   const pending=hasPurge?
    "NOT EXISTS(SELECT 1 FROM central_live_purge_files p WHERE p.order_id=s.order_id) "+
    "OR EXISTS(SELECT 1 FROM central_live_purge_files p "+
    "WHERE p.order_id=s.order_id AND p.state!='deleted')":
    '1=1';
   const result=await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM central_live_production_states s "+
    "WHERE s.state='entregado' AND ("+pending+")").first();
   if(Number.isSafeInteger(result?.n)&&result.n>=0)
    cleanupPendingCount=result.n;
  }catch{/* No asegurar un borrado si D1 no responde. */}
 }
 return reply({ok:true,orders:ready,source:'production-d1-verified-payments-only',
  cleanupPendingCount,productionAuthorized:false,downloadAuthorized:false});
}
