/**
 * Mercado Pago SANDBOX: a single D1 order for a mixed TUS/R2 PDF batch.
 * Every approval is derived from signed Central D1 state, never a browser
 * boolean. R2 original stays local until verified payment.
 */
import {verificarFichaUniversal} from './r2-lote-universal-central.mjs';
import {UNIVERSAL_ORDER_SKU} from './r2-universal-order-central.mjs';
const FLAG='PRIVATE_TEST_ONLY';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const MIB=1048576;
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const enabled=env=>env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED===FLAG&&
 env.CENTRAL_R2_UNIVERSAL_ORDER_ENABLED===FLAG&&
 env.CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED===FLAG&&
 env.DOCS_SANDBOX_CHECKOUT_ENABLED===FLAG&&
 env.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED===FLAG;
const error=reason=>({ok:false,reason});
/** Full consistency gate shared by the direct /demo/checkout and signed API. */
export async function verificarPedidoUniversalCobrable(env,commercialOrderId,{
 webOrderId=null,subtle=crypto.subtle
}={}){
 if(!enabled(env)||!UUID.test(commercialOrderId||'')||
    (webOrderId!==null&&!WEB.test(webOrderId)))
  return error('UNIVERSAL_PAGO_DESHABILITADO');
 const db=env?.DB;
 if(typeof db?.prepare!=='function')return error('UNIVERSAL_D1_NO_DISPONIBLE');
 let link;
 try{
  link=await db.prepare('SELECT l.web_order_id,l.quote_hash,l.amount_ars,'+
   'd.draft_id,d.price_revision,d.total_ars,d.file_count,d.armados_json,d.state,'+
   'o.id,o.status,o.deposit_ars,o.amount_ars AS order_total,o.created_at,'+
   'o.paid_at,o.payment_id,o.preference_id '+
   'FROM central_r2_universal_order_links l '+
   'JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id '+
   'JOIN orders o ON o.id=l.commercial_order_id '+
   'WHERE l.commercial_order_id=? LIMIT 1').bind(commercialOrderId).first();
 }catch{return error('UNIVERSAL_TABLAS_NO_DISPONIBLES')}
 if(!link||!WEB.test(link.web_order_id)||webOrderId!==null&&link.web_order_id!==webOrderId||
    !SHA.test(link.quote_hash)||link.state!=='draft_not_payable'||
    !Number.isSafeInteger(link.amount_ars)||link.amount_ars<1||
    link.amount_ars!==link.total_ars||link.order_total!==link.amount_ars||
    link.deposit_ars!==link.amount_ars||!UUID.test(link.id||''))
  return error('UNIVERSAL_PEDIDO_D1_NO_COINCIDE');
 const items=await db.prepare(
  'SELECT sku,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json '+
  'FROM order_items WHERE order_id=? ORDER BY line_number').bind(link.id).all();
 const line=items.results||[];
 if(line.length!==1||line[0].sku!==UNIVERSAL_ORDER_SKU||
    line[0].quantity!==1||line[0].unit_price_ars!==link.amount_ars||
    line[0].line_total_ars!==link.amount_ars)
  return error('UNIVERSAL_LINEAS_INCONSISTENTES');
 const stored=await db.prepare('SELECT file_id,ordinal,name,sha256,bytes,transport,'+
  'service,work_json,received FROM central_r2_universal_files WHERE web_order_id=? '+
  'ORDER BY ordinal').bind(link.web_order_id).all();
 const rows=stored.results||[];
 if(rows.length!==link.file_count||rows.length<1||rows.length>10||
    rows.some((f,i)=>f.ordinal!==i||![0,1].includes(f.received)))
  return error('UNIVERSAL_ORIGINALES_INCONSISTENTES');
 let works,groups,detail,ids;
 try{
  works=rows.map((r,i)=>{
   const w=JSON.parse(r.work_json);
   if(w.fileId!==r.file_id||w.indice!==i||w.nombre!==r.name||
      w.sha256!==r.sha256||w.bytes!==r.bytes||
      w.transporte!==r.transport||w.destino!==r.service)
    throw Error('File inconsistent');
   return w;
  });
  groups=JSON.parse(link.armados_json);
  detail=JSON.parse(line[0].detail_json);
  ids=JSON.parse(line[0].file_references_json);
  const r2=works.filter(f=>f.transporte==='r2').length;
  if(detail.schema!=='saber-r2-universal-commercial-v1'||
     detail.webOrderId!==link.web_order_id||detail.quoteHash!==link.quote_hash||
     detail.priceRevision!==link.price_revision||detail.fileCount!==works.length||
     detail.r2Count!==r2||detail.tusCount!==works.length-r2||
     detail.armadosCount!==groups.length||
     detail.prepressPending!==true||detail.originalsReceived!==false||
     JSON.stringify(ids)!==JSON.stringify(works.map(f=>f.fileId)))
   throw Error('Order line inconsistent');
  await verificarFichaUniversal({
   schema:'saber-r2-universal-draft-v1',webOrderId:link.web_order_id,
   priceRevision:link.price_revision,totalArs:link.total_ars,
   archivos:works,armados:groups,pagoAutorizado:false,
   subidaAutorizada:false,produccionAutorizada:false,
   estado:'PRELIMINAR_SIN_ORIGINALES',
   quoteHash:link.quote_hash
  },{subtle});
 }catch{return error('UNIVERSAL_COTIZACION_FUERA_DE_CONTRATO')}
 return {ok:true,link,works,rows,commercialOrderId:link.id,
  webOrderId:link.web_order_id,amountArs:link.amount_ars};
}
async function estadoPagoUniversal(env,orderId,db=env.DB){
 const [fresh,review]=await Promise.all([
  db.prepare('SELECT status,paid_at,payment_id,preference_id,amount_ars,deposit_ars '+
   'FROM orders WHERE id=?').bind(orderId).first(),
  db.prepare('SELECT state FROM payment_reviews WHERE order_id=?').bind(orderId).first()
 ]);
 const verified=fresh?.status==='paid'&&Boolean(fresh.paid_at)&&
  fresh.deposit_ars===fresh.amount_ars&&review?.state==='verified'&&
  fresh.payment_id!==null&&fresh.payment_id!==undefined&&
  fresh.preference_id!==null&&fresh.preference_id!==undefined;
 return {fresh,verified,revoked:review?.state==='revoked'};
}
export async function checkoutUniversalSandboxCentral(request,env,{
 readSigned,dispatch,reconcile,now=()=>Date.now(),subtle=crypto.subtle
}={}){
 if(!enabled(env))return reply({ok:false,error:'UNIVERSAL_CHECKOUT_OFF'},503);
 if(typeof readSigned!=='function')return reply({ok:false,error:'UNIVERSAL_HMAC_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'UNIVERSAL_HMAC_INVALIDA'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='action,commercialOrderId,schema,webOrderId'||
    p.schema!=='saber-central-r2-universal-checkout-v1'||
    !['start','status'].includes(p.action)||
    !WEB.test(p.webOrderId||'')||!UUID.test(p.commercialOrderId||''))
  return reply({ok:false,error:'UNIVERSAL_PAGO_PARAMETROS'},422);
 const checked=await verificarPedidoUniversalCobrable(env,p.commercialOrderId,{
  webOrderId:p.webOrderId,subtle});
 if(!checked.ok)return reply({ok:false,error:checked.reason},409);
 const order=checked.link;
 const created=Date.parse(String(order.created_at||'').replace(' ','T')+'Z');
 if(!Number.isFinite(created)||created>now()+30000||now()-created>24*60*60*1000)
  return reply({ok:false,error:'UNIVERSAL_COTIZACION_VENCIDA'},409);
 if(p.action==='status'){
  if(order.status==='awaiting_payment'&&order.preference_id&&typeof reconcile==='function')
   await reconcile(env,order.id);
  const state=await estadoPagoUniversal(env,order.id);
  const current=state.revoked?'revocado':state.verified?
   'pagado_esperando_archivos':'pendiente';
  return reply({ok:true,webOrderId:p.webOrderId,
   commercialOrderId:order.id,amountArs:checked.amountArs,estado:current,
   fileCount:checked.works.length,
   pendingFiles:checked.rows.filter(r=>r.received===0).length,
   uploadAuthorized:state.verified,checkoutEnabled:false,
   productionAuthorized:false},200);
 }
 if(order.status!=='awaiting_payment')
  return reply({ok:false,error:'UNIVERSAL_ORDEN_YA_PROCESADA'},409);
 const transfers=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'"
 ).first();
 if(transfers){
  const row=await env.DB.prepare('SELECT order_id FROM transfer_requests WHERE order_id=?')
   .bind(order.id).first();
  if(row)return reply({ok:false,error:'UNIVERSAL_TRANSFERENCIA_EN_CURSO'},409);
 }
 if(typeof dispatch!=='function'||typeof env.DEMO_ADMIN_KEY!=='string'||
    env.DEMO_ADMIN_KEY.length<1)
  return reply({ok:false,error:'UNIVERSAL_PASARELA_NO_DISPONIBLE'},503);
 const checkout=await dispatch(new Request(new URL('/demo/checkout',request.url),{
  method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,
   'Content-Type':'application/json'},body:JSON.stringify({order_id:order.id})
 }));
 if(!checkout.ok)return reply({ok:false,error:'UNIVERSAL_MP_RECHAZADO'},checkout.status===409?409:503);
 const data=await checkout.json().catch(()=>null);
 let u;try{u=new URL(data?.checkout_url)}catch{}
 if(data?.order_id!==order.id||!u||u.protocol!=='https:'||
    !/(^|\.)mercadopago\.com(\.ar)?$/.test(u.hostname)||
    u.username||u.password||u.hash)
  return reply({ok:false,error:'UNIVERSAL_MP_URL_INVALIDA'},502);
 return reply({ok:true,webOrderId:p.webOrderId,
  commercialOrderId:order.id,amountArs:checked.amountArs,
  fileCount:checked.works.length,estado:'pendiente',checkoutUrl:u.href,
  uploadAuthorized:false,productionAuthorized:false},200);
}
/** HMAC-only file-scoped postpayment receipt consumed by existing R2 upload gate. */
export async function consultarPagoUniversalR2(request,env,{
 readSigned,now=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle
}={}){
 if(!enabled(env)||env.CENTRAL_R2_STAGING_ENABLED!==FLAG||
    env.CENTRAL_R2_QUOTA_ENABLED!==FLAG)
  return reply({ok:false,error:'UNIVERSAL_R2_POSTPAGO_OFF'},503);
 if(typeof readSigned!=='function')
  return reply({ok:false,error:'UNIVERSAL_R2_FIRMA_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'UNIVERSAL_R2_FIRMA_INVALIDA'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='bytes,fileId,orderId,schema,sha256'||
    p.schema!=='saber-central-r2-universal-payment-lookup-v1'||
    !WEB.test(p.orderId||'')||!FILE.test(p.fileId||'')||
    !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<=40*MIB||p.bytes>200*MIB)
  return reply({ok:false,error:'UNIVERSAL_R2_ARCHIVO_INVALIDO'},422);
 const related=await env.DB.prepare('SELECT commercial_order_id FROM central_r2_universal_order_links '+
  'WHERE web_order_id=?').bind(p.orderId).first();
 if(!UUID.test(related?.commercial_order_id||''))
  return reply({ok:false,error:'UNIVERSAL_R2_PEDIDO_NO_ENCONTRADO'},404);
 const checked=await verificarPedidoUniversalCobrable(env,related.commercial_order_id,{
  webOrderId:p.orderId,subtle});
 if(!checked.ok)return reply({ok:false,error:'UNIVERSAL_R2_FICHA_INCORRECTA'},409);
 const matches=checked.rows.filter(x=>x.file_id===p.fileId&&x.sha256===p.sha256&&
  x.bytes===p.bytes&&x.transport==='r2'&&[0,1].includes(x.received));
 if(matches.length!==1)return reply({ok:false,error:'UNIVERSAL_R2_ARCHIVO_NO_PENDIENTE'},409);
 const productionTable=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='central_production_status'"
 ).first();
 if(productionTable){
  const stage=await env.DB.prepare('SELECT state FROM central_production_status WHERE order_id=?')
   .bind(checked.commercialOrderId).first();
  if(stage?.state==='entregado')
   return reply({ok:false,error:'UNIVERSAL_R2_PEDIDO_YA_ENTREGADO'},409);
 }
 const pay=await estadoPagoUniversal(env,checked.commercialOrderId);
 if(!pay.verified)return reply({ok:false,error:'UNIVERSAL_R2_PAGO_NO_CONFIRMADO'},402);
 const verifiedAt=now();
 if(!Number.isSafeInteger(verifiedAt))
  return reply({ok:false,error:'UNIVERSAL_R2_HORA_INVALIDA'},503);
 const ref='MP-'+String(pay.fresh.payment_id);
 if(!/^[A-Za-z0-9_.:-]{5,160}$/.test(ref))
  return reply({ok:false,error:'UNIVERSAL_R2_PAGO_ID_INVALIDO'},409);
 return reply({ok:true,paymentAuthorizedForR2:true,productionAuthorized:false,
  receipt:{source:'CENTRAL_D1_RECONCILED',orderId:p.orderId,
   fileId:p.fileId,sha256:p.sha256,bytes:p.bytes,
   method:'mercadopago',authority:'MERCADOPAGO_API_RECONCILED',
   paymentState:'PAID_CONFIRMED',providerVerified:true,
   reversed:false,refunded:false,currency:'ARS',amountArs:checked.amountArs,
   paymentReference:ref,verifiedAt}},200);
}
