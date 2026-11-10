/** TUS producción: firmador privado aislado y verificador de PDF pospago.
 * Nunca genera órdenes, nunca publica URLs de descarga ni usa el bucket LAB.
 * Cada petición exige sesión ligada a pedido y doble gate D1 conciliado.
 */
import {validarMetasTUS,crearTandaTUS,leerReciboTUS} from './tus-pedido-contrato.mjs';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {llamarTUSUniversalCentralLive} from './tus-universal-live-puente-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX=60*1048576;
const respond=(obj,status=200)=>Response.json(obj,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function storageConfig(env){
 const project=env?.DOCS_LIVE_TUS_PROJECT_URL;
 const bucket=env?.DOCS_LIVE_TUS_BUCKET;
 const secret=env?.DOCS_LIVE_TUS_SERVICE_KEY;
 const receiptKey=env?.DOCS_LIVE_TUS_RECEIPT_KEY;
 const publicKey=env?.DOCS_LIVE_TUS_PUBLISHABLE_KEY;
 let url;try{url=new URL(project)}catch{}
 return url?.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
  url.pathname==='/'&&!url.search&&!url.hash&&
  /^[a-z0-9]{15,30}\.storage\.supabase\.co$/.test(url.hostname)&&
  url.hostname!=='qkbbqzbannyhuanngjpw.storage.supabase.co'&&
  /^[a-z0-9][a-z0-9_-]{3,45}$/.test(bucket||'')&&
  !['saber-tus-lab','saber-tus-pruebas'].includes(bucket)&&
  typeof secret==='string'&&secret.length>=41&&
  typeof receiptKey==='string'&&receiptKey.length>=32&&
  typeof publicKey==='string'&&publicKey.length>=30&&
  ![env.CENTRAL_BRIDGE_KEY,env.DOCS_TUS_RECEIPT_KEY,
    env.DOCS_TUS_SUPABASE_SERVICE_KEY,secret].includes(receiptKey)&&
  secret!==env.DOCS_TUS_SUPABASE_SERVICE_KEY&&
  ![secret,receiptKey].includes(publicKey)?
  {origin:url.origin,bucket,secret,receiptKey,publicKey}:null;
}
function allowed(req,env,authorized){
 const url=new URL(req.url);
 return authorized===true&&req.method==='POST'&&url.origin===ORIGIN&&
  !url.search&&!url.hash&&req.headers.get('Origin')===ORIGIN&&
  (!req.headers.get('Sec-Fetch-Site')||
   req.headers.get('Sec-Fetch-Site')==='same-origin')&&
  /^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')&&
  env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'&&
  env?.DOCS_MP_LIVE_GATE===GO&&
  env?.DOCS_LIVE_RECEPCION_GATE===GO&&
  env?.DOCS_LIVE_TUS_GATE===GO&&
  Boolean(storageConfig(env));
}
async function readJson(req,max=64000){
 if(Number(req.headers.get('Content-Length')||0)>max)return null;
 const raw=await req.text();if(raw.length>max)return null;
 try{return JSON.parse(raw)}catch{return null}
}
function objectUrl(config,object){
 if(typeof object!=='string'||!/^v2\/WEB-ENSAYO-[A-F0-9]{32}\/[^/]+\.pdf$/.test(object))
  throw Error('LIVE_TUS_OBJECT');
 return config.origin+'/storage/v1/object/'+config.bucket+'/'+
  object.split('/').map(encodeURIComponent).join('/');
}
async function signUpload(config,object,{fetcher}){
 const url=objectUrl(config,object).replace('/storage/v1/object/','/storage/v1/object/upload/sign/');
 const r=await fetcher(url,{method:'POST',redirect:'manual',
  headers:{apikey:config.secret,Authorization:'Bearer '+config.secret,
   'Content-Type':'application/json'},body:'{}'});
 if(!r.ok||r.status>=300&&r.status<400)throw Error('LIVE_TUS_STORAGE_SIGN');
 const raw=await r.text();
 if(raw.length>2000)throw Error('LIVE_TUS_SIGN_RESPONSE');
 let parsed;try{parsed=JSON.parse(raw)}catch{}
 if(typeof parsed?.token!=='string'||parsed.token.length<12||
  parsed.token.length>512)throw Error('LIVE_TUS_SIGN_TOKEN');
 return parsed.token;
}
async function readObject(config,object,{fetcher}){
 const r=await fetcher(objectUrl(config,object),{redirect:'manual',
  headers:{apikey:config.secret,Authorization:'Bearer '+config.secret}});
 if(!r.ok||r.status>=300&&r.status<400||
  Number(r.headers.get('Content-Length')||0)>40*1048576)
  throw Error('LIVE_TUS_OBJECT_NOT_FOUND');
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.length<5||bytes.length>40*1048576)return null;
 return bytes;
}
const gateMeta=(action,orderId,m)=>({
 schema:'saber-central-r2-universal-tus-gate-v1',
 action,orderId,fileId:m.fileId,name:m.name,sha256:m.sha256,
 bytes:m.bytes,pages:m.pages
});
export async function iniciarTUSUniversalLive(req,env,{
 authorized=false,gate=llamarTUSUniversalCentralLive,fetcher=fetch,
 uuid=()=>crypto.randomUUID(),subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000)
}={}){
 if(new URL(req.url).pathname!=='/api/pedido/live/tus/iniciar'||
  !allowed(req,env,authorized))
  return respond({ok:false,error:'LIVE_TUS_INICIAR_CERRADO'},503);
 const data=await readJson(req);
 let validated;try{
  if(!data||Object.keys(data).sort().join(',')!=='metas,orderId'||
   !WEB.test(data.orderId||''))throw Error('invalid');
  validated=validarMetasTUS(data);
 }catch{return respond({ok:false,error:'LIVE_TUS_META_INVALIDA'},422)}
 for(const m of validated.metas){
  let proof;
  try{proof=await gate(env,'gate',gateMeta('start',data.orderId,m))}
  catch{return respond({ok:false,error:'LIVE_TUS_PAGO_PENDIENTE'},402)}
  if(!proof||proof.ok!==true||proof.uploadAuthorized!==true||
   proof.fileId!==m.fileId||proof.mode!==m.mode||
   proof.bytes!==m.bytes||proof.sha256!==m.sha256||proof.pages!==m.pages||
   proof.name!==m.name)
   return respond({ok:false,error:'LIVE_TUS_FICHA_CAMBIADA'},409);
 }
 const config=storageConfig(env);
 let sessions;
 try{
  sessions=await crearTandaTUS({
   ...data,uuid,ahora:now,subtle,secret:config.receiptKey,
   firmarSubida:object=>signUpload(config,object,{fetcher})
  });
 }catch{return respond({ok:false,error:'LIVE_TUS_FIRMA_NO_DISPONIBLE'},503)}
 return respond({ok:true,orderId:data.orderId,sessions:sessions.sessions,
  totalFiles:sessions.totalFiles,totalBytes:sessions.totalBytes,
  projectRef:new URL(config.origin).hostname.split('.')[0],
  bucket:config.bucket,publishableKey:config.publicKey,
  paymentAuthorized:false,productionAuthorized:false,checkoutEnabled:false});
}
export async function confirmarTUSUniversalLive(req,env,{
 authorized=false,gate=llamarTUSUniversalCentralLive,fetcher=fetch,
 measure=medidasPdfServidor,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000)
}={}){
 if(new URL(req.url).pathname!=='/api/pedido/live/tus/confirmar'||
   !allowed(req,env,authorized))
  return respond({ok:false,error:'LIVE_TUS_CONFIRMAR_CERRADO'},503);
 const data=await readJson(req);
 if(!data||Object.keys(data).sort().join(',')!=='entries,orderId'||
  !WEB.test(data.orderId||'')||!Array.isArray(data.entries)||
  data.entries.length<1||data.entries.length>10||
  data.entries.some(e=>!e||Object.keys(e).join(',')!=='proof'||
   typeof e.proof!=='string'||e.proof.length>2048))
  return respond({ok:false,error:'LIVE_TUS_COMPROBANTE_INVALIDO'},422);
 const config=storageConfig(env);
 let total=0;const seen=new Set(),receipts=[];
 for(const entry of data.entries){
  try{
   const claim=await leerReciboTUS(entry.proof,{
    secret:config.receiptKey,ahora:now,subtle});
   if(claim.orderId!==data.orderId||seen.has(claim.fileId))throw Error('ORDER');
   seen.add(claim.fileId);total+=claim.bytes;
   if(total>MAX)throw Error('BATCH');
   const expected=await gate(env,'gate',gateMeta('finish',data.orderId,claim));
   if(!expected||expected.uploadAuthorized!==true||
    expected.fileId!==claim.fileId||expected.mode!==claim.mode||
    expected.bytes!==claim.bytes||expected.sha256!==claim.sha256||
    expected.pages!==claim.pages||expected.name!==claim.name||
    !Array.isArray(expected.expectedMetrics)||
    expected.expectedMetrics.length!==claim.pages)throw Error('GATE');
   const bytes=await readObject(config,claim.objectName,{fetcher});
   if(!(bytes instanceof Uint8Array)||bytes.length!==claim.bytes||
     String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('BYTES');
   const digest=hex(new Uint8Array(await subtle.digest('SHA-256',bytes)));
   if(!SHA.test(digest)||digest!==claim.sha256)throw Error('SHA');
   const physical=await measure(bytes);
   if(physical.pageCount!==claim.pages||
      !Array.isArray(physical.pageMetrics)||
      physical.pageMetrics.length!==claim.pages||
      physical.pageMetrics.some((m,i)=>{
       const target=expected.expectedMetrics[i];
       return !target||!Number.isFinite(m.anchoCm)||!Number.isFinite(m.altoCm)||
        Math.abs(m.anchoCm-target.anchoCm)>0.25||
        Math.abs(m.altoCm-target.altoCm)>0.25;
      }))throw Error('METRICS');
   const saved=await gate(env,'received',{
    schema:'saber-central-r2-universal-tus-received-v1',
    orderId:data.orderId,fileId:claim.fileId,receiptId:claim.receiptId,
    objectName:claim.objectName,name:claim.name,sha256:digest,
    bytes:claim.bytes,pages:claim.pages,
    metrics:physical.pageMetrics.map(m=>({
     anchoCm:m.anchoCm,altoCm:m.altoCm,modo:'sin-clasificar'
    }))
   });
   if(saved?.saved!==true||saved.fileId!==claim.fileId)
    throw Error('CENTRAL');
   receipts.push({fileId:claim.fileId,receiptId:claim.receiptId,
    saved:true,idempotent:saved.idempotent===true});
  }catch{
   return respond({ok:false,error:'LIVE_TUS_VERIFICACION_PENDIENTE',
    savedFiles:receipts.length,failedFileIndex:receipts.length,
    paymentAuthorized:false,productionAuthorized:false},409);
  }
 }
 return respond({ok:true,webOrderId:data.orderId,savedFiles:receipts.length,
  receipts,paymentAuthorized:false,productionAuthorized:false});
}
