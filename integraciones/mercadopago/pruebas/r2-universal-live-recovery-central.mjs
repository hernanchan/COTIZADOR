/** Consulta recuperación R2 universal pagado. Solo D1, sin cuotas ni escrituras.
 * Un cliente con orden pagada nunca inicia nuevo multipart si ya hay reserva.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal}
 from './r2-universal-checkout-central.mjs';
import {r2GateGeneralOCanary} from './r2-live-canary-order.mjs';
import {puedeRecibirTransferenciaAvisada} from './central-transferencia-recepcion-anticipada.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function consultarRecuperacionR2Live(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
  env?.CENTRAL_LIVE_POSTPAY_GATE!==GO||
  (env?.CENTRAL_LIVE_R2_GATE!==GO&&
   env?.CENTRAL_R2_CANARY_MODE!=='SOLO_PEDIDO_R2_CONTROLADO')||
  env?.CENTRAL_LIVE_ORDER_GATE!==GO||typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'LIVE_R2_RECOVERY_OFF'},503);
 if(typeof readSigned!=='function')return reply({ok:false,error:'LIVE_R2_RECOVERY_HMAC_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'LIVE_R2_RECOVERY_HMAC'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='bytes,fileId,name,orderId,pages,schema,sha256'||
  p.schema!=='saber-central-r2-universal-recovery-v1'||
  !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.orderId||'')||
  !/^[A-Za-z0-9_-]{1,80}$/.test(p.fileId||'')||
  !/^[a-f0-9]{64}$/.test(p.sha256||'')||
  typeof p.name!=='string'||p.name.length<1||p.name.length>120||
  !p.name.toLowerCase().endsWith('.pdf')||
  !Number.isSafeInteger(p.bytes)||p.bytes<=40*MIB||p.bytes>200*MIB||
  !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000)
  return reply({ok:false,error:'LIVE_R2_RECOVERY_FICHA'},422);
 if(!r2GateGeneralOCanary(env,p.orderId,['CENTRAL_LIVE_R2_GATE']))
  return reply({ok:false,error:'LIVE_R2_RECOVERY_ORDEN_NO_HABILITADA'},503);
 try{
  const db=env.DB;
  const link=await db.prepare(
   'SELECT commercial_order_id FROM central_r2_universal_order_links WHERE web_order_id=?'
  ).bind(p.orderId).first();
  if(!link)return reply({ok:false,error:'LIVE_R2_RECOVERY_ORDEN'},404);
  const verified=await verificarPedidoUniversalCobrable(env,link.commercial_order_id,{
   webOrderId:p.orderId,subtle});
  if(!verified.ok)return reply({ok:false,error:'LIVE_R2_RECOVERY_FICHA_D1'},409);
  const work=verified.works.find(x=>x.fileId===p.fileId);
  const row=verified.rows.find(x=>x.file_id===p.fileId);
  if(!work||!row||row.transport!=='r2'||row.received!==0||
     row.name!==p.name||row.sha256!==p.sha256||row.bytes!==p.bytes||
     work.configuracion?.paginas?.length!==p.pages)
   return reply({ok:false,error:'LIVE_R2_RECOVERY_ARCHIVO_AJENO'},409);
  const payment=await estadoPagoUniversal(env,link.commercial_order_id);
  const bankPending=!payment.verified&&!payment.revoked&&
   await puedeRecibirTransferenciaAvisada(env,{
    commercialOrderId:link.commercial_order_id,webOrderId:p.orderId});
  if(payment.revoked||(!payment.verified&&!bankPending))
   return reply({ok:false,error:'LIVE_R2_RECOVERY_PAGO_O_AVISO'},402);
  const reserve=await db.prepare(
   'SELECT object_key,web_order_id,file_id,sha256,bytes,state '+
   'FROM central_r2_large_reservations WHERE web_order_id=? AND file_id=?'
  ).bind(p.orderId,p.fileId).first();
  if(!reserve)return reply({ok:true,found:false,state:'not_started',
   webOrderId:p.orderId,fileId:p.fileId,uploadPossible:true,
   paymentVerified:payment.verified===true,bankPending,productionAuthorized:false});
  if(reserve.web_order_id!==p.orderId||reserve.file_id!==p.fileId||
     reserve.sha256!==p.sha256||reserve.bytes!==p.bytes||
     reserve.state!=='reserved'||
     !/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9-]{36}[.]pdf$/i.test(reserve.object_key||'')||
     !reserve.object_key.startsWith('r2-v1/'+p.orderId+'/'))
   return reply({ok:false,error:'LIVE_R2_RECOVERY_RESERVA_AJENA'},409);
  const staged=await db.prepare(
   'SELECT object_key,web_order_id,file_id,sha256,bytes,status '+
   'FROM central_r2_large_pending WHERE web_order_id=? AND file_id=?'
  ).bind(p.orderId,p.fileId).first();
  if(staged&&(staged.object_key!==reserve.object_key||
     staged.sha256!==p.sha256||staged.bytes!==p.bytes||
     staged.status!=='awaiting_pdf_analysis'))
   return reply({ok:false,error:'LIVE_R2_RECOVERY_STAGE_AJENO'},409);
  return reply({ok:true,found:true,state:staged?'staged':'reserved',
   webOrderId:p.orderId,fileId:p.fileId,
   sha256:p.sha256,bytes:p.bytes,objectKey:reserve.object_key,
   paymentVerified:payment.verified===true,bankPending,uploadPossible:false,productionAuthorized:false});
 }catch{return reply({ok:false,error:'LIVE_R2_RECOVERY_D1'},503)}
}
