/** Recuperación manual de pagos LIVE: solo personal Basic + puente HMAC.
 * Nunca crea cobros, preferencias ni pedidos. Solo consulta a Mercado Pago,
 * coteja vendedor/referencias/importes y registra en D1 un pago ya aprobado.
 */
import {compuertaMPProduccion,cotejarPagoRealMP} from '../../publicacion/mercadopago-live-preflight.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const reply=(value,status=200)=>Response.json(value,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
const numeric=x=>/^[1-9]\d{3,19}$/.test(String(x??''));
const uuid=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(x||''));
function gate(env){
 return compuertaMPProduccion(env)&&env?.CENTRAL_LIVE_BRIDGE_ENABLED===GO&&
  env?.CENTRAL_LIVE_ORDER_GATE===GO&&env?.CENTRAL_LIVE_POSTPAY_GATE===GO&&
  typeof env?.DB?.prepare==='function'&&typeof env?.DB?.batch==='function';
}
async function getMP(env,path,fetcher){
 if(!/^(\/users\/me|\/v1\/payments\/[1-9][0-9]{3,19}|\/v1\/payments\/search\?external_reference=[a-f0-9-]{36}&status=approved&limit=10|\/merchant_orders\/[1-9][0-9]{3,19}|\/merchant_orders\/search\?preference_id=[a-zA-Z0-9-]{16,150})$/.test(path))
  throw Error('RUTA_MP_NO_ADMITIDA');
 // El recurso /users/me es de Mercado Libre; su host oficial es
 // api.mercadolibre.com, no el host de Payments API de Mercado Pago.
 const endpoint=path==='/users/me'?
  'https://api.mercadolibre.com/users/me':'https://api.mercadopago.com'+path;
 const r=await fetcher(endpoint,{
  method:'GET',redirect:'manual',
  headers:{Authorization:'Bearer '+env.MP_LIVE_ACCESS_TOKEN,
   'Content-Type':'application/json',Accept:'application/json'},
  signal:AbortSignal.timeout(12000)
 });
 if(!r.ok)throw Error('MP_CONSULTA_'+r.status);
 return r.json();
}
export function pagoUnicoDeOrdenComerciante(search,order){
 const matching=(Array.isArray(search?.elements)?search.elements:[]).filter(x=>
  x&&numeric(x.id)&&String(x.preference_id)===String(order.preference_id)&&
  x.external_reference===order.id);
 // Nunca seleccionar un pago arbitrariamente cuando haya varias órdenes o pagos.
 if(matching.length!==1)return null;
 const merchant=matching[0];
 const approved=(Array.isArray(merchant.payments)?merchant.payments:[]).filter(p=>
  numeric(p?.id)&&p.status==='approved');
 if(approved.length!==1)return null;
 return {merchantId:String(merchant.id),paymentId:String(approved[0].id)};
}
/** Búsqueda oficial de MP por external_reference; no depender sólo de Merchant Orders.
 * Nunca aceptar resultados cuyo ID, estado y referencia no sean inequívocos.
 */
export function pagoUnicoDeBusqueda(search,order){
 const rows=Array.isArray(search?.results)?search.results:[];
 const approved=rows.filter(x=>x&&numeric(x.id)&&x.status==='approved'&&
  x.external_reference===order.id&&numeric(x.order?.id));
 if(approved.length!==1)return null;
 return {paymentId:String(approved[0].id),merchantId:String(approved[0].order.id)};
}
async function procesarUna(env,order,seller,fetcher){
 if(!uuid(order.id)||order.status!=='awaiting_payment'||order.payment_id!=null||
   !order.preference_id||!Number.isSafeInteger(order.amount_ars)||order.amount_ars<=0||
   order.deposit_ars!==order.amount_ars||order.review_state==='revoked')
  return 'revision';
 const paymentSearchPath='/v1/payments/search?external_reference='+order.id+'&status=approved&limit=10';
 const search=await getMP(env,paymentSearchPath,fetcher);
 let match=pagoUnicoDeBusqueda(search,order);
 if(!match){
  // Respaldo sólo cuando no existe un pago aprobado único en la búsqueda principal.
  const qp=new URLSearchParams({preference_id:order.preference_id}).toString();
  const merchantSearch=await getMP(env,'/merchant_orders/search?'+qp,fetcher);
  match=pagoUnicoDeOrdenComerciante(merchantSearch,order);
 }
 if(!match)return 'sin_confirmar';
 const [payment,merchantOrder]=await Promise.all([
  getMP(env,'/v1/payments/'+match.paymentId,fetcher),
  getMP(env,'/merchant_orders/'+match.merchantId,fetcher)
 ]);
 const check=cotejarPagoRealMP({payment,merchantOrder,seller,order,sellerId:env.MP_LIVE_SELLER_ID});
 if(!check.verified||String(payment.id)!==match.paymentId)return 'revision';
 const duplicate=await env.DB.prepare('SELECT id FROM orders WHERE payment_id=? AND id<>?')
  .bind(match.paymentId,order.id).first();
 if(duplicate)return 'revision';
 const update=env.DB.prepare(
  "UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') "+
  "WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL AND preference_id=?"
 ).bind(match.paymentId,order.id,order.preference_id);
 const review=env.DB.prepare(
  "INSERT INTO payment_reviews(order_id,state,checked_at) "+
  "SELECT id,'verified',datetime('now') FROM orders WHERE id=? AND status='paid' AND payment_id=? "+
  "ON CONFLICT(order_id) DO UPDATE SET "+
  "state=CASE WHEN payment_reviews.state='revoked' THEN 'revoked' ELSE 'verified' END,"+
  "checked_at=datetime('now')"
 ).bind(order.id,match.paymentId);
 const result=await env.DB.batch([update,review]);
 if(result?.[0]?.meta?.changes===1&&result?.[1]?.meta?.changes===1)return 'recuperado';
 const latest=await env.DB.prepare(
  "SELECT o.status,o.payment_id,r.state FROM orders o LEFT JOIN payment_reviews r ON r.order_id=o.id WHERE o.id=?"
 ).bind(order.id).first();
 if(latest?.status==='paid'&&String(latest.payment_id)===match.paymentId&&latest.state==='verified')
  return 'ya_conciliado';
 return 'revision';
}
/** Conciliación programada: sólo órdenes pendientes con vínculo D1 y pago MP confirmado.
 * Idempotente; no solicita cobros. Ejecutable únicamente dentro de saber-pagos-produccion.
 */
