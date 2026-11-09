/** Ficha de producción R2 a Documentos vía HMAC; sólo preprensa aprobada. */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const DOC=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const result=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'
}});
export async function consultarFichaR2AprobadaCentral(req,env,{readSigned}={}){
 if(env?.CENTRAL_R2_PREPAY_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.CENTRAL_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof readSigned!=='function'||!env?.DB?.prepare)
  return result({ok:false,error:'R2_FICHA_NO_HABILITADA'},503);
 const signed=await readSigned(req,env);
 if(signed?.error)return result({ok:false,error:'R2_FICHA_FIRMA_INVALIDA'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='receiptId,schema,webOrderId'||
    p.schema!=='saber-central-r2-production-sheet-v1'||
    !WEB.test(p.webOrderId||'')||!DOC.test(p.receiptId||''))
  return result({ok:false,error:'R2_FICHA_IDENTIDAD_INVALIDA'},422);
 const row=await env.DB.prepare(
  'SELECT o.id,o.status,o.amount_ars,o.deposit_ars,o.paid_at,v.state AS review_state,'+
  'i.web_order_id,i.sha256 AS expected_sha,i.bytes AS expected_bytes,i.declared_pages,'+
  'r.receipt_id,r.sha256 AS received_sha,r.bytes AS received_bytes,r.pages_claimed,'+
  'a.sha256 AS approved_sha,a.amount_ars AS approved_amount,a.receipt_id AS approved_receipt,'+
  'a.operator,a.approved_at,n.number,t.detail_json,s.state AS production_state '+
  'FROM central_r2_prepaid_intents i JOIN orders o ON o.id=i.commercial_order_id '+
  'JOIN payment_reviews v ON v.order_id=o.id '+
  'JOIN central_r2_prepress_approvals a ON a.order_id=o.id '+
  'JOIN central_r2_large_pending r ON r.web_order_id=i.web_order_id AND r.file_id=i.file_id '+
  'JOIN order_items t ON t.order_id=o.id AND t.sku=\'R2_PREPAID_PLOT\' AND t.line_number=1 '+
  'LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id '+
  'LEFT JOIN central_production_status s ON s.order_id=o.id '+
  'WHERE i.web_order_id=? AND r.receipt_id=? LIMIT 1'
 ).bind(p.webOrderId,p.receiptId).first();
 if(!row||row.status!=='paid'||!row.paid_at||row.review_state!=='verified'||
    row.amount_ars!==row.deposit_ars||row.amount_ars!==row.approved_amount||
    row.receipt_id!==row.approved_receipt||
    row.expected_sha!==row.received_sha||row.expected_sha!==row.approved_sha||
    row.expected_bytes!==row.received_bytes||row.pages_claimed!==row.declared_pages||
    !Number.isSafeInteger(row.number)||row.number<1||
    row.production_state==='entregado')
  return result({ok:false,error:'R2_FICHA_NO_APROBADA_O_ENTREGADA'},409);
 let info;try{info=JSON.parse(row.detail_json)}catch{}
 const q=info?.quoteSnapshot;
 if(!q||q.schema!=='saber-r2-cotizacion-firmada-v1'||
    q.importeArs!==row.amount_ars||!Array.isArray(q.paginas)||
    q.paginas.length!==row.declared_pages||q.paginas.length>2000||
    !Number.isSafeInteger(q.copias)||q.copias<1||
    !['bn','color'].includes(q.modoImpresion)||
    !q.paginas.every(a=>Array.isArray(a)&&a.length===5&&
      Number.isFinite(a[0])&&Number.isFinite(a[1])&&
      ['cad','poster'].includes(a[2])&&/^(rollo|rec)\d+$/.test(a[3]||'')&&
      ['obra80','recubierto'].includes(a[4])))
  return result({ok:false,error:'R2_FICHA_COTIZACION_INVALIDA'},409);
 return result({ok:true,schema:'saber-central-r2-production-sheet-v1',
  webOrderId:p.webOrderId,receiptId:p.receiptId,
  numeroOrden:String(row.number).padStart(3,'0'),importe:row.amount_ars,
  aprobadoPor:row.operator,aprobadoEn:row.approved_at,
  nombreOriginal:q.nombre,modoImpresion:q.modoImpresion,copias:q.copias,
  papelPoster:q.papelPoster,rolloBase:q.rolloBase,paginas:q.paginas,
  productionState:row.production_state||'pendiente',
  preprensaAprobada:true,productionAuthorized:false,readyForPrinting:false},200);
}
