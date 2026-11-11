/** R2 LIVE: lector de original staged y cierre de inspección, SOLO desde
 * Worker Docs autenticado con el servicio interno HMAC. Nunca URL pública R2.
 */
import {leerFirmaInternaLive} from './central-live-bridge.mjs';
import {manifiestoInspeccionR2Live,finalizarInspeccionR2Live}
 from './r2-live-inspection-finalize.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const BASE='https://pagos.libreriasaber.com.ar';
const KEY=/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.pdf$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const json=(body,status=200)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'
}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function operarInspeccionR2LiveInterna(req,env,{
 readSigned=leerFirmaInternaLive,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000)
}={}){
 const path=new URL(req.url).pathname;
 const source=path==='/internal/central/live/r2-inspection-source';
 const confirm=path==='/internal/central/live/r2-inspection-confirm';
 if(!source&&!confirm)return json({ok:false,error:'LIVE_R2_STAFF_RUTA'},404);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GO||
  env?.CENTRAL_LIVE_R2_GATE!==GO||env?.CENTRAL_LIVE_R2_STAGING_GATE!==GO||
  env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==GO||
  typeof env?.DB?.prepare!=='function')
  return json({ok:false,error:'LIVE_R2_STAFF_GATE_CERRADO'},503);
 const signed=await readSigned(req,env);
 if(signed?.error)return json({ok:false,error:'LIVE_R2_STAFF_HMAC'},signed.status||401);
 const p=signed.payload;
 if(!p||!WEB.test(p.webOrderId||'')||!FILE.test(p.fileId||''))
  return json({ok:false,error:'LIVE_R2_STAFF_PEDIDO'},422);
 const url=BASE+'/admin/api/central/live-r2-manifest?webOrderId='+
  encodeURIComponent(p.webOrderId)+'&fileId='+encodeURIComponent(p.fileId);
 const authManifest=await manifiestoInspeccionR2Live(new Request(url),env,{authorized:true});
 if(!authManifest.ok)return json({ok:false,error:'LIVE_R2_STAFF_MANIFEST'},authManifest.status);
 const check=await authManifest.json();
 const m=check?.manifest;
 if(!m||m.webOrderId!==p.webOrderId||m.fileId!==p.fileId||
  !Number.isSafeInteger(m.expectedBytes)||m.expectedBytes<=40*1048576||
  m.expectedBytes>200*1048576||!Array.isArray(m.paginasDeclaradas)||
  !m.paginasDeclaradas.length||m.paginasDeclaradas.length>2000)
  return json({ok:false,error:'LIVE_R2_STAFF_FICHA_INVALIDA'},409);
 if(source){
  let row;try{
   row=await env.DB.prepare('SELECT object_key,receipt_id,sha256,bytes,status '+
    'FROM central_r2_large_pending WHERE web_order_id=? AND file_id=?')
    .bind(p.webOrderId,p.fileId).first();
  }catch{return json({ok:false,error:'LIVE_R2_STAFF_D1'},503)}
  if(!row||row.status!=='awaiting_pdf_analysis'||!KEY.test(row.object_key||'')||
   !row.object_key.startsWith('r2-v1/'+p.webOrderId+'/')||
   row.receipt_id!==m.receiptId||row.sha256!==m.expectedSha256||
   row.bytes!==m.expectedBytes)
   return json({ok:false,error:'LIVE_R2_STAFF_ORIGINAL_PENDIENTE'},409);
  return json({ok:true,schema:'saber-r2-staff-inspection-source-v1',
   webOrderId:p.webOrderId,fileId:p.fileId,objectKey:row.object_key,
   sha256:row.sha256,bytes:row.bytes,
   paginasDeclaradas:m.paginasDeclaradas,
   productionAuthorized:false,inspected:false});
 }
 if(typeof env?.CENTRAL_LIVE_R2_INSPECTION_KEY!=='string'||
  env.CENTRAL_LIVE_R2_INSPECTION_KEY.length<32||
  p.confirmed!==true||typeof p.operator!=='string'||
  p.operator.trim().length<2||p.operator.trim().length>60||
  !Array.isArray(p.measuredDimensions)||
  p.measuredDimensions.length!==m.paginasDeclaradas.length)
  return json({ok:false,error:'LIVE_R2_STAFF_APROBACION_INVALIDA'},422);
 const proof={
  schema:'saber-r2-live-inspection-proof-v1',
  webOrderId:m.webOrderId,commercialOrderId:m.commercialOrderId,
  fileId:m.fileId,receiptId:m.receiptId,quoteHash:m.quoteHash,
  sha256:m.expectedSha256,bytes:m.expectedBytes,
  issuedAt:now(),
  measuredDimensions:p.measuredDimensions
 };
 const key=await subtle.importKey('raw',
  new TextEncoder().encode(env.CENTRAL_LIVE_R2_INSPECTION_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(JSON.stringify(proof)))));
 const body={operator:p.operator.trim(),confirmed:true,proof,signature:sig};
 const finalReq=new Request(BASE+'/admin/api/central/live-r2-inspection',{
  method:'POST',headers:{'Origin':BASE,'Content-Type':'application/json'},
  body:JSON.stringify(body)});
 const saved=await finalizarInspeccionR2Live(finalReq,env,{authorized:true,subtle,now});
 if(!saved.ok)return json({ok:false,error:'LIVE_R2_STAFF_INSPECCION_RECHAZADA'},
  saved.status);
 const result=await saved.json();
 if(result?.saved!==true||result.productionAuthorized!==false)
  return json({ok:false,error:'LIVE_R2_STAFF_CENTRAL_INCONSISTENTE'},502);
 return json({ok:true,inspected:true,webOrderId:m.webOrderId,fileId:m.fileId,
  saved:true,productionAuthorized:false,prepressApproved:false});
}
