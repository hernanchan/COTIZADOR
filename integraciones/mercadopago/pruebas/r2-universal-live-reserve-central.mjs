/** Reserva R2 LIVE después de comprobar D1 y pago, SIN tocar bucket.
 * Guardas separadas de Sandbox; SQL atómico para impedir exceder cuota.
 */
import {autorizarOriginalR2Live} from './r2-universal-live-gate-central.mjs';
import {r2GateGeneralOCanary} from './r2-live-canary-order.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9-]{36})\.pdf$/i;
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const live=env=>env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'&&
 env?.MP_LIVE_GATE===GO&&env?.CENTRAL_LIVE_BRIDGE_ENABLED===GO&&
 env?.CENTRAL_LIVE_POSTPAY_GATE===GO&&
 (env?.CENTRAL_LIVE_R2_GATE===GO&&env?.CENTRAL_LIVE_R2_QUOTA_GATE===GO||
  env?.CENTRAL_R2_CANARY_MODE==='SOLO_PEDIDO_R2_CONTROLADO')&&
 env?.CENTRAL_LIVE_ORDER_GATE===GO&&
 env?.CENTRAL_LIVE_PRICING_GATE===GO&&
 env?.CENTRAL_R2_QUOTA_ENABLED!=='PRIVATE_TEST_ONLY'&&
 typeof env?.DB?.prepare==='function';
export async function reservarR2Live(request,env,{
 readSigned,verify=autorizarOriginalR2Live
}={}){
 if(!live(env))return reply({ok:false,error:'LIVE_R2_QUOTA_OFF'},503);
 if(typeof readSigned!=='function')return reply({ok:false,error:'LIVE_R2_QUOTA_HMAC'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'LIVE_R2_QUOTA_FIRMA'},signed.status||401);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='bytes,fileId,name,objectKey,orderId,pages,schema,sha256'||
  p.schema!=='saber-central-r2-universal-live-reserve-v1'||
  !Number.isSafeInteger(p.bytes)||p.bytes<=40*MIB||p.bytes>200*MIB||
  !UUID.test((KEY.exec(p.objectKey||'')||[])[2]||'')||
  !KEY.test(p.objectKey||'')||
  !p.objectKey.startsWith('r2-v1/'+p.orderId+'/'))
  return reply({ok:false,error:'LIVE_R2_QUOTA_FICHA'},422);
 if(!r2GateGeneralOCanary(env,p.orderId,
   ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE']))
  return reply({ok:false,error:'LIVE_R2_QUOTA_PEDIDO_NO_HABILITADO'},503);
 const gate={
  schema:'saber-central-r2-universal-live-gate-v1',
  orderId:p.orderId,fileId:p.fileId,sha256:p.sha256,
  name:p.name,bytes:p.bytes,pages:p.pages
 };
 // Revalidar autorización de pago y relación del PDF inmediatamente
 // antes del INSERT reservado. El permiso navegador no tiene valor.
 const pre=await verify(request,env,{
  readSigned:async()=>({payload:gate})});
 if(!pre?.ok)return pre;
 const proof=await pre.json();
 if(proof?.ok!==true||
    !(proof.paymentVerified===true||proof.bankPending===true&&proof.paymentVerified===false)||
    proof.webOrderId!==p.orderId||proof.fileId!==p.fileId||
    proof.sha256!==p.sha256||proof.bytes!==p.bytes)
  return reply({ok:false,error:'LIVE_R2_QUOTA_PAGO_INCONSISTENTE'},402);
 const db=env.DB;
 let old;
 try{old=await db.prepare(
  'SELECT object_key,web_order_id,file_id,sha256,bytes,state '+
  'FROM central_r2_large_reservations '+
  'WHERE (web_order_id=? AND file_id=?) OR object_key=? LIMIT 1'
 ).bind(p.orderId,p.fileId,p.objectKey).first()}
 catch{return reply({ok:false,error:'LIVE_R2_QUOTA_D1_TABLE'},503)}
 if(old){
  const identical=old.object_key===p.objectKey&&
   old.web_order_id===p.orderId&&old.file_id===p.fileId&&
   old.sha256===p.sha256&&old.bytes===p.bytes&&old.state==='reserved';
  return identical?reply({ok:true,reserved:true,idempotent:true,
   webOrderId:p.orderId,fileId:p.fileId,objectKey:p.objectKey,
   paymentAuthorized:false,uploadAuthorized:false,productionAuthorized:false}):
   reply({ok:false,error:'LIVE_R2_QUOTA_CONFLICTO'},409);
 }
 const query='INSERT INTO central_r2_large_reservations '+
  '(object_key,web_order_id,file_id,sha256,bytes) '+
  'SELECT ?,?,?,?,? WHERE '+
  "(SELECT COALESCE(SUM(bytes),0) FROM central_r2_large_reservations WHERE state='reserved') + ? <= ? "+
  "AND (SELECT COUNT(*) FROM central_r2_large_reservations WHERE web_order_id=? AND state='reserved') < ? "+
  "AND (SELECT COALESCE(SUM(bytes),0) FROM central_r2_large_reservations WHERE web_order_id=? AND state='reserved') + ? <= ?";
 try{
  const r=await db.prepare(query).bind(
   p.objectKey,p.orderId,p.fileId,p.sha256,p.bytes,
   p.bytes,2*1024*MIB,p.orderId,10,p.orderId,p.bytes,1024*MIB
  ).run();
  if(r?.meta?.changes===1)return reply({
   ok:true,reserved:true,idempotent:false,
   webOrderId:p.orderId,fileId:p.fileId,objectKey:p.objectKey,
   paymentAuthorized:false,uploadAuthorized:false,productionAuthorized:false},201);
  if(r?.meta?.changes===0)return reply({ok:false,error:'LIVE_R2_QUOTA_AGOTADA'},429);
 }catch{return reply({ok:false,error:'LIVE_R2_QUOTA_D1_WRITE'},503)}
 return reply({ok:false,error:'LIVE_R2_QUOTA_NO_CONFIRMADA'},409);
}
