/** Multipart R2 LIVE de documentos PAGADOS y privados (40-200 MiB).
 * Reutiliza las primitivas ensayadas, pero ni gates, ni bucket, ni claves de
 * Sandbox. D1 autoriza cada original; la ficha no la decide el filename.
 */
import {validarMetaR2,iniciarR2Grande,leerReciboR2,
 subirParteR2Grande,completarR2Grande} from './r2-pdf-grandes-privado.mjs';
import {verificarIntegridadR2Grande,verificarObjetoR2Reservado} from './r2-pdf-integridad-stream.mjs';
import {consultarReservaR2Live} from './r2-live-recovery-puente-central.mjs';
import {consultarPagoArchivoR2Live} from './r2-live-puente-central.mjs';
import {reservarCapacidadR2Live} from './r2-live-reserva-puente-central.mjs';
import {informarR2LivePendiente} from './r2-live-stage-puente-central.mjs';
import {autorizadoOrdenLive} from './sesion-comprador-live.mjs';
const ON='GO_COMERCIAL_CONFIRMADO';
const ROOT='/api/pedido/live/r2/';
const HOST='https://pedidos.libreriasaber.com.ar';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const respond=(v,status=200)=>Response.json({
 paymentAuthorized:false,productionAuthorized:false,
 checkoutEnabled:false,...v
},{status,headers:{'Cache-Control':'no-store,private',
 'X-Content-Type-Options':'nosniff'}});
function storage(env){
 const bucket=env?.SABER_R2_GRANDES_LIVE;
 const secret=env?.DOCS_LIVE_R2_RECEIPT_KEY;
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==ON||env?.DOCS_LIVE_RECEPCION_GATE!==ON||
  env?.DOCS_LIVE_R2_GATE!==ON||env?.DOCS_LIVE_R2_UPLOAD_GATE!==ON||
  env?.DOCS_LIVE_R2_STAGING_GATE!==ON||
  !bucket||bucket===env.SABER_R2_GRANDES||
  typeof bucket.createMultipartUpload!=='function'||
  typeof bucket.resumeMultipartUpload!=='function'||
  typeof bucket.head!=='function'||typeof bucket.get!=='function'||
  typeof secret!=='string'||secret.length<32||
  [env.DOCS_R2_RECEIPT_KEY,env.CENTRAL_BRIDGE_KEY,env.DOCS_TUS_RECEIPT_KEY]
   .includes(secret))return null;
 return {bucket,secret};
}
function origin(req){
 const url=new URL(req.url);
 return url.origin===HOST&&req.headers.get('Origin')===HOST&&
  (!req.headers.get('Sec-Fetch-Site')||
   req.headers.get('Sec-Fetch-Site')==='same-origin');
}
async function json(req,max=16000){
 if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
  Number(req.headers.get('Content-Length')||0)>max)throw Error('LIVE_R2_JSON');
 const raw=await req.text();if(raw.length>max)throw Error('LIVE_R2_JSON');
 return JSON.parse(raw);
}
const expected=claim=>({orderId:claim.orderId,fileId:claim.fileId,
 name:claim.name,bytes:claim.bytes,sha256:claim.sha256,pages:claim.pages});
// Una transferencia avisada permite recepción privada, NO pago ni impresión.
const puedeSubir=proof=>proof?.paymentVerified===true||
 proof?.paymentVerified===false&&proof?.bankPending===true;

