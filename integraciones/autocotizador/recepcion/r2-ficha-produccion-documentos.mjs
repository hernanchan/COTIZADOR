/** Consulta privada de orden R2 aprobada en D1, autenticación Basic + HMAC. */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const DOC=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const response=(d,s=200)=>Response.json(d,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function fichaR2Personal(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 if(!authorized)return response({ok:false,error:'Personal no autorizado'},403);
 if(env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return response({ok:false,error:'Ficha privada deshabilitada'},503);
 const url=new URL(request.url);
 if(request.method!=='POST'||url.protocol!=='https:'||
    url.pathname!=='/prueba-v2/api/ensayo-r2-ficha-produccion-personal'||
    request.headers.get('Origin')!==url.origin||url.search||url.hash||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&
     request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return response({ok:false,error:'Origen no autorizado'},403);
 const raw=await request.text();if(raw.length>1000)return response({ok:false,error:'Solicitud extensa'},413);
 let data;try{data=JSON.parse(raw)}catch{}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).sort().join(',')!=='receiptId,webOrderId'||
    !WEB.test(data.webOrderId||'')||!DOC.test(data.receiptId||''))
  return response({ok:false,error:'Pedido R2 inválido'},422);
 let target;try{target=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!target||target.protocol!=='https:'||!HOST.test(target.hostname)||
    target.pathname!=='/internal/central/stage'||target.search||target.hash||
    target.username||target.password||target.port)
  return response({ok:false,error:'Central no configurada'},503);
 target.pathname='/internal/central/r2-production-sheet';
 const body=JSON.stringify({schema:'saber-central-r2-production-sheet-v1',
  webOrderId:data.webOrderId,receiptId:data.receiptId});
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!/^[a-f0-9-]{36}$/i.test(id))
  return response({ok:false,error:'Firma no disponible'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let result;
 try{result=await service.fetch(new Request(target.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig
 },body}))}
 catch{return response({ok:false,error:'Central no responde'},503)}
 if(!result.ok)return response({ok:false,error:'La preprensa todavía no está aprobada'},409);
 const text=await result.text();if(text.length>48000)
  return response({ok:false,error:'Ficha demasiado extensa'},502);
 let q;try{q=JSON.parse(text)}catch{}
 if(!q||q.ok!==true||q.schema!=='saber-central-r2-production-sheet-v1'||
    q.webOrderId!==data.webOrderId||q.receiptId!==data.receiptId||
    q.preprensaAprobada!==true||q.productionAuthorized!==false||
    q.readyForPrinting!==false||!/^\d{3,}$/.test(q.numeroOrden||'')||
    !Number.isSafeInteger(q.importe)||q.importe<1||
    !Number.isSafeInteger(q.copias)||q.copias<1||
    !['bn','color'].includes(q.modoImpresion)||
    typeof q.aprobadoPor!=='string'||q.aprobadoPor.length<2||
    !Array.isArray(q.paginas)||!q.paginas.length||q.paginas.length>2000||
    q.paginas.some(a=>!Array.isArray(a)||a.length!==5||
     !Number.isFinite(a[0])||!Number.isFinite(a[1])||
     !['cad','poster'].includes(a[2])))
  return response({ok:false,error:'Central devolvió datos no verificables'},502);
 return response(q,200);
}