export async function conciliarPendientesMPLiveAutomatico(env,{fetcher=fetch}={}){
 if(!gate(env))return {ok:false,error:'RESCATE_NO_HABILITADO'};
 let orders;
 try{
  const q=await env.DB.prepare(
   "SELECT o.id,o.status,o.amount_ars,o.deposit_ars,o.preference_id,o.payment_id,"+
   "r.state AS review_state FROM orders o "+
   "LEFT JOIN payment_reviews r ON r.order_id=o.id "+
   "JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id "+
   "WHERE o.status='awaiting_payment' AND o.preference_id IS NOT NULL "+
   "AND o.payment_id IS NULL AND o.amount_ars=o.deposit_ars "+
   "AND datetime(o.created_at)>=datetime('now','-7 days') "+
   "ORDER BY o.created_at DESC LIMIT 10"
  ).all();
  orders=q?.results||[];
  if(!Array.isArray(orders))throw Error('D1_RESPUESTA_INVALIDA');
 }catch{return {ok:false,error:'RESCATE_D1_NO_DISPONIBLE'}}
 if(!orders.length)return {ok:true,revisados:0,recuperados:0,pendientes:0,enRevision:0,errores:0};
 let seller;
 try{seller=await getMP(env,'/users/me',fetcher)}
 catch(error){
  const code=String(error?.message||'');
  const kind=error?.name;
  const reason=/^MP_CONSULTA_[0-9]{3}$/.test(code)?'RESCATE_'+code:
   code==='RUTA_MP_NO_ADMITIDA'?'RESCATE_MP_RUTA_NO_ADMITIDA':
   kind==='TimeoutError'||kind==='AbortError'?'RESCATE_VENDEDOR_TIMEOUT':
   kind==='SyntaxError'?'RESCATE_VENDEDOR_JSON_INVALIDO':
   kind==='TypeError'?'RESCATE_VENDEDOR_TYPE_ERROR':
   'RESCATE_VENDEDOR_EXCEPCION';
  return {ok:false,error:reason};
 }
 if(String(seller?.id)!==String(env.MP_LIVE_SELLER_ID))
  return {ok:false,error:'RESCATE_VENDEDOR_ID_DIFERENTE'};
 if(seller.test_user===true||(Array.isArray(seller?.tags)&&seller.tags.includes('test_user')))
  return {ok:false,error:'RESCATE_VENDEDOR_CUENTA_TEST'};
 const totals={recuperado:0,ya_conciliado:0,sin_confirmar:0,revision:0,error:0};
 // Concurrencia acotada; cada orden se valida y persiste de forma individual.
 for(let i=0;i<orders.length;i+=2){
  const outcomes=await Promise.all(orders.slice(i,i+2).map(async o=>
   procesarUna(env,o,seller,fetcher).catch(()=> 'error')));
  for(const outcome of outcomes)totals[outcome]=(totals[outcome]||0)+1;
 }
 return {ok:true,revisados:orders.length,
  recuperados:totals.recuperado,yaConciliados:totals.ya_conciliado,
  pendientes:totals.sin_confirmar,enRevision:totals.revision,errores:totals.error};
}

export async function rescatarPagosMPLiveCentral(request,env,{
 readSigned,fetcher=fetch
}={}){
 if(!gate(env))return reply({ok:false,error:'RESCATE_NO_HABILITADO'},503);
 if(request.method!=='POST'||typeof readSigned!=='function')
  return reply({ok:false,error:'RESCATE_FIRMA_REQUERIDA'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'RESCATE_HMAC'},signed.status||401);
 if(signed.payload?.schema!=='saber-central-live-staff-reconcile-v1'||
  signed.payload?.purpose!=='revisar-cobros-pendientes')
  return reply({ok:false,error:'RESCATE_PARAMETROS'},422);
 const result=await conciliarPendientesMPLiveAutomatico(env,{fetcher});
 return reply(result,result.ok?200:503);
}
