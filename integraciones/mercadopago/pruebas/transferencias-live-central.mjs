/**
 * Transferencia bancaria LIVE, aislada de Mercado Pago y de Sandbox.
 * Solicitud: HMAC desde comprador, solo deja pendiente. Nunca acredita con un
 * comprobante del cliente. Acreditación: operador privado + referencia bancaria
 * única verificada contra la cuenta de Librería Saber.
 *
 * TUS y R2 usan el mismo circuito de cobro; R2 solo se ofrece cuando
 * sus compuertas de recepción, reserva y staging están habilitadas.
 * La acreditación requiere confirmación bancaria del operador.
 */
import {verificarPedidoUniversalCobrable} from './r2-universal-checkout-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const bankReference=/^[A-Z0-9][A-Z0-9._/ -]{5,79}$/;
const respond=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store, private','X-Robots-Tag':'noindex,nofollow',
 'X-Content-Type-Options':'nosniff'
}});
const gate=(env,approval=false)=>env?.SABER_ENTORNO==='produccion'&&
 env?.CENTRAL_DB_ENV==='produccion'&&env?.MP_LIVE_GATE===GO&&
 env?.CENTRAL_LIVE_BRIDGE_ENABLED===GO&&
 env?.CENTRAL_LIVE_ORDER_GATE===GO&&env?.CENTRAL_LIVE_POSTPAY_GATE===GO&&
 env?.CENTRAL_LIVE_TUS_GATE===GO&&env?.CENTRAL_LIVE_TRANSFER_GATE===GO&&
 (!approval||env?.CENTRAL_LIVE_TRANSFER_APPROVAL_GATE===GO)&&
 typeof env?.DB?.prepare==='function';
const validAlias=env=>typeof env?.CENTRAL_LIVE_TRANSFER_ALIAS==='string'&&
 /^[A-Za-z0-9._-]{6,50}$/.test(env.CENTRAL_LIVE_TRANSFER_ALIAS);
