/**
 * Librería Saber — endpoints TUS del Worker PRIVADO, siempre apagados salvo
 * DOCS_TUS_PRIVATE_ENABLED=PRIVATE_TEST_ONLY y Basic/cookie del ensayo V2.
 *
 * Backend único:
 * - start: Worker firma manifiesto y pide dos/varios tokens privados de TUS;
 * - commit: vuelve a LEER y revalidar PDF de Supabase, recalcula tarifas
 *   con motor original, registra D1 mediante la Central existente;
 * - download: SOLO personal autenticado, nunca URL pública de Storage.
 *
 * Requiere en env DOCS_TUS_RECEIPT_KEY (nuevo HMAC >=32),
 * DOCS_TUS_SUPABASE_SERVICE_KEY (Supabase service_role, SÓLO Worker) y
 * DOCS_TUS_PUBLISHABLE_KEY (clave pública). No pedir estas claves en chat.
 * Este código NO activa pagos ni altera el sitio comercial.
 */
import {crearTandaTUS,validarMetasTUS} from './tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from './tus-pedido-puente.mjs';
import {registrarManifiestoV2EnCentral} from './registrar-manifiesto-v2-central.mjs';
import {prepararDocumentosCentralFirmado} from './preparar-documentos-central.mjs';
const PROJECT='qkbbqzbannyhuanngjpw';
const API='https://'+PROJECT+'.supabase.co';
const STORAGE='https://'+PROJECT+'.storage.supabase.co';
const BUCKET='saber-tus-lab';
const FLAG='PRIVATE_TEST_ONLY';
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const RECEIPT=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_REQUEST=64000;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,
 headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow'}});
