/** Create exactly one commercial D1 order for an immutable TUS/R2 quote.
 * No checkout, uploads, payment confirmation, or production authorization.
 * The historical R2_PREPAID_PLOT path remains unchanged.
 */
import {verificarFichaUniversal} from './r2-lote-universal-central.mjs';
const ON='PRIVATE_TEST_ONLY';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
export const UNIVERSAL_ORDER_SKU='PDF_UNIVERSAL_PREPAID';
export const LINK_SQL="CREATE TABLE IF NOT EXISTS central_r2_universal_order_links ("+
 "web_order_id TEXT PRIMARY KEY REFERENCES central_r2_universal_drafts(web_order_id) ON DELETE RESTRICT,"+
 "commercial_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,"+
 "quote_hash TEXT NOT NULL,amount_ars INTEGER NOT NULL CHECK(amount_ars>0),"+
 "created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const response=(v,s=200)=>Response.json(v,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export function validarPromocionUniversal(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).sort().join(',')!=='draftId,quoteHash,schema,telefono,webOrderId'||
    x.schema!=='saber-central-r2-universal-create-order-v1'||
    !WEB.test(x.webOrderId||'')||!UUID.test(x.draftId||'')||
    !SHA.test(x.quoteHash||'')||
    typeof x.telefono!=='string'||!/^\+?[0-9 ()-]{10,26}$/.test(x.telefono)||
    x.telefono.replace(/\D/g,'').length<10||x.telefono.replace(/\D/g,'').length>15)
  throw Error('UNIVERSAL_PROMOCION_IDENTIDAD_INVALIDA');
 return x;
}
export async function promoverPedidoUniversalD1(request,env,{
 readSigned,uuid=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 const sandbox=env?.SABER_ENTORNO!=='produccion'&&
  env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED===ON&&
  env?.CENTRAL_R2_UNIVERSAL_ORDER_ENABLED===ON;
 const live=env?.SABER_ENTORNO==='produccion'&&
  env?.CENTRAL_DB_ENV==='produccion'&&
  env?.CENTRAL_LIVE_ORDER_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_LIVE_BRIDGE_ENABLED==='GO_COMERCIAL_CONFIRMADO'&&
  env?.MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED!==ON&&
  env?.CENTRAL_R2_UNIVERSAL_ORDER_ENABLED!==ON;
 if((!sandbox&&!live)||
    typeof env?.DB?.prepare!=='function'||typeof env?.DB?.batch!=='function')
  return response({ok:false,error:'UNIVERSAL_PROMOCION_NO_HABILITADA'},503);
 if(typeof readSigned!=='function')
  return response({ok:false,error:'UNIVERSAL_PROMOCION_FIRMA_INDISPONIBLE'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return response({ok:false,error:'UNIVERSAL_PROMOCION_FIRMA_INVALIDA'},signed.status||401);
 let p;try{p=validarPromocionUniversal(signed.payload)}
 catch{return response({ok:false,error:'UNIVERSAL_PROMOCION_ARGUMENTOS'},422)}
 const db=env.DB;
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN "+
  "('orders','order_items','central_work_order_numbers','central_r2_universal_drafts',"+
  "'central_r2_universal_files','central_order_contacts','central_document_manifests','central_r2_prepaid_intents')").all();
 const present=new Set((tables.results||[]).map(x=>x.name));
 if(['orders','order_items','central_work_order_numbers','central_r2_universal_drafts',
    'central_r2_universal_files','central_order_contacts'].some(t=>!present.has(t)))
  return response({ok:false,error:'UNIVERSAL_PROMOCION_ESQUEMA_INCOMPLETO'},503);
 // Same web reference cannot secretly be reused for historic orders.
 for(const table of ['central_document_manifests','central_r2_prepaid_intents']){
  if(!present.has(table))continue;
  const used=await db.prepare('SELECT web_order_id FROM '+table+
   ' WHERE web_order_id=? LIMIT 1').bind(p.webOrderId).first();
  if(used)return response({ok:false,error:'UNIVERSAL_PROMOCION_PEDIDO_REUTILIZADO'},409);
 }
 if(live){
  // Impedir pagar un presupuesto de una revisión que dejó de estar aprobada.
  // Si cambia el tarifario entre cotizar y crear la orden, recalcular y aceptar otra vez.
  let approved;
  try{approved=await db.prepare(
   'SELECT approved_revision,approved_json FROM central_pricing_admin_head WHERE id=1'
  ).first()}catch{return response({ok:false,error:'LIVE_ORDER_TARIFARIO_INDISPONIBLE'},503)}
  if(!approved?.approved_json||!Number.isSafeInteger(approved.approved_revision)||
     approved.approved_revision<1)
   return response({ok:false,error:'LIVE_ORDER_TARIFARIO_NO_APROBADO'},409);
  const current='d1-approved-revision-'+approved.approved_revision;
  const saved=await db.prepare(
   'SELECT price_revision FROM central_r2_universal_drafts WHERE web_order_id=? LIMIT 1'
  ).bind(p.webOrderId).first();
  if(!saved||saved.price_revision!==current)
   return response({ok:false,error:'LIVE_ORDER_PRECIO_CAMBIO'},409);
 }
 const d=await db.prepare('SELECT web_order_id,draft_id,quote_hash,price_revision,'+
  'total_ars,file_count,armados_json,state FROM central_r2_universal_drafts '+
  'WHERE web_order_id=? LIMIT 1').bind(p.webOrderId).first();
 if(!d||d.web_order_id!==p.webOrderId||d.draft_id!==p.draftId||
    d.quote_hash!==p.quoteHash||d.state!=='draft_not_payable')
  return response({ok:false,error:'UNIVERSAL_PROMOCION_BORRADOR_INCOMPATIBLE'},409);
 const all=await db.prepare('SELECT file_id,ordinal,name,sha256,bytes,transport,service,'+
  'work_json,received FROM central_r2_universal_files WHERE web_order_id=? '+
  'ORDER BY ordinal ASC').bind(p.webOrderId).all();
 const rows=all.results||[];
 if(!rows.length||rows.length!==d.file_count||rows.length>10||
    rows.some((r,i)=>r.ordinal!==i||r.received!==0))
  return response({ok:false,error:'UNIVERSAL_PROMOCION_ARCHIVOS_INCOMPLETOS'},409);
 let f,armados;
 try{
  f=rows.map(r=>{
   const w=JSON.parse(r.work_json);
   if(w.fileId!==r.file_id||w.indice!==r.ordinal||w.nombre!==r.name||
      w.sha256!==r.sha256||w.bytes!==r.bytes||
      w.transporte!==r.transport||w.destino!==r.service)
    throw Error('Referencia desincronizada');
   return w;
  });
  armados=JSON.parse(d.armados_json);
  // Rebuild the original SHA-256 signed full quote, not a browser subtotal.
  await verificarFichaUniversal({
   schema:'saber-r2-universal-draft-v1',webOrderId:p.webOrderId,
   priceRevision:d.price_revision,totalArs:d.total_ars,
   archivos:f,armados,pagoAutorizado:false,subidaAutorizada:false,
   produccionAutorizada:false,estado:'PRELIMINAR_SIN_ORIGINALES',
   quoteHash:d.quote_hash
  },{subtle,allowTusOnly:live});
 }catch{return response({ok:false,error:'UNIVERSAL_PROMOCION_FICHA_INVALIDA'},409)}
 // One aggregate positive line avoids zero-priced anillado work items;
 // individual detailed sheets remain in central_r2_universal_files.
 const total=d.total_ars,ids=f.map(x=>x.fileId);
 const r2=f.filter(x=>x.transporte==='r2').length;
 const detail=JSON.stringify({
  schema:'saber-r2-universal-commercial-v1',webOrderId:p.webOrderId,
  quoteHash:p.quoteHash,priceRevision:d.price_revision,
  fileCount:ids.length,r2Count:r2,tusCount:ids.length-r2,
  armadosCount:armados.length,prepressPending:true,originalsReceived:false
 });
 await db.prepare(LINK_SQL).run();
 const find=()=>db.prepare('SELECT commercial_order_id,quote_hash,amount_ars '+
  'FROM central_r2_universal_order_links WHERE web_order_id=?').bind(p.webOrderId).first();
 async function confirmed(link,idempotent){
  if(!link||link.quote_hash!==p.quoteHash||link.amount_ars!==total)return null;
  const id=link.commercial_order_id;
  const [order,line,count,number,contact]=await Promise.all([
   db.prepare('SELECT status,amount_ars,deposit_ars FROM orders WHERE id=?').bind(id).first(),
   db.prepare('SELECT sku,quantity,line_total_ars,detail_json,file_references_json '+
    'FROM order_items WHERE order_id=? AND line_number=1').bind(id).first(),
   db.prepare('SELECT COUNT(*) AS total FROM order_items WHERE order_id=?').bind(id).first(),
   db.prepare('SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?').bind(id).first(),
   db.prepare('SELECT phone FROM central_order_contacts WHERE order_id=?').bind(id).first()
  ]);
  if(!order||order.status!=='awaiting_payment'||order.amount_ars!==total||
     order.deposit_ars!==total||line?.sku!==UNIVERSAL_ORDER_SKU||
     line.quantity!==1||line.line_total_ars!==total||
     line.detail_json!==detail||line.file_references_json!==JSON.stringify(ids)||
     count?.total!==1||contact?.phone!==p.telefono||
     !Number.isSafeInteger(number?.number)||number.number<1)
   return null;
  return response({ok:true,webOrderId:p.webOrderId,commercialOrderId:id,
   numeroOrden:String(number.number).padStart(3,'0'),totalArs:total,
   fileCount:ids.length,idempotent,checkoutEnabled:false,
   paymentAuthorized:false,uploadAuthorized:false,
   filesUploaded:false,productionAuthorized:false},idempotent?200:201);
 }
 const before=await find();
 if(before)return await confirmed(before,true)||
  response({ok:false,error:'UNIVERSAL_PROMOCION_CONFLICTO'},409);
 const id=uuid();
 if(!UUID.test(id))return response({ok:false,error:'UNIVERSAL_PROMOCION_UUID'},503);
 try{
  const result=await db.batch([
   db.prepare('INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)')
    .bind(id,'Librería Saber · PDFs TUS/R2 pendientes de originales',total,total),
   db.prepare('INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,'+
    'unit_price_ars,line_total_ars,detail_json,file_references_json) '+
    'VALUES(?,1,?,?,?,?,?,?,?,?)')
    .bind(id,'print',UNIVERSAL_ORDER_SKU,'Pedido PDF universal pendiente de archivos',
     1,total,total,detail,JSON.stringify(ids)),
   db.prepare('INSERT INTO central_r2_universal_order_links '+
    '(web_order_id,commercial_order_id,quote_hash,amount_ars) VALUES(?,?,?,?)')
    .bind(p.webOrderId,id,p.quoteHash,total),
   db.prepare('INSERT INTO central_work_order_numbers(commercial_order_id) VALUES(?)').bind(id),
   db.prepare('INSERT INTO central_order_contacts(order_id,phone) VALUES(?,?)').bind(id,p.telefono)
  ]);
  if(result?.length!==5||result.some(x=>x?.meta?.changes!==1))
   return response({ok:false,error:'UNIVERSAL_PROMOCION_TRANSACCION_NO_CONFIRMADA'},503);
 }catch{
  return await confirmed(await find().catch(()=>null),true)||
   response({ok:false,error:'UNIVERSAL_PROMOCION_COLISION'},409);
 }
 return await confirmed({commercial_order_id:id,quote_hash:p.quoteHash,amount_ars:total},false)||
  response({ok:false,error:'UNIVERSAL_PROMOCION_POST_VERIFICACION'},503);
}
