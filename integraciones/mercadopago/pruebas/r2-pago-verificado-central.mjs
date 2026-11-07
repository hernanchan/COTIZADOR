/**
 * Servicio SOLO LECTURA: autorización R2 después de cobrar, verificada desde
 * la base D1 de Central, NUNCA por parámetro paymentAuthorized del navegador.
 *
 * Requiere una intención de compra prearchivo previamente creada desde un
 * presupuesto validado por servidor (central_r2_prepaid_intents). Esta función
 * NO crea esa intención, ni órdenes, ni cobros, ni objetos R2.
 * Si la intención no existe: NO puede subir el PDF aunque se haya pagado otro
 * pedido legítimo en la tienda.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const MIB=1024*1024;
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}});
export async function consultarPagoR2PreviaCarga(request,env,{
 readSigned,now=()=>Math.floor(Date.now()/1000)
}={}){
 if(env?.CENTRAL_R2_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'R2_PREPAGO_NO_HABILITADO'},503);
 if(typeof readSigned!=='function')return reply({ok:false,error:'R2_HMAC_NO_DISPONIBLE'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'R2_FIRMA_NO_AUTORIZADA'},signed.status||401);
 const p=signed?.payload;
 if(!p||p.schema!=='saber-central-r2-payment-lookup-v1'||
    Object.keys(p).sort().join(',')!=='bytes,fileId,orderId,schema,sha256'||
    !ORDER.test(p.orderId||'')||!FILE.test(p.fileId||'')||
    !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<=40*MIB||p.bytes>256*MIB)
  return reply({ok:false,error:'R2_IDENTIDAD_ARCHIVO_INVALIDA'},422);
 const table=await env.DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='table' AND name='central_r2_prepaid_intents'"
 ).first();
 if(!table)return reply({ok:false,error:'R2_PRESUPUESTO_PREPAGO_NO_REGISTRADO'},409);
 // Liga tres identificadores del ORIGINAL a una intención de compra validada
 // antes del checkout. El pago de otros productos jamás habilita su R2.
 const entry=await env.DB.prepare(
  "SELECT i.web_order_id,i.file_id,i.sha256,i.bytes,i.amount_ars AS expected_amount,"+
  "o.id AS commercial_order_id,o.amount_ars,o.deposit_ars,o.status,o.paid_at,"+
  "o.payment_id,o.preference_id,r.state AS review_state "+
  "FROM central_r2_prepaid_intents i "+
  "JOIN orders o ON o.id=i.commercial_order_id "+
  "JOIN payment_reviews r ON r.order_id=o.id "+
  "WHERE i.web_order_id=? AND i.file_id=? AND i.sha256=? AND i.bytes=? "+
  "AND i.state='awaiting_upload_after_payment' "+
  "AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND o.amount_ars=i.amount_ars "+
  "AND r.state='verified' LIMIT 1"
 ).bind(p.orderId,p.fileId,p.sha256,p.bytes).first();
 if(!entry)return reply({ok:false,error:'R2_PAGO_NO_CONFIRMADO'},402);
 let method,authority,reference;
 if(entry.payment_id!==null&&entry.payment_id!==undefined&&
    entry.preference_id!==null&&entry.preference_id!==undefined){
  method='mercadopago';authority='MERCADOPAGO_API_RECONCILED';
  reference='MP-'+String(entry.payment_id);
 }else if(entry.payment_id===null&&entry.preference_id===null){
  const bankTable=await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='bank_accreditations'"
  ).first();
  if(!bankTable)return reply({ok:false,error:'R2_TRANSFERENCIA_NO_ACREDITADA'},402);
  const bank=await env.DB.prepare(
    "SELECT amount_ars,bank_reference FROM bank_accreditations "+
    "WHERE order_id=? AND amount_ars=? LIMIT 1"
  ).bind(entry.commercial_order_id,entry.amount_ars).first();
  if(!bank)return reply({ok:false,error:'R2_TRANSFERENCIA_NO_ACREDITADA'},402);
  method='transferencia';authority='BANK_CREDIT_CONFIRMED_BY_STAFF';
  reference='BANK-'+String(bank.bank_reference||'');
 }else return reply({ok:false,error:'R2_IDENTIFICACION_PAGO_INCOMPLETA'},402);
 if(!/^[A-Za-z0-9_.:-]{5,160}$/.test(reference))
  return reply({ok:false,error:'R2_REFERENCIA_PAGO_INVALIDA'},402);
 const verifiedAt=now();
 if(!Number.isSafeInteger(verifiedAt))
  return reply({ok:false,error:'R2_HORA_NO_VERIFICABLE'},503);
 return reply({ok:true,receipt:{
  source:'CENTRAL_D1_RECONCILED',orderId:p.orderId,
  fileId:p.fileId,sha256:p.sha256,bytes:p.bytes,
  method,authority,paymentState:'PAID_CONFIRMED',
  providerVerified:true,reversed:false,refunded:false,
  currency:'ARS',amountArs:entry.amount_ars,paymentReference:reference,
  verifiedAt
 },paymentAuthorizedForR2:true,productionAuthorized:false});
}