export function tusPrivadoConfigurado(env){
 return env?.DOCS_TUS_PRIVATE_ENABLED===FLAG&&
   env?.DOCS_V2_PRIVATE_UI_ENABLED===FLAG&&
   env?.DOCS_CENTRAL_SYNC_ENABLED===FLAG&&
   env?.DOCS_ORDER_PREPARE_ENABLED===FLAG&&
   typeof env.DOCS_TUS_RECEIPT_KEY==='string'&&env.DOCS_TUS_RECEIPT_KEY.length>=32&&
   typeof env.DOCS_TUS_SUPABASE_SERVICE_KEY==='string'&&env.DOCS_TUS_SUPABASE_SERVICE_KEY.length>40&&
   typeof env.DOCS_TUS_PUBLISHABLE_KEY==='string'&&env.DOCS_TUS_PUBLISHABLE_KEY.length>30&&
   env.DOCS_TUS_RECEIPT_KEY!==env.CENTRAL_BRIDGE_KEY&&
   env.DOCS_TUS_RECEIPT_KEY!==env.DOCS_RELAY_KEY&&
   env.DOCS_TUS_RECEIPT_KEY!==env.DOCS_CENTRAL_ADMIN_KEY;
}
function ensureRequest(request,env,authorized){
 if(!tusPrivadoConfigurado(env))throw Error('private-tus-off');
 if(request.method!=='POST'||authorized!==true)
  throw Error('private-tus-denied');
 const u=new URL(request.url);
 if(u.protocol!=='https:'||request.headers.get('Origin')!==u.origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  throw Error('private-tus-origin');
}
async function bodyJSON(req){
 const len=Number(req.headers.get('content-length')||0);
 if(len>MAX_REQUEST)throw Error('private-tus-size');
 const raw=await req.text();
 if(raw.length>MAX_REQUEST)throw Error('private-tus-size');
 return JSON.parse(raw);
}
function privateHeaders(env){
 return {
   apikey:env.DOCS_TUS_SUPABASE_SERVICE_KEY,
   Authorization:'Bearer '+env.DOCS_TUS_SUPABASE_SERVICE_KEY,
 };
}
function pathUrl(objectName){
 if(typeof objectName!=='string'||!/^[A-Za-z0-9_./-]+$/.test(objectName)||
  objectName.includes('..')||!objectName.startsWith('v2/'))
  throw Error('Ruta de archivo privado inválida.');
 return objectName.split('/').map(encodeURIComponent).join('/');
}
export async function firmarSubidaSupabase(env,objectName,{fetcher=fetch}={}){
 const url=API+'/storage/v1/object/upload/sign/'+BUCKET+'/'+pathUrl(objectName);
 const r=await fetcher(url,{method:'POST',headers:{
   ...privateHeaders(env),'Content-Type':'application/json',
 },body:'{}',redirect:'error'});
 const raw=await r.text();
 if(!r.ok||raw.length>2000)throw Error('Supabase no autorizó la subida privada.');
 let answer;
 try{answer=JSON.parse(raw)}catch{throw Error('Firma de Storage ilegible.')}
 if(typeof answer?.token!=='string'||answer.token.length<12)
  throw Error('No se recibió un token de subida por PDF.');
 return answer.token;
}
export async function leerObjetoTUSPrivado(env,objectName,{fetcher=fetch}={}){
 const url=API+'/storage/v1/object/'+BUCKET+'/'+pathUrl(objectName);
 const r=await fetcher(url,{headers:privateHeaders(env),redirect:'error'});
 if(!r.ok||Number(r.headers.get('Content-Length')||0)>20*1024*1024)
  throw Error('No se pudo leer el PDF privado.');
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.byteLength<5||bytes.byteLength>20*1024*1024)
  throw Error('PDF ausente o fuera del límite autorizado.');
 return bytes;
}
export function manifiestoServidorTUS({verificacion,claims}){
 const recibos=new Map(verificacion.recibos.map(r=>[r.receiptId,r]));
 const trabajos=new Map(verificacion.ficha.trabajos.map(r=>[r.reciboPrivado,r]));
 if(claims.length!==recibos.size||claims.length!==trabajos.size)
  throw Error('La ficha no contiene todos los PDF.');
 const items=claims.map(c=>{
  const r=recibos.get(c.receiptId),f=trabajos.get(c.receiptId);
  if(!r||!f||r.sha256!==c.sha256||r.pages!==c.pages||r.fileId!==c.fileId||
     f.sha256!==c.sha256||f.paginasOriginales!==c.pages)
   throw Error('Ficha y recibo TUS incompatibles.');
  const opciones=f.servicio==='ploteos'?
   {servicio:'ploteos',copias:f.copias,papelPoster:c.opciones.papelPoster}:
   {formato:f.formatoFinal,caras:f.carasPresupuestadas,copias:f.copias,
    anillado:f.tipoAnillado,grupoAnillado:c.opciones.grupoAnillado||'',
    materialColor:c.opciones.materialColor};
  return {
   reciboPrivado:c.receiptId,sha256:c.sha256,paginas:c.pages,
   opciones,estado:'REQUIERE_REVALIDACION_DE_BACKEND',
   subtotalReferencia:0,versionPrecioReferencia:'recalculado_servidor'
  };
 });
 return {
  schema:'saber-v2-manifiesto-preliminar-v1',orderId:verificacion.orderId,
  items,totalOrientativo:verificacion.importeVerificado,
  receiptsRecheckedByBackend:false,pricesRecalculatedByBackend:false,
  registeredInD1:false,checkoutEnabled:false,paymentAuthorized:false,
  listoParaProducir:false,
 };
}
export async function iniciarTandaTUSPrivada(request,env,{
 authorized=false,fetcher=fetch,uuid=()=>crypto.randomUUID(),ahora,
}={}){
 try{
  ensureRequest(request,env,authorized);
  const input=await bodyJSON(request);
  if(!input||Object.keys(input).sort().join(',')!=='metas,orderId')
   throw Error('Solicitud TUS incorrecta.');
  validarMetasTUS(input);
  const result=await crearTandaTUS({
   ...input,secret:env.DOCS_TUS_RECEIPT_KEY,uuid,ahora,
   firmarSubida:objectName=>firmarSubidaSupabase(env,objectName,{fetcher})
  });
  return json({ok:true,...result,projectRef:PROJECT,bucket:BUCKET,
   publishableKey:env.DOCS_TUS_PUBLISHABLE_KEY,
   paymentAuthorized:false,checkoutEnabled:false});
 }catch(e){
  console.warn('saber_tus_private_start',typeof e?.message==='string'&&e.message.startsWith('private-')?'GATE':'REJECT');
  return json({ok:false,error:'No se pudo autorizar la tanda de PDF.',paymentAuthorized:false},403);
 }
}
export async function finalizarPedidoTUSPrivado(request,env,{
 authorized=false,fetcher=fetch,preciosServidor,puente,ahora,
 registrar=registrarManifiestoV2EnCentral,
 preparar=prepararDocumentosCentralFirmado,
}={}){
 try{
  ensureRequest(request,env,authorized);
  const input=await bodyJSON(request);
  if(!input||Object.keys(input).sort().join(',')!=='clientOrderId,entries,orderId'||
     !UUID.test(input.clientOrderId||''))
   throw Error('Pedido privado inválido.');
  const checked=await verificarTandaTUSYRecalcular({
   orderId:input.orderId,entries:input.entries,
   secret:env.DOCS_TUS_RECEIPT_KEY,ahora,
   leerObjetoPrivado:objectName=>leerObjetoTUSPrivado(env,objectName,{fetcher}),
   preciosServidor,puente
  });
  const manifiesto=manifiestoServidorTUS(checked);
  const registrado=await registrar({
   manifiesto,verificacion:checked.verificacion,env
  });
  if(registrado.orderId!==checked.verificacion.orderId||
    registrado.archivos!==checked.claims.length||registrado.registeredInD1!==true)
   throw Error('Registro privado de D1 incongruente.');
  const pedido=await preparar({
   env,webOrderId:registrado.orderId,clientOrderId:input.clientOrderId,items:[]
  });
  if(pedido.amountArs!==checked.verificacion.importeVerificado||
     pedido.paymentAuthorized!==false)
   throw Error('Importe privado no coincide con el servidor.');
  return json({
   ok:true,webOrderId:registrado.orderId,orderId:pedido.commercialOrderId,
   archivosVerificados:checked.claims.length,totalArs:pedido.amountArs,
   idempotent:pedido.idempotent,carritoDocumentalV2:true,
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false,
   message:'PDF privados comprobados y pedido registrado, sin cobro.'
  });
 }catch(_){
  console.warn('saber_tus_private_commit_rejected');
  return json({ok:false,error:'Pedido pendiente; no se registró un pago.',
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false},422);
 }
}
export async function descargarPdfTUSPersonal(request,env,{
 authorized=false,fetcher=fetch
}={}){
 try{
  ensureRequest(request,env,authorized);
  const input=await bodyJSON(request);
  if(!input||Object.keys(input).sort().join(',')!=='orderId,receiptId'||
     !ORDER.test(input.orderId||'')||!RECEIPT.test(input.receiptId||''))
   throw Error('Consulta de PDF inválida.');
  const path='v2/'+input.orderId+'/'+input.receiptId.slice(4)+'.pdf';
  const bytes=await leerObjetoTUSPrivado(env,path,{fetcher});
  // Verificar al menos estructura PDF al descargar; el SHA completo se
  // validó antes de ingresar a D1. Acceso requiere auth de OPERADOR.
  if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
   throw Error('Objeto privado no es PDF.');
  return new Response(bytes,{status:200,headers:{
   'Content-Type':'application/pdf','Cache-Control':'no-store, private',
   'Content-Disposition':'attachment; filename="documento-verificado.pdf"',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(_){return json({ok:false,error:'Descarga privada no autorizada.'},403);}
}
