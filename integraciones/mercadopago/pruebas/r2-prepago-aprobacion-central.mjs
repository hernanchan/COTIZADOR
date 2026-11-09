/** R2: aprobación de preprensa humana, inmutable y ligada al presupuesto D1. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DOC=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const respond=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store,private'}});
export const APPROVAL_TABLE="CREATE TABLE IF NOT EXISTS central_r2_prepress_approvals ("+
 "order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "receipt_id TEXT NOT NULL UNIQUE REFERENCES central_r2_large_pending(receipt_id),"+
 "sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,quote_sha256 TEXT NOT NULL,"+
 "amount_ars INTEGER NOT NULL,measured_json TEXT NOT NULL,operator TEXT NOT NULL,"+
 "notes TEXT NOT NULL,approved_at TEXT NOT NULL DEFAULT(datetime('now')))";
export function validarAprobacionR2(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='confirmed,medidasCm,notes,operator,orderId,receiptId,schema'||
  p.schema!=='saber-r2-preprensa-aprobacion-v1'||!UUID.test(p.orderId||'')||
  !DOC.test(p.receiptId||'')||
  typeof p.operator!=='string'||p.operator.trim().length<2||p.operator.length>60||
  typeof p.notes!=='string'||p.notes.trim().length<6||p.notes.length>280||
  !p.confirmed||typeof p.confirmed!=='object'||Array.isArray(p.confirmed)||
  Object.keys(p.confirmed).sort().join(',')!=='clasificacion,contenido,copias,papel,precio,rollo'||
  Object.values(p.confirmed).some(v=>v!==true)||
  !Array.isArray(p.medidasCm)||!p.medidasCm.length||p.medidasCm.length>2000||
  p.medidasCm.some(a=>!Array.isArray(a)||a.length!==2||
    a.some(n=>!Number.isFinite(n)||n<=0||n>2000)))
  throw Error('R2_PREPRENSA_DATOS_INVALIDOS');
 return p;
}
export function cotizacionCoincideR2(q,p,amount,count){
 return Boolean(q&&q.schema==='saber-r2-cotizacion-firmada-v1'&&
  q.importeArs===amount&&q.seleccion==='original'&&
  Number.isSafeInteger(q.copias)&&q.copias>=1&&
  ['bn','color'].includes(q.modoImpresion)&&
  Array.isArray(q.paginas)&&q.paginas.length===count&&
  p.medidasCm.length===count&&q.paginas.every((a,i)=>
   Array.isArray(a)&&a.length===5&&
   ['cad','poster'].includes(a[2])&&/^(rollo|rec)\d+$/.test(a[3]||'')&&
   ['obra80','recubierto'].includes(a[4])&&
   Math.abs(a[0]-p.medidasCm[i][0])<=0.1&&
   Math.abs(a[1]-p.medidasCm[i][1])<=0.1));
}
export async function aprobarPreprensaR2(req,env,{authorized=false}={}){
 if(!authorized)return respond({ok:false,error:'No autorizado'},401);
 if(['CENTRAL_R2_PREPAY_DRAFT_ENABLED','CENTRAL_R2_STAGING_ENABLED','CENTRAL_PRODUCTION_TRACKING_ENABLED']
  .some(f=>env?.[f]!=='PRIVATE_TEST_ONLY')||!env?.DB?.prepare)
  return respond({ok:false,error:'Preprensa privada deshabilitada'},503);
 if(req.method!=='POST'||!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))
  return respond({ok:false,error:'Solicitud inválida'},405);
 const raw=await req.text();
 if(raw.length>32000)return respond({ok:false,error:'Solicitud extensa'},413);
 let p;try{p=validarAprobacionR2(JSON.parse(raw))}catch{
  return respond({ok:false,error:'Formulario de preprensa inválido'},422)}
 const db=env.DB;
 const row=await db.prepare(
  'SELECT i.commercial_order_id,i.amount_ars,i.declared_pages,'+
  'i.quote_sha256,i.sha256 AS expected_sha,i.bytes AS expected_bytes,i.state AS intent_state,'+
  'o.amount_ars AS paid_amount,o.deposit_ars,o.status AS payment_status,o.paid_at,'+
  'v.state AS review_state,r.receipt_id,r.sha256 AS received_sha,r.bytes AS received_bytes,'+
  'r.pages_claimed,r.status AS receipt_status,t.detail_json '+
  'FROM central_r2_prepaid_intents i JOIN orders o ON o.id=i.commercial_order_id '+
  'JOIN payment_reviews v ON v.order_id=o.id '+
  'JOIN central_r2_large_pending r ON r.web_order_id=i.web_order_id AND r.file_id=i.file_id '+
  "LEFT JOIN order_items t ON t.order_id=o.id AND t.sku='R2_PREPAID_PLOT' AND t.line_number=1 "+
  'WHERE o.id=? LIMIT 1').bind(p.orderId).first();
 if(!row||row.commercial_order_id!==p.orderId||
   !['awaiting_upload_after_payment','under_review','uploaded_verified'].includes(row.intent_state)||
   row.receipt_id!==p.receiptId||!SHA.test(row.expected_sha||'')||
   row.expected_sha!==row.received_sha||row.received_bytes!==row.expected_bytes||
   row.pages_claimed!==row.declared_pages||row.receipt_status!=='awaiting_pdf_analysis'||
   row.payment_status!=='paid'||!row.paid_at||row.review_state!=='verified'||
   row.paid_amount!==row.amount_ars||row.deposit_ars!==row.amount_ars)
  return respond({ok:false,error:'Pago o integridad no verificados'},409);
 let detail;try{detail=JSON.parse(row.detail_json)}catch{}
 if(!detail||detail.sha256!==row.expected_sha||
   detail.bytes!==row.expected_bytes||detail.quoteSha256!==row.quote_sha256||
   !cotizacionCoincideR2(detail.quoteSnapshot,p,row.amount_ars,row.declared_pages))
  return respond({ok:false,error:'Diferencia con cotización: revisión comercial obligatoria'},409);
 await db.prepare(APPROVAL_TABLE).run();
 const get=()=>db.prepare('SELECT receipt_id,sha256,bytes,quote_sha256,amount_ars,measured_json FROM central_r2_prepress_approvals WHERE order_id=?')
  .bind(p.orderId).first();
 const measured=JSON.stringify(p.medidasCm);
 const equal=x=>x&&x.receipt_id===p.receiptId&&x.sha256===row.expected_sha&&
  x.bytes===row.expected_bytes&&x.quote_sha256===row.quote_sha256&&
  x.amount_ars===row.amount_ars&&x.measured_json===measured;
 const old=await get();
 if(old)return equal(old)?respond({ok:true,approved:true,idempotent:true,productionAuthorized:false}):
  respond({ok:false,error:'Aprobación anterior no coincide'},409);
 try{
  const result=await db.batch([
   db.prepare('INSERT INTO central_r2_prepress_approvals '+
    '(order_id,receipt_id,sha256,bytes,quote_sha256,amount_ars,measured_json,operator,notes) '+
    'VALUES(?,?,?,?,?,?,?,?,?)').bind(p.orderId,p.receiptId,row.expected_sha,
      row.expected_bytes,row.quote_sha256,row.amount_ars,measured,p.operator.trim(),p.notes.trim()),
   db.prepare('INSERT OR IGNORE INTO central_work_order_numbers(commercial_order_id) VALUES(?)').bind(p.orderId)
  ]);
  if(Number(result?.[0]?.meta?.changes)!==1)throw Error('DB_CONFLICT');
 }catch{
  return equal(await get().catch(()=>null))?
   respond({ok:true,approved:true,idempotent:true,productionAuthorized:false}):
   respond({ok:false,error:'No se confirmó aprobación D1'},409);
 }
 return respond({ok:true,approved:true,idempotent:false,productionAuthorized:false},201);
}
