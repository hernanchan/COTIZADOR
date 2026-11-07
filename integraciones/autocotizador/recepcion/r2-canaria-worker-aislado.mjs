/**
 * CANARIO R2 DESTRUCTIBLE — solo runner GitHub Actions.
 * Worker separado del de documentos; NO admite pedidos de compradores ni cobros.
 * Reutiliza la implementacion R2 de produccion experimental, sin cuotas ni D1.
 * Debe eliminarse (script + objetos) al terminar el ensayo.
 */
import {iniciarR2Grande,subirParteR2Grande,completarR2Grande,leerReciboR2} from './r2-pdf-grandes-privado.mjs';
import {verificarIntegridadR2Grande} from './r2-pdf-integridad-stream.mjs';
const PATH='/__saber-r2-canario/';
const reply=(x,status=200)=>new Response(JSON.stringify({paymentAuthorized:false,checkoutEnabled:false,...x}),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}
});
function isAuthenticated(request,env){
  const expected='Bearer '+env?.CANARY_AUTH_SECRET;
  const supplied=request.headers.get('Authorization')||'';
  if(!env?.CANARY_AUTH_SECRET||env.CANARY_AUTH_SECRET.length<32||supplied.length!==expected.length)return false;
  let difference=0;
  for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return difference===0;
}
async function json(request){
  const size=request.headers.get('Content-Length');
  if(size&&Number(size)>12000)throw Error('BODY_TOO_LARGE');
  const txt=await request.text();
  if(txt.length>12000)throw Error('BODY_TOO_LARGE');
  return JSON.parse(txt);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),action=url.pathname.slice(PATH.length);
  if(!url.pathname.startsWith(PATH)||!isAuthenticated(request,env))return reply({ok:false},404);
  if(!env.SABER_R2_GRANDES||env.CANARY_ONLY!=='RUNNER_CONTROLLED'||
    !env.CANARY_RECEIPT_KEY||env.CANARY_RECEIPT_KEY.length<32)return reply({ok:false},503);
  if(request.headers.get('Origin')!==url.origin)return reply({ok:false},403);
  if(action==='health'&&request.method==='GET')return reply({ok:true,canary:true});
  if(!['start','part','finish','verify','cleanup','sweep','diagnose'].includes(action))return reply({ok:false},404);
  if((action==='part'&&request.method!=='PUT')||(action!=='part'&&request.method!=='POST'))return reply({ok:false},405);
  const options={bucket:env.SABER_R2_GRANDES,secret:env.CANARY_RECEIPT_KEY};
  try{
   if(action==='diagnose'){
    const uuid=crypto.randomUUID();
    const diagnosticKey='r2-v1/'+env.CANARY_ORDER_ID+'/'+uuid+'.pdf';
    const upload=await env.SABER_R2_GRANDES.createMultipartUpload(diagnosticKey);
    const data={
      uploadIdType:typeof upload.uploadId,
      uploadIdLength:typeof upload.uploadId==='string'?upload.uploadId.length:-1,
      uploadIdAtMost256:typeof upload.uploadId==='string'&&upload.uploadId.length<=256,
      keyType:typeof upload.key,
      keyLength:typeof upload.key==='string'?upload.key.length:-1,
      keyMatches:upload.key===diagnosticKey,
      uuidV4:/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(uuid)
    };
    await upload.abort();
    return reply({ok:true,diagnostic:data});
   }
   if(action==='sweep'){
    const prefix='r2-v1/'+env.CANARY_ORDER_ID+'/';
    if(!/^WEB-ENSAYO-R2-CANARIO-[0-9]{6,15}$/.test(env.CANARY_ORDER_ID||''))
      throw Error('CANARY_PREFIX_NOT_SAFE');
    let deleted=0,continuation;
    for(let page=0;page<5;page++){
      const listed=await env.SABER_R2_GRANDES.list({prefix,limit:200,...(continuation?{cursor:continuation}:{})});
      if(!listed||!Array.isArray(listed.objects))throw Error('CANARY_LIST_FAILED');
      const names=listed.objects.map(o=>o.key).filter(k=>k.startsWith(prefix));
      if(names.length){await env.SABER_R2_GRANDES.delete(names);deleted+=names.length}
      if(!listed.truncated)break;
      if(!listed.cursor||page===4)throw Error('CANARY_LIST_TRUNCATED');
      continuation=listed.cursor;
    }
    const final=await env.SABER_R2_GRANDES.list({prefix,limit:1});
    if(final.objects?.length||final.truncated)return reply({ok:false,error:'CANARY_SWEEP_INCOMPLETE'},500);
    return reply({ok:true,objectAbsent:true,sweptObjects:deleted});
   }
   if(action==='start'){
    const data=await json(request);
    if(!/^WEB-ENSAYO-R2-CANARIO-[0-9]{6,15}$/.test(data.orderId||'')||
      !data.meta||!/^canario-(80|200)\.pdf$/.test(data.meta.name||''))
      return reply({ok:false,error:'CANARY_ONLY'},422);
    const session=await iniciarR2Grande({...options,orderId:data.orderId,meta:data.meta});
    return reply({ok:true,session});
   }
   if(action==='part'){
    const proof=request.headers.get('X-Saber-R2-Proof');
    const n=Number(url.searchParams.get('n'));
    const result=await subirParteR2Grande({...options,proof,partNumber:n,request});
    return reply({ok:true,...result});
   }
   const data=await json(request);
   const claim=await leerReciboR2(data.proof,{secret:options.secret});
   if(!/^WEB-ENSAYO-R2-CANARIO-[0-9]{6,15}$/.test(claim.orderId))throw Error('CANARY_ONLY');
   if(action==='finish'){
    const result=await completarR2Grande({...options,proof:data.proof,uploadedParts:data.parts});
    return reply({ok:true,result});
   }
   if(action==='verify'){
    const result=await verificarIntegridadR2Grande({...options,proof:data.proof});
    return reply({ok:true,verified:{bytes:result.bytes,sha256:result.sha256,
      sha256Verificado:result.sha256Verificado,contenidoPdfVerificado:result.contenidoPdfVerificado,
      etag:result.etag,paymentAuthorized:false}});
   }
   if(action==='cleanup'){
    // No recibe claves libres: se limita exclusivamente a la clave del proof firmado.
    const before=await env.SABER_R2_GRANDES.head(claim.key);
    if(before)await env.SABER_R2_GRANDES.delete(claim.key);
    else{
      // Si el multipart no concluyo, abortar sus partes para evitar reservas temporales.
      try{
       const pending=env.SABER_R2_GRANDES.resumeMultipartUpload(claim.key,claim.uploadId);
       await pending.abort();
      }catch{/* la carga ya pudo haberse cerrado */}
    }
    const after=await env.SABER_R2_GRANDES.head(claim.key);
    if(after)return reply({ok:false,error:'CANARY_CLEANUP_NOT_VERIFIED'},500);
    return reply({ok:true,objectAbsent:true,deleted:!!before});
   }
  }catch(e){
    const code=typeof e?.message==='string'&&/^[A-Z0-9_]{3,64}$/.test(e.message)?e.message:'CANARY_OPERATION_FAILED';
    console.warn('r2_canary_operation_rejected',code);
    return reply({ok:false,error:code},422);
  }
 }
};