// La autoridad del transporte son las líneas D1; una declaración del cliente no
// habilita pago de R2 si la infraestructura no puede recibir el archivo.
export function transportesTransferenciaLiveHabilitados(rows,env){
 if(!Array.isArray(rows)||rows.length<1||rows.length>10)return false;
 const tus=rows.some(f=>f?.transport==='tus');
 const r2=rows.some(f=>f?.transport==='r2');
 if(!rows.every(f=>f&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&
   (f.transport==='tus'?f.bytes<=40*MIB:
    f.transport==='r2'?f.bytes>40*MIB&&f.bytes<=200*MIB:false)))return false;
 if(tus&&env?.CENTRAL_LIVE_TUS_GATE!==GO)return false;
 return !r2||['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
  'CENTRAL_LIVE_R2_STAGING_GATE','CENTRAL_LIVE_POSTPAY_GATE']
  .every(name=>env?.[name]===GO);
}
export async function ensureLiveBankTables(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS central_live_transfer_requests (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,amount_ars INTEGER NOT NULL CHECK(amount_ars>0),state TEXT NOT NULL CHECK(state='awaiting_bank_verification'),created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS central_live_bank_accreditations (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,amount_ars INTEGER NOT NULL CHECK(amount_ars>0),operator TEXT NOT NULL,bank_reference TEXT NOT NULL UNIQUE,recorded_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS central_live_transfer_customer_notices (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,reported_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_live_bank_ref_normalized ON central_live_bank_accreditations(REPLACE(bank_reference,' ','-'))").run();
}
const paidState=async(db,orderId)=>{
 const order=await db.prepare(
  'SELECT o.status,o.paid_at,o.amount_ars,o.deposit_ars,o.payment_id,o.preference_id,p.state AS review_state,b.amount_ars AS bank_amount '+
  'FROM orders o LEFT JOIN payment_reviews p ON p.order_id=o.id '+
  'LEFT JOIN central_live_bank_accreditations b ON b.order_id=o.id WHERE o.id=?'
 ).bind(orderId).first();
 return order?.status==='paid'&&!!order.paid_at&&order.deposit_ars===order.amount_ars&&
  order.review_state==='verified'&&!order.payment_id&&!order.preference_id&&
  order.bank_amount===order.amount_ars;
};
const validateSigned=(p,kind)=>{
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join(',')!=='commercialOrderId,schema,webOrderId')return false;
 return p.schema==='saber-central-live-transfer-'+kind+'-v1'&&
  UUID.test(p.commercialOrderId||'')&&WEB.test(p.webOrderId||'');
};
export async function manejarTransferenciaLiveCentral(request,env,{readSigned,verifyOrder=verificarPedidoUniversalCobrable,now=()=>Date.now()}={}){
 if(!gate(env)||!validAlias(env))return respond({ok:false,error:'TRANSFER_LIVE_NO_HABILITADA'},503);
 if(request.method!=='POST'||typeof readSigned!=='function')return respond({ok:false,error:'TRANSFER_LIVE_FIRMA_REQUERIDA'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'TRANSFER_LIVE_HMAC'},signed.status||401);
 const p=signed.payload;
 const pathname=new URL(request.url).pathname;
 const action=pathname.endsWith('/transfer-start')?'start':pathname.endsWith('/transfer-notify')?'notify':pathname.endsWith('/transfer-status')?'status':null;
 if(!validateSigned(p,action))return respond({ok:false,error:'TRANSFER_LIVE_ORDEN_INVALIDA'},422);
 let checked;
 try{checked=await verifyOrder(env,p.commercialOrderId,{webOrderId:p.webOrderId})}
 catch{return respond({ok:false,error:'TRANSFER_LIVE_D1_NO_DISPONIBLE'},503)}
 if(!checked?.ok)return respond({ok:false,error:'TRANSFER_LIVE_FICHA_NO_CONCILIADA'},409);
 if(!transportesTransferenciaLiveHabilitados(checked.rows,env))
  return respond({ok:false,error:'TRANSFER_LIVE_RECEPCION_NO_HABILITADA'},409);
 try{
  // Crear tabla de avisos también en pedidos iniciados antes de este despliegue.
  await ensureLiveBankTables(env.DB);
  if(action==='start'){
   const order=checked.link;
   const created=Date.parse(String(order.created_at||'').replace(' ','T')+'Z');
   if(!Number.isFinite(created)||created>now()+30000||now()-created>86400000)
    return respond({ok:false,error:'TRANSFER_LIVE_COTIZACION_VENCIDA'},409);
   if(order.status!=='awaiting_payment'||order.preference_id||order.payment_id)
    return respond({ok:false,error:'TRANSFER_LIVE_PAGO_PREEXISTENTE'},409);
   const mpAttempt=await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='live_checkout_attempts'"
   ).first();
   if(mpAttempt){
    const row=await env.DB.prepare('SELECT order_id FROM live_checkout_attempts WHERE order_id=?')
     .bind(order.id).first();
    if(row)return respond({ok:false,error:'TRANSFER_LIVE_MP_INICIADO'},409);
   }
   // El INSERT consulta el estado real D1: una carrera no puede crear dos transferencias.
   const query="INSERT OR IGNORE INTO central_live_transfer_requests(order_id,amount_ars,state) "+
    "SELECT o.id,o.amount_ars,'awaiting_bank_verification' FROM orders o "+
    "WHERE o.id=? AND o.status='awaiting_payment' AND o.payment_id IS NULL "+
    "AND o.preference_id IS NULL AND o.amount_ars=o.deposit_ars AND o.amount_ars=? "+
    (mpAttempt?"AND NOT EXISTS(SELECT 1 FROM live_checkout_attempts a WHERE a.order_id=o.id) ":"");
   await env.DB.prepare(query).bind(order.id,checked.amountArs).run();
  }
  const saved=await env.DB.prepare(
   'SELECT t.amount_ars,t.state,o.status,o.payment_id,o.preference_id FROM central_live_transfer_requests t '+
   'JOIN orders o ON o.id=t.order_id WHERE t.order_id=?'
  ).bind(checked.commercialOrderId).first();
  if(!saved||saved.amount_ars!==checked.amountArs)
   return respond({ok:false,error:'TRANSFER_LIVE_NO_SOLICITADA'},action==='start'?409:404);
  const paid=await paidState(env.DB,checked.commercialOrderId);
  if((action==='status'||action==='notify')&&paid)
   return respond({ok:true,commercialOrderId:checked.commercialOrderId,
    webOrderId:p.webOrderId,amountArs:checked.amountArs,estado:'pagado_esperando_archivos',
    paymentVerified:true,uploadAuthorized:true,productionAuthorized:false});
  if(saved.status!=='awaiting_payment'||saved.payment_id||saved.preference_id||
     saved.state!=='awaiting_bank_verification')
   return respond({ok:false,error:'TRANSFER_LIVE_ESTADO_INCOMPATIBLE'},409);
  if(action==='notify'){
   // El comprador sólo informa haber realizado la transferencia.
   // NUNCA modifica orders, payment_reviews ni bank_accreditations.
   await env.DB.prepare(
    "INSERT OR IGNORE INTO central_live_transfer_customer_notices(order_id) "+
    "SELECT t.order_id FROM central_live_transfer_requests t "+
    "JOIN orders o ON o.id=t.order_id "+
    "WHERE t.order_id=? AND t.amount_ars=? AND t.state='awaiting_bank_verification' "+
    "AND o.status='awaiting_payment' AND o.amount_ars=t.amount_ars "+
    "AND o.payment_id IS NULL AND o.preference_id IS NULL"
   ).bind(checked.commercialOrderId,checked.amountArs).run();
  }
  const notice=await env.DB.prepare(
   'SELECT reported_at FROM central_live_transfer_customer_notices WHERE order_id=?'
  ).bind(checked.commercialOrderId).first();
  return respond({ok:true,commercialOrderId:checked.commercialOrderId,
   webOrderId:p.webOrderId,amountArs:checked.amountArs,
   estado:notice?'transferencia_informada':'transferencia_pendiente',
   customerNotified:Boolean(notice),
   alias:env.CENTRAL_LIVE_TRANSFER_ALIAS,paymentVerified:false,
   uploadAuthorized:false,productionAuthorized:false});
 }catch{return respond({ok:false,error:'TRANSFER_LIVE_CENTRAL_NO_DISPONIBLE'},503)}
}
const adminAuthorized=(request,env,authorized)=>{
 const url=new URL(request.url);
 return authorized===true&&url.origin==='https://pagos.libreriasaber.com.ar'&&
  url.pathname.startsWith('/admin/api/central/live-transfers/')&&!url.search&&
  (!request.headers.get('Origin')||request.headers.get('Origin')===url.origin);
};
export async function listarTransferenciasLiveCentral(request,env,{authorized=false}={}){
 if(!gate(env,true))return respond({ok:false,error:'TRANSFER_LIVE_ADMIN_CERRADO'},503);
 if(!adminAuthorized(request,env,authorized)||request.method!=='GET')return respond({ok:false,error:'TRANSFER_LIVE_ADMIN_REQUIERE_ACCESO'},401);
 try{
  await ensureLiveBankTables(env.DB);
  const rows=await env.DB.prepare(
   "SELECT t.order_id,t.amount_ars,t.created_at,n.number AS numero_orden,"+
   "c.phone AS telefono,d.name AS nombre,d.address AS direccion,"+
   "v.reported_at AS aviso_cliente,"+
   "(SELECT COUNT(*) FROM central_r2_universal_files f "+
   "WHERE f.web_order_id=l.web_order_id) AS archivos_total,"+
   "(SELECT COUNT(*) FROM central_r2_universal_files f "+
   "WHERE f.web_order_id=l.web_order_id AND f.received=1) AS archivos_recibidos "+
   "FROM central_live_transfer_requests t JOIN orders o ON o.id=t.order_id "+
   "JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id "+
   "LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id "+
   "LEFT JOIN central_order_contacts c ON c.order_id=o.id "+
   "LEFT JOIN central_order_customer_details d ON d.order_id=o.id "+
   "LEFT JOIN central_live_transfer_customer_notices v ON v.order_id=t.order_id "+
   "WHERE t.state='awaiting_bank_verification' AND o.status='awaiting_payment' "+
   "AND o.payment_id IS NULL AND o.preference_id IS NULL AND t.amount_ars=o.amount_ars "+
   "ORDER BY CASE WHEN v.reported_at IS NULL THEN 1 ELSE 0 END ASC,COALESCE(v.reported_at,t.created_at) ASC LIMIT 100"
  ).all();
  return respond({ok:true,pending:(rows.results||[]).map(({aviso_cliente,...row})=>({
   ...row,customerNotified:Boolean(aviso_cliente),reportedAt:aviso_cliente||null
  }))});
 }catch{return respond({ok:false,error:'TRANSFER_LIVE_PENDIENTES_NO_DISPONIBLES'},503)}
}
export async function aprobarTransferenciaLiveCentral(request,env,{
 authorized=false,verifyOrder=verificarPedidoUniversalCobrable
}={}){
 if(!gate(env,true))return respond({ok:false,error:'TRANSFER_LIVE_APROBACION_CERRADA'},503);
 if(!adminAuthorized(request,env,authorized)||request.method!=='POST')
  return respond({ok:false,error:'TRANSFER_LIVE_OPERADOR_NO_AUTORIZADO'},401);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return respond({ok:false,error:'TRANSFER_LIVE_JSON_OBLIGATORIO'},415);
 const raw=await request.text();
 if(raw.length>1100)return respond({ok:false,error:'TRANSFER_LIVE_INPUT_LARGO'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='amount_ars,bank_reference,confirmed,operator,order_id'||
    !UUID.test(p.order_id||'')||!Number.isSafeInteger(p.amount_ars)||p.amount_ars<1||
    p.confirmed!==true||typeof p.operator!=='string'||
    p.operator.trim().length<2||p.operator.trim().length>60||
    typeof p.bank_reference!=='string')return respond({ok:false,error:'TRANSFER_LIVE_DATOS_INVALIDOS'},422);
 const reference=p.bank_reference.trim().toUpperCase().replace(/\s+/g,' ');
 const operator=p.operator.trim();
 if(!bankReference.test(reference)||/\.(?:PDF|PNG|JPE?G|WEBP)$/.test(reference))
  return respond({ok:false,error:'TRANSFER_LIVE_REFERENCIA_BANCARIA_INVALIDA'},422);
 try{
  await ensureLiveBankTables(env.DB);
  const order=await env.DB.prepare(
   'SELECT l.web_order_id,o.id,o.status,o.amount_ars,o.deposit_ars,o.payment_id,o.preference_id,'+
   't.amount_ars AS transfer_amount FROM orders o '+
   'JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id '+
   'JOIN central_live_transfer_requests t ON t.order_id=o.id WHERE o.id=?'
  ).bind(p.order_id).first();
  if(!order||order.status!=='awaiting_payment'||order.amount_ars!==p.amount_ars||
     order.deposit_ars!==p.amount_ars||order.transfer_amount!==p.amount_ars||
     order.preference_id||order.payment_id)
   return respond({ok:false,error:'TRANSFER_LIVE_ORDEN_NO_APROBABLE'},409);
  const checked=await verifyOrder(env,order.id,{webOrderId:order.web_order_id});
  if(!checked?.ok||checked.amountArs!==p.amount_ars||
     !transportesTransferenciaLiveHabilitados(checked.rows,env))
   return respond({ok:false,error:'TRANSFER_LIVE_FICHA_NO_CONCILIADA'},409);
  const [review,prior,usedReference]=await Promise.all([
   env.DB.prepare('SELECT state FROM payment_reviews WHERE order_id=?').bind(order.id).first(),
   env.DB.prepare('SELECT order_id FROM central_live_bank_accreditations WHERE order_id=?').bind(order.id).first(),
   env.DB.prepare("SELECT order_id FROM central_live_bank_accreditations "+
    "WHERE REPLACE(bank_reference,' ','-')=REPLACE(?,' ','-') LIMIT 1")
    .bind(reference).first()
  ]);
  if(review||prior)return respond({ok:false,error:'TRANSFER_LIVE_YA_REVISADA'},409);
  // Una referencia bancaria no identifica más de una acreditación, aun
  // cuando cambien espacios por guiones. Informar la causa real ANTES de batch.
  if(usedReference)return respond({
   ok:false,error:'TRANSFER_LIVE_REFERENCIA_YA_UTILIZADA'},409);
  // Transacción: registro bancario exclusivo + actualización paid + revisión D1.
  const applied=await env.DB.batch([
   env.DB.prepare(
    'INSERT INTO central_live_bank_accreditations(order_id,amount_ars,operator,bank_reference) '+
    'SELECT o.id,o.amount_ars,?,? FROM orders o '+
    'JOIN central_live_transfer_requests t ON t.order_id=o.id '+
    "WHERE o.id=? AND o.status='awaiting_payment' AND o.preference_id IS NULL "+
    'AND o.payment_id IS NULL AND o.amount_ars=o.deposit_ars AND t.amount_ars=o.amount_ars '+
    'AND NOT EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id)'
   ).bind(operator,reference,order.id),
   env.DB.prepare(
    "UPDATE orders SET status='paid',paid_at=datetime('now') "+
    "WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL AND preference_id IS NULL "+
    'AND deposit_ars=amount_ars AND EXISTS(SELECT 1 FROM central_live_bank_accreditations b '+
    'WHERE b.order_id=orders.id AND b.amount_ars=orders.amount_ars)'
   ).bind(order.id),
   env.DB.prepare(
    "INSERT INTO payment_reviews(order_id,state,checked_at) SELECT o.id,'verified',datetime('now') "+
    'FROM orders o JOIN central_live_bank_accreditations b ON b.order_id=o.id AND b.amount_ars=o.amount_ars '+
    "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
    'AND NOT EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id)'
   ).bind(order.id)
  ]);
  if(applied?.length!==3||applied.some(x=>x?.meta?.changes!==1))
   return respond({ok:false,error:'TRANSFER_LIVE_REVISION_INCOMPLETA'},409);
  return respond({ok:true,order_id:order.id,amount_ars:p.amount_ars,
   estado:'pagado',paymentVerified:true,productionAuthorized:false});
 }catch(error){
  // No mentir sobre referencias duplicadas: un error SQL de esquema, red o
  // consulta previa NO prueba concurrencia. D1.batch es transaccional.
  console.error('SABER_LIVE_TRANSFER_ACREDITACION_FALLO',
   {constraint:/UNIQUE|SQLITE_CONSTRAINT/i.test(String(error?.message||'')),
    databaseError:true});
  return respond({ok:false,error:'TRANSFER_LIVE_ACREDITACION_NO_COMPLETADA'},503);
 }
}
