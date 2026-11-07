/**
 * Presupuesto + orden documental SIN original: P0 ploteo grande, un PDF por
 * pedido. NO crea MP checkout ni inicia R2. Recalcula precio en Documentos
 * con tarifas APROBADAS D1, nunca recibe un total del navegador.
 */
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {obtenerTarifarioD1Privado} from './obtener-tarifario-d1-privado.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const MIB=1024*1024;
const response=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'
}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function prepararR2PagoSinArchivo(request,env,{
 authorized=false,priceLoader=obtenerTarifarioD1Privado,
 service=env?.SABER_CENTRAL,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(!authorized)return response({ok:false,error:'R2_PREPAGO_SESION_NO_AUTORIZADA'},401);
 if(env?.DOCS_R2_PREPAY_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_PRICE_ADMIN_D1_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')
  return response({ok:false,error:'R2_PREPAGO_NO_CONFIGURADO'},503);
 const origin=new URL(request.url).origin;
 if(request.method!=='POST'||request.headers.get('Origin')!==origin||
  (request.headers.get('Sec-Fetch-Site')&&
   request.headers.get('Sec-Fetch-Site')!=='same-origin')||
  !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return response({ok:false,error:'R2_PREPAGO_ORIGEN_RECHAZADO'},403);
 const raw=await request.text();
 if(raw.length>150000)return response({ok:false,error:'R2_PREPAGO_SOLICITUD_EXTENSA'},413);
 let p;try{p=JSON.parse(raw)}catch{return response({ok:false,error:'R2_PREPAGO_JSON_INVALIDO'},400)}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='archivos,bytes,fileId,sha256,webOrderId'||
    !WEB.test(p.webOrderId||'')||!FILE.test(p.fileId||'')||
    !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||
    p.bytes<=40*MIB||p.bytes>200*MIB||
    !Array.isArray(p.archivos)||p.archivos.length!==1)
  return response({ok:false,error:'R2_PREPAGO_IDENTIDAD_INVALIDA'},422);
 let price,quote;
 try{
  const snapshot=await priceLoader(env);
  if(!snapshot||snapshot.source!=='private-d1-approved-only'||
    !Number.isSafeInteger(snapshot.revision)||snapshot.revision<1||
    snapshot.prices?.priceVersion!=='d1-approved-revision-'+snapshot.revision)
   throw Error('D1 sin revisión aprobada');
  price=snapshot;
  quote=cotizarCargaUnica({archivos:p.archivos,precios:snapshot.prices});
 }catch{
  return response({ok:false,error:'R2_PREPAGO_COTIZACION_NO_VALIDADA'},422);
 }
 const file=p.archivos[0];
 if(quote.estado!=='PRELIMINAR'||quote.paymentAuthorized!==false||
    !Number.isSafeInteger(quote.total)||quote.total<1||quote.total>50000000||
    quote.plan.length!==1||quote.plan[0].destino!=='ploteos'||
    quote.detallePloteos.length!==1||quote.pendientes.length||
    file.paginas?.length<1||file.paginas.length>2000||
    file.servicio!=='auto')
  return response({ok:false,error:'R2_PREPAGO_SOLO_PLOTEO_COMPLETO'},422);
 const t=now(),id=nonce();
 if(!Number.isSafeInteger(t)||t<1000000000||t>9999999999||
    !/^[a-f0-9-]{36}$/i.test(id))
  return response({ok:false,error:'R2_PREPAGO_IDENTIFICACION_NO_VALIDA'},503);
 let url;try{url=new URL(env.CENTRAL_TEST_URL)}catch{}
 if(!url||url.protocol!=='https:'||!HOST.test(url.hostname)||
    url.pathname!=='/internal/central/stage'||url.search||url.hash||
    url.port||url.username||url.password)
  return response({ok:false,error:'R2_PREPAGO_CENTRAL_INVALIDA'},503);
 url.pathname='/internal/central/r2-prepay-intent';
 const quoteBytes=new TextEncoder().encode(JSON.stringify({
  files:p.archivos,priceRevision:price.revision,quote
 }));
 const digest=hex(new Uint8Array(await subtle.digest('SHA-256',quoteBytes)));
 const data={schema:'saber-central-r2-prepaid-intent-v1',
  webOrderId:p.webOrderId,fileId:p.fileId,sha256:p.sha256,
  bytes:p.bytes,amountArs:quote.total,declaredPages:file.paginas.length,
  quoteSha256:digest,quoteRevision:price.prices.priceVersion};
 const body=JSON.stringify(data);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(t+'\n'+id+'\n'+body))));
 let r;try{
  r=await service.fetch(new Request(url.href,{method:'POST',
   headers:{'Content-Type':'application/json','x-saber-ts':String(t),
    'x-saber-request-id':id,'x-saber-signature':sig},body}));
 }catch{return response({ok:false,error:'R2_PREPAGO_CENTRAL_NO_RESPONDE'},503)}
 if(!r.ok)return response({ok:false,error:'R2_PREPAGO_CENTRAL_RECHAZO'},r.status===409?409:503);
 let saved;try{saved=await r.json()}catch{return response({ok:false,error:'R2_PREPAGO_RESPUESTA_INVALIDA'},502)}
 if(saved?.ok!==true||saved.webOrderId!==p.webOrderId||
    !/^[a-f0-9-]{36}$/i.test(saved.commercialOrderId||'')||
    saved.amountArs!==quote.total||saved.filesUploaded!==false||
    saved.paymentAuthorized!==false)
  return response({ok:false,error:'R2_PREPAGO_CENTRAL_NO_COINCIDE'},502);
 return response({ok:true,webOrderId:p.webOrderId,
  commercialOrderId:saved.commercialOrderId,amountArs:quote.total,
  priceRevision:price.prices.priceVersion,declaredPages:file.paginas.length,
  quoteState:'PRELIMINAR_SIN_ARCHIVO',filesUploaded:false,
  paymentAuthorized:false,uploadAuthorized:false,checkoutEnabled:false,
  note:'Cotización declarada por comprador. Sin original verificado. Pago y R2 aún bloqueados.'
 },saved.idempotent?200:201);
}
