/**
 * Signed Central -> Documents deletion of ONE verified paid/delivered universal
 * TUS original. No public route, no R2 deletions, no session-based authority.
 */
import {leerObjetoTUSPrivado,tusPrivadoConfigurado} from './tus-pedido-worker.mjs';
const ON='PRIVATE_TEST_ONLY',LIVE='GO_COMERCIAL_CONFIRMADO',PROJECT='qkbbqzbannyhuanngjpw',BUCKET='saber-tus-lab';
const enabled=env=>(env?.DOCS_R2_UNIVERSAL_PURGE_ENABLED===ON&&
 env?.DOCS_R2_UNIVERSAL_PURGE_SCOPE==='NEW_ORDERS_ONLY'&&env?.DOCS_TUS_PURGE_ENABLED===ON)||
 (env?.SABER_ENTORNO==='produccion'&&env?.DOCS_LIVE_PURGE_GATE===LIVE&&
 env?.DOCS_LIVE_TUS_GATE===LIVE&&env?.DOCS_LIVE_RECEPCION_GATE===LIVE);
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DOC=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const SHA=/^[a-f0-9]{64}$/;
const keyOf=p=>'v2/'+p.webOrderId+'/'+p.receiptId.slice(4)+'.pdf';
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store,private'}});
const hex=u8=>Array.from(u8,b=>b.toString(16).padStart(2,'0')).join('');
function validate(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&
  Object.keys(p).sort().join(',')==='bytes,commercialOrderId,fileId,objectKey,productionVersion,receiptId,schema,sha256,transport,webOrderId'&&
  p.schema==='saber-docs-r2-universal-purge-file-v1'&&
  p.transport==='tus'&&WEB.test(p.webOrderId||'')&&
  UUID.test(p.commercialOrderId||'')&&ID.test(p.fileId||'')&&
  DOC.test(p.receiptId||'')&&SHA.test(p.sha256||'')&&
  Number.isSafeInteger(p.bytes)&&p.bytes>=5&&p.bytes<=40*1048576&&
  Number.isSafeInteger(p.productionVersion)&&p.productionVersion>=1&&
  p.objectKey===keyOf(p);
}
async function signedRequest(request,env,{
 now=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle
}={}){
 if(request.method!=='POST'||request.headers.has('Origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  throw Error('UNIVERSAL_PURGE_NOT_PRIVATE');
 const ts=request.headers.get('x-saber-ts')||'';
 const uuid=request.headers.get('x-saber-request-id')||'';
 const sig=request.headers.get('x-saber-signature')||'';
 if(!/^\d{10}$/.test(ts)||!UUID.test(uuid)||!SHA.test(sig)||
    Math.abs(now()-Number(ts))>300)throw Error('UNIVERSAL_PURGE_BAD_NONCE');
 const raw=await request.text();
 if(raw.length<20||raw.length>1800)throw Error('UNIVERSAL_PURGE_BAD_LENGTH');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+uuid+'\n'+raw))));
 let bad=0;
 for(let i=0;i<64;i++)bad|=expected.charCodeAt(i)^sig.charCodeAt(i);
 if(bad)throw Error('UNIVERSAL_PURGE_BAD_SIGNATURE');
 let p;try{p=JSON.parse(raw)}catch{}
 if(!validate(p))throw Error('UNIVERSAL_PURGE_BAD_PAYLOAD');
 return p;
}
/** Supabase TUS Storage: verify SHA before sending DELETE, and absence after. */
export async function eliminarOriginalUniversalTUS(env,p,{
 fetcher=fetch,read=leerObjetoTUSPrivado,subtle=crypto.subtle
}={}){
 if(!validate(p)||!tusPrivadoConfigurado(env)||
    !enabled(env)||
    typeof env?.DOCS_TUS_SUPABASE_SERVICE_KEY!=='string'||
    env.DOCS_TUS_SUPABASE_SERVICE_KEY.length<32)
  throw Error('UNIVERSAL_PURGE_TUS_OFF');
 const headers={apikey:env.DOCS_TUS_SUPABASE_SERVICE_KEY,
  Authorization:'Bearer '+env.DOCS_TUS_SUPABASE_SERVICE_KEY,
  'Cache-Control':'no-store'};
 const storage='https://'+PROJECT+'.storage.supabase.co/storage/v1/object/';
 const encoded=p.objectKey.split('/').map(encodeURIComponent).join('/');
 const headURL=storage+BUCKET+'/'+encoded;
 async function exists(){
  const r=await fetcher(headURL,{method:'HEAD',redirect:'manual',headers});
  if(r.status===404)return false;
  if(r.status===400){
   const info=await fetcher(storage+'info/'+BUCKET+'/'+encoded,{
    method:'GET',redirect:'manual',headers});
   if(info.status===404)return false;
   if(info.status!==400)throw Error('UNIVERSAL_PURGE_STORAGE_UNCLEAR');
   const raw=await info.text();
   if(raw.length>1500)throw Error('UNIVERSAL_PURGE_STORAGE_INVALID');
   let v;try{v=JSON.parse(raw)}catch{}
   if(v?.code==='NoSuchKey')return false;
   throw Error('UNIVERSAL_PURGE_STORAGE_UNCLEAR');
  }
  if(r.status!==200)throw Error('UNIVERSAL_PURGE_TUS_HEAD_UNAVAILABLE');
  if(r.headers.has('Content-Length')&&Number(r.headers.get('Content-Length'))!==p.bytes)
   throw Error('UNIVERSAL_PURGE_TUS_LENGTH_CHANGED');
  return true;
 }
 const present=await exists();
 if(present){
  // Don't delete an object silently replaced with same byte length.
  const content=await read(env,p.objectKey,{fetcher});
  if(!(content instanceof Uint8Array)||content.length!==p.bytes||
      String.fromCharCode(...content.subarray(0,5))!=='%PDF-')
   throw Error('UNIVERSAL_PURGE_TUS_BYTES_CHANGED');
  const sha=hex(new Uint8Array(await subtle.digest('SHA-256',content)));
  if(sha!==p.sha256)throw Error('UNIVERSAL_PURGE_TUS_SHA_CHANGED');
  const r=await fetcher(storage+BUCKET,{method:'DELETE',redirect:'manual',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({prefixes:[p.objectKey]})});
  if(!r.ok)throw Error('UNIVERSAL_PURGE_TUS_DELETE_FAILED');
 }
 if(await exists())throw Error('UNIVERSAL_PURGE_TUS_STILL_PRESENT');
 return {ok:true,verifiedAbsent:true,webOrderId:p.webOrderId,fileId:p.fileId};
}
export async function atenderBorradoUniversalTUS(request,env,{
 verify=signedRequest,remove=eliminarOriginalUniversalTUS,
 now,subtle
}={}){
 if(!enabled(env))
  return reply({ok:false,error:'UNIVERSAL_PURGE_OFF'},503);
 let p;try{p=await verify(request,env,{...(now?{now}:{}),...(subtle?{subtle}:{})})}
 catch{return reply({ok:false,error:'UNIVERSAL_PURGE_HMAC_INVALIDA'},401)}
 try{
  const x=await remove(env,p);
  if(x?.ok!==true||x.verifiedAbsent!==true||
     x.webOrderId!==p.webOrderId||x.fileId!==p.fileId)
   throw Error('UNIVERSAL_PURGE_NO_PROOF');
  return reply({ok:true,verifiedAbsent:true,webOrderId:p.webOrderId,fileId:p.fileId});
 }catch{return reply({ok:false,error:'UNIVERSAL_PURGE_TUS_PENDIENTE'},409)}
}
