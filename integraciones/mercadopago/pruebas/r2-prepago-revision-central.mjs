/**
 * Cola OPERATIVA de ploteos R2 prepagados para personal de Central.
 * Una orden de pago verificado SIN revisión del PDF no es una orden imprimible.
 * No crea tablas, no altera estado ni expone claves de bucket o SHA.
 */
const FLAG='PRIVATE_TEST_ONLY';
const respond=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'
}});
export async function listarR2PagadosRevision(request,env,{authorized=false}={}){
 if(authorized!==true)return respond({ok:false,error:'R2_REVISION_SIN_AUTORIZACION'},401);
 if(request.method!=='GET')return respond({ok:false,error:'R2_REVISION_METODO'},405);
 if(env?.CENTRAL_R2_PREPAY_DRAFT_ENABLED!==FLAG||
    env?.CENTRAL_R2_STAGING_ENABLED!==FLAG||
    typeof env?.DB?.prepare!=='function')
  return respond({ok:false,error:'R2_REVISION_NO_CONFIGURADA'},503);
 const tables=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN "+
  "('central_r2_prepaid_intents','central_r2_large_pending','payment_reviews')"
 ).all();
 const present=new Set((tables.results||[]).map(row=>row.name));
 if(['central_r2_prepaid_intents','central_r2_large_pending','payment_reviews']
    .some(name=>!present.has(name)))
  return respond({ok:true,orders:[],count:0,productionAuthorized:false});
 const sql=
  'SELECT i.web_order_id,i.file_id,i.commercial_order_id,i.amount_ars,'+
  'i.bytes AS expected_bytes,i.sha256 AS expected_sha256,i.declared_pages,'+
  'i.state AS intent_state,i.created_at AS quoted_at,'+
  'o.paid_at,o.status AS commercial_status,'+
  'p.receipt_id,p.name AS received_name,p.bytes AS received_bytes,'+
  'p.sha256 AS received_sha256,p.pages_claimed,p.status AS received_status,'+
  't.detail_json AS quote_detail_json '+
  'FROM central_r2_prepaid_intents i '+
  'JOIN orders o ON o.id=i.commercial_order_id '+
  'JOIN payment_reviews v ON v.order_id=o.id '+
  'LEFT JOIN central_r2_large_pending p ON '+
  'p.web_order_id=i.web_order_id AND p.file_id=i.file_id '+
  'LEFT JOIN order_items t ON t.order_id=i.commercial_order_id '+
  "AND t.sku='R2_PREPAID_PLOT' AND t.line_number=1 "+
  'WHERE o.status=\'paid\' AND o.paid_at IS NOT NULL '+
  'AND o.deposit_ars=o.amount_ars AND v.state=\'verified\' '+
  'AND i.state NOT IN (\'cancelled\',\'delivered\') '+
  'ORDER BY o.paid_at DESC LIMIT 50';
 const data=await env.DB.prepare(sql).all();
 const orders=(data.results||[]).map(row=>{
  let quoteSnapshot=null;
  try{
   const q=JSON.parse(row.quote_detail_json||'null')?.quoteSnapshot;
   if(q?.schema==='saber-r2-cotizacion-firmada-v1'&&
    q.importeArs===row.amount_ars&&Array.isArray(q.paginas)&&
    q.paginas.length===row.declared_pages&&q.paginas.length<=2000)
    quoteSnapshot=q;
  }catch{}
  const matching=Boolean(row.receipt_id)&&
   row.received_status==='awaiting_pdf_analysis'&&
   row.received_sha256===row.expected_sha256&&
   row.received_bytes===row.expected_bytes&&
   row.pages_claimed===row.declared_pages;
  const hasReceipt=Boolean(row.receipt_id);
  const estado=hasReceipt?
   (matching?'RECIBIDO_PENDIENTE_PREPRENSA':'RECEPCION_A_REVISAR'):
   'PAGADO_ESPERANDO_ARCHIVO';
  return {
   webOrderId:row.web_order_id,commercialOrderId:row.commercial_order_id,
   amountArs:row.amount_ars,paidAt:row.paid_at,
   declaredPages:row.declared_pages,expectedBytes:row.expected_bytes,
   fileId:row.file_id,receiptId:hasReceipt?row.receipt_id:null,
   originalName:hasReceipt?row.received_name:null,
   estado,verifiedReceipt:matching,received:hasReceipt,
   quoteSnapshot,quotedParametersAvailable:Boolean(quoteSnapshot),
   requiresCommercialReview:true,
   measuredPages:null,measuredDimensions:null,priceFinalVerified:false,
   readyForPrinting:false,productionAuthorized:false
  };
 });
 return respond({ok:true,orders,count:orders.length,productionAuthorized:false});
}
