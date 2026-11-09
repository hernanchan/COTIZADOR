/**
 * Resuelve un recibo R2 pagado para el operador, sin exponer objectKey ni
 * usar la clave de la Central en el navegador. Todas las consultas internas
 * son HMAC entre Workers, NO acepta URL o receipt enviados como autoridad.
 * Solo HTTP Basic de personal; no usa cookie de comprador.
 */
import {consultarReservaR2Documentos} from './r2-reserva-consulta-documentos.mjs';
import {consultarR2PendienteCentral} from './r2-grandes-lookup-central.mjs';
import {comprobarPagoR2EnCentral} from './r2-confirmar-pago-central.mjs';
import {pagoAprobadoParaR2} from './r2-recepcion-solo-pagada.mjs';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ROUTE='/prueba-v2/api/ensayo-r2-referencia-personal';
const response=(body,status=200)=>Response.json({productionAuthorized:false,readyForPrinting:false,...body},
 {status,headers:{'Cache-Control':'no-store,private',
  'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow',
  'Referrer-Policy':'no-referrer'}});
export async function resolverReferenciaR2Personal(request,env,{
 authorized=false,reserve=consultarReservaR2Documentos,
 lookup=consultarR2PendienteCentral,payment=comprobarPagoR2EnCentral,
 now=()=>Math.floor(Date.now()/1000)
}={}){
 if(authorized!==true)return response({ok:false,error:'R2_REFERENCIA_SIN_AUTORIZACION'},403);
 if(env?.DOCS_R2_BIG_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_R2_QUOTA_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_R2_POSTPAY_REQUIRED!=='PRIVATE_TEST_ONLY'||
  !env?.SABER_R2_GRANDES||typeof env.SABER_R2_GRANDES.head!=='function')
  return response({ok:false,error:'R2_REFERENCIA_NO_CONFIGURADA'},503);
 const u=new URL(request.url);
 if(request.method!=='POST'||u.pathname!==ROUTE||u.protocol!=='https:'||
    u.search||u.hash||request.headers.get('Origin')!==u.origin||
    (request.headers.get('Sec-Fetch-Site')&&
     request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return response({ok:false,error:'R2_REFERENCIA_ORIGEN_INVALIDO'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return response({ok:false,error:'R2_REFERENCIA_FORMATO_INVALIDO'},415);
 try{
  if(Number(request.headers.get('Content-Length')||0)>1800)
   return response({ok:false,error:'R2_REFERENCIA_CUERPO_EXTENSO'},413);
  const raw=await request.text();
  if(raw.length>1800)return response({ok:false,error:'R2_REFERENCIA_CUERPO_EXTENSO'},413);
  const data=JSON.parse(raw);
  if(!data||Array.isArray(data)||typeof data!=='object'||
   Object.keys(data).sort().join(',')!=='bytes,fileId,sha256,webOrderId'||
   !WEB.test(data.webOrderId||'')||!FILE.test(data.fileId||'')||
   !SHA.test(data.sha256||'')||!Number.isSafeInteger(data.bytes)||
   data.bytes<=40*1024*1024||data.bytes>200*1024*1024)
   return response({ok:false,error:'R2_REFERENCIA_IDENTIDAD_INVALIDA'},422);
  const meta={fileId:data.fileId,sha256:data.sha256,bytes:data.bytes};
  const p=await payment({env,orderId:data.webOrderId,meta});
  if(!pagoAprobadoParaR2(p,data.webOrderId,now()))
   return response({ok:false,error:'R2_REFERENCIA_PAGO_NO_CONFIRMADO'},402);
  const reservation=await reserve({env,orderId:data.webOrderId,meta});
  if(reservation?.found!==true||reservation.state!=='reserved'||
     reservation.orderId!==data.webOrderId||
     reservation.fileId!==data.fileId||
     reservation.sha256!==data.sha256||reservation.bytes!==data.bytes)
   return response({ok:false,error:'R2_REFERENCIA_RESERVA_NO_COINCIDE'},409);
  const matched=/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/([a-f0-9-]{36})\.pdf$/i.exec(reservation.objectKey||'');
  if(!matched||!UUID.test(matched[1]))
   return response({ok:false,error:'R2_REFERENCIA_CLAVE_NO_VALIDA'},409);
  const receiptId='DOC-'+matched[1];
  const entry=await lookup(env,{orderId:data.webOrderId,receiptId});
  if(entry?.webOrderId!==data.webOrderId||entry.receiptId!==receiptId||
    entry.fileId!==data.fileId||entry.objectKey!==reservation.objectKey||
    entry.sha256!==data.sha256||entry.bytes!==data.bytes||
    entry.status!=='awaiting_pdf_analysis')
   return response({ok:false,error:'R2_REFERENCIA_REGISTRO_NO_COINCIDE'},409);
  const obj=await env.SABER_R2_GRANDES.head(entry.objectKey);
  if(!obj||obj.size!==entry.bytes||obj.etag!==entry.etag)
   return response({ok:false,error:'R2_REFERENCIA_OBJETO_NO_DISPONIBLE'},409);
  return response({ok:true,webOrderId:data.webOrderId,fileId:data.fileId,
    receiptId,sha256:entry.sha256,bytes:entry.bytes,
    declaredPages:entry.pagesDeclared,originalName:entry.name,
    paidVerified:true,received:true,status:'PREPRENSA_PENDIENTE'},200);
 }catch{
  return response({ok:false,error:'R2_REFERENCIA_NO_DISPONIBLE'},422);
 }
}
