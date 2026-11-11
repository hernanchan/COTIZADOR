/** Internal staff-only bridge to create a nonpayable universal D1 order.
 * No quote total, checkout token or R2 permission supplied by the browser.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const response=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store,private'}});
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
export async function prepararOrdenUniversalSinCheckout(req,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID()
}={}){
 if(authorized!==true)return response({ok:false,error:'UNIVERSAL_ORDEN_ACCESO_RECHAZADO'},401);
 if(env?.DOCS_R2_UNIVERSAL_ORDER_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return response({ok:false,error:'UNIVERSAL_ORDEN_NO_HABILITADA'},503);
 const url=new URL(req.url);
 if(req.method!=='POST'||req.headers.get('Origin')!==url.origin||
    !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
    (req.headers.get('Sec-Fetch-Site')&&
     !['same-origin','none'].includes(req.headers.get('Sec-Fetch-Site'))))
  return response({ok:false,error:'UNIVERSAL_ORDEN_ORIGEN_INVALIDO'},403);
 const raw=await req.text();
 if(raw.length>1200)return response({ok:false,error:'UNIVERSAL_ORDEN_LIMITE'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    !Object.keys(p).every(k=>['draftId','quoteHash','telefono','webOrderId','nombre','direccion'].includes(k))||
    !['draftId','quoteHash','telefono','webOrderId'].every(k=>Object.hasOwn(p,k))||
    !WEB.test(p.webOrderId||'')||!UUID.test(p.draftId||'')||
    !SHA.test(p.quoteHash||'')||typeof p.telefono!=='string'||
    !/^\+?[0-9 ()-]{10,26}$/.test(p.telefono)||
    p.telefono.replace(/\D/g,'').length<10||p.telefono.replace(/\D/g,'').length>15||
    (p.nombre!==undefined&&(typeof p.nombre!=='string'||p.nombre.trim().length<2||p.nombre.trim().length>100||/[<>]/.test(p.nombre)))||
    (p.direccion!==undefined&&(typeof p.direccion!=='string'||p.direccion.trim().length>180||/[<>]/.test(p.direccion))))
  return response({ok:false,error:'UNIVERSAL_ORDEN_PARAMETROS'},422);
 let central;try{central=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!central||central.protocol!=='https:'||!HOST.test(central.hostname)||
    central.pathname!=='/internal/central/stage'||central.search||
    central.hash||central.port||central.username||central.password)
  return response({ok:false,error:'UNIVERSAL_ORDEN_DESTINO_INVALIDO'},503);
 central.pathname='/internal/central/r2-universal-order';
 const body=JSON.stringify({schema:'saber-central-r2-universal-create-order-v1',...p});
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return response({ok:false,error:'UNIVERSAL_ORDEN_IDENTIFICACION_INVALIDA'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let responseCentral;
 try{responseCentral=await service.fetch(new Request(central.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':signature
  },body
 }))}catch{return response({ok:false,error:'UNIVERSAL_ORDEN_CENTRAL_INDISPONIBLE'},503)}
 if(!responseCentral.ok)return response({ok:false,error:'UNIVERSAL_ORDEN_CENTRAL_RECHAZA'},
  responseCentral.status===409?409:503);
 const saved=await responseCentral.json().catch(()=>null);
 if(!saved||saved.ok!==true||saved.webOrderId!==p.webOrderId||
    !UUID.test(saved.commercialOrderId||'')||
    !/^\d{3,}$/.test(saved.numeroOrden||'')||
    !Number.isSafeInteger(saved.totalArs)||saved.totalArs<1||
    !Number.isSafeInteger(saved.fileCount)||saved.fileCount<1||saved.fileCount>10||
    saved.checkoutEnabled!==false||saved.paymentAuthorized!==false||
    saved.uploadAuthorized!==false||saved.filesUploaded!==false||
    saved.productionAuthorized!==false)
  return response({ok:false,error:'UNIVERSAL_ORDEN_CENTRAL_NO_COINCIDE'},502);
 return response(saved,saved.idempotent?200:201);
}
