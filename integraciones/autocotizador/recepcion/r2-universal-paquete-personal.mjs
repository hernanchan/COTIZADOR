/**
 * Staff-only bridge for paid universal PDF package and original downloads.
 * D1 reconciles order/payment; browser never supplies Storage path or hashes.
 * SHA-256 rechecked before emitting any PDF; never enables printing.
 */
import {leerObjetoTUSPrivado,tusPrivadoConfigurado} from './tus-pedido-worker.mjs';
import {verificarObjetoR2Reservado} from './r2-pdf-integridad-stream.mjs';
import {consultarPaqueteCentralLive} from './paquete-live-puente-central.mjs';
const ON='PRIVATE_TEST_ONLY';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const OBJECT=/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.pdf$/i;
const R2MIN=40*1048576,R2MAX=200*1048576;
const respond=(x,s=200)=>Response.json(x,{status:s,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const GO='GO_COMERCIAL_CONFIRMADO';
const liveMode=env=>env?.SABER_ENTORNO==='produccion'&&
 env?.CENTRAL_DB_ENV==='produccion'&&env?.DOCS_MP_LIVE_GATE===GO&&
 env?.DOCS_LIVE_STAFF_GATE===GO&&env?.DOCS_LIVE_PACKAGE_GATE===GO&&
 env?.DOCS_R2_UNIVERSAL_PACKAGE_ENABLED!==ON&&
 env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!==ON&&
 env?.DOCS_CENTRAL_SYNC_ENABLED!==ON;
function configured(env){
 return (liveMode(env)||(
  env?.SABER_ENTORNO!=='produccion'&&
  env?.DOCS_R2_UNIVERSAL_PACKAGE_ENABLED===ON&&
  env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED===ON&&
  env?.DOCS_CENTRAL_SYNC_ENABLED===ON))&&
  typeof env?.CENTRAL_BRIDGE_KEY==='string'&&
  env.CENTRAL_BRIDGE_KEY.length>=32&&
  typeof env?.SABER_CENTRAL?.fetch==='function';
}
function tusLiveConfig(env){
 if(!liveMode(env)||env?.DOCS_LIVE_TUS_GATE!==GO||
    typeof env?.DOCS_LIVE_TUS_SERVICE_KEY!=='string'||
    env.DOCS_LIVE_TUS_SERVICE_KEY.length<41)return null;
 let u;try{u=new URL(env.DOCS_LIVE_TUS_PROJECT_URL)}catch{}
 const bucket=env?.DOCS_LIVE_TUS_BUCKET;
 if(!u||u.protocol!=='https:'||u.pathname!=='/'||u.port||
    !/^[a-z0-9]{15,30}\.storage\.supabase\.co$/.test(u.hostname)||
    u.hostname==='qkbbqzbannyhuanngjpw.storage.supabase.co'||
    !/^[a-z0-9][a-z0-9_-]{3,45}$/.test(bucket||'')||
    ['saber-tus-lab','saber-tus-pruebas'].includes(bucket))
  return null;
 return {origin:u.origin,bucket,secret:env.DOCS_LIVE_TUS_SERVICE_KEY};
}
/** Solo para acceso staff: leer originales del bucket TUS LIVE privado. */
export async function leerObjetoTUSLive(env,objectName,{fetcher=fetch}={}){
 const config=tusLiveConfig(env);
 if(!config||typeof objectName!=='string'||!/^v2\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9-]{36}\.pdf$/.test(objectName))
  throw Error('LIVE_PACKAGE_TUS_STORAGE_OFF');
 const url=config.origin+'/storage/v1/object/'+config.bucket+'/'+
  objectName.split('/').map(encodeURIComponent).join('/');
 const res=await fetcher(url,{redirect:'manual',headers:{
  apikey:config.secret,Authorization:'Bearer '+config.secret}});
 if(!res.ok||res.status>=300&&res.status<400||
  Number(res.headers.get('Content-Length')||0)>40*1048576)
  throw Error('LIVE_PACKAGE_TUS_STORAGE_ERROR');
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.length<5||bytes.length>40*1048576)
  throw Error('LIVE_PACKAGE_TUS_BYTES');
 return bytes;
}
function requestAllowed(request,authorized){
 const url=new URL(request.url);
 return authorized===true&&request.method==='POST'&&url.protocol==='https:'&&
  request.headers.get('Origin')===url.origin&&
  /^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')&&
  (!request.headers.get('Sec-Fetch-Site')||
    request.headers.get('Sec-Fetch-Site')==='same-origin');
}
async function inputJSON(request,type){
 const str=await request.text();
 if(str.length>500)throw Error('MANIFEST_INPUT_LIMIT');
 let p;try{p=JSON.parse(str)}catch{}
 const keys=type==='manifest'?'webOrderId':'fileId,webOrderId';
 if(!p||Object.keys(p).sort().join(',')!==keys||!WEB.test(p.webOrderId||'')||
    (type==='file'&&!FILE.test(p.fileId||'')))throw Error('MANIFEST_INPUT_INVALID');
 return p;
}
export async function consultarCentralUniversalDocumento(env,kind,data,{
 service=env?.SABER_CENTRAL,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(!configured(env)||!['manifest','file'].includes(kind))
  throw Error('UNIVERSAL_PACKAGE_OFF');
 if(liveMode(env))return consultarPaqueteCentralLive(env,kind,data,{
  service,subtle,now,nonce});
 let url;try{url=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!url||url.protocol!=='https:'||!HOST.test(url.hostname)||
    url.pathname!=='/internal/central/stage'||url.search||url.hash||
    url.port||url.username||url.password)
  throw Error('UNIVERSAL_PACKAGE_BAD_URL');
 url.pathname='/internal/central/r2-universal-package-'+kind;
 const payload=JSON.stringify({schema:'saber-central-r2-universal-package-'+kind+'-v1',...data});
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  throw Error('UNIVERSAL_PACKAGE_BAD_NONCE');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+payload))));
 const r=await service.fetch(new Request(url.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig
 },body:payload}));
 if(!r.ok)throw Error('UNIVERSAL_PACKAGE_D1_NOT_READY_'+r.status);
 const raw=await r.text();
 if(raw.length>1000000)throw Error('UNIVERSAL_PACKAGE_TOO_LARGE');
 let result;try{result=JSON.parse(raw)}catch{}
 if(result?.ok!==true||result?.webOrderId!==data.webOrderId||
    result?.productionAuthorized!==false)
  throw Error('UNIVERSAL_PACKAGE_D1_INCONSISTENT');
 return result;
}
export async function consultarPaqueteUniversalPersonal(request,env,{
 authorized=false,lookup=consultarCentralUniversalDocumento
}={}){
 if(!requestAllowed(request,authorized)||
    (liveMode(env)&&new URL(request.url).origin!=='https://pedidos.libreriasaber.com.ar'))
  return respond({ok:false,error:'PAQUETE_PERSONAL_NO_AUTORIZADO'},403);
 if(!configured(env))return respond({ok:false,error:'PAQUETE_PERSONAL_OFF'},503);
 let p;try{p=await inputJSON(request,'manifest')}
 catch{return respond({ok:false,error:'PAQUETE_PERSONAL_ARGUMENTOS'},422)}
 try{
  const d=await lookup(env,'manifest',p);
  if(d.schema!=='saber-central-r2-universal-package-manifest-v1'||
     !/^\d{3,}$/.test(d.numeroOrden||'')||
     !Number.isSafeInteger(d.importe)||d.importe<1||
     d.estadoPago!=='PAGADO_VERIFICADO'||d.pagoVerificado!==true||
     d.preprensaPendiente!==true||
     !Array.isArray(d.trabajos)||d.trabajos.length<1||d.trabajos.length>10||
     d.trabajos.some((x,i)=>x.orden!==i+1||
       !FILE.test(x.fileId||'')||
       !['r2','tus'].includes(x.transporte)||!SHA.test(x.sha256||'')||
       !Number.isSafeInteger(x.bytes)||x.bytes<5||
       typeof x.nombreOriginal!=='string'||x.nombreOriginal.length>120||
       !Array.isArray(x.paginasElegidas)||!x.paginasElegidas.length||
       x.preprensaAprobada!==false))
   throw Error('PAQUETE_PERSONAL_FICHA_INVALIDA');
  return respond(d);
 }catch{return respond({ok:false,error:'PAQUETE_PERSONAL_PENDIENTE_DE_VERIFICACION'},409)}
}
export async function descargarUniversalPersonal(request,env,{
 authorized=false,lookup=consultarCentralUniversalDocumento,
 readTUS=leerObjetoTUSPrivado,verifyR2=verificarObjetoR2Reservado,
 subtle=crypto.subtle
}={}){
 if(!requestAllowed(request,authorized)||
    (liveMode(env)&&new URL(request.url).origin!=='https://pedidos.libreriasaber.com.ar'))
  return respond({ok:false,error:'ARCHIVO_PERSONAL_NO_AUTORIZADO'},403);
 if(!configured(env))return respond({ok:false,error:'ARCHIVO_PERSONAL_OFF'},503);
 let p;try{p=await inputJSON(request,'file')}
 catch{return respond({ok:false,error:'ARCHIVO_PERSONAL_ARGUMENTOS'},422)}
 try{
  const d=await lookup(env,'file',p);
  if(d.schema!=='saber-central-r2-universal-package-file-v1'||
     d.fileId!==p.fileId||!SHA.test(d.sha256||'')||
     !Number.isSafeInteger(d.bytes)||d.bytes<5||
     !['tus','r2'].includes(d.transporte)||d.preprensaPendiente!==true)
   throw Error('ARCHIVO_PERSONAL_FICHA_INVALIDA');
  const head='Cache-Control';
  const filename='SABER_'+p.fileId+'.pdf';
  const headers={
   'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+filename+'"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
   'Content-Length':String(d.bytes)
  };
  if(d.transporte==='tus'){
   if(!(liveMode(env)?tusLiveConfig(env):tusPrivadoConfigurado(env))||d.bytes>R2MIN||
      typeof d.objectKey!=='string'||!d.objectKey.startsWith('v2/'+p.webOrderId+'/')||
      !/^DOC-[a-f0-9-]{36}$/i.test(d.receiptId||'')||
      d.objectKey!=='v2/'+p.webOrderId+'/'+d.receiptId.slice(4)+'.pdf')
    throw Error('ARCHIVO_PERSONAL_TUS_INVALIDO');
   const bytes=await (liveMode(env)&&readTUS===leerObjetoTUSPrivado?
     leerObjetoTUSLive(env,d.objectKey):readTUS(env,d.objectKey));
   if(!(bytes instanceof Uint8Array)||bytes.length!==d.bytes||
      String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
    throw Error('ARCHIVO_PERSONAL_TUS_BYTES');
   const hash=hex(new Uint8Array(await subtle.digest('SHA-256',bytes)));
   if(hash!==d.sha256)throw Error('ARCHIVO_PERSONAL_TUS_SHA');
   return new Response(bytes,{status:200,headers});
  }
  const bucket=liveMode(env)?env.SABER_R2_GRANDES_LIVE:env.SABER_R2_GRANDES;
  if(!(liveMode(env)?env?.DOCS_LIVE_R2_GATE===GO&&
      env?.DOCS_LIVE_R2_STAGING_GATE===GO:env?.DOCS_R2_BIG_ENABLED===ON)||
     !bucket||(liveMode(env)&&bucket===env.SABER_R2_GRANDES)||
     typeof bucket.head!=='function'||typeof bucket.get!=='function'||
     d.bytes<=R2MIN||d.bytes>R2MAX||!OBJECT.test(d.objectKey||'')||
     !d.objectKey.startsWith('r2-v1/'+p.webOrderId+'/'))
   throw Error('ARCHIVO_PERSONAL_R2_INVALIDO');
  const checked=await verifyR2({bucket,reserva:{
   found:true,orderId:p.webOrderId,fileId:p.fileId,objectKey:d.objectKey,
   sha256:d.sha256,bytes:d.bytes
  }});
  if(checked?.sha256Verificado!==true||checked.sha256!==d.sha256||
     checked.bytes!==d.bytes||typeof checked.etag!=='string')
   throw Error('ARCHIVO_PERSONAL_R2_HASH');
  const object=await bucket.get(d.objectKey,{onlyIf:{etagMatches:checked.etag}});
  if(!object||object.etag!==checked.etag||object.size!==d.bytes||
     !(object.body instanceof ReadableStream))
   throw Error('ARCHIVO_PERSONAL_R2_ETAG');
  return new Response(object.body,{status:200,headers});
 }catch{
  return respond({ok:false,error:'ARCHIVO_PERSONAL_ORIGINAL_NO_VERIFICADO'},409);
 }
}
