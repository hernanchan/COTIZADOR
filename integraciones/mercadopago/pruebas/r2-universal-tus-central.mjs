/** Control de recepción TUS para un pedido universal ya pago.
 * Nunca crea orders ni preferencias. Sólo valida autorización por PDF y
 * vincula recibos SHA-256 verificados a la orden comercial existente.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal} from './r2-universal-checkout-central.mjs';
import {puedeRecibirTransferenciaAvisada,BANK_PREUPLOAD_SQL} from './central-transferencia-recepcion-anticipada.mjs';
const ON='PRIVATE_TEST_ONLY',LIVE='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const postpayEnabled=env=>{
 const live=env?.SABER_ENTORNO==='produccion'&&
  env?.CENTRAL_DB_ENV==='produccion'&&env?.MP_LIVE_GATE===LIVE&&
  env?.CENTRAL_LIVE_BRIDGE_ENABLED===LIVE&&
  env?.CENTRAL_LIVE_POSTPAY_GATE===LIVE&&env?.CENTRAL_LIVE_TUS_GATE===LIVE&&
  env?.CENTRAL_R2_UNIVERSAL_TUS_ENABLED!==ON&&
  env?.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED!==ON;
 const sandbox=env?.SABER_ENTORNO!=='produccion'&&
  env?.CENTRAL_R2_UNIVERSAL_TUS_ENABLED===ON&&
  env?.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED===ON;
 return {allowed:live||sandbox,live};
};
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const RECEIPT=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const respond=(obj,status=200)=>Response.json(obj,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export const TUS_RECEIPT_TABLE="CREATE TABLE IF NOT EXISTS central_r2_universal_tus_receipts ("+
 "web_order_id TEXT NOT NULL,file_id TEXT NOT NULL,receipt_id TEXT NOT NULL UNIQUE,"+
 "object_name TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,"+
 "page_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')),"+
 "PRIMARY KEY(web_order_id,file_id),FOREIGN KEY(web_order_id,file_id) "+
 "REFERENCES central_r2_universal_files(web_order_id,file_id) ON DELETE RESTRICT)";
const required=p=>p&&typeof p==='object'&&!Array.isArray(p)&&
 Object.keys(p).sort().join(',')==='action,bytes,fileId,name,orderId,pages,schema,sha256'&&
 p.schema==='saber-central-r2-universal-tus-gate-v1'&&
 ['start','finish'].includes(p.action)&&ORDER.test(p.orderId||'')&&
 FILE.test(p.fileId||'')&&SHA.test(p.sha256||'')&&
 typeof p.name==='string'&&p.name.length>=1&&p.name.length<=120&&
 /\.pdf$/i.test(p.name)&&Number.isSafeInteger(p.bytes)&&
 p.bytes>=5&&p.bytes<=40*MIB&&
 Number.isSafeInteger(p.pages)&&p.pages>=1&&p.pages<=2000;
const pageMetric=m=>m&&typeof m==='object'&&
 Number.isFinite(m.anchoCm)&&Number.isFinite(m.altoCm)&&
 m.anchoCm>0&&m.altoCm>0&&m.anchoCm<=2000&&m.altoCm<=2000;
const metricsEqual=(actual,expected)=>Array.isArray(actual)&&
 actual.length===expected.length&&actual.every((m,i)=>
  pageMetric(m)&&Math.abs(m.anchoCm-expected[i].anchoCm)<=0.25&&
  Math.abs(m.altoCm-expected[i].altoCm)<=0.25);
async function resolve(env,meta,subtle){
 const db=env.DB;
 const link=await db.prepare("SELECT commercial_order_id FROM central_r2_universal_order_links "+
  "WHERE web_order_id=?").bind(meta.orderId).first();
 if(!link)return null;
 const check=await verificarPedidoUniversalCobrable(env,link.commercial_order_id,{
  webOrderId:meta.orderId,subtle});
 if(!check.ok)return null;
 const found=check.rows.filter((r)=>r.file_id===meta.fileId&&
   r.name===meta.name&&r.sha256===meta.sha256&&r.bytes===meta.bytes&&
   r.transport==='tus');
 if(found.length!==1)return null;
 const work=check.works.find(w=>w.fileId===meta.fileId);
 const pages=work?.configuracion?.paginas;
 if(!Array.isArray(pages)||pages.length!==meta.pages||
    pages.some((p,i)=>p.numero!==i+1||!pageMetric(p))||
    !['bn','color'].includes(work.configuracion.modo))
  return null;
 const pay=await estadoPagoUniversal(env,link.commercial_order_id);
 const bankPending=!pay.verified&&!pay.revoked&&postpayEnabled(env).live&&
  await puedeRecibirTransferenciaAvisada(env,{
   commercialOrderId:link.commercial_order_id,webOrderId:meta.orderId});
 if(pay.revoked||(!pay.verified&&!bankPending))return null;
 const productionTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
   "AND name='central_production_status'").first();
 if(productionTable){
  const state=await db.prepare("SELECT state FROM central_production_status WHERE order_id=?")
   .bind(link.commercial_order_id).first();
  if(state?.state==='entregado')return null;
 }
 return {check,row:found[0],work,expected:pages,pay,bankPending};
}
export async function autorizarTUSUniversalCentral(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 if(!postpayEnabled(env).allowed||!env?.DB?.prepare)
  return respond({ok:false,error:'UNIVERSAL_TUS_OFF'},503);
 if(typeof readSigned!=='function')
  return respond({ok:false,error:'UNIVERSAL_TUS_FIRMA_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'UNIVERSAL_TUS_HMAC'},signed.status||401);
 const p=signed.payload;
 if(!required(p))return respond({ok:false,error:'UNIVERSAL_TUS_IDENTIDAD'},422);
 let result;
 try{result=await resolve(env,p,subtle)}
 catch{return respond({ok:false,error:'UNIVERSAL_TUS_D1_NO_VALIDO'},409)}
 if(!result)return respond({ok:false,error:'UNIVERSAL_TUS_ARCHIVO_O_PAGO_NO_CONCILIA'},402);
 // A paid order may retry the confirmation after a lost network response;
 // only the stored proof can be linked again. No new upload token is issued.
 if(result.row.received!==0&&p.action==='start')
  return respond({ok:false,error:'UNIVERSAL_TUS_YA_RECIBIDO'},409);
 return respond({ok:true,webOrderId:p.orderId,fileId:p.fileId,
  bytes:p.bytes,sha256:p.sha256,name:p.name,pages:p.pages,
  mode:result.work.configuracion.modo,
  expectedMetrics:result.expected.map(x=>({anchoCm:x.anchoCm,altoCm:x.altoCm})),
  uploadAuthorized:true,paymentVerified:result.pay.verified===true,
  bankPending:result.bankPending===true,productionAuthorized:false});
}
export async function recibirTUSUniversalCentral(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 if(!postpayEnabled(env).allowed||!env?.DB?.prepare||!env?.DB?.batch)
  return respond({ok:false,error:'UNIVERSAL_TUS_OFF'},503);
 if(typeof readSigned!=='function')
  return respond({ok:false,error:'UNIVERSAL_TUS_FIRMA_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'UNIVERSAL_TUS_HMAC'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!==
    'bytes,fileId,metrics,name,objectName,orderId,pages,receiptId,schema,sha256'||
    p.schema!=='saber-central-r2-universal-tus-received-v1'||
    !ORDER.test(p.orderId||'')||!FILE.test(p.fileId||'')||
    !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<5||p.bytes>40*MIB||
    typeof p.name!=='string'||p.name.length>120||!/\.pdf$/i.test(p.name)||
    !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000||
    !Array.isArray(p.metrics)||p.metrics.length!==p.pages||
    p.metrics.some(x=>!pageMetric(x)||Object.keys(x).sort().join(',')!=='altoCm,anchoCm,modo')||
    !RECEIPT.test(p.receiptId||'')||
    p.objectName!==('v2/'+p.orderId+'/'+p.receiptId.slice(4)+'.pdf'))
  return respond({ok:false,error:'UNIVERSAL_TUS_RECIBO_INVALIDO'},422);
 let result;
 try{result=await resolve(env,p,subtle)}
 catch{return respond({ok:false,error:'UNIVERSAL_TUS_D1_NO_VALIDO'},409)}
 if(!result||!metricsEqual(p.metrics,result.expected))
  return respond({ok:false,error:'UNIVERSAL_TUS_PRECIO_O_MEDIDA_NO_CONCILIA'},409);
 const db=env.DB;
 // En producción la tabla debe estar migrada; no ejecutar DDL en cada recepción.
 if(!postpayEnabled(env).live)await db.prepare(TUS_RECEIPT_TABLE).run();
 const lookup=()=>db.prepare('SELECT receipt_id,object_name,sha256,bytes,page_count '+
  'FROM central_r2_universal_tus_receipts WHERE web_order_id=? AND file_id=?')
  .bind(p.orderId,p.fileId).first();
 const same=x=>x&&x.receipt_id===p.receiptId&&x.object_name===p.objectName&&
  x.sha256===p.sha256&&x.bytes===p.bytes&&x.page_count===p.pages;
 const prior=await lookup();
 if(prior)return same(prior)&&result.row.received===1?
  respond({ok:true,saved:true,idempotent:true,webOrderId:p.orderId,
   fileId:p.fileId,productionAuthorized:false}):
  respond({ok:false,error:'UNIVERSAL_TUS_RECIBO_DUPLICADO'},409);
 if(result.row.received!==0)
  return respond({ok:false,error:'UNIVERSAL_TUS_RECEPCION_INCOMPATIBLE'},409);
 // La recepción TUS exige acreditación auténtica en el mismo UPDATE D1:
 // MP con ambos IDs, o transferencia con asiento bancario único y mismo importe.
 const bankTable=postpayEnabled(env).live?await db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='central_live_bank_accreditations'"
 ).first():null;
 const verifiedPayment=bankTable?
  "((o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL) OR "+
  "(o.payment_id IS NULL AND o.preference_id IS NULL AND EXISTS ("+
  "SELECT 1 FROM central_live_bank_accreditations b "+
  "WHERE b.order_id=o.id AND b.amount_ars=o.amount_ars)))":
  "(o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL)";
 const paidWhere="EXISTS (SELECT 1 FROM central_r2_universal_order_links l "+
 "JOIN orders o ON o.id=l.commercial_order_id "+
 "JOIN payment_reviews rev ON rev.order_id=o.id "+
 "WHERE l.web_order_id=central_r2_universal_files.web_order_id "+
 "AND o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
 "AND "+verifiedPayment+" AND rev.state='verified')";
 // El original puede estar recibido y SHA-verificado ANTES de que el
 // banco se acredite. La orden sigue awaiting_payment: ZIP y producción
 // continúan bloqueados por la consulta de pago en el paquete.
 const payWhere=postpayEnabled(env).live?
  '('+paidWhere+' OR '+BANK_PREUPLOAD_SQL+')':paidWhere;
 try{
  const a=await db.batch([
   db.prepare('INSERT INTO central_r2_universal_tus_receipts '+
    '(web_order_id,file_id,receipt_id,object_name,sha256,bytes,page_count) '+
    'SELECT web_order_id,file_id,?,?,?,?,? FROM central_r2_universal_files '+
    'WHERE web_order_id=? AND file_id=? AND transport=? AND received=0 '+
    'AND sha256=? AND bytes=? AND '+payWhere)
    .bind(p.receiptId,p.objectName,p.sha256,p.bytes,p.pages,
     p.orderId,p.fileId,'tus',p.sha256,p.bytes),
   db.prepare('UPDATE central_r2_universal_files SET received=1 WHERE web_order_id=? '+
    'AND file_id=? AND transport=? AND sha256=? AND bytes=? AND received=0 '+
    'AND '+payWhere)
    .bind(p.orderId,p.fileId,'tus',p.sha256,p.bytes)
  ]);
  if(a?.length!==2||a.some(x=>x?.meta?.changes!==1))
   return respond({ok:false,error:'UNIVERSAL_TUS_TRANSACCION_INCOMPLETA'},409);
 }catch{
  const existing=await lookup().catch(()=>null);
  const fresh=await db.prepare('SELECT received FROM central_r2_universal_files '+
   'WHERE web_order_id=? AND file_id=?').bind(p.orderId,p.fileId).first().catch(()=>null);
  return same(existing)&&fresh?.received===1?
   respond({ok:true,saved:true,idempotent:true,webOrderId:p.orderId,
    fileId:p.fileId,productionAuthorized:false}):
   respond({ok:false,error:'UNIVERSAL_TUS_RECEPCION_CONCURRENTE'},409);
 }
 return respond({ok:true,saved:true,idempotent:false,webOrderId:p.orderId,
  fileId:p.fileId,productionAuthorized:false},201);
}
