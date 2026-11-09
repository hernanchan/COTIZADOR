/** Reusable Supabase TUS upload + verified PDF linking to an existing
 * paid universal D1 order. IMPORTANT: do NOT call finalizarPedidoTUSPrivado:
 * that would create a second commercial order and charge again.
 */
import {validarMetasTUS,leerReciboTUS} from './tus-pedido-contrato.mjs';
import {iniciarTandaTUSPrivada,leerObjetoTUSPrivado,tusPrivadoConfigurado} from './tus-pedido-worker.mjs';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {llamarTUSUniversalCentral} from './tus-universal-puente-central.mjs';
const ON='PRIVATE_TEST_ONLY';
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const MAX=60*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const respond=(d,s=200)=>Response.json(d,{status:s,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const hex=u8=>Array.from(u8,b=>b.toString(16).padStart(2,'0')).join('');
function allowed(req,env,authorized){
 const u=new URL(req.url);
 return authorized===true&&req.method==='POST'&&u.protocol==='https:'&&
   req.headers.get('Origin')===u.origin&&
   /^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')&&
   (!req.headers.get('Sec-Fetch-Site')||
     req.headers.get('Sec-Fetch-Site')==='same-origin')&&
   tusPrivadoConfigurado(env)&&
   env.DOCS_R2_UNIVERSAL_TUS_ENABLED===ON&&
   env.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED===ON;
}
async function jsonLimited(req){
 if(Number(req.headers.get('Content-Length')||0)>MAX)return null;
 const text=await req.text();
 if(text.length>64000)return null;
 try{return JSON.parse(text)}catch{return null}
}
const gateBody=(action,orderId,meta)=>({
 schema:'saber-central-r2-universal-tus-gate-v1',
 action,orderId,fileId:meta.fileId,name:meta.name,
 sha256:meta.sha256,bytes:meta.bytes,pages:meta.pages
});
export async function iniciarLoteTUSUniversal(request,env,{
 authorized=false,gate=llamarTUSUniversalCentral,
 start=iniciarTandaTUSPrivada
}={}){
 if(!allowed(request,env,authorized))
  return respond({ok:false,error:'UNIVERSAL_TUS_SESION_OFF'},403);
 const input=await jsonLimited(request.clone());
 let meta;try{
  if(!input||Object.keys(input).sort().join(',')!=='metas,orderId'||
     !ORDER.test(input.orderId||''))throw Error('input');
  meta=validarMetasTUS(input);
 }catch{return respond({ok:false,error:'UNIVERSAL_TUS_DATOS_INVALIDOS'},422)}
 // All files authorized against real paid D1 state BEFORE signing any upload.
 for(const m of meta.metas){
  let v;try{v=await gate(env,'gate',gateBody('start',input.orderId,m))}
  catch{return respond({ok:false,error:'UNIVERSAL_TUS_PAGO_NO_VERIFICADO'},402)}
  if(v?.ok!==true||v.uploadAuthorized!==true||
     v.mode!==m.mode||v.fileId!==m.fileId||v.sha256!==m.sha256||
     v.bytes!==m.bytes||v.pages!==m.pages)
   return respond({ok:false,error:'UNIVERSAL_TUS_PDF_NO_COINCIDE'},409);
 }
 const result=await start(request,env,{authorized:true});
 if(!result.ok)return result;
 const value=await result.clone().json().catch(()=>null);
 if(!value||value.ok!==true||value.orderId!==input.orderId||
    value.sessions?.length!==meta.metas.length||
    value.sessions.some((x,i)=>x.fileId!==meta.metas[i].fileId||
     x.bytes!==meta.metas[i].bytes))
  return respond({ok:false,error:'UNIVERSAL_TUS_SESIONES_NO_COINCIDEN'},502);
 return result;
}
export async function confirmarLoteTUSUniversal(request,env,{
 authorized=false,gate=llamarTUSUniversalCentral,
 read=leerObjetoTUSPrivado,measure=medidasPdfServidor,
 subtle=crypto.subtle,ahora
}={}){
 if(!allowed(request,env,authorized))
  return respond({ok:false,error:'UNIVERSAL_TUS_SESION_OFF'},403);
 const p=await jsonLimited(request);
 if(!p||Object.keys(p).sort().join(',')!=='entries,orderId'||
    !ORDER.test(p.orderId||'')||!Array.isArray(p.entries)||
    p.entries.length<1||p.entries.length>10||
    p.entries.some(x=>!x||Object.keys(x).join(',')!=='proof'||
     typeof x.proof!=='string'||x.proof.length>2048))
  return respond({ok:false,error:'UNIVERSAL_TUS_RECIBOS_INCOMPLETOS'},422);
 const ids=new Set(),results=[];let total=0;
 for(const item of p.entries){
  let claim,expected;
  try{
   // Browser proof is never an authorization: verify its Worker HMAC.
   claim=await leerReciboTUS(item.proof,{
    secret:env.DOCS_TUS_RECEIPT_KEY,subtle,...(ahora?{ahora}:{})
   });
   if(claim.orderId!==p.orderId||ids.has(claim.fileId))throw Error('another order');
   ids.add(claim.fileId);total+=claim.bytes;
   if(total>MAX)throw Error('over quota');
   expected=await gate(env,'gate',gateBody('finish',p.orderId,claim));
   if(expected.uploadAuthorized!==true||
      expected.mode!==claim.mode||expected.name!==claim.name||
      expected.sha256!==claim.sha256||
      expected.bytes!==claim.bytes||expected.pages!==claim.pages)
    throw Error('metadata');
   const bytes=await read(env,claim.objectName);
   if(!(bytes instanceof Uint8Array)||bytes.length!==claim.bytes||
      String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
    throw Error('missing original');
   const sha=hex(new Uint8Array(await subtle.digest('SHA-256',bytes)));
   if(!SHA.test(sha)||sha!==claim.sha256)
    throw Error('sha mismatch');
   const physical=await measure(bytes);
   if(physical.pageCount!==claim.pages||
      physical.pageMetrics.length!==claim.pages||
      !physical.pageMetrics.every((m,i)=>{
       const q=expected.expectedMetrics[i];
       return q&&Math.abs(m.anchoCm-q.anchoCm)<=0.25&&
        Math.abs(m.altoCm-q.altoCm)<=0.25;
      }))
    throw Error('pages or size mismatch');
   // No order creation. Only immutable file receipt (signed Worker->Central).
   const receipt=await gate(env,'received',{
    schema:'saber-central-r2-universal-tus-received-v1',
    orderId:p.orderId,fileId:claim.fileId,receiptId:claim.receiptId,
    objectName:claim.objectName,name:claim.name,
    sha256:sha,bytes:claim.bytes,pages:claim.pages,
    metrics:physical.pageMetrics.map(m=>({
     anchoCm:m.anchoCm,altoCm:m.altoCm,modo:'sin-clasificar'
    }))
   });
   if(receipt?.saved!==true||receipt?.fileId!==claim.fileId)
    throw Error('central rejected');
   results.push({fileId:claim.fileId,receiptId:claim.receiptId,
    saved:true,idempotent:receipt.idempotent});
  }catch(e){
   console.warn('saber_tus_universal_verify_rejected',String(e?.message||'').slice(0,70));
   return respond({ok:false,error:'UNIVERSAL_TUS_ORIGINAL_PENDIENTE',
    savedFiles:results.length,failedFileIndex:results.length,
    paymentAuthorized:false,productionAuthorized:false},409);
  }
 }
 return respond({ok:true,webOrderId:p.orderId,
  savedFiles:results.length,receipts:results,
  paymentAuthorized:false,productionAuthorized:false});
}
