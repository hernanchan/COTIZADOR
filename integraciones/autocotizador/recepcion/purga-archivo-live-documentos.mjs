/**
 * Elimina UN original LIVE autorizado por D1 de pagos.
 * La petición llega firmada por la Central, nunca por el comprador.
 * Sólo usa el Storage y R2 PRIVADOS DE PRODUCCIÓN.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const DOC=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store,private'}});
const hex=arr=>Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
function allowed(env){
 return env?.SABER_ENTORNO==='produccion'&&env?.DOCS_LIVE_PURGE_GATE===GO&&
  env?.DOCS_LIVE_TUS_GATE===GO&&env?.DOCS_LIVE_R2_GATE===GO&&
  typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32;
}
function valid(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||p.schema!=='saber-docs-live-purge-file-v1'||
  Object.keys(p).sort().join(',')!=='bytes,commercialOrderId,etag,fileId,objectKey,productionVersion,receiptId,schema,sha256,transport,webOrderId'||
  !WEB.test(p.webOrderId||'')||!UUID.test(p.commercialOrderId||'')||
  !FILE.test(p.fileId||'')||!DOC.test(p.receiptId||'')||!SHA.test(p.sha256||'')||
  !Number.isSafeInteger(p.bytes)||p.bytes<5||!Number.isSafeInteger(p.productionVersion)||
  p.productionVersion<1)return false;
 const key=p.transport==='r2'?'r2-v1/':'v2/';
 if(!['r2','tus'].includes(p.transport)||p.objectKey!==key+p.webOrderId+'/'+p.receiptId.slice(4)+'.pdf')return false;
 return p.transport==='r2'?
  p.bytes>40*1048576&&p.bytes<=200*1048576&&typeof p.etag==='string'&&p.etag.length>=8:
  p.bytes<=40*1048576&&p.etag===null;
}
async function verify(req,env){
 if(req.method!=='POST'||req.headers.has('Origin')||
   !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))throw Error('METHOD');
 const ts=req.headers.get('x-saber-ts')||'';
 const id=req.headers.get('x-saber-request-id')||'';
 const sig=req.headers.get('x-saber-signature')||'';
 if(!/^\d{10}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300||
  !UUID.test(id)||!SHA.test(sig))throw Error('NONCE');
 const raw=await req.text();
 if(raw.length<100||raw.length>1800)throw Error('LENGTH');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+raw))));
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);
 if(diff)throw Error('HMAC');
 const p=JSON.parse(raw);
 if(!valid(p))throw Error('PAYLOAD');
 return p;
}
async function deleteTUS(env,p,{fetcher=fetch}={}){
 const origin=env.DOCS_LIVE_TUS_PROJECT_URL;
 const bucket=env.DOCS_LIVE_TUS_BUCKET;
 const secret=env.DOCS_LIVE_TUS_SERVICE_KEY;
 let url;try{url=new URL(origin)}catch{}
 if(!url||url.protocol!=='https:'||url.pathname!=='/'||
  !/^[a-z0-9]{15,30}\.storage\.supabase\.co$/.test(url.hostname)||
  url.hostname==='qkbbqzbannyhuanngjpw.storage.supabase.co'||
  !/^[a-z0-9][a-z0-9_-]{3,45}$/.test(bucket||'')||
  ['saber-tus-lab','saber-tus-pruebas'].includes(bucket)||
  typeof secret!=='string'||secret.length<32)throw Error('TUS_LIVE_CONFIG');
 const base=origin.replace(/\/$/,'')+'/storage/v1/object/';
 const encoded=p.objectKey.split('/').map(encodeURIComponent).join('/');
 const headers={apikey:secret,Authorization:'Bearer '+secret,'Cache-Control':'no-store'};
 const target=base+bucket+'/'+encoded;
 const check=async()=>{
  const r=await fetcher(target,{method:'GET',headers,redirect:'manual'});
  if(r.status===404)return null;
  if(!r.ok||r.redirected)throw Error('TUS_READ_FAIL');
  if(Number(r.headers.get('Content-Length')||0)>40*1048576)throw Error('TUS_SIZE');
  const data=new Uint8Array(await r.arrayBuffer());
  if(data.length!==p.bytes||String.fromCharCode(...data.subarray(0,5))!=='%PDF-')
   throw Error('TUS_BYTES_CHANGED');
  if(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)))!==p.sha256)
   throw Error('TUS_SHA_CHANGED');
  return true;
 };
 const present=await check();
 if(present){
  const r=await fetcher(base+bucket,{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({prefixes:[p.objectKey]}),redirect:'manual'});
  if(!r.ok||r.redirected)throw Error('TUS_DELETE_FAIL');
 }
 // Confirmación sin volver a descargar 40 MiB: HEAD, sin redirecciones.
 const r=await fetcher(target,{method:'HEAD',headers,redirect:'manual'});
 if(r.status===404)return;
 if(r.status===400){
  // Supabase Storage puede responder 400 para un objeto ausente; sólo
  // aceptar un NoSuchKey inequívoco, nunca errores de autenticación.
  const info=await fetcher(base+'info/'+bucket+'/'+encoded,{
   method:'GET',headers,redirect:'manual'});
  if(info.status===404)return;
  if(info.status===400){
   const raw=await info.text();
   if(raw.length>1500)throw Error('TUS_ABSENCE_UNVERIFIED');
   let value;try{value=JSON.parse(raw)}catch{}
   if(value?.code==='NoSuchKey')return;
  }
 }
 throw Error('TUS_ABSENCE_UNVERIFIED');
}
async function deleteR2(env,p){
 const bucket=env.SABER_R2_GRANDES_LIVE;
 if(!bucket?.head||!bucket?.delete)throw Error('R2_LIVE_CONFIG');
 const obj=await bucket.head(p.objectKey);
 if(obj){
  if(obj.size!==p.bytes||String(obj.etag||'').replaceAll('"','')!==
    p.etag.replaceAll('"',''))throw Error('R2_OBJECT_CHANGED');
  await bucket.delete(p.objectKey);
 }
 if(await bucket.head(p.objectKey))throw Error('R2_ABSENCE_UNVERIFIED');
}
export async function atenderPurgaArchivoLive(req,env,{verifyRequest=verify,removeTUS=deleteTUS,removeR2=deleteR2}={}){
 if(!allowed(env))return reply({ok:false,error:'LIVE_PURGE_OFF'},503);
 let p;try{p=await verifyRequest(req,env)}catch{return reply({ok:false,error:'LIVE_PURGE_AUTH'},401)}
 if(!valid(p))return reply({ok:false,error:'LIVE_PURGE_PAYLOAD'},422);
 try{
  if(p.transport==='tus')await removeTUS(env,p);
  else await removeR2(env,p);
  return reply({ok:true,verifiedAbsent:true,webOrderId:p.webOrderId,fileId:p.fileId});
 }catch{return reply({ok:false,error:'LIVE_PURGE_RETRY'},409)}
}
