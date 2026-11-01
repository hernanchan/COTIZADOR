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
const SHA=/^[a-f0-9]{64}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_REQUEST=64000;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,
 headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow'}});
/** Diagnóstico protegido: SOLO nombres de requisitos, jamás valores secretos. */
export function diagnosticarTUSPrivado(env){
 const has=(key,min)=>typeof env?.[key]==='string'&&env[key].length>=min;
 const checks=[
  ['DOCS_TUS_PRIVATE_ENABLED',env?.DOCS_TUS_PRIVATE_ENABLED===FLAG],
  ['DOCS_V2_PRIVATE_UI_ENABLED',env?.DOCS_V2_PRIVATE_UI_ENABLED===FLAG],
  ['DOCS_CENTRAL_SYNC_ENABLED',env?.DOCS_CENTRAL_SYNC_ENABLED===FLAG],
  ['DOCS_ORDER_PREPARE_ENABLED',env?.DOCS_ORDER_PREPARE_ENABLED===FLAG],
  ['DOCS_TUS_RECEIPT_KEY',has('DOCS_TUS_RECEIPT_KEY',32)&&
   ![env?.CENTRAL_BRIDGE_KEY,env?.DOCS_RELAY_KEY,env?.DOCS_CENTRAL_ADMIN_KEY]
    .includes(env?.DOCS_TUS_RECEIPT_KEY)],
  ['DOCS_TUS_SUPABASE_SERVICE_KEY',has('DOCS_TUS_SUPABASE_SERVICE_KEY',41)],
  ['DOCS_TUS_PUBLISHABLE_KEY',has('DOCS_TUS_PUBLISHABLE_KEY',31)]
 ];
 const invalidos=checks.filter(([,ok])=>!ok).map(([name])=>name);
 return Object.freeze({
  solicitado:env?.DOCS_TUS_PRIVATE_ENABLED===FLAG,
  listo:invalidos.length===0,
  invalidos:Object.freeze(invalidos)
 });
}
export function tusPrivadoConfigurado(env){
 return diagnosticarTUSPrivado(env).listo;
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
 if(!r.ok||raw.length>2000){
  const err=Error('Supabase no autorizó la subida privada.');
  err.code=r.ok?'STORAGE_RESPONSE_SIZE':'STORAGE_HTTP_'+r.status;
  throw err;
 }
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
/**
 * Preflight del ensayo privado: firma una ruta ALEATORIA y NO sube archivos.
 * No revela token, URL firmada, credenciales ni detalles de Storage.
 * Permite conocer la etapa de fallo ANTES de aceptar los PDF del cliente.
 */
export async function comprobarTUSAntesDeEnviar(request,env,{
 authorized=false,fetcher=fetch,uuid=()=>crypto.randomUUID()
}={}){
 try{
  ensureRequest(request,env,authorized);
 }catch(error){
  // Código fijo sin valores de secretos, cookies, tokens o encabezados.
  const safeCode={
   'private-tus-off':'CONFIGURACION_PRIVADA',
   'private-tus-denied':'SESION_PRIVADA',
   'private-tus-origin':'ORIGEN_SOLICITUD'
  }[error?.message]||'AUTORIZACION_PORTAL';
  return json({ok:false,etapa:safeCode,paymentAuthorized:false},403);
 }
 try{
  const id=uuid();
  if(!UUID.test(id))throw Error('Id diagnóstico incorrecto.');
  const objectName='v2/WEB-DIAGNOSTICO-'+id+'/'+id+'.pdf';
  const signature=await firmarSubidaSupabase(env,objectName,{fetcher});
  if(typeof signature!=='string'||signature.length<12)
   throw Error('Firma de diagnóstico incorrecta.');
  return json({ok:true,etapa:'STORAGE_FIRMA_OK',paymentAuthorized:false,
   archivosSubidos:0});
 }catch(error){
  const code=typeof error?.code==='string'&&/^STORAGE_(HTTP_[0-9]{3}|RESPONSE_SIZE)$/.test(error.code)
   ?error.code:'STORAGE_FIRMA_ERROR';
  console.warn('saber_tus_private_preflight',code);
  return json({ok:false,etapa:code,paymentAuthorized:false,archivosSubidos:0},503);
 }
}
export async function iniciarTandaTUSPrivada(request,env,{
 authorized=false,fetcher=fetch,uuid=()=>crypto.randomUUID(),ahora,
}={}){
 let etapa='AUTORIZACION_PORTAL';
 try{
  ensureRequest(request,env,authorized);
  etapa='METADATOS';
  const input=await bodyJSON(request);
  if(!input||Object.keys(input).sort().join(',')!=='metas,orderId')
   throw Error('Solicitud TUS incorrecta.');
  validarMetasTUS(input);
  etapa='STORAGE_FIRMA';
  const result=await crearTandaTUS({
   ...input,secret:env.DOCS_TUS_RECEIPT_KEY,uuid,ahora,
   firmarSubida:objectName=>firmarSubidaSupabase(env,objectName,{fetcher})
  });
  return json({ok:true,...result,projectRef:PROJECT,bucket:BUCKET,
   publishableKey:env.DOCS_TUS_PUBLISHABLE_KEY,
   paymentAuthorized:false,checkoutEnabled:false});
 }catch(e){
  const code=typeof e?.code==='string'&&/^STORAGE_(HTTP_[0-9]{3}|RESPONSE_SIZE)$/.test(e.code)
   ?e.code:etapa;
  console.warn('saber_tus_private_start',code);
  return json({ok:false,error:'No se pudo autorizar la tanda de PDF.',etapa:code,
   paymentAuthorized:false},403);
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
/** Pregunta a D1 por un recibo mediante el Service Binding ya firmado.
 * El operador no puede descargar un PDF no registrado en su pedido.
 */
export async function consultarReciboTUSFirmadoD1(env,orderId,receiptId,{
 service=env?.SABER_CENTRAL,now=()=>Math.floor(Date.now()/1000),
 uuid=()=>crypto.randomUUID(),subtle=crypto.subtle,
}={}){
 if(!ORDER.test(orderId||'')||!RECEIPT.test(receiptId||'')||
    typeof service?.fetch!=='function'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  throw Error('No se puede verificar el recibo contra D1.');
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{throw Error('Central de ensayo ausente.')}
 if(target.protocol!=='https:'||
    !/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/.test(target.hostname)||
    target.pathname!=='/internal/central/stage'||target.search||target.hash||
    target.port||target.username||target.password)
  throw Error('Destino de Central no autorizado.');
 target.pathname='/internal/central/receipt-check';
 const body=JSON.stringify({schema:'saber-central-tus-recibo-lookup-v1',webOrderId:orderId,receiptId});
 const ts=now(),requestId=uuid();
 if(!Number.isSafeInteger(ts)||!UUID.test(requestId))throw Error('Nonce de consulta D1 incorrecto.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+requestId+'\n'+body))),v=>v.toString(16).padStart(2,'0')).join('');
 const response=await service.fetch(new Request(target.href,{method:'POST',
  headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':requestId,
   'x-saber-signature':signature},body
 }));
 const raw=await response.text();
 if(response.status!==200||raw.length>2400)
  throw Error('D1 no confirmó la pertenencia del recibo.');
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('Recibo D1 ilegible.')}
 if(data?.ok!==true||data.found!==true||
    data.schema!=='saber-central-tus-recibo-lookup-v1'||
    data.webOrderId!==orderId||data.receiptId!==receiptId||
    data.paymentAuthorized!==false||data.listoParaProducir!==false||
    !SHA.test(data.sha256||'')||
    !Number.isSafeInteger(data.bytes)||data.bytes<5||data.bytes>20*1024*1024||
    !Number.isSafeInteger(data.pages)||data.pages<1||data.pages>2000)
  throw Error('D1 devolvió un recibo fuera del pedido.');
 return Object.freeze(data);
}

export async function descargarPdfTUSPersonal(request,env,{
 authorized=false,fetcher=fetch,
 revisarD1=consultarReciboTUSFirmadoD1,
 subtle=crypto.subtle,
}={}){
 try{
  ensureRequest(request,env,authorized);
  const input=await bodyJSON(request);
  if(!input||Object.keys(input).sort().join(',')!=='orderId,receiptId'||
     !ORDER.test(input.orderId||'')||!RECEIPT.test(input.receiptId||''))
   throw Error('Consulta de PDF inválida.');
  // Primera barrera: confirmar pertenencia real D1 ANTES de descargar Storage.
  const entry=await revisarD1(env,input.orderId,input.receiptId);
  if(!entry||entry.receiptId!==input.receiptId||entry.webOrderId!==input.orderId||
    entry.found!==true||!SHA.test(entry.sha256||'')||
    !Number.isSafeInteger(entry.bytes)||entry.bytes<5||entry.bytes>20*1024*1024)
   throw Error('El archivo no pertenece al pedido registrado.');
  const path='v2/'+input.orderId+'/'+input.receiptId.slice(4)+'.pdf';
  const bytes=await leerObjetoTUSPrivado(env,path,{fetcher});
  if(bytes.length!==entry.bytes||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
   throw Error('Objeto privado incompatible con D1.');
  // Segunda barrera: el objeto descargado DEBE coincidir con el SHA de D1.
  const digest=new Uint8Array(await subtle.digest('SHA-256',bytes));
  const calculated=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
  if(calculated!==entry.sha256)throw Error('Integridad del archivo D1 no confirmada.');
  const filename=input.receiptId+'.pdf';
  return new Response(bytes,{status:200,headers:{
   'Content-Type':'application/pdf','Cache-Control':'no-store, private',
   'Content-Disposition':'attachment; filename="'+filename+'"',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(_){return json({ok:false,error:'Descarga privada no autorizada.'},403);}
}
