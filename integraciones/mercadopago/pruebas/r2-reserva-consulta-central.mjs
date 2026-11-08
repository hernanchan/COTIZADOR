/**
 * Sólo lectura de reserva R2 por orden+archivo, vía HMAC entre Workers.
 * No otorga permiso de subir ni de producir, no devuelve uploadId.
 * Distinge "nunca iniciada" de "ya reservada", para no duplicar multipart.
 */
const FLAG='PRIVATE_TEST_ONLY';
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const MIN=40*1024*1024,MAX=256*1024*1024;
const reply=(data,status=200)=>Response.json({
 paymentAuthorized:false,registeredInD1:false,productionAuthorized:false,
 ...data
},{status,headers:{'Cache-Control':'no-store, private',
 'X-Content-Type-Options':'nosniff'}});
export async function consultarReservaR2Central(request,env,{readSigned}={}){
 if(env?.CENTRAL_R2_QUOTA_ENABLED!==FLAG||
    typeof env?.DB?.prepare!=='function')
  return reply({ok:false,error:'R2_RESERVA_NO_CONFIGURADA'},503);
 if(typeof readSigned!=='function')
  return reply({ok:false,error:'R2_FIRMA_NO_CONFIGURADA'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'R2_FIRMA_INVALIDA'},
  signed.status||401);
 const p=signed?.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='bytes,fileId,schema,sha256,webOrderId'||
    p.schema!=='saber-central-r2-reservation-lookup-v1'||
    !ORDER.test(p.webOrderId||'')||!FILE.test(p.fileId||'')||
    !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<=MIN||p.bytes>MAX)
  return reply({ok:false,error:'R2_RESERVA_IDENTIDAD_INVALIDA'},422);
 const table=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='central_r2_large_reservations'"
 ).first();
 if(!table)return reply({ok:true,found:false,state:'not_started',
  webOrderId:p.webOrderId});
 const row=await env.DB.prepare(
  'SELECT object_key,web_order_id,file_id,sha256,bytes,state '+
  'FROM central_r2_large_reservations WHERE web_order_id=? AND file_id=? LIMIT 1'
 ).bind(p.webOrderId,p.fileId).first();
 if(!row)return reply({ok:true,found:false,state:'not_started',
  webOrderId:p.webOrderId});
 const m=KEY.exec(row.object_key||'');
 if(!m||m[1]!==p.webOrderId||row.web_order_id!==p.webOrderId||
    row.file_id!==p.fileId||row.sha256!==p.sha256||
    row.bytes!==p.bytes||row.state!=='reserved')
  return reply({ok:false,error:'R2_RESERVA_CONFLICTO'},409);
 return reply({ok:true,found:true,state:'reserved',
  webOrderId:p.webOrderId,fileId:p.fileId,sha256:p.sha256,
  bytes:p.bytes,objectKey:row.object_key});
}
