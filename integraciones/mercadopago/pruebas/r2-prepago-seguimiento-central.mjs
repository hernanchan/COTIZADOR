/**
 * Reutiliza la página de seguimiento TUS únicamente para pedidos R2
 * PREPAGADOS con conciliación de pago verificada en D1.
 * Sin ficha de preprensa aprobada el estado NO libera producción ni ETA.
 * El llamador debe haber validado previamente el token HMAC de la orden.
 */
const FLAG='PRIVATE_TEST_ONLY';
const reply=(data,status)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'
}});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function consultarSeguimientoR2PrevioPreprensa(env,commercialOrderId){
 if(!UUID.test(commercialOrderId||''))return reply({error:'Enlace inválido'},404);
 if(env?.CENTRAL_R2_PREPAY_DRAFT_ENABLED!==FLAG||
    env?.CENTRAL_R2_STAGING_ENABLED!==FLAG||
    typeof env?.DB?.prepare!=='function')
  return reply({error:'Seguimiento R2 no habilitado'},503);
 const tables=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN "+
  "('central_r2_prepaid_intents','payment_reviews','central_r2_large_pending')").all();
 const present=new Set((tables.results||[]).map(v=>v.name));
 if(['central_r2_prepaid_intents','payment_reviews','central_r2_large_pending']
  .some(t=>!present.has(t)))
  return reply({error:'Enlace inválido'},404);
 const row=await env.DB.prepare(
  'SELECT o.id,o.status,o.paid_at,o.amount_ars,o.deposit_ars,'+
  'i.web_order_id,i.file_id,i.bytes AS quoted_bytes,i.sha256 AS quoted_sha,'+
  'i.declared_pages,i.state AS intent_state,r.state AS review_state,'+
  'p.receipt_id,p.bytes AS received_bytes,p.sha256 AS received_sha,'+
  'p.pages_claimed,p.status AS received_status '+
  'FROM central_r2_prepaid_intents i '+
  'JOIN orders o ON o.id=i.commercial_order_id '+
  'LEFT JOIN payment_reviews r ON r.order_id=o.id '+
  'LEFT JOIN central_r2_large_pending p ON p.web_order_id=i.web_order_id '+
  'AND p.file_id=i.file_id '+
  'WHERE o.id=? LIMIT 1').bind(commercialOrderId).first();
 if(!row||row.intent_state==='cancelled'||row.intent_state==='delivered')
  return reply({error:'Enlace inválido'},404);
 const verified=row.status==='paid'&&Boolean(row.paid_at)&&
  row.deposit_ars===row.amount_ars&&row.review_state==='verified';
 if(!verified){
  // El estado del pago queda resguardado por la misma autenticación HMAC
  // de los pedidos documentales. No afirmar pago con review desconocido.
  return reply({ok:true,payment:row.review_state==='revoked'?'requiere_revision':'pendiente',
   stage:null,phase:row.review_state==='revoked'?'Pago en revisión':'Esperando pago',
   orderNumber:null,estimate:null,deliveryPlan:null,productionAuthorized:false},200);
 }
 const hasReceipt=Boolean(row.receipt_id);
 const intact=hasReceipt&&row.received_status==='awaiting_pdf_analysis'&&
  row.received_bytes===row.quoted_bytes&&
  row.received_sha===row.quoted_sha&&
  row.pages_claimed===row.declared_pages;
 return reply({ok:true,payment:'pagado',orderNumber:null,
  stage:'pendiente',
  phase:!hasReceipt?'Pago confirmado · esperando archivo':
   intact?'Archivo recibido · revisión de preprensa':
   'Archivo recibido · diferencias en revisión',
  estimate:null,deliveryPlan:'por_confirmar',
  prepressPending:true,productionAuthorized:false,
  readyForPrinting:false},200);
}
