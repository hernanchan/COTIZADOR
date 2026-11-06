/**
 * Sondeo de SOLO LECTURA a la ruta sintética de Storage ya eliminada.
 * Temporal: se monta como módulo de diagnóstico sólo durante GitHub Actions.
 * Sin acceso a otras rutas, sin DELETE y sin cambio alguno en D1.
 */
const WEB='WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4';
const PATH='v2/'+WEB+'/3c98ffd9-ab0a-47ae-ad92-125dd7c9a2a5.pdf';
const BASE='https://qkbbqzbannyhuanngjpw.storage.supabase.co/storage/v1/object';
const ROOT='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const ENDPOINT='/internal/ensayo-diagnosticar-head-canaria-024';
const res=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store,private'}});
const equal=(a,b)=>{
 if(typeof a!=='string'||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
 return d===0;
};
export async function diagnosticarHEADCanaria(request,env,{fetcher=fetch}={}){
 if(request.method!=='POST'||new URL(request.url).pathname!==ENDPOINT||
    request.headers.get('Origin')!==ROOT||
    env.DOCS_TUS_PURGE_ENABLED!=='OFF'||
    env.DOCS_CANARY_DISPOSAL_ENABLED!=='PRIVATE_TEST_ONLY'||
    env.DOCS_TUS_PURGE_CANARY_ORDER!==WEB||
    env.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.DOCS_V2_PRIVATE_UI_SECRET!=='string'||
    typeof env.DOCS_CANARY_DISPOSAL_NONCE!=='string'||
    typeof env.DOCS_TUS_SUPABASE_SERVICE_KEY!=='string'||
    env.DOCS_TUS_SUPABASE_SERVICE_KEY.length<32||
    !equal(request.headers.get('x-saber-disposable-nonce'),env.DOCS_CANARY_DISPOSAL_NONCE))
  return res({ok:false,error:'Operación privada no autorizada'},403);
 let basic;
 try{basic=atob((request.headers.get('Authorization')||'').replace(/^Basic /,''))}catch{return res({ok:false},403)}
 if(!equal(basic,'operador:'+env.DOCS_V2_PRIVATE_UI_SECRET))return res({ok:false},403);
 let payload;try{payload=await request.json()}catch{return res({ok:false},422)}
 if(payload?.schema!=='saber-test-only-absence-probe-v1'||payload?.webOrderId!==WEB||
    Object.keys(payload).sort().join(',')!=='schema,webOrderId')
  return res({ok:false},422);
 const credentials={apikey:env.DOCS_TUS_SUPABASE_SERVICE_KEY,
   Authorization:'Bearer '+env.DOCS_TUS_SUPABASE_SERVICE_KEY,'Cache-Control':'no-cache'};
 const encoded=PATH.split('/').map(encodeURIComponent).join('/');
 try{
  const head=await fetcher(BASE+'/saber-tus-lab/'+encoded,{method:'HEAD',redirect:'manual',headers:credentials});
  const info=await fetcher(BASE+'/info/saber-tus-lab/'+encoded,{method:'GET',redirect:'manual',headers:credentials});
  const raw=await info.text();
  let detail={};try{if(raw.length<=1500)detail=JSON.parse(raw)}catch{}
  const safe={
   code:typeof detail.code==='string'?detail.code.slice(0,70):null,
   error:typeof detail.error==='string'?detail.error.slice(0,70):null,
   message:typeof detail.message==='string'?detail.message.slice(0,90):null,
   statusCode:typeof detail.statusCode==='string'||typeof detail.statusCode==='number'?detail.statusCode:null
  };
  return res({ok:true,webOrderId:WEB,headStatus:head.status,
   infoStatus:info.status,notFoundError:safe,deletedBytesPreviously:1102,
   paymentVerified:false,deliveryVerified:false,storageMutation:false});
 }catch{return res({ok:false,error:'Error de diagnóstico privado'},503)}
}
