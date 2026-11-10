/** Bridge HMAC ONLY from Documents staff Worker to paid LIVE Central.
 * Returns immutable D1 package manifest/file references. No original bytes.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BASE='https://pagos.libreriasaber.com.ar/internal/central/live/package-';
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function consultarPaqueteCentralLive(env,kind,data,{
 service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_PACKAGE_GATE!==GO||
    env?.DOCS_LIVE_STAFF_GATE!==GO||
    typeof service?.fetch!=='function'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    [env.DOCS_LIVE_STAFF_SECRET,env.DOCS_LIVE_TUS_SERVICE_KEY,
     env.DOCS_LIVE_R2_RECEIPT_KEY].includes(env.CENTRAL_BRIDGE_KEY))
  throw Error('LIVE_PACKAGE_CENTRAL_OFF');
 if(!['manifest','file'].includes(kind)||!data||typeof data!=='object'||
  Object.keys(data).sort().join(',')!==(kind==='manifest'?'webOrderId':'fileId,webOrderId')||
  !WEB.test(data.webOrderId||'')||(kind==='file'&&!FILE.test(data.fileId||'')))
  throw Error('LIVE_PACKAGE_INPUT');
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||!UUID.test(id))
  throw Error('LIVE_PACKAGE_ID');
 const body=JSON.stringify({schema:'saber-central-r2-universal-package-'+kind+'-v1',...data});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let res;
 try{res=await service.fetch(new Request(BASE+kind,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':signature},
  body}))}catch{throw Error('LIVE_PACKAGE_CENTRAL_NO_RESPONDE')}
 if(!res.ok)throw Error('LIVE_PACKAGE_CENTRAL_'+res.status);
 const raw=await res.text();if(raw.length>1000000)throw Error('LIVE_PACKAGE_CENTRAL_TOO_LARGE');
 let result;try{result=JSON.parse(raw)}catch{}
 if(result?.ok!==true||result?.webOrderId!==data.webOrderId||
    result.schema!=='saber-central-r2-universal-package-'+kind+'-v1'||
    result.productionAuthorized!==false||(kind==='file'&&result.fileId!==data.fileId))
  throw Error('LIVE_PACKAGE_CENTRAL_NOT_OWNED');
 return result;
}
