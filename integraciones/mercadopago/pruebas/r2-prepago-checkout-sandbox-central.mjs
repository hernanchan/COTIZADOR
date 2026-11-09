/**
 * Cobro TEST SELLER para una intención SIN PDF, creada previamente en D1.
 * Solo HMAC entre Workers. Jamás autoriza subir ni producir por sí solo.
 * /demo/checkout conserva validación de vendedor test_user y monto ARS.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'
}});
export async function checkoutR2PrepaidSandboxCentral(request,env,{
 readSigned,dispatch,reconcile,trackingLink=async()=>null,now=()=>Date.now()
}={}){
 if(env?.CENTRAL_R2_PREPAY_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
   env?.DOCS_SANDBOX_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY'||
   typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'R2_PREPAGO_CHECKOUT_APAGADO'},503);
 if(typeof readSigned!=='function')
  return reply({ok:false,error:'R2_PREPAGO_FIRMA_NO_DISPONIBLE'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'R2_PREPAGO_FIRMA_RECHAZADA'},signed.status||401);
 const p=signed?.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='action,commercialOrderId,schema,webOrderId'||
  p.schema!=='saber-central-r2-prepaid-checkout-v1'||
  !['start','status'].includes(p.action)||
  !WEB.test(p.webOrderId||'')||!UUID.test(p.commercialOrderId||''))
  return reply({ok:false,error:'R2_PREPAGO_IDENTIDAD_INVALIDA'},422);
 const row=await env.DB.prepare(
  'SELECT i.web_order_id,i.amount_ars,i.state,i.created_at,'+
  'o.id,o.amount_ars AS order_total,o.deposit_ars,o.status,'+
  'o.paid_at,o.payment_id,o.preference_id,o.created_at AS order_created_at '+
  'FROM central_r2_prepaid_intents i JOIN orders o ON i.commercial_order_id=o.id '+
  'JOIN order_items line ON line.order_id=o.id AND line.sku=? '+
  'WHERE i.web_order_id=? AND i.commercial_order_id=? '+
  'AND line.quantity=1 AND line.unit_price_ars=o.amount_ars '+
  'AND line.line_total_ars=o.amount_ars LIMIT 1'
 ).bind('R2_PREPAID_PLOT',p.webOrderId,p.commercialOrderId).first();
 if(!row||row.state!=='awaiting_upload_after_payment'||
  !Number.isSafeInteger(row.amount_ars)||row.amount_ars<1||
  row.order_total!==row.amount_ars||row.deposit_ars!==row.amount_ars)
  return reply({ok:false,error:'R2_PREPAGO_NO_COINCIDE'},409);
 const created=Date.parse(String(row.order_created_at||'').replace(' ','T')+'Z');
 if(!Number.isFinite(created)||created>now()+30000||now()-created>24*3600*1000)
  return reply({ok:false,error:'R2_PREPAGO_COTIZACION_VENCIDA'},409);
 if(p.action==='status'){
  if(row.status==='awaiting_payment'&&row.preference_id&&typeof reconcile==='function')
   await reconcile(env,row.id);
  const fresh=await env.DB.prepare(
   'SELECT status,paid_at FROM orders WHERE id=?').bind(row.id).first();
  const review=await env.DB.prepare(
   'SELECT state FROM payment_reviews WHERE order_id=?').bind(row.id).first();
  const estado=review?.state==='revoked'?'revocado':
   fresh?.status==='paid'&&fresh?.paid_at&&review?.state==='verified'?
    'pagado_esperando_archivo':'pendiente';
  const seguimientoUrl=estado==='pagado_esperando_archivo'&&
   typeof trackingLink==='function'?await trackingLink(row.id):null;
  return reply({ok:true,webOrderId:p.webOrderId,
   commercialOrderId:row.id,estado,amountArs:row.amount_ars,
   ...(seguimientoUrl?{seguimientoUrl}:{}),
   uploadAuthorized:estado==='pagado_esperando_archivo',
   filesUploaded:false,productionAuthorized:false});
 }
 if(row.status!=='awaiting_payment')
  return reply({ok:false,error:'R2_PREPAGO_YA_PAGADO_O_CANCELADO'},409);
 // La solicitud de comprobación de cuenta real sigue en /demo/checkout.
 // Evitar cualquier transferencia con el mismo pedido.
 const transfers=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'"
 ).first();
 if(transfers){
  const t=await env.DB.prepare('SELECT order_id FROM transfer_requests WHERE order_id=?')
   .bind(row.id).first();
  if(t)return reply({ok:false,error:'R2_PREPAGO_TRANSFERENCIA_EN_CURSO'},409);
 }
 // La clave existente de Central ya se verifica por coincidencia exacta en
 // /demo/checkout. No exigir otra longitud solo para R2: cortaba un
 // checkout autorizado sin mejorar la autenticación del endpoint.
 if(typeof dispatch!=='function'||typeof env.DEMO_ADMIN_KEY!=='string'||
    env.DEMO_ADMIN_KEY.length===0)
  return reply({ok:false,error:'R2_PREPAGO_PASARELA_NO_CONFIGURADA'},503);
 const payment=await dispatch(new Request(new URL('/demo/checkout',request.url),{
  method:'POST',headers:{'Authorization':'Bearer '+env.DEMO_ADMIN_KEY,
   'Content-Type':'application/json'},body:JSON.stringify({order_id:row.id})
 }));
 if(!payment.ok)return reply({ok:false,error:'R2_PREPAGO_CHECKOUT_RECHAZADO'},payment.status);
 const x=await payment.json().catch(()=>null);
 let u;try{u=new URL(x?.checkout_url)}catch{}
 if(x?.order_id!==row.id||!u||u.protocol!=='https:'||
    !/(^|\.)mercadopago\.com(\.ar)?$/.test(u.hostname)||
    u.username||u.password||u.hash)
  return reply({ok:false,error:'R2_PREPAGO_ENLACE_INSEGURO'},502);
 return reply({ok:true,webOrderId:p.webOrderId,
  commercialOrderId:row.id,amountArs:row.amount_ars,
  checkoutUrl:u.href,estado:'pendiente',uploadAuthorized:false,
  filesUploaded:false,productionAuthorized:false});
}