export async function manejarR2MultipartLive(req,env,{
 authorized=false,verify=consultarPagoArchivoR2Live,
 reserve=reservarCapacidadR2Live,stage=informarR2LivePendiente,
 recover=consultarReservaR2Live,
 buyer=autorizadoOrdenLive,subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 uuid=()=>crypto.randomUUID(),digestFactory
}={}){
 const u=new URL(req.url);
 const action=u.pathname.startsWith(ROOT)?u.pathname.slice(ROOT.length):'';
 const config=storage(env);
 if(!authorized||!config||!origin(req)||
  !['iniciar','parte','completar','verificar','recuperar'].includes(action))
  return respond({ok:false,error:'LIVE_R2_MULTIPART_OFF'},503);
 const method=action==='parte'?'PUT':'POST';
 if(req.method!==method||
  (action==='parte'?
   u.searchParams.size!==1||!u.searchParams.has('n'):
   Boolean(u.search)))
  return respond({ok:false,error:'LIVE_R2_MULTIPART_METODO'},405);
 const settings={bucket:config.bucket,secret:config.secret,subtle,now};
 try{
  if(action==='recuperar'){
   const input=await json(req);
   if(!input||Object.keys(input).sort().join(',')!=='meta,orderId'||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(input.orderId||''))
    return respond({ok:false,error:'LIVE_R2_RECOVERY_INPUT'},422);
   validarMetaR2(input.meta);
   if(input.meta.bytes>200*1048576)
    return respond({ok:false,error:'LIVE_R2_LIMITE'},422);
   if(!await buyer(req,env,input.orderId))
    return respond({ok:false,error:'LIVE_R2_COMPRADOR_AJENO'},403);
   const m={orderId:input.orderId,fileId:input.meta.fileId,
    name:input.meta.name,bytes:input.meta.bytes,
    sha256:input.meta.sha256,pages:input.meta.pages};
   const paid=await verify(env,m);
   if(!puedeSubir(paid)||paid.mode!==input.meta.mode)
    return respond({ok:false,error:'LIVE_R2_RECOVERY_PAGO'},402);
   const saved=await recover(env,m);
   if(saved.found===false&&saved.state==='not_started')
    return respond({ok:true,state:'not_started',alreadyStored:false,
     uploadPossible:true});
   if(saved.found!==true||!['reserved','staged'].includes(saved.state)||
     saved.sha256!==m.sha256||saved.bytes!==m.bytes)
    return respond({ok:false,error:'LIVE_R2_RECOVERY_CONFLICTO'},409);
   const head=await config.bucket.head(saved.objectKey);
   if(!head)return respond({ok:true,state:'multipart_incomplete',
    alreadyStored:false,uploadPossible:false,productionAuthorized:false});
   if(head.size!==m.bytes)
    return respond({ok:false,error:'LIVE_R2_RECOVERY_TAMANO'},409);
   const verified=await verificarObjetoR2Reservado({
    bucket:config.bucket,reserva:{found:true,objectKey:saved.objectKey,
     orderId:m.orderId,fileId:m.fileId,sha256:m.sha256,bytes:m.bytes},
    ...(digestFactory?{digestFactory}:{})
   });
   const claim={...m,mode:input.meta.mode,key:saved.objectKey};
   const staged=await stage(env,claim,verified);
   if(staged?.stagedForCentral!==true||
      staged.orderId!==m.orderId||staged.fileId!==m.fileId)
    throw Error('LIVE_R2_RECOVERY_STAGE');
   return respond({ok:true,state:'stored_and_staged',
    alreadyStored:true,uploadPossible:false,result:{
     sha256Verificado:true,sha256:m.sha256,bytes:m.bytes,
     contenidoPdfVerificado:false,registeredInD1:false,
     stagedForCentral:true,productionAuthorized:false}});
  }
  if(action==='iniciar'){
   const input=await json(req);
   if(!input||Object.keys(input).sort().join(',')!=='meta,orderId'||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(input.orderId||''))
    return respond({ok:false,error:'LIVE_R2_ORDEN'},422);
   validarMetaR2(input.meta);
   if(input.meta.bytes>200*1048576)
    return respond({ok:false,error:'LIVE_R2_LIMITE'},422);
   if(!await buyer(req,env,input.orderId))
    return respond({ok:false,error:'LIVE_R2_COMPRADOR_AJENO'},403);
   const paid=await verify(env,{orderId:input.orderId,
    fileId:input.meta.fileId,name:input.meta.name,bytes:input.meta.bytes,
    sha256:input.meta.sha256,pages:input.meta.pages});
   if(paid.mode!==input.meta.mode||!puedeSubir(paid)||
    paid.uploadAuthorized!==false)
    return respond({ok:false,error:'LIVE_R2_FICHA_DISTINTA'},409);
   const id=uuid();
   if(!UUID.test(id))return respond({ok:false,error:'LIVE_R2_UUID'},503);
   const objectKey='r2-v1/'+input.orderId+'/'+id+'.pdf';
   const quota=await reserve(env,{orderId:input.orderId,
    fileId:input.meta.fileId,name:input.meta.name,bytes:input.meta.bytes,
    sha256:input.meta.sha256,pages:input.meta.pages,objectKey});
   if(quota.reserved!==true||quota.objectKey!==objectKey)
    return respond({ok:false,error:'LIVE_R2_CUPO'},409);
   // El primer byte R2 solo se almacena después de reserva D1 y
   // pago reconciliado O aviso bancario D1; jamás sólo por presupuestar.
   const session=await iniciarR2Grande({...settings,
    orderId:input.orderId,meta:input.meta,uuid:()=>id});
   return respond({ok:true,session,objectKey,
    quotaReserved:true,storageReady:false},201);
  }
  const data=action==='parte'?null:await json(req);
  if(data&&Object.keys(data).sort().join(',')!==
   (action==='completar'?'proof,uploadedParts':'proof'))
   return respond({ok:false,error:'LIVE_R2_CIERRE_INVALIDO'},422);
  const proof=action==='parte'?req.headers.get('X-Saber-R2-Proof'):data?.proof;
  const claim=await leerReciboR2(proof,settings);
  if(!await buyer(req,env,claim.orderId))
   return respond({ok:false,error:'LIVE_R2_COMPRADOR_AJENO'},403);
  const paid=await verify(env,expected(claim));
  if(!puedeSubir(paid)||paid.mode!==claim.mode||
    paid.uploadAuthorized!==false)
   return respond({ok:false,error:'LIVE_R2_PAGO_CAMBIO'},402);
  if(action==='parte'){
   const n=u.searchParams.get('n');
   if(!/^[1-9][0-9]{0,2}$/.test(n||''))
    return respond({ok:false,error:'LIVE_R2_PARTE'},422);
   const part=await subirParteR2Grande({...settings,proof,
    partNumber:Number(n),request:req});
   return respond({ok:true,...part});
  }
  if(action==='completar'){
   const result=await completarR2Grande({...settings,proof,
    uploadedParts:data.uploadedParts});
   return respond({ok:true,result});
  }
  const result=await verificarIntegridadR2Grande({...settings,proof,
   ...(digestFactory?{digestFactory}:{})});
  const staged=await stage(env,claim,result);
  if(staged?.stagedForCentral!==true||
     staged.orderId!==claim.orderId||
     staged.fileId!==claim.fileId)
   throw Error('LIVE_R2_STAGE_RECHAZADO');
  return respond({ok:true,result:{...result,stagedForCentral:true,
   registeredInD1:false,productionAuthorized:false}});
 }catch(e){
  const known=typeof e?.message==='string'&&
   /^LIVE_R2_[A-Z_]{3,70}$/.test(e.message)?e.message:
   'LIVE_R2_OPERACION_NO_COMPLETADA';
  return respond({ok:false,error:known},known==='LIVE_R2_CUPO_AGOTADO'?429:409);
 }
}
