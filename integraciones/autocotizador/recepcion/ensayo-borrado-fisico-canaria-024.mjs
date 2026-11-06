/**
 * ENSAYO TEMPORAL Y DESCARTABLE DE SUPABASE STORAGE — 06/11/2026.
 *
 * NO es el flujo "Entregado" ni una acreditación de pago.
 * Se carga SOLO mediante una versión temporal del Worker documental de PRUEBAS,
 * desde GitHub Actions y con restauración de versión original en el mismo job.
 *
 * Único objeto autorizado: PDF sintético creado por workflow 42205254413.
 * No existe elección de ruta ni bucket por parte del solicitante.
 * El código normal de producción NO importa este módulo.
 */
const WEB='WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4';
const PATH='v2/'+WEB+'/3c98ffd9-ab0a-47ae-ad92-125dd7c9a2a5.pdf';
const HASH='5d28e8b1a783c8dc4d0b038db26f497498e29b88ea9f5d8042c4e92e81dd7ac6';
const BYTES=1102;
const BUCKET='saber-tus-lab';
const STORAGE='https://qkbbqzbannyhuanngjpw.storage.supabase.co/storage/v1/object/'+BUCKET;
const ENDPOINT='/internal/ensayo-unico-borrar-canaria-024';
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store,private',
 'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'
}});
const exact=(actual,expected)=>{
 if(typeof actual!=='string'||actual.length!==expected.length)return false;
 let difference=0;
 for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
 return difference===0;
};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const headerMap=(key)=>({apikey:key,Authorization:'Bearer '+key});
const allow=(req,env)=>{
 if(req.method!=='POST'||new URL(req.url).pathname!==ENDPOINT||
  !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
  req.headers.get('Origin')!=='https://saber-documentos-pruebas.libreriasaber.workers.dev')return false;
 if(env.DOCS_CANARY_DISPOSAL_ENABLED!=='PRIVATE_TEST_ONLY'||
  env.DOCS_TUS_PURGE_ENABLED!=='OFF'||
  env.DOCS_TUS_PURGE_CANARY_ORDER!==WEB||
  env.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env.DOCS_V2_PRIVATE_UI_SECRET!=='string'||env.DOCS_V2_PRIVATE_UI_SECRET.length<32||
  typeof env.DOCS_CANARY_DISPOSAL_NONCE!=='string'||env.DOCS_CANARY_DISPOSAL_NONCE.length!==48||
  typeof env.DOCS_TUS_SUPABASE_SERVICE_KEY!=='string'||env.DOCS_TUS_SUPABASE_SERVICE_KEY.length<32)
  return false;
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Basic ')||authorization.length>400)return false;
 let basic;try{basic=atob(authorization.slice(6))}catch{return false}
 return exact(basic,'operador:'+env.DOCS_V2_PRIVATE_UI_SECRET)&&
  exact(req.headers.get('x-saber-disposable-nonce'),'012345678901234567890123456789012345678901234567')===false&&
  exact(req.headers.get('x-saber-disposable-nonce'),env.DOCS_CANARY_DISPOSAL_NONCE);
};
export async function borrarCanariaSinteticaUnica(request,env,{fetcher=fetch,subtle=crypto.subtle}={}){
 if(!allow(request,env))return reply({ok:false,error:'Ensayo aislado no autorizado'},403);
 let data;
 try{
  const raw=await request.text();
  if(raw.length>400)throw Error('exceso');
  data=JSON.parse(raw);
 }catch{return reply({ok:false,error:'Solicitud incorrecta'},422)}
 if(!data||typeof data!=='object'||Array.isArray(data)||
   Object.keys(data).sort().join(',')!=='operation,webOrderId'||
   data.operation!=='delete-synthetic-canary-only'||
   data.webOrderId!==WEB)
  return reply({ok:false,error:'Referencia canaria incompatible'},422);
 const pathUrl=STORAGE+'/'+PATH.split('/').map(encodeURIComponent).join('/');
 const token=env.DOCS_TUS_SUPABASE_SERVICE_KEY;
 const headers=headerMap(token);
 try{
  // Los bytes reales deben coincidir con el PDF canario original: ningún
  // archivo ajeno ni sobreescrito puede alcanzar DELETE.
  const before=await fetcher(pathUrl,{method:'GET',redirect:'manual',headers});
  if(before.status!==200)return reply({ok:false,error:'El PDF sintético no está presente'},409);
  const received=new Uint8Array(await before.arrayBuffer());
  if(received.byteLength!==BYTES)return reply({ok:false,error:'Tamaño canario distinto'},409);
  const checksum=hex(new Uint8Array(await subtle.digest('SHA-256',received)));
  if(checksum!==HASH)return reply({ok:false,error:'Hash canario distinto'},409);
  const deletion=await fetcher(STORAGE,{method:'DELETE',redirect:'manual',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({prefixes:[PATH]})});
  if(!deletion.ok)return reply({ok:false,error:'Supabase rechazó la eliminación'},502);
  const after=await fetcher(pathUrl,{method:'HEAD',redirect:'manual',headers});
  if(after.status!==404)return reply({ok:false,error:'Archivo sigue presente o no se verificó la ausencia'},503);
  return reply({ok:true,webOrderId:WEB,bucket:BUCKET,deletedCount:1,removedObject:PATH,
   sha256Verified:true,verifiedAbsent:true,testOnly:true,paymentVerified:false,deliveryVerified:false});
 }catch{
  return reply({ok:false,error:'Falló la comprobación de almacenamiento'},503);
 }
}
export const UNIQUE_CANARY={webOrderId:WEB,objectName:PATH,bytes:BYTES,sha256:HASH};
