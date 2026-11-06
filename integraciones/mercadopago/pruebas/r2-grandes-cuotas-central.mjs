/**
 * Cupo preventivo para la habilitación de R2, SOLO rama de ensayo.
 *
 * Se reserva antes de crear multipart; todos los bytes reservados se cuentan
 * hasta implantar borrado auditado al marcar Entregado. Es deliberadamente
 * conservador para no generar gastos con la futura tarjeta.
 *
 * Límites: 2 GiB global en total, 1 GiB por pedido y 10 PDF por pedido.
 * Una reserva repetida idéntica es idempotente; otra no puede sustituirla.
 *
 * El único origen admitido es una llamada HMAC de Worker a Worker.
 */
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const MIB=1024*1024,GIB=1024*MIB;
export const R2_QUOTA_LIMITS=Object.freeze({
 minExclusiveBytes:40*MIB,maxFileBytes:256*MIB,
 maxOrderBytes:GIB,maxOrderFiles:10,maxGlobalReservedBytes:2*GIB
});
const reply=(body,status=200)=>new Response(JSON.stringify({
 paymentAuthorized:false,registeredInD1:false,checkoutEnabled:false,
 ...body
}),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}});
export function validarSolicitudCupoR2(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join(',')!=='bytes,fileId,objectKey,orderId,schema,sha256'||
  p.schema!=='saber-central-r2-reserva-v1'||
  !ORDER.test(p.orderId||'')||!FILE.test(p.fileId||'')||
  !SHA.test(p.sha256||'')||
  !Number.isSafeInteger(p.bytes)||p.bytes<=R2_QUOTA_LIMITS.minExclusiveBytes||
  p.bytes>R2_QUOTA_LIMITS.maxFileBytes)
  throw Error('R2_QUOTA_SOLICITUD_INVALIDA');
 const match=KEY.exec(p.objectKey||'');
 if(!match||match[1]!==p.orderId)
  throw Error('R2_QUOTA_ORDEN_AJENA');
 return Object.freeze({...p});
}
export async function reservarCupoR2Central(request,env,{readSigned}={}){
 if(env?.CENTRAL_R2_QUOTA_ENABLED!=='PRIVATE_TEST_ONLY')
  return reply({ok:false,error:'Cupo R2 no habilitado'},503);
 if(typeof readSigned!=='function'||!env?.DB?.prepare)
  return reply({ok:false,error:'Cupo R2 no configurado'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'Reserva no autorizada'},signed.status||401);
 let p;try{p=validarSolicitudCupoR2(signed.payload)}
 catch{return reply({ok:false,error:'Reserva fuera de límites'},422)}
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS central_r2_large_reservations ('+
  'object_key TEXT PRIMARY KEY,web_order_id TEXT NOT NULL,'+
  'file_id TEXT NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,'+
  'state TEXT NOT NULL DEFAULT \'reserved\' CHECK(state IN (\'reserved\',\'released\')),'+
  'created_at TEXT NOT NULL DEFAULT (datetime(\'now\')),'+
  'UNIQUE(web_order_id,file_id))').run();
 const existing=await env.DB.prepare(
  'SELECT object_key,web_order_id,file_id,sha256,bytes,state '+
  'FROM central_r2_large_reservations WHERE (web_order_id=? AND file_id=?) '+
  'OR object_key=? LIMIT 1'
 ).bind(p.orderId,p.fileId,p.objectKey).first();
 if(existing){
  const same=existing.object_key===p.objectKey&&
   existing.web_order_id===p.orderId&&existing.file_id===p.fileId&&
   existing.sha256===p.sha256&&existing.bytes===p.bytes&&
   existing.state==='reserved';
  return same?
   reply({ok:true,reserved:true,idempotent:true,orderId:p.orderId,quotaGranted:true}):
   reply({ok:false,error:'El archivo tiene otra reserva R2'},409);
 }
 // La condición y el INSERT son UNA única instrucción SQLite atómica.
 // Ningún SELECT anterior decide la capacidad; evita carreras entre pedidos.
 const sql='INSERT INTO central_r2_large_reservations '+
  '(object_key,web_order_id,file_id,sha256,bytes) '+
  'SELECT ?,?,?,?,? WHERE '+
  '(SELECT COALESCE(SUM(bytes),0) FROM central_r2_large_reservations '+
  "WHERE state='reserved') <= ? "+
  'AND (SELECT COALESCE(SUM(bytes),0) FROM central_r2_large_reservations '+
  "WHERE state='reserved') + ? <= ? "+
  '(SELECT COUNT(*) FROM central_r2_large_reservations '+
  "WHERE web_order_id=? AND state='reserved') < ? "+
  '(SELECT COALESCE(SUM(bytes),0) FROM central_r2_large_reservations '+
  "WHERE web_order_id=? AND state='reserved') + ? <= ?";
 try{
  const result=await env.DB.prepare(sql).bind(
   p.objectKey,p.orderId,p.fileId,p.sha256,p.bytes,
   R2_QUOTA_LIMITS.maxGlobalReservedBytes,p.bytes,R2_QUOTA_LIMITS.maxGlobalReservedBytes,
   p.orderId,R2_QUOTA_LIMITS.maxOrderFiles,
   p.orderId,p.bytes,R2_QUOTA_LIMITS.maxOrderBytes
  ).run();
  if(result?.meta?.changes===1)
   return reply({ok:true,reserved:true,idempotent:false,orderId:p.orderId,quotaGranted:true},201);
  if(result?.meta?.changes===0)
   return reply({ok:false,error:'Cupo R2 de ensayos completo, sin iniciar transferencia',quotaGranted:false},429);
 }catch{
  // Reintento concurrente: no crear multipart sin confirmación de D1.
 }
 return reply({ok:false,error:'No se pudo reservar R2',quotaGranted:false},409);
}
