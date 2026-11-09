/**
 * Link a SHA-256-verified R2 object to the exact PAID universal D1 file.
 * Called only after the immutable R2 pending receipt is stored in Central.
 * No browser-provided payment, price, object URL or production permission.
 */
import {verificarPedidoUniversalCobrable} from './r2-universal-checkout-central.mjs';
const FLAG='PRIVATE_TEST_ONLY';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const DOC=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function confirmarOriginalUniversalR2(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 if(env?.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED!==FLAG||
    env?.CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED!==FLAG||
    env?.CENTRAL_R2_STAGING_ENABLED!==FLAG||
    env?.CENTRAL_R2_QUOTA_ENABLED!==FLAG||!env?.DB?.prepare)
  return reply({ok:false,error:'UNIVERSAL_RECIBO_OFF'},503);
 if(typeof readSigned!=='function')
  return reply({ok:false,error:'UNIVERSAL_RECIBO_SIN_PUENTE'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'UNIVERSAL_RECIBO_HMAC'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!==
     'bytes,fileId,name,objectKey,orderId,pages,receiptId,schema,sha256'||
    p.schema!=='saber-central-r2-universal-received-v1'||
    !WEB.test(p.orderId||'')||!FILE.test(p.fileId||'')||
    !DOC.test(p.receiptId||'')||!SHA.test(p.sha256||'')||
    typeof p.name!=='string'||p.name.length<1||p.name.length>120||
    !/\.pdf$/i.test(p.name)||
    !Number.isSafeInteger(p.bytes)||p.bytes<=40*1048576||
    p.bytes>200*1048576||
    !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000)
  return reply({ok:false,error:'UNIVERSAL_RECIBO_FORMA'},422);
 const match=KEY.exec(p.objectKey||'');
 if(!match||match[1]!==p.orderId||
    ('DOC-'+match[2]).toLowerCase()!==p.receiptId.toLowerCase())
  return reply({ok:false,error:'UNIVERSAL_RECIBO_LLAVE_AJENA'},422);
 const db=env.DB;
 const link=await db.prepare('SELECT commercial_order_id FROM central_r2_universal_order_links '+
  'WHERE web_order_id=?').bind(p.orderId).first();
 if(!link)return reply({ok:false,error:'UNIVERSAL_RECIBO_OTRA_MODALIDAD'},404);
 const valid=await verificarPedidoUniversalCobrable(env,link.commercial_order_id,{
  webOrderId:p.orderId,subtle});
 if(!valid.ok)return reply({ok:false,error:'UNIVERSAL_RECIBO_COTIZACION'},409);
 const work=valid.works.find(x=>x.fileId===p.fileId);
 const row=valid.rows.find(x=>x.file_id===p.fileId);
 if(!work||!row||row.transport!=='r2'||
    work.nombre!==p.name||work.bytes!==p.bytes||work.sha256!==p.sha256||
    !Array.isArray(work.configuracion?.paginas)||
    work.configuracion.paginas.length!==p.pages)
  return reply({ok:false,error:'UNIVERSAL_RECIBO_ORIGINAL_DISTINTO'},409);
 const [pending,quota,payment,productionTable]=await Promise.all([
  db.prepare('SELECT web_order_id,file_id,object_key,name,bytes,sha256,pages_claimed,status '+
   'FROM central_r2_large_pending WHERE receipt_id=? LIMIT 1').bind(p.receiptId).first(),
  db.prepare('SELECT web_order_id,file_id,sha256,bytes,state '+
   'FROM central_r2_large_reservations WHERE object_key=? LIMIT 1').bind(p.objectKey).first(),
  db.prepare("SELECT o.id FROM orders o JOIN payment_reviews r ON r.order_id=o.id "+
   "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
   "AND o.deposit_ars=o.amount_ars AND r.state='verified' "+
   "AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL LIMIT 1")
   .bind(valid.commercialOrderId).first(),
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_production_status'").first()
 ]);
 if(!payment)return reply({ok:false,error:'UNIVERSAL_RECIBO_PAGO_NO_CONCILIADO'},402);
 if(productionTable){
  const stage=await db.prepare('SELECT state FROM central_production_status WHERE order_id=?')
   .bind(valid.commercialOrderId).first();
  if(stage?.state==='entregado')
   return reply({ok:false,error:'UNIVERSAL_RECIBO_PEDIDO_ENTREGADO'},409);
 }
 if(!pending||pending.web_order_id!==p.orderId||pending.file_id!==p.fileId||
    pending.object_key!==p.objectKey||pending.name!==p.name||
    pending.sha256!==p.sha256||pending.bytes!==p.bytes||
    pending.pages_claimed!==p.pages||pending.status!=='awaiting_pdf_analysis'||
    !quota||quota.web_order_id!==p.orderId||quota.file_id!==p.fileId||
    quota.sha256!==p.sha256||quota.bytes!==p.bytes||quota.state!=='reserved')
  return reply({ok:false,error:'UNIVERSAL_RECIBO_R2_NO_COINCIDE'},409);
 if(row.received===1)
  return reply({ok:true,saved:true,idempotent:true,webOrderId:p.orderId,
   fileId:p.fileId,remainingFiles:valid.rows.filter(x=>x.received===0).length,
   productionAuthorized:false},200);
 const changed=await db.prepare('UPDATE central_r2_universal_files SET received=1 '+
  'WHERE web_order_id=? AND file_id=? AND sha256=? AND bytes=? AND transport=? AND received=0 '+
  "AND EXISTS (SELECT 1 FROM central_r2_universal_order_links l "+
  "JOIN orders o ON o.id=l.commercial_order_id "+
  "JOIN payment_reviews r ON r.order_id=o.id "+
  "WHERE l.web_order_id=central_r2_universal_files.web_order_id "+
  "AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND r.state='verified' "+
  "AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL)")
  .bind(p.orderId,p.fileId,p.sha256,p.bytes,'r2').run();
 if(changed?.meta?.changes!==1)
  return reply({ok:false,error:'UNIVERSAL_RECIBO_SIMULTANEO'},409);
 return reply({ok:true,saved:true,idempotent:false,
  webOrderId:p.orderId,fileId:p.fileId,
  remainingFiles:valid.rows.filter(x=>x.received===0).length-1,
  productionAuthorized:false},201);
}
