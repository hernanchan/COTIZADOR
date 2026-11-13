/** R2 LIVE: permiso de etapa preliminar exclusivamente después de cobro D1.
 * NO reserva ni crea objetos. La ruta requiere HMAC y no concede subida.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal}
 from './r2-universal-checkout-central.mjs';
import {r2GateGeneralOCanary} from './r2-live-canary-order.mjs';
import {puedeRecibirTransferenciaAvisada} from './central-transferencia-recepcion-anticipada.mjs';
const G='GO_COMERCIAL_CONFIRMADO',M=1048576;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const respond=(value,status=200)=>Response.json(value,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function autorizarOriginalR2Live(request,env,{readSigned,subtle=crypto.subtle}={}){
 const active=env?.SABER_ENTORNO==='produccion'&&
  env?.CENTRAL_DB_ENV==='produccion'&&env?.MP_LIVE_GATE===G&&
  env?.CENTRAL_LIVE_BRIDGE_ENABLED===G&&
  env?.CENTRAL_LIVE_POSTPAY_GATE===G&&
  (env?.CENTRAL_LIVE_R2_GATE===G||
   env?.CENTRAL_R2_CANARY_MODE==='SOLO_PEDIDO_R2_CONTROLADO')&&
  env?.CENTRAL_LIVE_ORDER_GATE===G&&
  env?.CENTRAL_LIVE_PRICING_GATE===G&&
  env?.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY';
 if(!active||typeof env?.DB?.prepare!=='function')
  return respond({ok:false,error:'LIVE_R2_OFF',uploadAuthorized:false},503);
 if(typeof readSigned!=='function')return respond({ok:false,error:'LIVE_R2_FIRMA_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return respond({ok:false,error:'LIVE_R2_HMAC',uploadAuthorized:false},
  signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='bytes,fileId,name,orderId,pages,schema,sha256'||
  p.schema!=='saber-central-r2-universal-live-gate-v1'||
  !WEB.test(p.orderId||'')||!ID.test(p.fileId||'')||
  !SHA.test(p.sha256||'')||typeof p.name!=='string'||
  p.name.length<1||p.name.length>120||!p.name.toLowerCase().endsWith('.pdf')||
  !Number.isSafeInteger(p.bytes)||p.bytes<=40*M||p.bytes>200*M||
  !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000)
  return respond({ok:false,error:'LIVE_R2_FICHA_INVALIDA',uploadAuthorized:false},422);
 if(!r2GateGeneralOCanary(env,p.orderId,['CENTRAL_LIVE_R2_GATE']))
  return respond({ok:false,error:'LIVE_R2_ORDEN_NO_HABILITADA',uploadAuthorized:false},503);
 let result,paid,mode,expectedMetrics,bankPending=false;
 try{
  const link=await env.DB.prepare(
   'SELECT commercial_order_id FROM central_r2_universal_order_links WHERE web_order_id=?'
  ).bind(p.orderId).first();
  if(!link)return respond({ok:false,error:'LIVE_R2_NO_ORDEN',uploadAuthorized:false},404);
  result=await verificarPedidoUniversalCobrable(env,link.commercial_order_id,{
   webOrderId:p.orderId,subtle});
  if(!result.ok)return respond({ok:false,error:'LIVE_R2_FICHA_D1',uploadAuthorized:false},409);
  const entries=result.rows.filter(x=>x.file_id===p.fileId&&
   x.transport==='r2'&&x.name===p.name&&x.sha256===p.sha256&&
   x.bytes===p.bytes&&x.received===0);
  const work=result.works.find(x=>x.fileId===p.fileId);
  if(entries.length!==1||!work||!Array.isArray(work.configuracion?.paginas)||
    work.configuracion.paginas.length!==p.pages||
    !['bn','color'].includes(work.configuracion.modo)||
    work.configuracion.paginas.some((page,i)=>page.numero!==i+1||
      !Number.isFinite(page.anchoCm)||!Number.isFinite(page.altoCm)||
      page.anchoCm<=0||page.altoCm<=0))
   return respond({ok:false,error:'LIVE_R2_ARCHIVO_NO_COINCIDE',uploadAuthorized:false},409);
  mode=work.configuracion.modo;
  expectedMetrics=work.configuracion.paginas.map(x=>({
   anchoCm:x.anchoCm,altoCm:x.altoCm
  }));
  paid=await estadoPagoUniversal(env,link.commercial_order_id);
  if(!paid.verified&&!paid.revoked)
   bankPending=await puedeRecibirTransferenciaAvisada(env,{
    commercialOrderId:link.commercial_order_id,webOrderId:p.orderId});
  if(paid.revoked||(!paid.verified&&!bankPending))
   return respond({ok:false,error:'LIVE_R2_PAGO_O_AVISO_NO_VALIDO',uploadAuthorized:false},402);
 }catch{return respond({ok:false,error:'LIVE_R2_D1_INDISPONIBLE',uploadAuthorized:false},503)}
 return respond({ok:true,webOrderId:p.orderId,fileId:p.fileId,
  sha256:p.sha256,bytes:p.bytes,pages:p.pages,transport:'r2',
  mode,expectedMetrics,
  paymentVerified:paid.verified===true,bankPending,uploadAuthorized:false,productionAuthorized:false,
  next:'reserve-capacity-before-multipart'});
}
