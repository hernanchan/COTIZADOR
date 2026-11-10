/**
 * Checkout Pro LIVE aislado. Sin una compuerta producción completa responde 503;
 * no reutiliza token, webhook, D1 ni preferencias de Mercado Pago Sandbox.
 * Solo invocable por HMAC interno (checkout) o webhook MP firmado (conciliación).
 */
import {compuertaMPProduccion,cotejarPagoRealMP}
 from '../../publicacion/mercadopago-live-preflight.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const PAYMENT=/^[1-9][0-9]{3,19}$/;
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
function urlSegura(value,kind){
 let u;try{u=new URL(value)}catch{return false}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
 if(kind==='mp')return /(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(u.hostname);
 if(kind==='webhook')return (u.hostname==='pagos.libreriasaber.com.ar'||
  u.hostname==='libreriasaber.com.ar')&&
  u.pathname==='/webhooks/mercadopago-live'&&!u.search;
 return ['libreriasaber.com.ar','www.libreriasaber.com.ar'].includes(u.hostname)&&
  /^\/(pedido|seguimiento)(\/|$)/.test(u.pathname)&&!u.search;
}
const productionOn=env=>compuertaMPProduccion(env)&&
  typeof env?.DB?.prepare==='function'&&
  typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32&&
  env.CENTRAL_BRIDGE_KEY!==env.MP_LIVE_WEBHOOK_SECRET&&
  env.MP_LIVE_ACCESS_TOKEN!==env.MP_TEST_ACCESS_TOKEN&&
  urlSegura(env.MP_LIVE_WEBHOOK_URL,'webhook')&&
  urlSegura(env.MP_LIVE_RETURN_URL,'return');
async function mpLive(env,path,{fetcher=fetch,method='GET',body=null,headers={}}={}){
 if(!/^\/(users\/me|v1\/payments\/[0-9]+|merchant_orders\/[0-9]+|checkout\/preferences(?:\/[a-zA-Z0-9-]+|\/search\?[^#]*)?)$/.test(path))
  throw Error('MP_LIVE_RUTA_PROHIBIDA');
 const r=await fetcher('https://api.mercadopago.com'+path,{
  method,redirect:'error',signal:AbortSignal.timeout(15000),
  headers:{Authorization:'Bearer '+env.MP_LIVE_ACCESS_TOKEN,
   'Content-Type':'application/json',...headers},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!r.ok)throw Error('MP_LIVE_HTTP_'+r.status);
 return r.json();
}
async function sellerLive(env,fetcher){
 const seller=await mpLive(env,'/users/me',{fetcher});
 if(String(seller.id)!==String(env.MP_LIVE_SELLER_ID)||
    Array.isArray(seller.tags)&&seller.tags.includes('test_user'))
  throw Error('MP_LIVE_VENDEDOR_INCORRECTO');
 return seller;
}
async function datosPedido(env,id){
 const order=await env.DB.prepare('SELECT id,description,amount_ars,deposit_ars,status,preference_id,payment_id,created_at FROM orders WHERE id=?').bind(id).first();
 if(!order||!Number.isSafeInteger(order.amount_ars)||order.amount_ars<1||
   order.deposit_ars!==order.amount_ars)return null;
 const rows=(await env.DB.prepare('SELECT line_total_ars,quantity,unit_price_ars FROM order_items WHERE order_id=? ORDER BY line_number').bind(id).all()).results||[];
 if(rows.length<1||rows.length>100||!rows.every(x=>
   Number.isSafeInteger(x.quantity)&&x.quantity>0&&
   Number.isSafeInteger(x.unit_price_ars)&&x.unit_price_ars>0&&
   x.quantity*x.unit_price_ars===x.line_total_ars)||
   rows.reduce((sum,x)=>sum+x.line_total_ars,0)!==order.amount_ars)return null;
 return order;
}
async function enlacePedido(env,id,webOrderId){
 const r=await env.DB.prepare('SELECT commercial_order_id FROM central_r2_universal_order_links WHERE web_order_id=? AND commercial_order_id=?').bind(webOrderId,id).first();
 if(r)return true;
 const m=await env.DB.prepare('SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=? AND commercial_order_id=?').bind(webOrderId,id).first();
 return Boolean(m);
}
async function verificarPref(env,order,id,{fetcher}){
 const [seller,pref]=await Promise.all([
  sellerLive(env,fetcher),
  mpLive(env,'/checkout/preferences/'+encodeURIComponent(id),{fetcher})
 ]);
 const items=pref.items||[];
 if(String(pref.id)!==String(id)||String(pref.collector_id)!==String(seller.id)||
  pref.external_reference!==order.id||items.length!==1||
  items[0].currency_id!=='ARS'||Number(items[0].quantity)!==1||
  Number(items[0].unit_price)!==order.amount_ars||
  !urlSegura(pref.init_point,'mp'))
  throw Error('MP_LIVE_PREFERENCIA_INCOMPATIBLE');
 return pref.init_point;
}
export async function checkoutMPLiveCentral(request,env,{
 readSigned,fetcher=fetch,now=()=>Date.now()
}={}){
 if(!productionOn(env))return reply({ok:false,error:'MP_LIVE_GATE_CERRADO'},503);
 if(request.method!=='POST'||typeof readSigned!=='function')
  return reply({ok:false,error:'MP_LIVE_FIRMA_OBLIGATORIA'},403);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'MP_LIVE_HMAC_INCORRECTO'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='commercialOrderId,schema,webOrderId'||
    p.schema!=='saber-mp-live-checkout-v1'||
    !UUID.test(p.commercialOrderId||'')||!WEB.test(p.webOrderId||''))
  return reply({ok:false,error:'MP_LIVE_PEDIDO_INVALIDO'},422);
 const order=await datosPedido(env,p.commercialOrderId);
 if(!order||order.status!=='awaiting_payment'||!await enlacePedido(env,order.id,p.webOrderId))
  return reply({ok:false,error:'MP_LIVE_ORDEN_NO_COBRABLE'},409);
 const age=now()-Date.parse(String(order.created_at).replace(' ','T')+'Z');
 if(!Number.isFinite(age)||age<0||age>=86400000)
  return reply({ok:false,error:'MP_LIVE_COTIZACION_VENCIDA'},409);
 const transferTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
 if(transferTable&&await env.DB.prepare('SELECT order_id FROM transfer_requests WHERE order_id=?').bind(order.id).first())
  return reply({ok:false,error:'MP_LIVE_TRANSFERENCIA_PENDIENTE'},409);
 try{
  if(order.preference_id){
   const checkout=await verificarPref(env,order,order.preference_id,{fetcher});
   return reply({ok:true,orderId:order.id,amountArs:order.amount_ars,checkoutUrl:checkout,reused:true});
  }
  // Exclusión de pestañas concurrentes; un intento remoto jamás se reintenta a ciegas.
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS live_checkout_locks(order_id TEXT PRIMARY KEY,expires_at TEXT NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS live_checkout_attempts(order_id TEXT PRIMARY KEY,started_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  const lock=await env.DB.prepare("INSERT INTO live_checkout_locks(order_id,expires_at) VALUES(?,datetime('now','+90 seconds')) ON CONFLICT(order_id) DO UPDATE SET expires_at=excluded.expires_at WHERE live_checkout_locks.expires_at<datetime('now')").bind(order.id).run();
  if(!lock.meta?.changes)return reply({ok:false,error:'MP_LIVE_CHECKOUT_EN_PREPARACION'},409);
  try{
   const check=await env.DB.prepare('SELECT status,preference_id FROM orders WHERE id=?').bind(order.id).first();
   if(check?.status!=='awaiting_payment')return reply({ok:false,error:'MP_LIVE_ESTADO_CAMBIO'},409);
   if(check.preference_id){
    const checkout=await verificarPref(env,order,check.preference_id,{fetcher});
    return reply({ok:true,orderId:order.id,amountArs:order.amount_ars,checkoutUrl:checkout,reused:true});
   }
   const attempt=await env.DB.prepare('INSERT OR IGNORE INTO live_checkout_attempts(order_id) VALUES(?)').bind(order.id).run();
   let prefId;
   if(attempt.meta?.changes){
    await sellerLive(env,fetcher); // no crear preferencia con vendedor de pruebas
    const pref=await mpLive(env,'/checkout/preferences',{fetcher,method:'POST',
     headers:{'X-Idempotency-Key':order.id},
     body:{items:[{id:order.id,title:String(order.description||'Librería Saber').slice(0,120),
      quantity:1,currency_id:'ARS',unit_price:order.amount_ars}],
      external_reference:order.id,
      notification_url:env.MP_LIVE_WEBHOOK_URL,
      back_urls:{success:env.MP_LIVE_RETURN_URL,pending:env.MP_LIVE_RETURN_URL,
       failure:env.MP_LIVE_RETURN_URL},
      expires:true,expiration_date_to:new Date(now()+Math.max(1000,86400000-age)).toISOString(),
      metadata:{purpose:'libreria_saber_produccion',payment_mode:'full'}}
    });
    prefId=pref.id;
   }else{
    const found=await mpLive(env,'/checkout/preferences/search?'+new URLSearchParams({external_reference:order.id}),{fetcher});
    const exact=(found.elements||[]).filter(x=>x.external_reference===order.id&&x.id);
    if(exact.length!==1)return reply({ok:false,error:'MP_LIVE_RECONCILIACION_MANUAL'},409);
    prefId=exact[0].id;
   }
   if(typeof prefId!=='string'||!prefId||prefId.length>150)
    return reply({ok:false,error:'MP_LIVE_PREFERENCIA_SIN_ID'},502);
   const checkout=await verificarPref(env,order,prefId,{fetcher});
   const updated=await env.DB.prepare("UPDATE orders SET preference_id=? WHERE id=? AND preference_id IS NULL AND status='awaiting_payment'").bind(prefId,order.id).run();
   if(!updated.meta?.changes){
    const stored=await env.DB.prepare('SELECT preference_id FROM orders WHERE id=?').bind(order.id).first();
    if(stored?.preference_id!==prefId)return reply({ok:false,error:'MP_LIVE_PREFERENCIA_CONFLICTO'},409);
   }
   return reply({ok:true,orderId:order.id,amountArs:order.amount_ars,checkoutUrl:checkout,reused:!attempt.meta?.changes});
  }finally{await env.DB.prepare('DELETE FROM live_checkout_locks WHERE order_id=?').bind(order.id).run()}
 }catch{
  return reply({ok:false,error:'MP_LIVE_CHECKOUT_NO_VERIFICADO'},503);
 }
}
async function webhookFirmaValida(request,url,secret,{now=()=>Date.now(),subtle=crypto.subtle}={}){
 const parts=Object.fromEntries((request.headers.get('x-signature')||'').split(',').map(s=>{
  const i=s.indexOf('=');return i<0?['','']:[s.slice(0,i).trim(),s.slice(i+1).trim()]}));
 const id=url.searchParams.get('data.id'),rid=request.headers.get('x-request-id'),ts=parts.ts,hash=parts.v1;
 if(!PAYMENT.test(id||'')||!rid||rid.length>150||!/^[0-9]{10,13}$/.test(ts||'')||!/^[a-f0-9]{64}$/i.test(hash||''))return false;
 const ms=Number(ts)*(ts.length===13?1:1000);
 if(!Number.isFinite(ms)||Math.abs(now()-ms)>15*60000)return false;
 const key=await subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const got=new Uint8Array(await subtle.sign('HMAC',key,new TextEncoder().encode('id:'+id.toLowerCase()+';request-id:'+rid+';ts:'+ts+';')));
 const expected=new Uint8Array(32);
 for(let i=0;i<32;i++)expected[i]=parseInt(hash.slice(i*2,i*2+2),16);
 let diff=0;for(let i=0;i<32;i++)diff|=got[i]^expected[i];
 return diff===0;
}
export async function conciliarWebhookMPLive(request,env,{
 fetcher=fetch,now=()=>Date.now(),subtle=crypto.subtle
}={}){
 if(!productionOn(env))return reply({ok:false,error:'MP_LIVE_GATE_CERRADO'},503);
 if(request.method!=='POST')return reply({ok:false,error:'MP_LIVE_METODO'},405);
 const url=new URL(request.url);
 if(url.pathname!=='/webhooks/mercadopago-live'||
  !await webhookFirmaValida(request,url,env.MP_LIVE_WEBHOOK_SECRET,{now,subtle}))
  return reply({ok:false,error:'MP_LIVE_WEBHOOK_FIRMA'},401);
 const body=await request.json().catch(()=>null);
 if(body?.type!=='payment'||String(body?.data?.id)!==url.searchParams.get('data.id'))
  return reply({received:true,ignored:true});
 const id=url.searchParams.get('data.id');
 try{
  const [pay,seller]=await Promise.all([
   mpLive(env,'/v1/payments/'+id,{fetcher}),sellerLive(env,fetcher)]);
  if(String(pay.id)!==id||!UUID.test(pay.external_reference||''))
   return reply({received:true,registered:false,reason:'referencia_invalida'});
  const order=await env.DB.prepare(
   'SELECT o.id,o.amount_ars,o.deposit_ars,o.status,o.preference_id,o.payment_id,r.state AS review_state FROM orders o LEFT JOIN payment_reviews r ON r.order_id=o.id WHERE o.id=?'
  ).bind(pay.external_reference).first();
  if(!order)return reply({received:true,registered:false,reason:'orden_no_encontrada'});
  if(order.status==='paid'&&String(order.payment_id)===id&&
     (pay.status!=='approved'||Number(pay.transaction_amount_refunded||0)>0)){
    await env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'revoked',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET state='revoked',checked_at=datetime('now')").bind(order.id).run();
    return reply({received:true,registered:false,reason:'pago_revocado'});
  }
  if(order.review_state==='revoked')return reply({received:true,registered:false,reason:'pago_revocado'});
  if(!PAYMENT.test(String(pay.order?.id||'')))
   return reply({received:true,registered:false,reason:'merchant_order_missing'});
  const merchantOrder=await mpLive(env,'/merchant_orders/'+pay.order.id,{fetcher});
  const verified=cotejarPagoRealMP({payment:pay,merchantOrder,seller,order,sellerId:env.MP_LIVE_SELLER_ID});
  if(!verified.verified)return reply({received:true,registered:false,reason:verified.reason});
  const duplicate=await env.DB.prepare('SELECT id FROM orders WHERE payment_id=? AND id<>?').bind(id,order.id).first();
  if(duplicate)return reply({received:true,registered:false,reason:'pago_duplicado'});
  if(order.status==='paid')return reply({received:true,registered:true,idempotent:true});
  const update=await env.DB.prepare("UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL AND preference_id=?").bind(id,order.id,order.preference_id);
  const review=await env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'verified',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET state=CASE WHEN payment_reviews.state='revoked' THEN 'revoked' ELSE 'verified' END,checked_at=datetime('now')").bind(order.id);
  const rows=await env.DB.batch([update,review]); // transacción D1
  return reply({received:true,registered:Boolean(rows?.[0]?.meta?.changes)});
 }catch{
  return reply({ok:false,error:'MP_LIVE_RECONCILIACION_PENDIENTE'},503);
 }
}
