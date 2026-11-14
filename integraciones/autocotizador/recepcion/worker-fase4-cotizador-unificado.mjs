import {prepararPresupuestoDocumentos} from '../pruebas/cotizacion-desde-recibos-servidor.mjs';
import {cotizarLoteVerificado} from '../pruebas/cotizacion-multifichero-piloto.mjs';
import {paginaLotePdf} from './pantalla-lote-pdf.mjs';
import {paginaLotePdfAmpliado} from './pantalla-lote-pdf-ampliado.mjs';
import {paginaCotizadorRapido} from './cotizador-rapido-pagina.mjs';
import {paginaPloteosRapido} from './ploteos-rapido-pagina.mjs';
import {paginaCotizadorConjunto} from './cotizador-conjunto-pagina.mjs';
import {paginaCargaUnica} from './carga-unica-pagina.mjs';
import {manejarCotizadorCliente,autorizadoCotizadorCliente,manejarPortalPedidosCliente,autorizadoPedidoCliente,cookiePedidoClienteVinculado,autorizadoPedidoClienteVinculado,cookieRecuperacionR2Comprador,autorizadoRecuperacionR2Comprador} from './cotizador-cliente-publico.mjs';
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {cotizarNupReciboVerificado} from './cotizar-nup-recibo-verificado.mjs';
import {cotizarPloteoReciboVerificado} from './cotizar-ploteo-recibo-verificado.mjs';
import {leerPdfFase4Privado} from './leer-pdf-fase4-privado.mjs';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {GRAFICA_COMERCIAL} from './cotizar-grafica.mjs';
import {fase4FichaCentralPrivada} from './fase4-ficha-central-privada.mjs';
import {fase4FichaCentralLotePrivada} from './fase4-ficha-central-lote-privada.mjs';
import {crearComprobantePdf} from './comprobante-pdf-servidor.mjs';
import {verificarPedidoPorComprobantes} from './verificacion-central-comprobante.mjs';
import {enviarCentralFirmada} from './enviar-central-firmada.mjs';
import {prepararMixtoCentralFirmado} from './preparar-mixto-central.mjs';
import {prepararDocumentosCentralFirmado} from './preparar-documentos-central.mjs';
import {registrarManifiestoV2EnCentral} from './registrar-manifiesto-v2-central.mjs';
import {probarPuenteCentral} from './probar-puente-central.mjs';
import {componerDesdeReciboVerificado} from './componer-desde-recibo-verificado.mjs';
import {guardarPdfCompuestoPrivado} from './guardar-pdf-compuesto-privado.mjs';
import {registrarPdfCompuestoCentralFirmado} from './registrar-pdf-compuesto-central.mjs';
import {verificarVinculoCotizadorV2} from './verificar-vinculo-cotizador-v2.mjs';
import {paginaCotizadorV2PruebaPrivada,paginaCotizadorTUSClientePruebas} from './pantalla-cotizador-v2-prueba-privada.mjs';
import {prepararCotizadorArchivosLive} from './pagina-archivos-live.mjs';
import portadaSaberDirectoHtml from '../../../vidriera/index.html';
import ofertasSaberDirectoHtml from '../../../vidriera/ofertas.html';
import {prepararVistaDisenoPrivada,prepararVistaDisenoAbierta} from './saber-directo-vista-previa.mjs';
import {consultarCatalogoPublicado} from './catalogo-productos-publicos.mjs';
import {pagoTUSSandboxCliente} from './tus-pago-sandbox-cliente.mjs';
import {checkoutCanarioTUSPersonal} from './tus-canaria-checkout-privado.mjs';
import {paginaDescargaTUSPersonal} from './pantalla-descarga-tus-personal.mjs';
import {paginaPaqueteTUSPersonal} from './pantalla-paquete-tus-personal.mjs';
import {paginaPaqueteUniversalPersonal} from './pantalla-paquete-universal-personal.mjs';
import {paginaCentralPersonalLive} from './pagina-central-personal-live.mjs';
import {paginaTransferenciasPersonalLive,jsTransferenciasPersonalLive} from './pantalla-transferencias-personal-live.mjs';
import {transferenciasPersonalLive} from './transferencias-personal-live.mjs';
import {consultarPaqueteUniversalPersonal,descargarUniversalPersonal} from './r2-universal-paquete-personal.mjs';
import {consultarPaqueteTUSPersonal} from './tus-paquete-personal.mjs';
import {simularLimpiezaTUS,recibirLimpiezaEntregadaInterna} from './borrado-tus-entregado.mjs';
import cotizadorV2OriginalHtml from '../../../cotizador-web-v2.html';
import v2ReaderClientJs from './cotizador-v2-ensayo-archivos.txt';
import v2UploadClientJs from './subir-vincular-pdf-v2-privado.txt';
import v2ManifestClientJs from './preparar-manifiesto-v2-documental.txt';
import v2TUSClientJs from './tus-directo-cliente.txt';
import v2R2ClientJs from './r2-pdf-grandes-cliente.txt';
import v2R2PrepaidClientJs from './r2-prepago-flujo-cliente.txt';
import v2UniversalClientJs from './flujo-universal-pdf-cliente.txt';
import v2UniversalTUSClientJs from './tus-universal-directo-cliente.txt';
import cargaClienteJs from './carga-unica-cliente.txt';
import {cotizarPloteosRapido} from '../pruebas/cotizar-ploteos-rapido.mjs';
import plotClienteJs from './ploteos-rapido-cliente.txt';
import rapidoClienteJs from './cotizador-rapido-cliente.txt';
import {cotizarDocumentos} from '../pruebas/cotizar-documentos.mjs';
import {cotizarDocumentosIndividuales} from '../pruebas/cotizar-documentos-individuales.mjs';
import preciosPiloto from '../../../precios-web.json';
import {obtenerTarifarioD1Privado} from './obtener-tarifario-d1-privado.mjs';
import {obtenerTarifarioD1Live} from './obtener-tarifario-d1-live.mjs';
import {verificarPdfAlmacenado} from './verificacion-pdf-drive-servidor.mjs';
import {tusPrivadoConfigurado,diagnosticarTUSPrivado,comprobarTUSAntesDeEnviar,iniciarTandaTUSPrivada,finalizarPedidoTUSPrivado,recuperarPedidoTUSPrivado,descargarPdfTUSPersonal} from './tus-pedido-worker.mjs';
import {manejarR2GrandePrivado} from './r2-pdf-grandes-api-privada.mjs';
import {comprobarPagoR2EnCentral} from './r2-confirmar-pago-central.mjs';
import {comprobarPagoUniversalR2EnCentral} from './r2-universal-confirmar-pago-central.mjs';

import {stageR2Compatible} from './r2-stage-compatible-clasico-universal.mjs';
import {prepararR2PagoSinArchivo} from './r2-prepago-documentos.mjs';
import {cotizarPlanUniversalSinSubida} from './r2-plan-universal-api-privada.mjs';
import {guardarBorradorUniversal} from './r2-borrador-universal-documentos.mjs';
import {prepararOrdenUniversalSinCheckout} from './r2-orden-universal-documentos.mjs';
import {iniciarLoteTUSUniversal,confirmarLoteTUSUniversal} from './tus-universal-worker.mjs';
import {iniciarTUSUniversalLive,confirmarTUSUniversalLive} from './tus-live-recepcion-documentos.mjs';
import {preflightOriginalR2Live} from './r2-live-preflight-documentos.mjs';
import {manejarR2MultipartLive} from './r2-live-multipart-documentos.mjs';
import {pagoSandboxUniversalDocumentos} from './r2-universal-checkout-documentos.mjs';
import {pagoMPLiveComprador} from './mp-live-comprador.mjs';
import {iniciarSesionCompradorLive,autorizadoCompradorLive,autorizadoOrdenLive,vinculoOrdenLive} from './sesion-comprador-live.mjs';
import {revincularOrdenLive} from './revincular-orden-live.mjs';
import {guardarBorradorUniversalLive,crearOrdenUniversalLive} from './ordenes-universales-live-documentos.mjs';
import {paginaRetornoLive} from './pagina-retorno-live.mjs';
import {paginaContinuarPagoLive} from './pagina-continuar-pago-live.mjs';
import {paginaCotizarLive} from './pagina-cotizar-live.mjs';
import liveBuyerClientJs from './flujo-presupuesto-live-cliente.txt';
import livePostpayTusJs from './recepcion-tus-live-cliente.txt';
import livePostpayR2Js from './recepcion-r2-live-cliente.txt';
import {checkoutR2PrepaidSandboxDocumentos} from './r2-prepago-checkout-documentos.mjs';
import {descargarR2GrandePersonal} from './r2-pdf-grandes-descarga-personal.mjs';
import {descargarR2PendientePorD1Personal} from './r2-pdf-descarga-d1-personal.mjs';
import {resolverReferenciaR2Personal} from './r2-referencia-personal.mjs';
import {paginaR2PreprensaPersonal} from './pantalla-r2-preprensa-personal.mjs';
import {fichaR2Personal} from './r2-ficha-produccion-documentos.mjs';
/**
 * SABER — DOCUMENTOS — ARCHIVO ÚNICO LISTO PARA PEGAR EN CLOUDFLARE
 *
 * VERSIÓN DE SEGURIDAD PARA ENSAYO, SIN CARGAS: bloqueo DOBLE.
 * INTERNAL_ALLOW_UPLOADS=false es deliberadamente constante en este código.
 * El secreto DOCS_RELAY_KEY y la URL de Apps Script están guardados
 * SOLO en Variables y secretos del Worker, NUNCA en este archivo.
 *
 * La RUTA GENERAL sigue bloqueada. PILOTO: una sesión de PDF de hasta 1 MB,
 * FASE 2: permite validar páginas del PDF original ya recibido y comprobado.
 * en carpeta separada, sin acceso a pagos ni validación de páginas.
 * La operación de ping de Google
 * puede ejecutarse si DOCS_PING_ENABLED=true y Turnstile se valida.
 * DOCS_UPLOAD_ENABLED no activa la subida, incluso si se cambia a true.
 * Nunca usar en producción tal cual.
 */
/** Catálogo de pruebas, D1 desactivado salvo habilitación privada explícita.
 * Requiere autorización por sesión V2 o credencial interna de personal.
 * Si falla la lectura D1, no sustituye el último precio sin avisar.
 */
async function preciosPrivados(env,request){
 const live=env?.SABER_ENTORNO==='produccion';
 // Nunca cotizar con precios históricos ni leer sandbox en producción.
 if(!live&&env?.DOCS_PRICE_ADMIN_D1_ENABLED!=='PRIVATE_TEST_ONLY')return preciosPiloto;
 if(!(request instanceof Request))throw Error('Tarifario privado requiere una solicitud autorizada.');
 let staff=false;
 const secret=env?.DOCS_CENTRAL_ADMIN_KEY;
 if(typeof secret==='string'&&secret.length>=32){
  const expected='Bearer '+secret,got=request.headers.get('Authorization')||'';
  if(expected.length===got.length){
   let difference=0;
   for(let i=0;i<got.length;i++)difference|=expected.charCodeAt(i)^got.charCodeAt(i);
   staff=difference===0;
  }
 }
 const quotePath=new URL(request.url).pathname;
 const soloPresupuesto=quotePath==='/api/ensayo-materiales-rapido'||
   quotePath==='/api/ensayo-carga-unica';
 const consultaLive=live&&['/api/pedido/live/materiales','/api/pedido/live/cotizar'].includes(quotePath)&&
   await autorizadoCompradorLive(request,env);
 const precioComprador=soloPresupuesto||quotePath==='/prueba-v2/precios-web.json'||
   quotePath==='/prueba-v2/api/ensayo-tus-registrar'||quotePath==='/api/ensayo-tus-registrar';
 if(!staff&&v2PrivateBrowserAuthorized(request,env)!=='allow'&&
    !(await v2SessionAuthorized(request,env))&&
    !(soloPresupuesto&&await autorizadoCotizadorCliente(request,env))&&
    !(precioComprador&&await autorizadoPedidoCliente(request,env))&&
    !consultaLive)
  throw Error('La versión de precios privada requiere sesión autorizada.');
 const aprobado=live?await obtenerTarifarioD1Live(env):
  await obtenerTarifarioD1Privado(env);
 // Metadatos de promociones aprobadas únicamente para el motor de cotización.
 // No se copian ni se exponen en el JSON público de precios.
 return Object.defineProperty(aprobado.prices,'__promotions',{
  value:aprobado.promotions,enumerable:false,configurable:false
 });
}

const INTERNAL_ALLOW_UPLOADS = false;
const WORKER_SERVICE = 'saber-documentos-pruebas';

function closed() {
  return new Response(JSON.stringify({
    ok:false, service:WORKER_SERVICE, receptionEnabled:false,
    message:'Recepcion de documentos desactivada'
  }), {status:503, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, private',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  }});
}

/**
 * Librería Saber | relay Cloudflare independiente de recepción de PDF.
 * SIN RUTA ACTIVA Y NO DESPLEGADO. No reutiliza polaroids-receiver.js.
 * HMAC env.DOCS_RELAY_KEY coincide con propiedad privada Google Apps Script.
 * Requiere DOCS_UPLOAD_ENABLED=true + DOCS_ALLOWED_ORIGIN exacto + Turnstile.
 */
const MAX_BODY_BYTES=950000;
const DOCS_MAX=20*1024*1024;
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
function allowed(request,env){
 const allowed=env.DOCS_ALLOWED_ORIGIN;
 if(typeof allowed!=='string'||!/^https:\/\//.test(allowed))return false;
 const u=new URL(request.url),a=new URL(allowed);
 return u.origin===a.origin&&request.headers.get('Origin')===allowed&&
  (!request.headers.get('Sec-Fetch-Site')||request.headers.get('Sec-Fetch-Site')==='same-origin');
}
async function readLimited(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('Formato de solicitud no admitido.');
 const declared=Number(request.headers.get('Content-Length'));
 if(declared>MAX_BODY_BYTES)throw Error('Solicitud demasiado grande.');
 const reader=request.body?.getReader();if(!reader)throw Error('Solicitud vacía.');
 const chunks=[];let size=0;
 while(true){
  const part=await reader.read();if(part.done)break;
  size+=part.value.byteLength;
  if(size>MAX_BODY_BYTES){await reader.cancel();throw Error('Solicitud demasiado grande.');}
  chunks.push(part.value);
 }
 const bytes=new Uint8Array(size);let pos=0;
 for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
function validateBasic(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !['start','status','part','finish'].includes(input.op))
   throw Error('Operación inválida.');
 if(input.op==='start'){
  const m=input.meta;
  if(!m||typeof m!=='object'||typeof input.turnstileToken!=='string'||
   input.turnstileToken.length<10||
   !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(m.orderId||'')||
   !/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')||
   !/\.pdf$/i.test(m.name||'')||
   !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>DOCS_MAX||
   !/^[a-f0-9]{64}$/.test(m.sha256||'')||
   m.partBytes!==524288||m.parts!==Math.ceil(m.bytes/524288)||
   !['bn','color','cad','poster'].includes(m.mode))
   throw Error('PDF o verificación de inicio inválidos.');
 }
 if(input.op!=='start'&&(
   typeof input.uploadId!=='string'||!/^DOC-[a-f0-9-]{36}$/i.test(input.uploadId)||
   typeof input.token!=='string'||input.token.length<16))
   throw Error('Sesión inválida.');
 if(input.op==='part'&&(
   !Number.isSafeInteger(input.index)||input.index<0||
   !Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>524288||
   !/^[a-f0-9]{64}$/.test(input.sha256||'')||
   typeof input.dataBase64!=='string'||input.dataBase64.length>699100))
   throw Error('Fragmento inválido.');
}
async function turnstileValid(input,env,fetcher){
 const f=new URLSearchParams();
 f.set('secret',env.DOCS_TURNSTILE_SECRET||'');
 f.set('response',input.turnstileToken);
 let r;
 try{r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',
  {method:'POST',body:f,redirect:'manual',signal:AbortSignal.timeout(15000)});}
 catch(_){return false}
 if(!r.ok)return false;
 const v=await r.json().catch(()=>null);
 return v?.success===true&&v?.hostname===new URL(env.DOCS_ALLOWED_ORIGIN).hostname&&
  v?.action==='documentos';
}
async function signature(json,timestamp,key){
 const bytes=new TextEncoder().encode(timestamp+'\n'+json);
 const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',secret,bytes));
 return Array.from(signed,b=>(b&255).toString(16).padStart(2,'0')).join('');
}
function googleScriptUrl(str){
 return typeof str==='string'&&
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(str);
}
/**
 * JSON firmado compatible entre Cloudflare/WebCrypto y Google Apps Script.
 * Escapar los caracteres no ASCII ANTES de firmar y enviar el mismo string:
 * JSON.parse() recupera los nombres originales (acentos y emoji), pero el
 * cálculo HMAC no depende del charset implícito de GAS. No cambia la clave,
 * algoritmo ni el contrato de respuesta, tampoco elimina verificaciones.
 */
function docsJsonAsciiFirmado(payload){
 return JSON.stringify(payload).replace(/[\u007f-\uffff]/g,
  chr=>'\\u'+chr.charCodeAt(0).toString(16).padStart(4,'0'));
}
async function postToScript(env,payload,fetcher,maxResponseChars=5000){
 if(!googleScriptUrl(env.DOCS_SCRIPT_URL)||typeof env.DOCS_RELAY_KEY!=='string'||
  env.DOCS_RELAY_KEY.length<32)throw Error('Conexión privada no configurada.');
 const payloadJson=docsJsonAsciiFirmado(payload),timestamp=Date.now();
 const envelope=JSON.stringify({
   payloadJson,timestamp,signature:await signature(payloadJson,timestamp,env.DOCS_RELAY_KEY)
 });
 let stage='script_post';
 let r=await fetcher(env.DOCS_SCRIPT_URL,{
  method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
  body:envelope,redirect:'manual',signal:AbortSignal.timeout(55000)});
 if([302,303].includes(r.status)){
  stage='googleusercontent_get';
  const location=r.headers.get('Location')||'';
  if(!/^https:\/\/script\.googleusercontent\.com\/macros\//.test(location))
    throw Error('Redirección de Google no autorizada.');
  // Cloudflare Workers NO admite redirect:'error': se usa manual y se rechaza cualquier 3xx adicional.
  r=await fetcher(location,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
 }
 if(!r.ok){
  const failure=new Error('Google no confirmó la operación.');
  failure.stage=stage;
  if(Number.isInteger(r.status)&&r.status>=100&&r.status<=599)failure.httpStatus=r.status;
  throw failure;
 }
 const data=await r.text();
 if(data.length>maxResponseChars)throw Error('Respuesta Google inesperada.');
 let json;
 try{json=JSON.parse(data)}catch(_){throw Error('Respuesta Google ilegible.')}
 if(!json||typeof json.ok!=='boolean')throw Error('Respuesta Google inválida.');
 return json;
}
async function handleDocumentsPost(request,env,fetcher=fetch){
 if(env?.DOCS_UPLOAD_ENABLED!=='true')
  return response({ok:false,error:'Recepción de documentos desactivada.'},503);
 if(request.method!=='POST')return response({ok:false,error:'Método no permitido.'},405);
 if(!allowed(request,env))return response({ok:false,error:'Origen no autorizado.'},403);
 let input;
 try{input=await readLimited(request);validateBasic(input)}
 catch(e){return response({ok:false,error:e.message||'Solicitud inválida.'},400)}
 if(input.op==='start'&&!(await turnstileValid(input,env,fetcher)))
   return response({ok:false,error:'No se pudo validar el inicio seguro.'},403);
 const op=input.op, p={...input};delete p.turnstileToken;
 try{
  const result=await postToScript(env,p,fetcher);
  if(!result.ok)return response({ok:false,error:result.error||'Recepción no confirmada.'},422);
  // No dar al navegador URLs de Drive, sesión Google ni variables internas.
  return response(result,200);
 }catch(_){
  // Puede haberse guardado el fragmento aunque se haya perdido la respuesta:
  // la próxima llamada a status consultará la misma sesión.
  return response({ok:false,op,dispatched:'unknown',
    error:'La conexión no permitió confirmar el estado. Consultá nuevamente antes de reenviar.'},502);
 }
}


/* Página de prueba Turnstile, independiente del receptor de documentos. */
function testResponse(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex,nofollow'
  }});
}
function testPage(env,mode='turnstile'){
  const batchMode=mode==='google-lote';
  const googleMode=mode==='google'||batchMode;
  const pageTitle=batchMode?'Diagnóstico de autorización · Sin PDF':googleMode?'Prueba de conexión · Cloudflare y Google':'Prueba de seguridad · Documentos';
  const pageDescription=batchMode
    ?'Tres comprobaciones firmadas, sin archivos: ping normal, ping con acentos e inicio de lote vacío (rechazado antes de crear sesiones). Sin pedidos ni cobros.'
    :googleMode?'Se comprobará un ping firmado a Google Apps Script. NO se envían PDF ni se habilitan compras.'
    :'La recepción de PDF permanece desactivada. Esta página sólo verifica Turnstile; no accede a Drive.';
  const endpoint=batchMode?'/prueba-google-lote':googleMode?'/prueba-google':'/prueba-turnstile';
  const successMessage=batchMode
    ?'DIAGNÓSTICO CONFIRMADO: Google verificó las firmas y autorizó la operación de lote. Ninguna sesión fue creada.'
    :googleMode?'PING CONFIRMADO: Cloudflare y Google se comunicaron mediante una firma correcta. La recepción continúa desactivada.'
    :'PRUEBA EXITOSA: Turnstile validado por Cloudflare. La recepción continúa desactivada.';
  const sitekey=env?.DOCS_TURNSTILE_SITE_KEY;
  if(typeof sitekey!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(sitekey))
    return testResponse({ok:false,reason:'site_key_missing',receptionEnabled:false},503);
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Librería Saber | Prueba de Turnstile</title>
  <style>body{font:16px Arial,sans-serif;background:#eef3f8;color:#12344d}
  main{max-width:540px;margin:9vh auto;background:#fff;border-radius:12px;padding:25px}
  h1{font-size:22px}p{line-height:1.5}
  button{border:0;border-radius:7px;padding:12px 19px;background:#176496;color:white;cursor:pointer}
  #salida{font-weight:bold}</style></head><body><main>
  <h1>${pageTitle}</h1>
  <p>${pageDescription}</p>
  <form id="form"><div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
  <p><button type="submit">Comprobar verificación</button></p></form>
  <p id="salida" aria-live="polite">Completá primero la verificación.</p>
  </main><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script>
  document.getElementById('form').addEventListener('submit',async e=>{
    e.preventDefault();
    const out=document.getElementById('salida');
    const token=window.turnstile?.getResponse();
    if(!token){out.textContent='Esperá o completá la verificación.';return;}
    out.textContent='Comprobando...';
    const inicioNavegador=performance.now();
    try{
      const res=await fetch('${endpoint}',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token})
      });
      const value=await res.json();
      const msNavegador=Math.round(performance.now()-inicioNavegador);
      const timing=${googleMode?"value.ok ? ' Tiempo total desde el navegador: '+msNavegador+' ms. Conexión firmada con Google: '+value.googleMs+' ms.' : ''":"''"};
      out.textContent=value.ok
        ? '${successMessage}'+timing+(value.diagnostic ? ' Resultado: '+String(value.diagnostic) : '')
        : 'NO VALIDADO — diagnóstico: '+String(value.reason || 'sin_diagnostico')+
          (Array.isArray(value.codes)&&value.codes.length ? ' ('+value.codes.join(', ')+')' : '')+
          (value.kind ? ' ['+value.kind+']' : '')+
          (value.httpStatus ? ' [HTTP '+value.httpStatus+']' : '')+
          (value.stage ? ' [etapa '+value.stage+']' : '')+
          '. La recepción de PDF continúa desactivada.';
    }catch(_){out.textContent='No se pudo completar la consulta.';}
    window.turnstile?.reset();
  });
  </script></body></html>`;
  return new Response(html,{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY','X-Robots-Tag':'noindex,nofollow'
  }});
}
async function testTurnstilePost(request,env){
  if(request.headers.get('Origin')!==new URL(request.url).origin||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
    return testResponse({ok:false,reason:'origin_or_content_type',receptionEnabled:false},403);
  if(typeof env?.DOCS_TURNSTILE_SECRET!=='string'||!env.DOCS_TURNSTILE_SECRET)
    return testResponse({ok:false,reason:'turnstile_secret_missing',receptionEnabled:false},503);
  let data;
  try{
    if(Number(request.headers.get('Content-Length'))>4096)throw Error('size');
    const r=request.body?.getReader();if(!r)throw Error('body');
    const chunks=[];let size=0;
    while(true){
      const {value,done}=await r.read();if(done)break;
      size+=value.byteLength;
      if(size>4096){await r.cancel();throw Error('size');}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let start=0;
    for(const chunk of chunks){bytes.set(chunk,start);start+=chunk.length;}
    data=JSON.parse(new TextDecoder().decode(bytes));
    if(typeof data.token!=='string'||data.token.length<10||data.token.length>2048)
      throw Error('token');
  }catch(_){return testResponse({ok:false,reason:'token_body_invalid',receptionEnabled:false},400);}
  // Igual que el ejemplo oficial Cloudflare Workers: FormData y POST Siteverify.
  // Diagnósticos por etapas; nunca mostrar datos del token ni del secreto.
  const form=new FormData();
  form.append('secret',env.DOCS_TURNSTILE_SECRET);
  form.append('response',data.token);
  let r;
  try{
    r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',body:form
    });
  }catch(error){
    const kind=(error&&error.name==='TypeError')?'type_error':
      (error&&error.name==='AbortError')?'aborted':'other';
    return testResponse({ok:false,reason:'siteverify_fetch_failed',kind,receptionEnabled:false},403);
  }
  if(!r.ok)return testResponse({
    ok:false,reason:'siteverify_http_error',httpStatus:r.status,receptionEnabled:false
  },403);
  let v;
  try{v=await r.json();}
  catch(_){return testResponse({ok:false,reason:'siteverify_invalid_json',receptionEnabled:false},403);}
  if(!v||typeof v.success!=='boolean')
    return testResponse({ok:false,reason:'siteverify_unexpected_json',receptionEnabled:false},403);
  if(v.success!==true){
    const allowedCodes=['missing-input-secret','invalid-input-secret',
      'missing-input-response','invalid-input-response',
      'bad-request','timeout-or-duplicate','internal-error'];
    const codes=Array.isArray(v['error-codes'])
      ? v['error-codes'].filter(x=>allowedCodes.includes(x)).slice(0,3) : [];
    return testResponse({ok:false,reason:'cloudflare_rejected',codes,receptionEnabled:false},403);
  }
  let permitted;
  try{permitted=new URL(env.DOCS_ALLOWED_ORIGIN).hostname;}
  catch(_){return testResponse({ok:false,reason:'allowed_origin_invalid',receptionEnabled:false},503);}
  if(v.hostname!==permitted)return testResponse({
    ok:false,reason:'hostname_mismatch',receptionEnabled:false},403);
  if(v.action!=='documentos')return testResponse({
    ok:false,reason:'action_mismatch',receptionEnabled:false},403);
  return testResponse({ok:true,receptionEnabled:false},200);
}

// Puente de diagnóstico restringido a un único ping firmado.
// Incluso si DOCS_PING_ENABLED=true, el receptor de PDF continúa bloqueado.
async function testGooglePing(request,env){
  if(env?.DOCS_PING_ENABLED!=='true')return testResponse({
    ok:false,reason:'google_ping_disabled',receptionEnabled:false},503);
  // Reutilizar el control de token + origen + acción comprobado en el ensayo real.
  const guard=await testTurnstilePost(request,env);
  if(!guard.ok)return guard;
  let googleReply;
  const inicioGoogle=Date.now();
  try{
    googleReply=await postToScript(env,{
      op:'ping',purpose:'saber-docs-hmac-v1'
    },fetch);
  }catch(err){
    const msg=String(err?.message||'');
    const reason=msg==='Redirección de Google no autorizada.'?'google_access_restricted':
      msg==='Google no confirmó la operación.'?'google_http_or_access_error':
      msg==='Respuesta Google ilegible.'?'google_non_json_response':
      msg==='Respuesta Google inesperada.'?'google_response_too_large':
      msg==='Respuesta Google inválida.'?'google_response_invalid':
      msg==='Conexión privada no configurada.'?'google_config_incomplete':
      'google_transport_error';
    const diagnostic={ok:false,reason,receptionEnabled:false};
    if(reason==='google_http_or_access_error'){
      diagnostic.stage=err?.stage==='googleusercontent_get'?'googleusercontent_get':'script_post';
      if(Number.isInteger(err?.httpStatus)&&err.httpStatus>=100&&err.httpStatus<=599)
        diagnostic.httpStatus=err.httpStatus;
    }
    return testResponse(diagnostic,502);
  }
  const googleMs=Date.now()-inicioGoogle;
  if(googleReply?.ok===true&&
    googleReply?.service==='saber-docs-handshake'&&
    googleReply?.signed===true&&
    googleReply?.receptionEnabled===false&&
    googleReply?.apiVersion==='ping-v1'){
    return testResponse({
      ok:true,service:'saber-docs-handshake',
      signed:true,receptionEnabled:false,googleMs
    },200);
  }
  return testResponse({ok:false,reason:'google_ping_not_confirmed',
    receptionEnabled:false},502);
}


/**
 * Diagnóstico sin efectos secundarios: dos pings firmados y lote vacío.
 * Un lote sin metas es rechazado ANTES de consultar cupos o Drive.
 */
async function diagnosticoAutorizacionLoteSinArchivos(request,env){
  if(env?.DOCS_PING_ENABLED!=='true')return testResponse({
    ok:false,reason:'google_ping_disabled',receptionEnabled:false},503);
  const guard=await testTurnstilePost(request,env);
  if(!guard.ok)return guard;
  const inicioGoogle=Date.now();
  try{
    const ascii=await postToScript(env,{op:'ping',purpose:'saber-docs-hmac-v1'},fetch);
    const validaPing=r=>r?.ok===true&&r?.service==='saber-docs-handshake'&&
      r?.signed===true&&r?.apiVersion==='ping-v1'&&r?.receptionEnabled===false;
    if(!validaPing(ascii))return testResponse({
      ok:false,reason:'ascii_ping_failed',receptionEnabled:false},502);
    const unicode=await postToScript(env,{
      op:'ping',purpose:'saber-docs-hmac-v1',probe:'prueba-áéíñ.pdf'
    },fetch);
    if(!validaPing(unicode))return testResponse({
      ok:false,reason:unicode?.errorCode==='UNAUTHORIZED'?'unicode_hmac_rejected':'unicode_ping_failed',
      receptionEnabled:false},502);
    // El receptor rechaza metas vacías antes de abrir sesiones Drive.
    const batch=await postToScript(env,{op:'multiStartBatch',metas:[]},fetch);
    if(batch?.ok===false&&batch?.errorCode==='RECEPTOR_ERROR')
      return testResponse({ok:true,diagnostic:'UTF8_OK_LOTE_AUTORIZADO',
        receptionEnabled:false,googleMs:Date.now()-inicioGoogle},200);
    return testResponse({ok:false,
      reason:batch?.errorCode==='UNAUTHORIZED'?'lote_no_autorizado':
        batch?.ok===false?'lote_rechazo_inesperado':'lote_respuesta_inesperada',
      receptionEnabled:false},502);
  }catch(err){
    return testResponse({ok:false,
      reason:err?.stage==='script_post'?'google_post_failure':
        err?.stage==='googleusercontent_get'?'google_redirect_failure':
        err?.name==='TimeoutError'?'google_timeout':'google_probe_transport_failure',
      receptionEnabled:false},502);
  }
}

/* PILOTO PDF único: endpoint distinto, un solo PDF <= 1MiB y sin checkout.
   El receptor de Google aplica su propio cupo y verifica HMAC en cada operación.
   Ninguna variable ni clave adicional en Cloudflare. */
const PILOT_MAX_BYTES=1024*1024;
const PILOT_ORDER='WEB-PILOTO-UN-PDF-20261020';
const PILOT_FILE='pdf-prueba';
function pilotHtml(env){
  const siteKey=env?.DOCS_TURNSTILE_SITE_KEY;
  if(typeof siteKey!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(siteKey))
    return testResponse({ok:false,reason:'site_key_missing',receptionEnabled:false},503);
  const html = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Librería Saber | Ensayo privado de PDF</title>
<style>
body{margin:0;background:#f1f4f7;color:#182b3f;font:16px system-ui,Arial,sans-serif}
main{max-width:600px;margin:6vh auto;padding:24px;background:white;border-radius:14px}
h1{font-size:24px;margin-top:0}
.notice{background:#e6f3f8;border-left:4px solid #1178a2;padding:12px;margin:12px 0 20px}
label{display:block;margin:15px 0 7px;font-weight:600}
input,button{font-size:16px}
button{background:#175a84;border:0;border-radius:8px;color:white;padding:13px 18px;cursor:pointer}
button:disabled{opacity:.55;cursor:wait}
#log{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.6}
</style></head><body><main><h1>Prueba de recepción de PDF</h1>
<p class="notice">Sólo UN archivo PDF de hasta 1 MB en carpeta de pruebas. No genera pedidos, precios, pagos ni documentos cobrables.</p>
<label for="pdf">Seleccionar PDF pequeño</label>
<input type="file" id="pdf" accept=".pdf,application/pdf">
<p>Verificación de seguridad</p>
<div class="cf-turnstile" data-sitekey="${siteKey}" data-action="documentos"></div>
<p><button type="button" id="send">Enviar PDF de prueba</button></p>
<div id="log" role="status" aria-live="polite">Esperando un archivo.</div>
</main>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
(async function(){
const btn=document.getElementById('send');
const log=document.getElementById('log');
const set=(message)=>log.textContent=message;
const partBytes=524288;
const MAX=1048576;
const digest=async buf=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)), b=>b.toString(16).padStart(2,'0')).join('');
function b64(u8){
 const limit=12288; let str='';
 for(let i=0;i<u8.length;i+=limit)str+=btoa(String.fromCharCode(...u8.slice(i,i+limit)));
 return str;
}
async function rpc(payload){
 const response=await fetch('/api/piloto-pdf',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 });
 const json=await response.json();
 if(!response.ok||json.ok!==true)throw Error(json.error||'El receptor no confirmó la operación ('+response.status+').');
 return json;
}
btn.addEventListener('click',async ()=>{
 if(btn.disabled)return;
 const file=document.getElementById('pdf').files[0];
 if(!file){set('Seleccioná primero un archivo PDF.');return;}
 if(!/\.pdf$/i.test(file.name)||file.size<5||file.size>MAX){
  set('Elegí un PDF de hasta 1 MB.');return;
 }
 const token=window.turnstile?.getResponse();
 if(!token){set('Completá primero la verificación Turnstile.');return;}
 btn.disabled=true;
 try{
  const buf=await file.arrayBuffer(),head=new Uint8Array(buf.slice(0,5));
  if(String.fromCharCode(...head)!=='%PDF-')throw Error('El archivo no tiene cabecera PDF.');
  const sha256=await digest(buf);
  const parts=Math.ceil(file.size/partBytes);
  set('Validación realizada. Iniciando recepción...');
  const meta={orderId:'WEB-PILOTO-UN-PDF-20261020',fileId:'pdf-prueba',
   name:file.name,mode:'bn',bytes:file.size,sha256,partBytes,parts};
  const session=await rpc({op:'start',meta,turnstileToken:token});
  for(let i=0;i<parts;i++){
   const chunk=new Uint8Array(buf.slice(i*partBytes,Math.min((i+1)*partBytes,file.size)));
   const sum=await digest(chunk);
   await rpc({op:'part',uploadId:session.uploadId,token:session.token,
    index:i,bytes:chunk.length,sha256:sum,dataBase64:b64(chunk)});
   set('Enviado: '+(i+1)+' de '+parts+' fragmentos.');
  }
  set('Comprobando integridad del PDF en Google Drive...');
  const result=await rpc({op:'finish',uploadId:session.uploadId,token:session.token,
   sha256,bytes:file.size,parts});
  if(result.received===true&&result.verified===false){
   set('PDF RECIBIDO Y COMPROBADO EN DRIVE. Recibo: '+result.receiptId+
    '\\nPrueba exitosa de almacenamiento. Validación de páginas y cobros: DESACTIVADOS.');
  }else throw Error('No se confirmó el recibo.');
 }catch(err){
  set('PRUEBA NO COMPLETADA: '+String(err?.message||'Error inesperado')+
   '\\nNo pagues ni envíes otro archivo sin consultar el estado.');
 }finally{
  btn.disabled=false;
  window.turnstile?.reset();
 }
});
})();
</script></body></html>`;
  return new Response(html,{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store, private',
    'X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex,nofollow',
    'X-Frame-Options':'DENY'
  }});
}
async function pilotVerifyTurnstile(token,env){
  if(typeof token!=='string'||token.length<10||token.length>2048||
    typeof env?.DOCS_TURNSTILE_SECRET!=='string')return false;
  const fd=new FormData();
  fd.append('secret',env.DOCS_TURNSTILE_SECRET);
  fd.append('response',token);
  try{
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:fd});
    if(!r.ok)return false;
    const answer=await r.json();
    return answer?.success===true&&answer.action==='documentos'&&
      answer.hostname===new URL(env.DOCS_ALLOWED_ORIGIN).hostname;
  }catch(_){return false;}
}
async function pilotPost(request,env){
  if(request.method!=='POST')return closed();
  if(!allowed(request,env))return testResponse({
    ok:false,error:'Origen no permitido',receptionEnabled:false},403);
  let input;
  try{
    input=await readLimited(request);
    validateBasic(input);
    if(!['start','part','status','finish'].includes(input.op))throw Error('Operación no autorizada');
    if(input.op==='start'){
      const meta=input.meta;
      if(meta.orderId!==PILOT_ORDER||meta.fileId!==PILOT_FILE||
         meta.bytes>PILOT_MAX_BYTES||!['bn','color'].includes(meta.mode))
        throw Error('Fuera de cupo piloto');
    }
  }catch(_){return testResponse({ok:false,error:'Datos fuera del cupo de prueba',receptionEnabled:false},400);}
  if(input.op==='start'&&!(await pilotVerifyTurnstile(input.turnstileToken,env))){
    return testResponse({ok:false,error:'No se pudo validar la verificación de seguridad',receptionEnabled:false},403);
  }
  const body={...input};delete body.turnstileToken;
  try{
    const result=await postToScript(env,body,fetch);
    if(!result.ok)return testResponse({ok:false,error:'Google no confirmó la solicitud',receptionEnabled:false},422);
    // No se permite declarar archivos cobrables por este endpoint.
    if(input.op==='finish'&&result.verified!==false)
      return testResponse({ok:false,error:'Validación de páginas no disponible',receptionEnabled:false},422);
    return testResponse({...result,receptionEnabled:false},200);
  }catch(_){
    return testResponse({ok:false,error:'Recepción no confirmada. No reenviar sin revisar el estado.',
      receptionEnabled:false},502);
  }
}


/* FASE 2 — Validación del PDF EXISTENTE, sin una segunda subida.
 * Los bytes se transportan sólo entre Apps Script y Worker. El navegador
 * recibe únicamente {páginas,recibo} al terminar. PDF-lib empaquetado en build.
 */
function validarPdfHtml(env){
 const key=env?.DOCS_TURNSTILE_SITE_KEY;
 if(typeof key!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(key))
   return testResponse({ok:false,reason:'site_key_missing'},503);
 return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Librería Saber — Verificar PDF privado</title>
<style>
body{background:#eef2f6;color:#142a3d;font:16px system-ui,sans-serif;margin:0}
main{max-width:580px;margin:7vh auto;background:#fff;padding:26px;border-radius:14px}
h1{font-size:24px}button{cursor:pointer;background:#135e91;border:0;border-radius:8px;color:white;padding:14px 18px;font-size:16px}
button:disabled{opacity:.55}#out{white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body><main>
<h1>Validación del PDF ya recibido</h1>
<p>El sistema leerá el PDF del Drive privado y comprobará su cantidad de páginas sin solicitar que lo vuelvas a subir.</p>
<p>No habilita pagos ni modifica la web pública.</p>
<div class="cf-turnstile" data-sitekey="${key}" data-action="documentos"></div>
<p><button id="go" type="button">Verificar páginas</button></p>
<p id="out" role="status">Esperando la comprobación.</p>
</main><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
document.getElementById('go').addEventListener('click',async function(){
 const b=this, out=document.getElementById('out');
 const token=window.turnstile?.getResponse();
 if(!token){out.textContent='Completá primero Turnstile.';return}
 b.disabled=true;out.textContent='Leyendo el archivo privado y contando páginas...';
 try{
  const response=await fetch('/api/validar-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({turnstileToken:token})});
  const j=await response.json();
  if(!response.ok||j.ok!==true)throw Error(j.error||'No se pudo terminar la comprobación.');
  out.textContent='PDF VERIFICADO EN SERVIDOR: '+j.pages+' página(s).\\nRecibo: '+j.receiptId+'\\nPagos: desactivados.';
 }catch(e){out.textContent='SIN VALIDAR: '+String(e.message||e)+'\\nNo se habilitan cobros.'}
 finally{b.disabled=false;window.turnstile?.reset()}
});
</script></body></html>`,{status:200,headers:{
 'Content-Type':'text/html;charset=utf-8','Cache-Control':'private,no-store',
 'X-Robots-Tag':'noindex,nofollow','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'
 }});
}
const hexSha256=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function safeHash(data){return hexSha256(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));}
async function verifyExistingPdf(request,env){
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))return testResponse({ok:false,error:'Origen no permitido',receptionEnabled:false},403);
 let input;
 try{
   input=await readLimited(request);
   if(!input||Object.keys(input).length!==1||typeof input.turnstileToken!=='string')
     throw Error('Inválido');
 }catch(_){return testResponse({ok:false,error:'Solicitud de prueba inválida',receptionEnabled:false},400)}
 if(!(await pilotVerifyTurnstile(input.turnstileToken,env)))
   return testResponse({ok:false,error:'Verificación Turnstile incorrecta',receptionEnabled:false},403);
 try{
   const m=await postToScript(env,{op:'privatePilotInfo'},fetch);
   if(!m.ok||m.bytes<5||!Number.isSafeInteger(m.bytes)||m.bytes>1024*1024||
       !/^DOC-[a-f0-9-]{36}$/i.test(m.receiptId||'')||
       !/^[a-f0-9]{64}$/.test(m.sha256||'')||
       m.privateChunkBytes!==256*1024)
     throw Error('Información privada de archivo inválida');
   if(m.pageVerification==='server'&&Number.isSafeInteger(m.pages)&&m.pages>0){
     const existing=await postToScript(env,{op:'privateVerifiedStatus',receiptId:m.receiptId},fetch);
     if(existing.ok&&existing.verified&&existing.pages===m.pages)
       return testResponse({ok:true,pages:existing.pages,receiptId:existing.receiptId,
         alreadyVerified:true,paymentAuthorized:false,receptionEnabled:false});
   }
   const bytes=new Uint8Array(m.bytes),size=256*1024;
   for(let offset=0;offset<bytes.length;offset+=size){
     const part=await postToScript(env,{op:'privateReadPart',
       receiptId:m.receiptId,offset},fetch,420000);
     const n=Math.min(size,bytes.length-offset);
     if(!part.ok||part.receiptId!==m.receiptId||part.offset!==offset||
         part.length!==n||part.bytes!==m.bytes||part.sha256!==m.sha256||
         typeof part.dataBase64!=='string'||part.dataBase64.length>380000||
         !/^[a-f0-9]{64}$/.test(part.chunkSha256||''))
       throw Error('Fragmento del PDF privado no confirmado');
     const decoded=atob(part.dataBase64);
     if(decoded.length!==n)throw Error('Fragmento de tamaño incorrecto');
     const chunk=Uint8Array.from(decoded,c=>c.charCodeAt(0));
     if(await safeHash(chunk)!==part.chunkSha256)
       throw Error('Integridad de un fragmento incorrecta');
     bytes.set(chunk,offset);
   }
   const receipt={receiptState:'bytes_checked',receiptId:m.receiptId,
     orderId:m.orderId,fileId:m.fileId,name:m.name,mode:m.mode,bytes:m.bytes,
     sha256:m.sha256};
   const verified=await verificarPdfAlmacenado({
     driveBytes:bytes,reciboServidor:receipt
   });
   const registered=await postToScript(env,{op:'privateCommitPages',
     receiptId:verified.receiptId,pages:verified.pages,sha256:verified.sha256,
     bytes:verified.bytes,parserVersion:'pdf-lib-1.17.1'},fetch);
   if(!registered.ok||!registered.verified||registered.pages!==verified.pages||
       registered.receiptId!==verified.receiptId||registered.paymentAuthorized!==false)
     throw Error('Google no confirmó el conteo de páginas');
   return testResponse({ok:true,pages:registered.pages,receiptId:registered.receiptId,
     verifiedBy:'server',paymentAuthorized:false,receptionEnabled:false});
 }catch(_){
   return testResponse({ok:false,
     error:'No se pudo verificar el PDF almacenado. No se habilitan cobros.',
     receptionEnabled:false},502);
 }
}

const PRESUPUESTO_HTML = "<!doctype html>\n<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"robots\" content=\"noindex,nofollow\">\n<title>Librería Saber — presupuesto de prueba</title>\n<style>\n*{box-sizing:border-box}body{font:16px system-ui,Arial;background:#eef2f6;color:#193348;margin:0}\nmain{max-width:650px;margin:6vh auto;padding:26px;background:#fff;border-radius:14px}\nh1{font-size:25px;margin:0}.note{background:#e8f2f9;padding:12px;border-left:4px solid #1472a3}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}@media(max-width:420px){.grid{grid-template-columns:1fr}}\nlabel{display:block;margin:12px 0 5px;font-weight:600}select,input{width:100%;border:1px solid #aabac7;border-radius:6px;padding:10px;font:16px system-ui}\nbutton{margin-top:15px;background:#195e8b;color:#fff;border:0;border-radius:8px;padding:14px;font:16px system-ui;cursor:pointer}\nbutton:disabled{opacity:.5}#out{white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere}\n</style></head><body><main><h1>Presupuesto de documentos</h1>\n<p class=\"note\">El servidor utiliza el PDF ya guardado en Google Drive y sus páginas verificadas. El importe es orientativo porque las tarifas todavía requieren actualización comercial.</p>\n<div class=\"grid\"><div><label>Formato</label><select id=\"format\"><option value=\"a4\">A4</option><option value=\"a3\">A3</option></select></div>\n<div><label>Impresión</label><select id=\"faces\"><option value=\"simple\">Simple faz</option><option value=\"double\">Doble faz</option></select></div></div>\n<div class=\"grid\"><div><label>Cantidad de copias</label><input id=\"copies\" type=\"number\" value=\"1\" min=\"1\" max=\"200\" step=\"1\"></div>\n<div><label>Anillado</label><select id=\"binding\"><option value=\"ninguno\">Sin anillado</option><option value=\"juntos\">Con anillado</option></select></div></div>\n<p>Verificación Turnstile</p><div class=\"cf-turnstile\" data-sitekey=\"__SITEKEY__\" data-action=\"documentos\"></div>\n<button type=\"button\" id=\"quote\">Calcular presupuesto</button>\n<div id=\"out\" role=\"status\" aria-live=\"polite\">Esperando confirmación del PDF.</div>\n<p><small>Pagos desactivados. No modifica la web pública.</small></p></main>\n<script src=\"https://challenges.cloudflare.com/turnstile/v0/api.js\" async defer></script>\n<script>\ndocument.getElementById('quote').addEventListener('click',async function(){\n const out=document.getElementById('out'),button=this;\n const token=window.turnstile?.getResponse();\n if(!token){out.textContent='Completá primero Turnstile.';return;}\n const payload={turnstileToken:token,formato:document.getElementById('format').value,\n  caras:document.getElementById('faces').value,\n  copias:Number(document.getElementById('copies').value),\n  anillado:document.getElementById('binding').value};\n button.disabled=true;out.textContent='Consultando las páginas verificadas y las tarifas...';\n try{\n  const response=await fetch('/api/presupuesto-pdf',{method:'POST',\n   headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});\n  const x=await response.json();\n  if(!response.ok||x.ok!==true)throw Error(x.error||'No se obtuvo presupuesto.');\n  const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});\n  out.textContent='PDF: '+x.pages+' páginas verificadas por servidor\\n'+\n   'Formato '+x.formato.toUpperCase()+' · '+(x.caras==='double'?'doble':'simple')+' faz\\n'+\n   'Copias: '+x.copias+' · Hojas totales: '+x.hojasTotales+'\\n'+\n   'Impresiones: '+money.format(x.subtotalImpresiones)+'\\n'+\n   'Anillados: '+money.format(x.anillados)+'\\n'+\n   'TOTAL ORIENTATIVO: '+money.format(x.total)+'\\n'+\n   'Fecha de la tabla de tarifas: '+x.priceVersion+'\\n'+\n   'Recibo: '+x.receiptId+'\\nPAGOS DESACTIVADOS';\n }catch(e){out.textContent='SIN PRESUPUESTO: '+String(e?.message||e)+'\\nNo se permite cobrar.';}\n finally{button.disabled=false;window.turnstile?.reset();}\n});\n</script></body></html>";

/* FASE 3: consulta privada de recibo de Google, precio preliminar y pagos bloqueados */
function presupuestoHtml(env) {
 const key=env?.DOCS_TURNSTILE_SITE_KEY;
 if(typeof key!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(key))
   return testResponse({ok:false,reason:'site_key_missing'},503);
 return new Response(PRESUPUESTO_HTML.replace('__SITEKEY__',key),{status:200,headers:{
  'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store,private',
  'X-Robots-Tag':'noindex,nofollow','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'}});
}
async function presupuestoPost(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 let o;
 try{
  o=await readLimited(request);
  if(!o||typeof o!=='object'||Array.isArray(o)||
    Object.keys(o).sort().join(',')!=='anillado,caras,copias,formato,turnstileToken'||
    !['a4','a3'].includes(o.formato)||!['simple','double'].includes(o.caras)||
    !['ninguno','juntos'].includes(o.anillado)||
    !Number.isSafeInteger(o.copias)||o.copias<1||o.copias>200||
    typeof o.turnstileToken!=='string'||o.turnstileToken.length<10||o.turnstileToken.length>2048)
    throw Error('Opciones inválidas');
 }catch(_){return testResponse({ok:false,error:'Opciones de impresión inválidas',paymentAuthorized:false},400)}
 if(!(await pilotVerifyTurnstile(o.turnstileToken,env)))
   return testResponse({ok:false,error:'Turnstile no confirmado',paymentAuthorized:false},403);
 try{
  // No se acepta desde el navegador la referencia del pedido, páginas, nombre, precio ni recibo.
  const info=await postToScript(env,{op:'privatePilotInfo'},fetch);
  if(!info.ok||!/^DOC-[a-f0-9-]{36}$/i.test(info.receiptId||'')||
    info.pageVerification!=='server'||!Number.isSafeInteger(info.pages)||info.pages<1)
    throw Error('El archivo aún no fue verificado');
  const r=await postToScript(env,{op:'privateVerifiedStatus',receiptId:info.receiptId},fetch);
  if(!r.ok||r.status!=='verified'||r.verified!==true||
    r.storageVerified!==true||r.pageVerification!=='server'||
    r.pages!==info.pages||r.receiptId!==info.receiptId||
    r.paymentAuthorized!==false)
    throw Error('Recibo de Google no confirmado');
  const solicitud={orderId:r.orderId,
    archivos:[{id:r.fileId,nombre:r.name,modo:r.mode,orden:1}],
    formato:o.formato,caras:o.caras,copias:o.copias,
    anillado:o.anillado,materialColor:'obra70'};
  const output=prepararPresupuestoDocumentos({
    solicitud,recibosConfiables:[r],tarifasServidor:preciosActuales
  });
  const q=output.quote;
  if(!Number.isSafeInteger(q.total)||q.total<=0||output.paymentAuthorized!==false)
    throw Error('Precio no confirmado');
  return testResponse({ok:true,pages:r.pages,receiptId:r.receiptId,
    formato:o.formato,caras:o.caras,copias:o.copias,
    hojasTotales:q.hojasTotales,
    subtotalImpresiones:q.subtotalBN+q.subtotalColor,
    anillados:q.cargoAnillado,total:q.total,priceVersion:output.priceVersion,
    serverPagesVerified:true,paymentAuthorized:false},200);
 }catch(_){
  return testResponse({ok:false,error:'No se pudo cotizar con el recibo verificado en Google.',
    paymentAuthorized:false},422);
 }
}

const FASE4_HTML = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\">\n<title>Librería Saber · Subir y presupuestar PDF</title>\n<style>\n*{box-sizing:border-box}body{font:16px system-ui,Arial;margin:0;background:#eef3f8;color:#183047}\nmain{max-width:700px;background:white;margin:5vh auto;padding:26px;border-radius:14px;box-shadow:0 3px 20px #122c4014}\nh1{font-size:25px;margin:0 0 8px}.notice{border-left:4px solid #287da5;background:#eef7fb;padding:13px;margin:15px 0}\n.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:500px){.row{grid-template-columns:1fr}}\nlabel{display:block;font-weight:600;margin:12px 0 7px}select,input{width:100%;padding:10px;border:1px solid #b7cbd9;border-radius:7px;font:16px system-ui}\nbutton{margin:14px 0;padding:14px 18px;border:0;border-radius:8px;background:#16618d;color:white;font:16px system-ui;cursor:pointer}\nbutton:disabled{opacity:.55}#out{white-space:pre-wrap;line-height:1.7;overflow-wrap:anywhere}\nsmall{color:#53697b}</style></head><body><main>\n<h1>Probá tu presupuesto PDF</h1>\n<p class=\"notice\">Ensayo aislado. Elegí un PDF nuevo de hasta 1 MB; lo enviaremos a Google Drive privado, verificaremos sus páginas y calcularemos el precio orientativo. Máximo cinco documentos en este piloto. Sin compras ni pagos.</p>\n<label>Tu archivo PDF</label><input id=\"file\" type=\"file\" accept=\".pdf,application/pdf\">\n<div class=\"row\"><div><label>Tipo de impresión</label><select id=\"mode\"><option value=\"bn\">Blanco y negro</option><option value=\"color\">Color</option></select></div>\n<div><label>Formato</label><select id=\"format\"><option value=\"a4\">A4</option><option value=\"a3\">A3</option></select></div></div>\n<div class=\"row\"><div><label>Caras</label><select id=\"faces\"><option value=\"simple\">Simple faz</option><option value=\"double\">Doble faz</option></select></div>\n<div><label>Copias</label><input id=\"copies\" type=\"number\" value=\"1\" min=\"1\" max=\"200\" step=\"1\"></div></div>\n<label>Anillado</label><select id=\"binding\"><option value=\"ninguno\">Sin anillado</option><option value=\"juntos\">Con anillado</option></select>\n<p>Control de seguridad</p><div class=\"cf-turnstile\" data-sitekey=\"__SITEKEY__\" data-action=\"documentos\"></div>\n<button id=\"submit\" type=\"button\">Subir PDF y calcular presupuesto</button>\n<div role=\"status\" aria-live=\"polite\" id=\"out\">Elegí el PDF y completá Turnstile.</div>\n<p><small>Importes solo para prueba; precios guardados en agosto de 2026. Los pagos, la tienda pública y Polaroids no se modifican.</small></p>\n</main><script src=\"https://challenges.cloudflare.com/turnstile/v0/api.js\" async defer></script>\n<script>\nconst $=id=>document.getElementById(id), button=$('submit'), out=$('out');\nconst orderIdsBySha=new Map();\nlet previousSession=null,previousSha=null,previousMode=null,previousName=null;\nfunction say(t){out.textContent=t}\nasync function digest(buf){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',buf));return Array.from(d,x=>x.toString(16).padStart(2,'0')).join('')}\nfunction toBase64(bytes){let str='';for(let i=0;i<bytes.length;i+=12288){str+=btoa(String.fromCharCode(...bytes.subarray(i,i+12288)))}return str}\nasync function rpc(path,obj){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});\n let data;try{data=await r.json()}catch(_){throw Error('Respuesta del servidor ilegible')}\n if(!r.ok||data.ok!==true)throw Error(data.error||'El servidor no confirmó la operación');\n return data;\n}\nbutton.addEventListener('click',async ()=>{\n const file=$('file').files[0],t=window.turnstile?.getResponse();\n if(!file||!t){say('Seleccioná un PDF y completá Turnstile.');return}\n if(!/\\.pdf$/i.test(file.name)||file.size<5||file.size>1048576){say('El PDF debe tener entre 5 bytes y 1 MB.');return}\n const mode=$('mode').value,formato=$('format').value,caras=$('faces').value,anillado=$('binding').value,copias=Number($('copies').value);\n if(!Number.isSafeInteger(copias)||copias<1||copias>200){say('Elegí de 1 a 200 copias.');return}\n button.disabled=true;\n let session=null;\n try{\n  const buf=await file.arrayBuffer();\n  if(String.fromCharCode(...new Uint8Array(buf.slice(0,5)))!=='%PDF-')throw Error('El archivo no tiene cabecera PDF');\n  const sha=await digest(buf),block=524288,parts=Math.ceil(file.size/block);\n  const finger=sha+':'+mode+':'+file.name;\n  if(!orderIdsBySha.has(finger)){\n   const id=new Uint8Array(8);crypto.getRandomValues(id);\n   orderIdsBySha.set(finger,'WEB-ENSAYO-'+Array.from(id,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase());\n  }\n  if(previousSha===sha&&previousMode===mode&&previousName===file.name&&previousSession){\n   session=previousSession;\n   say('Reutilizando la sesión anterior para no duplicar el archivo.');\n  }else{\n   say('Iniciando recepción segura del PDF...');\n   const meta={orderId:orderIdsBySha.get(finger),fileId:'documento',name:file.name,mode,\n     bytes:file.size,sha256:sha,partBytes:block,parts};\n   session=await rpc('/api/ensayo-pdf',{op:'start',meta,turnstileToken:t});\n   previousSession=session;previousSha=sha;previousMode=mode;previousName=file.name;\n  }\n  const progress=await rpc('/api/ensayo-pdf',{op:'status',uploadId:session.uploadId,token:session.token});\n  const accepted=new Set(progress.acceptedParts||[]);\n  for(let i=0;i<parts;i++){\n   if(accepted.has(i))continue;\n   const fragment=new Uint8Array(buf.slice(i*block,Math.min((i+1)*block,file.size)));\n   const partSha=await digest(fragment);\n   await rpc('/api/ensayo-pdf',{op:'part',uploadId:session.uploadId,token:session.token,\n    index:i,bytes:fragment.length,sha256:partSha,dataBase64:toBase64(fragment)});\n   say('Recibido el fragmento '+(i+1)+' de '+parts+'.');\n  }\n  const finish=await rpc('/api/ensayo-pdf',{op:'finish',uploadId:session.uploadId,\n   token:session.token,sha256:sha,bytes:file.size,parts});\n  if(finish.received!==true)throw Error('Google aún no confirmó la recepción completa');\n  say('PDF guardado íntegro. Verificando las páginas y cotizando...');\n  const result=await rpc('/api/ensayo-cotizar',{uploadId:session.uploadId,token:session.token,\n   formato,caras,copias,anillado});\n  const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});\n  say('PDF SUBIDO Y COTIZADO\\nArchivo: '+file.name+\n    '\\nPáginas verificadas en servidor: '+result.pages+\n    '\\nCopias: '+result.copias+' · Hojas: '+result.hojasTotales+\n    '\\nImpresiones: '+money.format(result.subtotalImpresiones)+\n    '\\nAnillado: '+money.format(result.anillados)+\n    '\\nTOTAL ORIENTATIVO: '+money.format(result.total)+\n    '\\nRecibo: '+result.receiptId+\n    '\\nTarifas de: '+result.priceVersion+\n    '\\nPAGOS DESACTIVADOS');\n }catch(e){\n  say('LA OPERACIÓN NO SE COMPLETÓ: '+String(e?.message||e)+\n    (session?'\\nNo vuelvas a subirlo antes de verificar el estado del recibo.':''));\n }finally{button.disabled=false;window.turnstile?.reset()}\n});\n</script></body></html>";

/* FASE 4 — cinco PDF de prueba distintos, una pantalla de carga + validación + cotización.
 * Reutiliza firmas HMAC, Turnstile, pdf-lib y tarifas del backend.
 * Sin habilitar rutas generales ni checkout.
 */
const FASE4_QUOTA_BYTES=1024*1024;
const FASE4_CHUNK_BYTES=256*1024;
function fase4Html(env){
 const key=env?.DOCS_TURNSTILE_SITE_KEY;
 if(typeof key!=='string'||!/^[a-zA-Z0-9._-]{10,200}$/.test(key))
   return testResponse({ok:false,error:'Clave pública de Turnstile ausente',paymentAuthorized:false},503);
 return new Response(FASE4_HTML.replace('__SITEKEY__',key),{status:200,headers:{
  'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store,private',
  'X-Frame-Options':'DENY','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'
 }});
}
const phase4Session=id=>typeof id==='string'&&/^DOC-[a-f0-9-]{36}$/i.test(id);
const phase4Token=t=>typeof t==='string'&&t.length>=16&&t.length<=256;
function phase4Opts(o){
 return o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).sort().join(',')==='anillado,caras,copias,formato,token,uploadId'&&
  phase4Session(o.uploadId)&&phase4Token(o.token)&&
  ['a4','a3'].includes(o.formato)&&['simple','double'].includes(o.caras)&&
  ['ninguno','juntos'].includes(o.anillado)&&
  Number.isSafeInteger(o.copias)&&o.copias>=1&&o.copias<=200;
}
/**
 * Inicio de TANDA privada: un Turnstile para hasta 10 sesiones de PDF,
 * con una única comunicación HMAC hacia Google Apps Script.
 * Sólo crea recibos independientes: no transporta archivos ni cobra.
 */
async function fase4BatchStart(request,env){
 if(env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Inicio privado de lote deshabilitado',paymentAuthorized:false},503);
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen no autorizado',paymentAuthorized:false},403);
 let body;
 try{
  body=await readLimited(request);
  if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body).sort().join(',')!=='metas,turnstileToken'||
     typeof body.turnstileToken!=='string'||body.turnstileToken.length<10||
     !Array.isArray(body.metas)||body.metas.length<1||body.metas.length>10)
    throw Error('Tanda inválida');
  let orderId=null,total=0;
  const seen=new Set();
  for(const meta of body.metas){
   if(!meta||typeof meta!=='object'||Array.isArray(meta)||
      Object.keys(meta).sort().join(',')!=='bytes,fileId,mode,name,orderId,partBytes,parts,sha256')
    throw Error('Metadatos de lote inválidos');
   validateBasic({op:'start',meta,turnstileToken:body.turnstileToken});
   if(orderId!==null&&orderId!==meta.orderId)throw Error('Pedidos diferentes');
   if(seen.has(meta.fileId))throw Error('Archivos repetidos');
   seen.add(meta.fileId);orderId=meta.orderId;total+=meta.bytes;
  }
  if(total>60*1024*1024)throw Error('Lote demasiado grande');
 }catch(_){
  return testResponse({ok:false,error:'Tanda de PDF inválida',paymentAuthorized:false},400);
 }
 if(!(await pilotVerifyTurnstile(body.turnstileToken,env)))
  return testResponse({ok:false,error:'No se confirmó la verificación de seguridad del lote',paymentAuthorized:false},403);
 try{
  const reply=await postToScript(env,{op:'multiStartBatch',metas:body.metas},fetch,12000);
  if(!reply.ok){
   const reason=String(reply.errorCode||'').toUpperCase();
   // El receptor sólo publica categorías autorizadas, nunca su mensaje interno.
   const permitted=new Set(['UNAUTHORIZED','GLOBAL_CAP','ORDER_CAP','INDEX_INVALID',
     'FILE_ID_CONFLICT','BAD_META','BUSY','RECEPTOR_ERROR']);
   const err=new Error('Receptor rechazó inicio del lote');
   err.safeReason=permitted.has(reason)?reason:'RECHAZO_RECEPTOR';
   throw err;
  }
  if(!Array.isArray(reply.sessions)||reply.sessions.length!==body.metas.length||
     reply.paymentAuthorized!==false){
   const err=new Error('Respuesta de lote incompatible');
   err.safeReason='RESPUESTA_INCOMPATIBLE';
   throw err;
  }
  const seenSessions=new Set();
  for(let i=0;i<reply.sessions.length;i++){
   const item=reply.sessions[i],meta=body.metas[i];
   if(!item||item.fileId!==meta.fileId||item.orderId!==meta.orderId||
      !phase4Session(item.uploadId)||!phase4Token(item.token)||
      typeof item.newSession!=='boolean'||seenSessions.has(item.uploadId))
    throw Error('Sesión de tanda no confiable');
   seenSessions.add(item.uploadId);
  }
  return testResponse({ok:true,orderId:body.metas[0].orderId,
   sessions:reply.sessions,receiptOnly:true,paymentAuthorized:false,
   maxParallelUploads:2},200);
 }catch(err){
  // Diagnóstico privado sin tokens, contenido de PDF, URL de Google ni errores crudos.
  // Un inicio parcial en Google puede recuperarse con idénticos fileId+SHA.
  const safeReason=err?.safeReason||
   (err?.stage==='script_post'?'GOOGLE_POST':
    err?.stage==='googleusercontent_get'?'GOOGLE_REDIRECT_GET':
    err?.name==='TimeoutError'?'TIMEOUT':
    err?.message==='Redirección de Google no autorizada.'?'GOOGLE_REDIRECT':
    err?.message==='Respuesta Google inesperada.'?'RESPUESTA_GRANDE':
    err?.message==='Respuesta Google ilegible.'?'JSON_INVALIDO':
    err?.message==='Respuesta Google inválida.'?'JSON_INCOMPATIBLE':
    err?.message==='Conexión privada no configurada.'?'CONFIGURACION':
    'VALIDACION_SESION');
  console.warn('saber_batch_start_failure',safeReason);
  return testResponse({ok:false,error:'No se pudo confirmar el inicio completo de la tanda. Podés reintentar sin duplicar recibos.',
   reasonCode:safeReason,retrySafe:true,paymentAuthorized:false},502);
 }
}
async function fase4Transfer(request,env,extended=false){
 if(extended&&env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Recepción ampliada privada deshabilitada',paymentAuthorized:false},503);
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
   return testResponse({ok:false,error:'Origen no autorizado',paymentAuthorized:false},403);
 let o;
 try {
  o=await readLimited(request);validateBasic(o);
  if(o.op==='start'){
   const m=o.meta;
   if((!extended&&(m.fileId!=='documento'||m.bytes>FASE4_QUOTA_BYTES||
      !['bn','color'].includes(m.mode)))||
      (extended&&(!/^[A-Za-z0-9_-]{1,80}$/.test(m.fileId)||
       m.bytes>DOCS_MAX||!['bn','color','cad','poster'].includes(m.mode)))||
      m.name.length>120)throw Error('Límite alcanzado');
  }else if(!phase4Session(o.uploadId)||!phase4Token(o.token)){
   throw Error('Sesión inválida');
  }
 }catch(_){return testResponse({ok:false,error:'Solicitud de PDF inválida',paymentAuthorized:false},400)}
 if(o.op==='start'&&!(await pilotVerifyTurnstile(o.turnstileToken,env)))
   return testResponse({ok:false,error:'No se pudo verificar el inicio seguro',paymentAuthorized:false},403);
 const p={...o};delete p.turnstileToken;
 if(o.op==='start'){
   if(!(extended?/^WEB-[A-Za-z0-9_-]{5,80}$/.test(o.meta.orderId||''):
     /^WEB-ENSAYO-[A-F0-9]{16}$/.test(o.meta.orderId||'')))
     return testResponse({ok:false,error:'ID de prueba inválido',paymentAuthorized:false},400);
   p.meta={...o.meta,fileId:extended?o.meta.fileId:'documento'};
 }
 p.op=({start:'multiStart',part:'multiPart',finish:'multiFinish',status:'multiStatus'})[o.op];
 try {
   const response=await postToScript(env,p,fetch);
   if(!response.ok){
    // Un rechazo de Apps Script no equivale necesariamente a un cupo agotado.
    // Sólo exponer fase y categoría segura; nunca tokens ni errores internos GAS.
    const hint=String(response.code||response.errorCode||response.error||'').toLowerCase();
    const categoria=/quota|cupo|limit|l[ií]mite|exceed/.test(hint)?'CUPO':
      /duplicate|duplicad|already|existe/.test(hint)?'DUPLICADO':
      /expired|expir|session|sesion|sesi[oó]n|token/.test(hint)?'SESION':
      /size|bytes|sha|hash|part|fragment/.test(hint)?'ARCHIVO':
      'RECHAZO_RECEPTOR';
    return testResponse({ok:false,phase:o.op,reasonCode:categoria,
     error:'El receptor privado rechazó la operación '+o.op+
      ' (código '+categoria+'). No se confirmó el PDF.',
     paymentAuthorized:false},422);
   }
   return testResponse({...response,ok:true,paymentAuthorized:false},200);
 }catch(_){return testResponse({ok:false,phase:o.op,reasonCode:'CONEXION',
    error:'No se pudo confirmar la operación '+o.op+
     ' por un problema de conexión con el receptor. Consultá el estado antes de reintentar.',
    paymentAuthorized:false},502)}
}
async function fase4PrivateVerified(env,session,metrics=null,preferirInfo=false,maxFileBytes=FASE4_QUOTA_BYTES,conMedidas=false,onFase=()=>{}){
 if(![FASE4_QUOTA_BYTES,DOCS_MAX].includes(maxFileBytes))throw Error('Límite documental inválido');
 const mark=()=>Date.now();let last=mark();
 const lap=(name)=>{if(metrics){metrics[name]=mark()-last;}last=mark();};
 const ctx={uploadId:session.uploadId,token:session.token};
 async function incluirMedidas(recibo,original=null){
  if(!conMedidas)return recibo;
  onFase('LECTURA_MEDIDAS');
  const bytes=original||await leerPdfFase4Privado({
   session,receiptId:recibo.receiptId,bytes:recibo.bytes,sha256:recibo.sha256,
   consultarFirmado:p=>postToScript(env,p,fetch,420000),maxFileBytes
  });
  // Si un PDF común no ofrece medidas avanzadas, conservar la ruta
  // histórica de cotización sin habilitar atajos inseguros.
  let medidas;
  onFase('MEDIDAS_PDF');
  try{medidas=await medidasPdfServidor(bytes)}
  catch{return {...recibo,serverPageMetrics:null};}
  if(medidas.pageCount!==recibo.pages)
   throw Error('Las medidas no coinciden con las páginas del PDF verificado.');
  return {...recibo,serverPageMetrics:medidas.pageMetrics};
 }
 // En una recotización, consultar primero el recibo ya validado ahorra
 // una llamada a Google. Si no está verificado, continuar con la lectura
 // y análisis completos. La respuesta sigue vinculada a sesión+token.
 if(!preferirInfo){
  onFase('ESTADO_GOOGLE');
  const previo=await postToScript(env,{op:'multiVerifiedStatus',...ctx},fetch);
  lap('estadoPrevioMs');
  if(previo.ok&&previo.status==='verified'&&previo.verified===true&&
     previo.storageVerified===true&&previo.pageVerification==='server'&&
     previo.paymentAuthorized===false&&previo.receiptId===ctx.uploadId&&
     Number.isSafeInteger(previo.pages)&&previo.pages>=1&&
     Number.isSafeInteger(previo.bytes)&&previo.bytes>=5&&previo.bytes<=maxFileBytes&&
     /^[a-f0-9]{64}$/.test(previo.sha256||'')){
    return incluirMedidas(previo);
  }
 }
 onFase('INFO_GOOGLE');
 const info=await postToScript(env,{op:'multiInfo',...ctx},fetch);
 lap('consultaGoogleMs');
 if(!info.ok||!phase4Session(info.receiptId)||info.receiptId!==ctx.uploadId||
    !Number.isSafeInteger(info.bytes)||info.bytes<5||info.bytes>maxFileBytes||
    !/^[a-f0-9]{64}$/.test(info.sha256||'')||
    info.privateChunkBytes!==FASE4_CHUNK_BYTES)throw Error('Información privada inválida');
 if(info.pageVerification==='server'&&Number.isSafeInteger(info.pages)&&info.pages>=1){
   onFase('ESTADO_VERIFICADO');
  const ready=await postToScript(env,{op:'multiVerifiedStatus',...ctx},fetch);
   lap('estadoVerificadoMs');
   if(ready.ok&&ready.verified&&ready.pages===info.pages&&
      ready.receiptId===info.receiptId&&ready.paymentAuthorized===false)
     return incluirMedidas(ready);
 }
 onFase('LECTURA_DRIVE');
 const bytes=new Uint8Array(info.bytes);
 // GAS ofrece multiReadPart autenticado sin lock de escritura: hasta tres
 // lecturas independientes a la vez, con validación completa de cada bloque.
 // Las operaciones de escritura y registro en D1 siguen siendo secuenciales.
 const offsets=Array.from({length:Math.ceil(bytes.length/FASE4_CHUNK_BYTES)},
  (_,i)=>i*FASE4_CHUNK_BYTES);
 let siguienteOffset=0;
 async function lectorPrivado(){
   while(siguienteOffset<offsets.length){
     const offset=offsets[siguienteOffset++];
     const part=await postToScript(env,{op:'multiReadPart',...ctx,
       receiptId:info.receiptId,offset},fetch,420000);
     const expected=Math.min(FASE4_CHUNK_BYTES,bytes.length-offset);
     if(!part.ok||part.receiptId!==info.receiptId||part.offset!==offset||
        part.length!==expected||part.bytes!==info.bytes||part.sha256!==info.sha256||
        typeof part.dataBase64!=='string'||part.dataBase64.length>380000||
        !/^[a-f0-9]{64}$/.test(part.chunkSha256||''))
       throw Error('Google no entregó el fragmento privado esperado');
     const str=atob(part.dataBase64);
     if(str.length!==expected)throw Error('Tamaño de fragmento inconsistente');
     const chunk=Uint8Array.from(str,c=>c.charCodeAt(0));
     if(await safeHash(chunk)!==part.chunkSha256)throw Error('Integridad de fragmento incorrecta');
     bytes.set(chunk,offset);
   }
 }
 await Promise.all(Array.from({length:Math.min(3,offsets.length)},()=>lectorPrivado()));
 lap('lecturaPrivadaMs');
 onFase('ANALISIS_PDF');
 const checked=await verificarPdfAlmacenado({driveBytes:bytes,reciboServidor:{
   receiptState:'bytes_checked',receiptId:info.receiptId,orderId:info.orderId,
   fileId:info.fileId,name:info.name,mode:info.mode,bytes:info.bytes,sha256:info.sha256
 }});
 lap('analisisPdfMs');
 onFase('GUARDADO_PAGINAS');
 const committed=await postToScript(env,{op:'multiCommitPages',...ctx,receiptId:info.receiptId,
   sha256:checked.sha256,bytes:checked.bytes,pages:checked.pages,parserVersion:'pdf-lib-1.17.1'},fetch);
 lap('confirmacionGoogleMs');
 if(!committed.ok||committed.verified!==true||committed.receiptId!==checked.receiptId||
   committed.pages!==checked.pages||committed.paymentAuthorized!==false)
   throw Error('Google no guardó el conteo de páginas');
 return incluirMedidas(committed,bytes);
}
/** Sólo presupuesto privado de ploteo de PDF ya guardado y verificado.
 * No registra órdenes, no escribe en D1 y no emite autorización de pago.
 */
async function v2CotizarPloteoVerificado(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env)||v2PrivateBrowserAuthorized(request,env)!=='allow')
  return testResponse({ok:false,error:'Acceso privado requerido',paymentAuthorized:false},401);
 if(env?.DOCS_V2_RECEIPT_LINK_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Recepción privada deshabilitada',paymentAuthorized:false},503);
 let input;
 try{
  input=await readLimited(request);
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).sort().join(',')!=='clasificacionCliente,copias,expectedMode,expectedOrderId,papelPoster,sesion'||
     !input.sesion||Object.keys(input.sesion).sort().join(',')!=='token,uploadId'||
     !phase4Session(input.sesion.uploadId)||!phase4Token(input.sesion.token)||
     !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(input.expectedOrderId||'')||
     !['bn','color'].includes(input.expectedMode)||
     !Number.isSafeInteger(input.copias)||input.copias<1||input.copias>200||
     !['obra80','recubierto'].includes(input.papelPoster)||
     !Array.isArray(input.clasificacionCliente)||input.clasificacionCliente.length<1||
     input.clasificacionCliente.length>2000)
   throw Error('Datos incorrectos');
 }catch{
  return testResponse({ok:false,error:'Instrucciones de ploteo inválidas',paymentAuthorized:false},400);
 }
 try{
  const recibo=await fase4PrivateVerified(env,input.sesion,null,false,DOCS_MAX);
  if(recibo.orderId!==input.expectedOrderId||recibo.mode!==input.expectedMode||
     recibo.paymentAuthorized!==false||recibo.receiptId!==input.sesion.uploadId)
   throw Error('Recibo no corresponde al trabajo.');
  const original=await leerPdfFase4Privado({
   session:input.sesion,receiptId:recibo.receiptId,
   bytes:recibo.bytes,sha256:recibo.sha256,maxFileBytes:DOCS_MAX,
   consultarFirmado:p=>postToScript(env,p,fetch,420000)
  });
  const medidas=await medidasPdfServidor(original);
  const quote=cotizarPloteoReciboVerificado({
   recibo,medidas,clasificacionCliente:input.clasificacionCliente,
   copias:input.copias,papelPoster:input.papelPoster,precios:preciosActuales
  });
  return testResponse({ok:true,orderId:recibo.orderId,receiptId:recibo.receiptId,
   sha256:recibo.sha256,quote,checkoutEnabled:false,
   paymentAuthorized:false,listoParaProducir:false},200);
 }catch(_){
  return testResponse({ok:false,error:'No se pudo verificar o cotizar el ploteo; requiere revisión.',
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false},422);
 }
}

async function v2VincularPdf(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(env?.DOCS_V2_RECEIPT_LINK_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Enlace V2 deshabilitado',paymentAuthorized:false},503);
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen de recepción no autorizado',paymentAuthorized:false},403);
 let input;
 try{
  input=await readLimited(request);
  if(!input||typeof input!=='object'||Array.isArray(input)||
     !['expectedMode,expectedOrderId,referencia,sesion','expectedMode,expectedOrderId,opciones,referencia,sesion'].includes(Object.keys(input).sort().join(','))||
     !input.sesion||Object.keys(input.sesion).sort().join(',')!=='token,uploadId'||
     !phase4Session(input.sesion.uploadId)||!phase4Token(input.sesion.token)||
     !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(input.expectedOrderId||'')||
     !['bn','color'].includes(input.expectedMode)||
     (input.opciones!==undefined&&(
       !input.opciones||typeof input.opciones!=='object'||Array.isArray(input.opciones)||
       !['anillado,caras,copias,formato,materialColor',
         'anillado,caras,copias,formato,materialColor,paginasPorHoja']
        .includes(Object.keys(input.opciones).sort().join(','))||
       ![1,2,4,9].includes(input.opciones.paginasPorHoja??1)||
       !['a4','a3'].includes(input.opciones.formato)||
       !['simple','double'].includes(input.opciones.caras)||
       !['ninguno','individual'].includes(input.opciones.anillado)||
       !Number.isSafeInteger(input.opciones.copias)||
       input.opciones.copias<1||input.opciones.copias>200||
       typeof input.opciones.materialColor!=='string'||
       !(preciosActuales[input.opciones.formato==='a4'?'colorA4':'colorA3']?.materials||[])
        .some(m=>m.id===input.opciones.materialColor))))
   throw Error('Solicitud V2 inválida');
 }catch(_){
  return testResponse({ok:false,error:'Referencia o sesión de PDF inválida',paymentAuthorized:false},400);
 }
 let etapaVinculo='RECIBO_GOOGLE';
 try{
  // Se valida todo el PDF; sólo omitimos la consulta de estado previa que
  // siempre queda pendiente inmediatamente después de finish.
  const recibo=await fase4PrivateVerified(env,input.sesion,null,true,DOCS_MAX,true,
   fase=>{etapaVinculo=fase});
  etapaVinculo='CRUCE_RECIBO';
  const link=verificarVinculoCotizadorV2({
   referencia:input.referencia,recibo,sessionId:input.sesion.uploadId,
   expectedOrderId:input.expectedOrderId,expectedMode:input.expectedMode
  });
  etapaVinculo='SELLO_RECEPCION';
  const comprobanteServidor=recibo.serverPageMetrics
   ?await crearComprobantePdf({
     recibo,medidas:recibo.serverPageMetrics,secret:env.DOCS_RELAY_KEY
    })
   :null;
  etapaVinculo='COTIZACION';
  // La cotización es OPCIONAL para conservar el contrato del cliente V2 existente.
  // Es preliminar de servidor, limitada a A4/A3, BN/color y materiales del piloto.
  // El importe del navegador jamás es autoridad y no se prepara una orden comercial.
  if(input.opciones!==undefined){
   const o=input.opciones;
   if((o.paginasPorHoja??1)!==1){
    const medidas={pageCount:recibo.pages,pageMetrics:recibo.serverPageMetrics};
    const presupuesto=cotizarNupReciboVerificado({
     recibo,medidas,opciones:o,precios:preciosActuales
    });
    return testResponse({...link,ok:true,comprobanteServidor,cotizacionServidor:{
     ...presupuesto,priceVersion:preciosActuales.generatedAt||'catalogo-local'
    },paymentAuthorized:false,checkoutEnabled:false},200);
   }
   const budget=prepararPresupuestoDocumentos({
    solicitud:{orderId:recibo.orderId,archivos:[{
     id:recibo.fileId,nombre:recibo.name,modo:recibo.mode,orden:1
    }],formato:o.formato,caras:o.caras,copias:o.copias,
    anillado:o.anillado==='individual'?'juntos':'ninguno',materialColor:o.materialColor},
    recibosConfiables:[recibo],tarifasServidor:preciosActuales
   });
   if(budget.paymentAuthorized!==false||
      !Number.isSafeInteger(budget.quote?.total)||budget.quote.total<=0)
    throw Error('Cotización documental no comprobada');
   return testResponse({...link,ok:true,comprobanteServidor,
    cotizacionServidor:{estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
     totalArs:budget.quote.total,priceVersion:budget.priceVersion,
     paginasOriginales:recibo.pages,formato:o.formato,caras:o.caras,
     copias:o.copias,anillado:o.anillado,grupoAnillado:'',
     materialColor:o.materialColor,paymentAuthorized:false},
    paymentAuthorized:false,checkoutEnabled:false},200);
  }
  return testResponse({...link,ok:true,comprobanteServidor},200);
 }catch(_){
  // Observabilidad segura: etapa enumerada, sin nombres, tokens ni SHA.
  console.warn('saber_v2_link_failure',etapaVinculo);
  return testResponse({ok:false,phase:'vinculo',reasonCode:etapaVinculo,
   error:'No se pudo verificar y cotizar el PDF seleccionado. Revisá el archivo y las opciones.',
   paymentAuthorized:false},422);
 }
}

async function fase4Quote(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 let o;
 try{o=await readLimited(request);if(!phase4Opts(o))throw Error('Opciones incorrectas')}
 catch(_){return testResponse({ok:false,error:'Opciones de cotización inválidas',paymentAuthorized:false},400)}
 try{
   const metricas={};const inicio=Date.now();
   const r=await fase4PrivateVerified(env,o,metricas);
   if(!r.ok||r.verified!==true||r.storageVerified!==true||
      r.pageVerification!=='server'||r.paymentAuthorized!==false)
     throw Error('Recibo pendiente de validación');
   const req={orderId:r.orderId,archivos:[{id:r.fileId,nombre:r.name,modo:r.mode,orden:1}],
     formato:o.formato,caras:o.caras,copias:o.copias,anillado:o.anillado,materialColor:'obra70'};
   const budget=prepararPresupuestoDocumentos({solicitud:req,
     recibosConfiables:[r],tarifasServidor:preciosActuales});
   if(budget.paymentAuthorized!==false||budget.quote.total<=0||
      !Number.isSafeInteger(budget.quote.total))throw Error('Importe no aprobado');
   return testResponse({ok:true,receiptId:r.receiptId,pages:r.pages,copias:o.copias,
     hojasTotales:budget.quote.hojasTotales,
     subtotalImpresiones:budget.quote.subtotalBN+budget.quote.subtotalColor,
     anillados:budget.quote.cargoAnillado,total:budget.quote.total,
     priceVersion:budget.priceVersion,paymentAuthorized:false,
     tiemposServidor:{...metricas,totalMs:Date.now()-inicio}},200);
 }catch(_){
   return testResponse({ok:false,error:'No se pudo validar y cotizar este PDF de prueba.',
     paymentAuthorized:false},422);
 }
}

/* Ensayo multifichero: las sesiones se verifican en Google por HMAC.
 * No aceptar páginas, importes, nombres, recibos ni configuraciones privadas
 * provenientes del navegador. La ruta sólo existe en Worker aislado.
 */
function pantallaLote(env){
 try {
  return new Response(paginaLotePdf(env?.DOCS_TURNSTILE_SITE_KEY),{
    status:200,headers:{'Content-Type':'text/html;charset=utf-8',
    'Cache-Control':'no-store,private','X-Robots-Tag':'noindex,nofollow',
    'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'}
  });
 }catch(_){return testResponse({ok:false,error:'Turnstile ausente',paymentAuthorized:false},503);}
}
function validarLote(op,maxFiles=5){
 if(![5,30].includes(maxFiles))return false;
 return op&&typeof op==='object'&&!Array.isArray(op)&&
   (Object.keys(op).sort().join(',')==='anillado,caras,copias,formato,sesiones'||
    Object.keys(op).sort().join(',')==='anillado,caras,copias,formato,primeraCotizacion,sesiones'&&
    typeof op.primeraCotizacion==='boolean')&&
   ['a4','a3'].includes(op.formato)&&['simple','double'].includes(op.caras)&&
   ['ninguno','juntos','separados'].includes(op.anillado)&&
   Number.isSafeInteger(op.copias)&&op.copias>=1&&op.copias<=200&&
   Array.isArray(op.sesiones)&&op.sesiones.length>=1&&op.sesiones.length<=maxFiles&&
   op.sesiones.every(s=>s&&typeof s==='object'&&!Array.isArray(s)&&
     Object.keys(s).sort().join(',')==='token,uploadId'&&
     phase4Session(s.uploadId)&&phase4Token(s.token))&&
   new Set(op.sesiones.map(s=>s.uploadId)).size===op.sesiones.length;
}
async function fase4QuoteLote(request,env,extended=false){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(extended&&env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Cotización ampliada privada deshabilitada',paymentAuthorized:false},503);
 const maxFiles=extended?30:5,maxFileBytes=extended?DOCS_MAX:FASE4_QUOTA_BYTES;
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
   return testResponse({ok:false,error:'Origen no autorizado',paymentAuthorized:false},403);
 let op;
 try{op=await readLimited(request);if(!validarLote(op,maxFiles))throw Error('Lote inválido');}
 catch(_){return testResponse({ok:false,error:'Opciones de lote inválidas',paymentAuthorized:false},400);}
 try {
   const start=Date.now(),recibos=[],tiemposPorArchivo=[];
   // Secuencial: proteger cuotas de Apps Script. La aceleración requiere mediciones reales.
   for(const s of op.sesiones){
     const metricas={};const inicioArchivo=Date.now();
     const r=await fase4PrivateVerified(env,s,metricas,op.primeraCotizacion===true,maxFileBytes);
     tiemposPorArchivo.push({numero:tiemposPorArchivo.length+1,
       totalMs:Date.now()-inicioArchivo,...metricas});
     if(!r.ok||r.verified!==true||r.storageVerified!==true||
        r.pageVerification!=='server'||r.paymentAuthorized!==false)
       throw Error('Un documento no está verificado');
     recibos.push(r);
   }
   const result=cotizarLoteVerificado({recibosVerificados:recibos,
     formato:op.formato,caras:op.caras,copias:op.copias,
     anillado:op.anillado,materialColor:'obra70',precios:preciosActuales,
     maxFiles,maxFileBytes,requireSharedOrder:extended});
   return testResponse({...result,tiempoServidorMs:Date.now()-start,
     tiemposPorArchivo,paymentAuthorized:false},200);
 }catch(_){
   return testResponse({ok:false,error:'No se pudo validar todos los archivos y cotizar el lote.',
     paymentAuthorized:false},422);
 }
}

/** Cotización preliminar sin subida: nunca crea recibos ni autoriza pagos. */
async function cotizacionRapida(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 let p;
 try{
  p=await readLimited(request);
  if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='anillado,archivos,caras,copias,formato'||
    !Array.isArray(p.archivos)||p.archivos.length<1||p.archivos.length>30)
   throw Error('Lote incorrecto');
  for(const [i,a] of p.archivos.entries()){
   if(!a||typeof a!=='object'||Array.isArray(a)||
     !['id,modo,nombre,orden,paginas','anillado,caras,copias,formato,grupoAnillado,id,materialColor,modo,nombre,orden,paginas','anillado,caras,copias,formato,id,materialColor,modo,nombre,orden,paginas'].includes(Object.keys(a).sort().join(','))||
     a.id!=='pdf'+(i+1)||a.orden!==i+1||
     typeof a.nombre!=='string'||a.nombre.length<1||a.nombre.length>160||
     !/\.pdf$/i.test(a.nombre)||!['bn','color'].includes(a.modo)||
     !Number.isSafeInteger(a.paginas)||a.paginas<1||a.paginas>20000||
     (Object.hasOwn(a,'formato')&&(!['a4','a3'].includes(a.formato)||!['simple','double'].includes(a.caras)||!Number.isSafeInteger(a.copias)||a.copias<1||a.copias>500||!['ninguno','individual','grupo'].includes(a.anillado)||(a.anillado==='grupo'&&!/^[1-9][0-9]?$/.test(String(a.grupoAnillado||'')))||typeof a.materialColor!=='string'||a.materialColor.length>40)))
    throw Error('Documentos incorrectos');
  }
  const individuales=p.archivos.every(a=>Object.hasOwn(a,'formato'));
  const d=individuales?cotizarDocumentosIndividuales({archivos:p.archivos,precios:preciosActuales}):cotizarDocumentos({...p,materialColor:'obra70',precios:preciosActuales});
  if(!Number.isFinite(d.total)||d.total<0)throw Error('Importe no calculable');
  return testResponse({
   ok:true,estado:'PRELIMINAR_SIN_VERIFICAR',paymentAuthorized:false,
   resumen:individuales?{total:d.total,paginas:d.paginasTotales,detalles:d.detalles,grupos:d.grupos,detalleArmados:d.detalleArmados,subtotalImpresiones:d.subtotalImpresiones,anillados:d.subtotalAnillados}:{total:d.total,paginas:d.paginasPorEjemplar,
     bnCantidad:d.bnCantidad,colorCantidad:d.colorCantidad,
     siguienteDescuentoBN:d.siguienteDescuentoBN,
     siguienteDescuentoColor:d.siguienteDescuentoColor,
     anillados:d.cargoAnillado},
   advertencia:'El precio y las páginas deben verificarse con archivos originales antes de aceptar un pedido.'
  },200);
 }catch(_){return testResponse({ok:false,error:'No se pudo calcular el precio orientativo.',paymentAuthorized:false},400)}
}
/** Catálogo público limitado a identificadores y nombres de materiales color (sin tarifas). */
async function catalogoMaterialesRapido(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='GET')return closed();
 if(new URL(request.url).origin!==new URL(env.DOCS_ALLOWED_ORIGIN||request.url).origin)
  return testResponse({ok:false,error:'Origen no permitido'},403);
 const clean=(key)=>(preciosActuales[key]?.materials||[]).map(m=>({id:m.id,name:m.name,family:m.family||''}));
 return testResponse({ok:true,materials:{a4:clean('colorA4'),a3:clean('colorA3')},photos:preciosActuales.photos.products.filter(p=>p.size!=='Polaroid').map(p=>({id:p.id,name:p.paper+' · '+p.size})),cutVariants:preciosActuales.cutPlotter.variants.map(v=>({id:v.id,name:v.name})),graphicProducts:GRAFICA_COMERCIAL.map(p=>({id:p.id,name:p.familia+' · '+p.descripcion}))});
}
/** Ploteos preliminares: nunca autoriza pagos ni recibe originales. */
async function catalogoPloteos(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='GET')return closed();
 if(new URL(request.url).origin!==new URL(env.DOCS_ALLOWED_ORIGIN||request.url).origin)
  return testResponse({ok:false,error:'Origen no permitido'},403);
 return testResponse({ok:true,supports:preciosActuales.plotter.supports.map(x=>({
  id:x.id,name:x.name,widthCm:x.widthCm
 }))});
}
async function cotizacionPloteos(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 try{
  const p=await readLimited(request);
  if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).join(',')!=='trabajos')throw Error('Solicitud inválida');
  const detalle=cotizarPloteosRapido({trabajos:p.trabajos,precios:preciosActuales});
  return testResponse({ok:true,paymentAuthorized:false,estado:'PRELIMINAR_SIN_VERIFICAR',resumen:detalle});
 }catch(_){return testResponse({ok:false,error:'Revisá las medidas y que el material admita el ancho del ploteo.',paymentAuthorized:false},400)}
}
function paginaPloteos(){
 return new Response(paginaPloteosRapido(),{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
  'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'
 }});
}
function scriptPloteos(){
 return new Response(plotClienteJs,{status:200,headers:{
  'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store,private',
  'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'
 }});
}
function paginaRapida(){
 return new Response(paginaCotizadorRapido(),{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
  'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'
 }});
}
function scriptRapido(){
 return new Response(rapidoClienteJs,{status:200,headers:{
  'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store,private',
  'X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'
 }});
}
/** Inspección de ficha central en piloto, solo operador con clave independiente.
 * No publica originales, no crea pedidos D1 ni permite pago.
 */
/** Prueba administrativa explícita, de solo verificación HMAC: no usa D1. */
async function diagnosticoPuenteCentral(request,env){
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 const secret=env?.DOCS_CENTRAL_ADMIN_KEY;
 if(typeof secret!=='string'||secret.length<32||
    secret===env.DOCS_RELAY_KEY||secret===env.CENTRAL_BRIDGE_KEY)
  return testResponse({ok:false,error:'Diagnóstico administrativo apagado',paymentAuthorized:false},503);
 const actual=request.headers.get('Authorization')||'';
 const expected='Bearer '+secret;
 let different=actual.length===expected.length?0:1;
 for(let i=0;i<expected.length;i++)
  different|=expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
 if(different)return testResponse({ok:false,error:'Autorización necesaria',paymentAuthorized:false},401);
 if(request.headers.get('Content-Type')!=='application/json')
  return testResponse({ok:false,error:'Solicitud no válida',paymentAuthorized:false},400);
 let input;
 try{input=await readLimited(request)}catch{return testResponse({ok:false,error:'Solicitud no válida',paymentAuthorized:false},400)}
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).join(',')!=='operation'||input.operation!=='verify-only')
  return testResponse({ok:false,error:'Solicitud no válida',paymentAuthorized:false},400);
 try{
  const result=await probarPuenteCentral({env});
  return testResponse(result,200);
 }catch{
  return testResponse({ok:false,error:'No se pudo verificar firma interna; revisar compuertas privadas.',paymentAuthorized:false},503);
 }
}

async function apiFichaCentralPrivada(request,env,sincronizar=false,mixto=false,lote=false,documental=false,compuesto=false,v2=false){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 const key=env?.DOCS_CENTRAL_ADMIN_KEY;
 if(typeof key!=='string'||key.length<32||key===env.DOCS_RELAY_KEY)
  return testResponse({ok:false,error:'Central privada sin configurar',paymentAuthorized:false},503);
 const given=request.headers.get('Authorization')||'';
 const expected='Bearer '+key;
 let diff=given.length===expected.length?0:1;
 for(let i=0;i<expected.length;i++)
  diff|=expected.charCodeAt(i)^(given.charCodeAt(i)||0);
 if(diff)return testResponse({ok:false,error:'Acceso administrativo requerido',paymentAuthorized:false},401);
 let input;
 try{
  input=await readLimited(request);
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).sort().join(',')!==(mixto?
      (lote?'clientOrderId,items,polaroidReference,sesiones':'clientOrderId,items,opciones,polaroidReference,sesion'):
      documental?(lote?'clientOrderId,items,sesiones':v2?'clientOrderId,items,opciones,referencia,sesion':'clientOrderId,items,opciones,sesion'):
      (lote?'sesiones':'opciones,sesion')))
    throw Error('Datos inválidos');
 }catch(_){return testResponse({ok:false,error:'Solicitud no válida',paymentAuthorized:false},400);}
 try{
  // V2: verificar referencia exacta del archivo original con una consulta
  // nueva al receptor GAS. Nunca confiar en estados recibidos del navegador.
  if(v2){
   if(!documental||lote||mixto||compuesto||
      env?.DOCS_V2_RECEIPT_LINK_ENABLED!=='PRIVATE_TEST_ONLY'||
      env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
    return testResponse({ok:false,error:'Vínculo comercial V2 privado apagado',paymentAuthorized:false},503);
   const original=await fase4PrivateVerified(env,input.sesion,null,false,DOCS_MAX);
   const cotejo=verificarVinculoCotizadorV2({
    referencia:input.referencia,recibo:original,
    sessionId:input.sesion.uploadId,
    expectedOrderId:original.orderId,expectedMode:original.mode
   });
   if(cotejo.reciboGoogleVerificado!==true||cotejo.paymentAuthorized!==false)
    throw Error('La referencia V2 no está confirmada.');
  }
  if(compuesto&&(env?.DOCS_PRINT_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
      env?.DOCS_PRINT_DRAFT_CENTRAL_ENABLED!=='PRIVATE_TEST_ONLY'))
    return testResponse({ok:false,error:'Composición de PDF privado deshabilitada',paymentAuthorized:false},503);
  if(mixto&&env?.DOCS_MIXED_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY')
    return testResponse({ok:false,error:'Pedido mixto privado apagado',paymentAuthorized:false},503);
  if(documental&&env?.DOCS_ORDER_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY')
    return testResponse({ok:false,error:'Compra de documentos privada apagada',paymentAuthorized:false},503);
  if((sincronizar||mixto||documental||compuesto)&&(env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
      typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
      env.CENTRAL_BRIDGE_KEY===env.DOCS_CENTRAL_ADMIN_KEY||
      env.CENTRAL_BRIDGE_KEY===env.DOCS_RELAY_KEY))
    return testResponse({ok:false,error:'Sincronización con D1 no habilitada',paymentAuthorized:false},503);
  const parametros={consultarFirmado:p=>postToScript(env,p,fetch,420000),
   preciosServidor:preciosActuales};
  const extended=env?.DOCS_EXTENDED_RECEIVER_ENABLED==='PRIVATE_TEST_ONLY';
  const result=lote||compuesto?
   await fase4FichaCentralLotePrivada({...parametros,
    sesiones:lote?input.sesiones:[{sesion:input.sesion,opciones:input.opciones}],
    maxFiles:extended?30:5,maxFileBytes:extended?20*1024*1024:1024*1024}):
   await fase4FichaCentralPrivada({...parametros,sesion:input.sesion,opciones:input.opciones});
  if(compuesto){
   const trabajos=result.ficha?.trabajos||[];
   if(trabajos.length!==1||trabajos[0].servicio!=='documentos')
    return testResponse({ok:false,error:'Sólo documentos presupuestados pueden componerse automáticamente',paymentAuthorized:false},422);
   const registrarOriginal=await enviarCentralFirmada({
    verificacion:result,url:env.CENTRAL_TEST_URL,
    clave:env.CENTRAL_BRIDGE_KEY,habilitado:env.DOCS_CENTRAL_SYNC_ENABLED,
    service:env.SABER_CENTRAL
   });
   if(registrarOriginal.webOrderId!==result.orderId)
    throw Error('La Central no identificó el pedido original.');
   const consultarFirmado=p=>postToScript(env,p,fetch,420000);
   const compuestoSeguro=await componerDesdeReciboVerificado({
    manifiesto:result,sesion:input.sesion,trabajoId:trabajos[0].idTrabajo,
    consultarFirmado,maxFileBytes:extended?20*1024*1024:1024*1024
   });
   const guardado=await guardarPdfCompuestoPrivado({
    ...compuestoSeguro,sesionOriginal:input.sesion,
    consultarFirmado,habilitado:env.DOCS_PRINT_DRAFT_ENABLED
   });
   const registrado=await registrarPdfCompuestoCentralFirmado({guardado,env});
   if(registrado.orderId!==result.orderId)
    throw Error('La Central no confirmó el PDF compuesto del mismo pedido.');
   return testResponse({ok:true,centralVinculada:true,ordenWeb:guardado.orderId,
    reciboOriginal:guardado.originalReceiptId,
    reciboBorrador:guardado.borradorReceiptId,
    sha256:guardado.sha256,paginas:guardado.pages,
    bytes:guardado.bytes,guardadoEnDrive:guardado.guardadoEnDrive,
    estado:guardado.estado,checkoutEnabled:false,
    paymentAuthorized:false,descargaPrivadaHabilitada:false,
    listoParaProducir:false},200);
  }
  if(sincronizar||mixto||documental){
   // Antes de cualquier escritura en D1, garantizar asociación con el PDF
   // íntegro que fue elegido y cotizado en el V2.
   if(v2){
    const recibido=result.recibos;
    if(!Array.isArray(recibido)||recibido.length!==1||
       recibido[0].receiptId!==input.sesion.uploadId||
       recibido[0].sha256!==input.referencia.sha256||
       recibido[0].bytes!==input.referencia.bytes||
       recibido[0].pages!==input.referencia.paginas)
     throw Error('La ficha comercial no corresponde al PDF V2.');
   }
   const resultado=await enviarCentralFirmada({
    verificacion:result,url:env.CENTRAL_TEST_URL,
    clave:env.CENTRAL_BRIDGE_KEY,habilitado:env.DOCS_CENTRAL_SYNC_ENABLED,
    service:env.SABER_CENTRAL
   });
   if(mixto){
    const commercial=await prepararMixtoCentralFirmado({env,
     webOrderId:resultado.webOrderId,
     polaroidReference:input.polaroidReference,
     clientOrderId:input.clientOrderId,items:input.items});
    return testResponse({ok:true,carritoMixto:true,
     orderId:commercial.commercialOrderId,totalArs:commercial.amountArs,
     idempotent:commercial.idempotent,
     checkoutEnabled:false,paymentAuthorized:false,
     listoParaProducir:false},200);
   }
   if(documental){
    // V2: la Central debe registrar exactamente la orden cuyo original
    // acaba de verificarse en GAS, antes de preparar su compra comercial.
    if(v2&&resultado.webOrderId!==result.orderId)
     throw Error('La Central vinculó un identificador de pedido diferente.');
    const commercial=await prepararDocumentosCentralFirmado({env,
     webOrderId:resultado.webOrderId,clientOrderId:input.clientOrderId,items:input.items});
    return testResponse({ok:true,carritoDocumental:true,
     orderId:commercial.commercialOrderId,totalArs:commercial.amountArs,
     idempotent:commercial.idempotent,checkoutEnabled:false,
     paymentAuthorized:false,listoParaProducir:false},200);
   }
   return testResponse({ok:true,sincronizado:true,
    webOrderId:resultado.webOrderId,guardado:resultado.guardado,
    yaExistia:resultado.existia,paymentAuthorized:false,
    listoParaProducir:false},200);
  }
  return testResponse({ok:true,...result,paymentAuthorized:false,
   listoParaProducir:false},200);
 }catch(_){
  return testResponse({ok:false,error:'No se pudo verificar la ficha en Drive. Requiere revisión.',
   paymentAuthorized:false,listoParaProducir:false},422);
 }
}

/**
 * Compra documental V2 de VARIOS PDFs, privada y apagada por defecto.
 * Cada PDF se descarga/verifica desde GAS/Drive con SHA y páginas; sólo
 * después se compara con el manifiesto del carrito y se registra en D1.
 * El importe proviene exclusivamente del servidor, no del navegador.
 */
async function apiPrepararDocumentosV2Lote(request,env){
 let preciosActuales;
 try{preciosActuales=await preciosPrivados(env,request);}
 catch(_){return testResponse({ok:false,error:'No pudimos verificar la tarifa vigente. No se generó presupuesto ni se autorizó cobro.',paymentAuthorized:false},503);}
 if(request.method!=='POST')return closed();
 if(!allowed(request,env))
  return testResponse({ok:false,error:'Origen no permitido',paymentAuthorized:false},403);
 const key=env?.DOCS_CENTRAL_ADMIN_KEY;
 if(typeof key!=='string'||key.length<32||key===env.DOCS_RELAY_KEY||
    key===env.CENTRAL_BRIDGE_KEY)
  return testResponse({ok:false,error:'Acceso privado apagado',paymentAuthorized:false},503);
 const expected='Bearer '+key,auth=request.headers.get('Authorization')||'';
 let difference=auth.length===expected.length?0:1;
 for(let i=0;i<expected.length;i++)
  difference|=expected.charCodeAt(i)^(auth.charCodeAt(i)||0);
 // El operador también puede iniciar el ensayo desde el portal Basic
 // del MISMO Worker: nunca se entrega DOCS_CENTRAL_ADMIN_KEY al JavaScript.
 // Se exigen las mismas compuertas privadas y origen explícito.
 if(difference&&v2PrivateBrowserAuthorized(request,env)!=='allow'&&
    !(await v2SessionAuthorized(request,env)))
  return testResponse({ok:false,error:'Autorización requerida',paymentAuthorized:false},401);
 if(env?.DOCS_V2_RECEIPT_LINK_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_ORDER_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY')
  return testResponse({ok:false,error:'Carrito V2 privado apagado',paymentAuthorized:false},503);
 let input;
 try{
  input=await readLimited(request);
  if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).sort().join(',')!=='clientOrderId,items,manifiesto,sesiones'||
   !Array.isArray(input.sesiones)||input.sesiones.length<1||
   input.sesiones.length>30||input.sesiones.length!==input.manifiesto?.items?.length||
   input.manifiesto.schema!=='saber-v2-manifiesto-preliminar-v1'||
   !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(input.manifiesto.orderId||'')||
   !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.clientOrderId||'')||
   !Array.isArray(input.items)||input.items.length>50||
   input.manifiesto.items.some((m,i)=>!m||
    !/^DOC-[a-f0-9-]{36}$/i.test(m.reciboPrivado||'')||
    input.sesiones[i]?.sesion?.uploadId!==m.reciboPrivado||
    !/^[a-f0-9]{64}$/.test(m.sha256||''))||
   new Set(input.manifiesto.items.map(m=>m.reciboPrivado)).size!==input.sesiones.length)
   throw Error('Pedido incorrecto');
 }catch{return testResponse({ok:false,error:'Pedido V2 inválido',paymentAuthorized:false},400);}
 let etapaRegistro='VERIFICACION_RECIBOS';
 try{
  // Sólo con TODOS los comprobantes HMAC válidos se evita una
  // segunda descarga. Para pedidos antiguos/mixtos se usa la ruta completa.
  const rutaLegada=()=>fase4FichaCentralLotePrivada({
   sesiones:input.sesiones,
   consultarFirmado:p=>postToScript(env,p,fetch,420000),
   preciosServidor:preciosActuales,maxFiles:30,maxFileBytes:20*1024*1024
  });
  let verificacion;
  if(input.sesiones.every(e=>e?.comprobanteServidor)){
   try{
    verificacion=await verificarPedidoPorComprobantes({
     sesiones:input.sesiones,manifiesto:input.manifiesto,
     secret:env.DOCS_RELAY_KEY,preciosServidor:preciosActuales
    });
   }catch(error){
    // Una prueba genuina que envejeció no obliga al cliente a re-subir.
    // Se vuelve a la verificación COMPLETA contra Drive. Firma alterada,
    // discrepancias de PDF o precio no se dejan pasar.
    if(error?.message!=='Comprobante vencido; se debe volver a comprobar el PDF en servidor.')
     throw error;
    etapaRegistro='RELECTURA_DRIVE';
    verificacion=await rutaLegada();
   }
  }else{
   etapaRegistro='RELECTURA_DRIVE';
   verificacion=await rutaLegada();
  }
  etapaRegistro='CONCILIACION_MANIFIESTO';
  const registrado=await registrarManifiestoV2EnCentral({
   manifiesto:input.manifiesto,verificacion,env
  });
  if(registrado.orderId!==verificacion.orderId||registrado.archivos!==input.sesiones.length)
   throw Error('Pedido V2 no concordante.');
  etapaRegistro='PREPARACION_CENTRAL';
  const pedido=await prepararDocumentosCentralFirmado({
   env,webOrderId:registrado.orderId,
   clientOrderId:input.clientOrderId,items:input.items
  });
  return testResponse({
   ok:true,carritoDocumentalV2:true,archivosVerificados:registrado.archivos,
   webOrderId:registrado.orderId,orderId:pedido.commercialOrderId,
   totalArs:pedido.amountArs,idempotent:pedido.idempotent,
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false
  },200);
 }catch(_error){
  // No registrar mensajes internos, identificadores, recibos ni credenciales.
  console.warn('saber_v2_registro_pendiente',etapaRegistro);
  return testResponse({ok:false,reasonCode:etapaRegistro,
   error:'Pedido privado pendiente de revisión; no se autorizó pago.',
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false},422);
 }
}

/**
 * Ensayo mismo origen del cotizador V2 original. Requiere DOS capas:
 * interruptor desactivado por defecto y contraseña independiente HTTP Basic.
 * Las rutas públicas de documentos y la web comercial NO se alteran.
 */
/** Acceso exclusivo personal LIVE por Basic; no acepta cookies de comprador ni ensayos. */
function staffLiveAuthorized(request,env){
 const GO='GO_COMERCIAL_CONFIRMADO';
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_STAFF_GATE!==GO||
    env?.DOCS_LIVE_PACKAGE_GATE!==GO||
    typeof env?.DOCS_LIVE_STAFF_SECRET!=='string'||
    !/^[A-Za-z0-9_-]{32,128}$/.test(env.DOCS_LIVE_STAFF_SECRET)||
    [env.CENTRAL_BRIDGE_KEY,env.DOCS_V2_PRIVATE_UI_SECRET,
     env.DOCS_LIVE_TUS_SERVICE_KEY,env.DOCS_LIVE_R2_RECEIPT_KEY]
     .includes(env.DOCS_LIVE_STAFF_SECRET))
  return 'off';
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Basic ')||auth.length>400)return 'deny';
 let provided;try{provided=atob(auth.slice(6))}catch{return 'deny'}
 const expected='operador:'+env.DOCS_LIVE_STAFF_SECRET;
 if(provided.length!==expected.length)return 'deny';
 let diff=0;for(let i=0;i<expected.length;i++)
  diff|=provided.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0?'allow':'deny';
}
function v2PrivateBrowserAuthorized(request,env){
 if(env?.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY'||
   typeof env.DOCS_V2_PRIVATE_UI_SECRET!=='string'||
   !/^[A-Za-z0-9_-]{32,128}$/.test(env.DOCS_V2_PRIVATE_UI_SECRET)||
   env.DOCS_V2_PRIVATE_UI_SECRET===env.DOCS_CENTRAL_ADMIN_KEY||
   env.DOCS_V2_PRIVATE_UI_SECRET===env.DOCS_RELAY_KEY||
   env.DOCS_V2_PRIVATE_UI_SECRET===env.CENTRAL_BRIDGE_KEY)
  return 'off';
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Basic ')||auth.length>400)return 'deny';
 let provided;
 try{provided=atob(auth.slice(6))}catch{return 'deny'}
 const expected='operador:'+env.DOCS_V2_PRIVATE_UI_SECRET;
 if(provided.length!==expected.length)return 'deny';
 let diff=0;
 for(let i=0;i<expected.length;i++)diff|=provided.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0?'allow':'deny';
}
// La navegación HTML usa HTTP Basic; fetch() no siempre reenvía esa
// cabecera en el POST. Una cookie firmada, HttpOnly, de 30 minutos conserva
// la autorización sin exponer secretos ni habilitar pagos.
const V2_SESSION_COOKIE='saber_v2_session',V2_SESSION_SECONDS=1800;
async function v2SessionMac(secret,timestamp){
 const key=await crypto.subtle.importKey('raw',
  new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('saber-v2-private-browser-v1\\n'+timestamp)));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function v2SessionCookie(env,path='/api/ensayo-preparar-documentos-v2-lote'){
 if(!['/api/ensayo-preparar-documentos-v2-lote','/api/ensayo-tus-',
  '/prueba-v2/api/','/prueba-v2/','/api/ensayo-materiales-rapido','/api/ensayo-carga-unica'].includes(path))
  throw Error('Ruta de cookie privada no autorizada.');
 const timestamp=Math.floor(Date.now()/1000);
 return V2_SESSION_COOKIE+'='+timestamp+'.'+
  await v2SessionMac(env.DOCS_V2_PRIVATE_UI_SECRET,String(timestamp))+
  '; Path='+path+'; Secure; HttpOnly; SameSite=Strict; Max-Age='+V2_SESSION_SECONDS;
}
async function v2SessionAuthorized(request,env){
 if(env?.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.DOCS_V2_PRIVATE_UI_SECRET!=='string'||
    !/^[A-Za-z0-9_-]{32,128}$/.test(env.DOCS_V2_PRIVATE_UI_SECRET))return false;
 const raw=request.headers.get('Cookie')||'';
 const match=raw.match(/(?:^|;\s*)saber_v2_session=(\d{10})\.([a-f0-9]{64})(?=;|$)/);
 if(!match)return false;
 const timestamp=Number(match[1]),now=Math.floor(Date.now()/1000);
 if(!Number.isSafeInteger(timestamp)||timestamp>now+30||
    now-timestamp>V2_SESSION_SECONDS)return false;
 const mac=await v2SessionMac(env.DOCS_V2_PRIVATE_UI_SECRET,match[1]);
 let diff=0;for(let i=0;i<64;i++)diff|=mac.charCodeAt(i)^match[2].charCodeAt(i);
 return diff===0;
}
/** Diagnóstico de sólo lectura para validar conexión D1 REAL ANTES de cambiar
 * DOCS_PRICE_ADMIN_D1_ENABLED del motor. Requiere HTTP Basic del operador,
 * devuelve solo versión y dos tarifas de referencia, sin tokens ni datos personales.
 */
async function probeTarifarioD1SoloOperador(request,env){
 if(request.method!=='GET')return closed();
 const authorized=v2PrivateBrowserAuthorized(request,env);
 if(authorized!=='allow')
  return new Response('Autenticación privada requerida',{
   status:401,headers:{'WWW-Authenticate':'Basic realm="Saber V2 Ensayo Privado", charset="UTF-8"',
    'Cache-Control':'no-store,private','X-Robots-Tag':'noindex,nofollow'}});
 try{
  const r=await obtenerTarifarioD1Privado({...env,DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY'});
  const a4=r.prices?.bnA4?.scales?.[0]?.simple;
  const rec60=r.prices?.plotter?.supports?.find(x=>x.id==='rec60')?.posterPerMeter;
  if(!Number.isFinite(a4)||a4<=0||!Number.isFinite(rec60)||rec60<=0)
   throw Error('Tarifario incompleto');
  return testResponse({ok:true,privateProbe:true,source:'d1-approved-only',
   priceVersion:r.prices.priceVersion,
   a4_bn_1_a_10_sf_ars:a4,poster_recubierto_60cm_metro_ars:rec60,
   docsPriceAdminD1Enabled:env.DOCS_PRICE_ADMIN_D1_ENABLED==='PRIVATE_TEST_ONLY',
   paymentAuthorized:false,commercialPublication:false},200);
 }catch(_){
  return testResponse({ok:false,error:'No se pudo comprobar el tarifario aprobado de D1.',
   privateProbe:true,paymentAuthorized:false,commercialPublication:false},503);
 }
}

/** Ingreso desde la Central: no se transmite la clave Basic ni se revela el ticket
 * en una URL HTTP. El fragmento se borra antes del intercambio POST mismo origen.
 * El uso único se consume mediante un Service Binding y firma HMAC entre Workers.
 */
const v2MobileInviteHtml=String.raw`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>Ingreso privado móvil · Librería Saber</title><style>body{font:16px system-ui;background:#f3f6fa;color:#173d62;padding:24px;margin:0}main{max-width:440px;margin:10vh auto;background:white;border-radius:16px;padding:25px;box-shadow:0 6px 22px #163d6220}h1{font-size:1.4rem}p{line-height:1.5}</style></head><body><main><h1>Librería Saber</h1><p id="status" role="status">Validando acceso privado…</p><p>Esta autorización permite ingresar al cotizador de pruebas durante una sesión corta. No habilita cobros reales.</p></main><script>
(async()=>{
 const status=document.getElementById("status");
 const params=new URLSearchParams(location.hash.slice(1));
 const ticket=params.get("ticket")||"";
 history.replaceState(null,"","/prueba-v2/ingresar");
 if(!/^[a-f0-9-]{36}\.[a-f0-9-]{36}$/i.test(ticket)){
  status.textContent="El enlace está incompleto. Generá otro desde la Central.";return;
 }
 try{
  const r=await fetch("/prueba-v2/ingresar",{method:"POST",headers:{"Content-Type":"application/json"},
   credentials:"same-origin",cache:"no-store",body:JSON.stringify({ticket})});
  const d=await r.json();
  if(!r.ok||d.ok!==true)throw Error("El enlace ya fue utilizado o venció. Generá uno nuevo desde la Central.");
  status.textContent="Ingreso autorizado. Abriendo cotizador…";
  location.replace("/prueba-v2/");
 }catch(e){status.textContent=e.message||"No se pudo validar el acceso."}
})();
</script></body></html>`;
async function v2MobileInviteExchange(request,env){
 if(env?.DOCS_V2_PRIVATE_UI_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.DOCS_V2_PRIVATE_UI_SECRET!=='string'||
    !/^[A-Za-z0-9_-]{32,128}$/.test(env.DOCS_V2_PRIVATE_UI_SECRET)||
    typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof env.SABER_CENTRAL?.fetch!=='function')
  return testResponse({ok:false,error:'Acceso privado no disponible'},503);
 if(request.method==='GET')
  return new Response(v2MobileInviteHtml,{status:200,headers:{
   'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private',
   'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow',
   'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }});
 if(request.method!=='POST')return closed();
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||
    request.headers.get('Sec-Fetch-Site')&&!['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site'))||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return testResponse({ok:false,error:'Origen o formato no admitido'},403);
 const raw=await request.text();if(raw.length>180)return closed();
 let payload;try{payload=JSON.parse(raw)}catch{return closed()}
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).join(',')!=='ticket'||
    typeof payload.ticket!=='string'||
    !/^[a-f0-9-]{36}\.[a-f0-9-]{36}$/i.test(payload.ticket))
  return testResponse({ok:false,error:'Enlace no válido'},400);
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(payload.ticket)));
 const digest=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const content=JSON.stringify({schema:'saber-private-mobile-redeem-v1',tokenHash:digest});
 const ts=String(Math.floor(Date.now()/1000)),id=crypto.randomUUID();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+content))),
  b=>b.toString(16).padStart(2,'0')).join('');
 let r;
 try{
  r=await env.SABER_CENTRAL.fetch(new Request(
   'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/mobile-invite-redeem',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':ts,
    'x-saber-request-id':id,'x-saber-signature':signature},body:content
  }));
 }catch{return testResponse({ok:false,error:'La Central no pudo validar el acceso'},503)}
 if(!r.ok)return testResponse({ok:false,error:'Enlace vencido o ya utilizado'},403);
 let confirmation;try{confirmation=await r.json()}catch{return closed()}
 if(confirmation?.ok!==true||confirmation?.consumed!==true)return closed();
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',await v2SessionCookie(env,'/prueba-v2/'));
 return new Response(JSON.stringify({ok:true,expiresInSeconds:1800}),{headers});
}

// Activar UI postpago sólo con todas las compuertas de prueba disponibles.
// Los endpoints vuelven a validar D1 y cobro; el booleano visual NO habilita R2.
function r2PrepagoUiConfigurado(env){
 return env?.DOCS_R2_PREPAY_DRAFT_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_POSTPAY_REQUIRED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_BIG_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_QUOTA_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_STAGING_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_CENTRAL_SYNC_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_PRICE_ADMIN_D1_ENABLED==='PRIVATE_TEST_ONLY'&&
  typeof env?.SABER_CENTRAL?.fetch==='function'&&
  !!env?.SABER_R2_GRANDES;
}
function universalUiConfigurado(env){
 return tusPrivadoConfigurado(env)&&
  env?.DOCS_R2_UNIVERSAL_DRAFT_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_UNIVERSAL_ORDER_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_UNIVERSAL_CHECKOUT_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_UNIVERSAL_TUS_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_BIG_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_QUOTA_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_R2_STAGING_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_CENTRAL_SYNC_ENABLED==='PRIVATE_TEST_ONLY'&&
  env?.DOCS_PRICE_ADMIN_D1_ENABLED==='PRIVATE_TEST_ONLY'&&
  typeof env?.SABER_CENTRAL?.fetch==='function'&&
  !!env?.SABER_R2_GRANDES;
}
const V2_BUYER_PUBLIC_ASSETS=new Set([
 '/prueba-v2/carga-inteligente','/prueba-v2/carga-inteligente.js',
 '/prueba-v2/precios-web.json','/prueba-v2/tus-directo.mjs','/prueba-v2/r2-grandes.mjs',
 '/prueba-v2/r2-prepago-flujo.mjs','/prueba-v2/flujo-universal.mjs',
 '/prueba-v2/tus-universal.mjs',
 '/prueba-v2/subir-vincular-pdf.mjs','/prueba-v2/preparar-manifiesto.mjs',
 '/prueba-v2/cotizador-v2-ensayo-archivos.mjs'
]);
async function v2PrivateBrowserResponse(request,env,path,{buyer=false}={}){
 if(request.method!=='GET')return closed();
 // Sólo activos de cotización y envío. Nunca concede la cookie de operador.
 const buyerOK=buyer&&V2_BUYER_PUBLIC_ASSETS.has(path)&&
  await autorizadoPedidoCliente(request,env);
 const status=v2PrivateBrowserAuthorized(request,env);
 if(status==='off'&&!buyerOK)return testResponse({ok:false,error:'Ensayo privado deshabilitado'},503);
 const allowMobile=path!=='/prueba-v2/universal-paquete'&&
  path!=='/prueba-v2/r2-preprensa-personal'&&
  path!=='/prueba-v2/orden-paquete'&&
  path!=='/prueba-v2/personal-descargar'&&
  status==='deny'&&await v2SessionAuthorized(request,env);
 if(status==='deny'&&!allowMobile&&!buyerOK)return new Response('Autenticación privada requerida',{
  status:401,headers:{'WWW-Authenticate':'Basic realm="Saber V2 Ensayo Privado", charset="UTF-8"',
   'Cache-Control':'no-store,private','X-Robots-Tag':'noindex,nofollow',
   'X-Content-Type-Options':'nosniff'}
 });
 try{
  const headers={'Cache-Control':'no-store,private',
    'X-Robots-Tag':'noindex,nofollow,noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'SAMEORIGIN'};
  if(path==='/prueba-v2/diseno-saber-directo'||path==='/prueba-v2/diseno-saber-directo/ofertas.html'){
   const ofertas=path.endsWith('/ofertas.html');
   return new Response(prepararVistaDisenoPrivada(ofertas?ofertasSaberDirectoHtml:portadaSaberDirectoHtml,{ofertas}),{
    status:200,headers:{
     ...headers,'Content-Type':'text/html; charset=utf-8',
     'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src https: data:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    }
   });
  }
  if(path==='/prueba-v2/r2-preprensa-personal'){
   if(env?.DOCS_R2_BIG_ENABLED!=='PRIVATE_TEST_ONLY'||
      env?.DOCS_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY')
    return testResponse({ok:false,error:'Preprensa R2 privada no habilitada'},503);
   return new Response(paginaR2PreprensaPersonal(),{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
   }});
  }
  if(path==='/prueba-v2/universal-paquete'){
   if(env?.DOCS_R2_UNIVERSAL_PACKAGE_ENABLED!=='PRIVATE_TEST_ONLY'||
      env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY')
    return testResponse({ok:false,error:'Paquete universal no habilitado'},503);
   if(v2PrivateBrowserAuthorized(request,env)!=='allow')
    return testResponse({ok:false,error:'Solo operador con autenticación privada'},403);
   return new Response(paginaPaqueteUniversalPersonal(),{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
   }});
  }
  if(path==='/prueba-v2/orden-paquete'){
   if(!tusPrivadoConfigurado(env))
    return testResponse({ok:false,error:'ZIP privado deshabilitado',paymentAuthorized:false},503);
   return new Response(paginaPaqueteTUSPersonal(),{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
   }});
  }
  if(path==='/prueba-v2/personal-descargar'){
   if(!tusPrivadoConfigurado(env))
    return testResponse({ok:false,error:'Descarga TUS privada deshabilitada',paymentAuthorized:false},503);
   return new Response(paginaDescargaTUSPersonal(),{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
   }});
  }
  if(path==='/prueba-v2/'){
   const html=paginaCotizadorV2PruebaPrivada(env.DOCS_TURNSTILE_SITE_KEY,tusPrivadoConfigurado(env),diagnosticarTUSPrivado(env),env.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED==='PRIVATE_TEST_ONLY',r2PrepagoUiConfigurado(env),universalUiConfigurado(env));
   const responseHeaders=new Headers({...headers,
    'Content-Type':'text/html; charset=utf-8'});
   responseHeaders.append('Set-Cookie',await v2SessionCookie(env));
   // El cotizador inteligente pide materiales por GET y presupuesto por POST.
   // Sólo estas dos rutas reciben sesión de precios privada.
   responseHeaders.append('Set-Cookie',await v2SessionCookie(env,'/api/ensayo-materiales-rapido'));
   responseHeaders.append('Set-Cookie',await v2SessionCookie(env,'/api/ensayo-carga-unica'));
   // El fetch TUS necesita cookie privada propia; el navegador no siempre
   // reenvía credenciales Basic tras la carga inicial del portal.
   if(tusPrivadoConfigurado(env)){
    responseHeaders.append('Set-Cookie',await v2SessionCookie(env,'/api/ensayo-tus-'));
    responseHeaders.append('Set-Cookie',await v2SessionCookie(env,'/prueba-v2/api/'));
   }
   return new Response(html,{status:200,headers:responseHeaders});
  }
  if(path==='/prueba-v2/carga-inteligente'){
   // Reutiliza el analizador consolidado CAD/Póster/rollos sin derivar
   // a la ruta de prueba pública ni recibir originales por esta pantalla.
   const html=paginaCargaUnica().replace(
    'Podés seleccionar varios a la vez (hasta 30).',
    'Podés seleccionar varios a la vez (hasta 10).'
   ).replace(
    '<script src="/prueba-carga-unica.js" defer></script>',
    '<script src="/prueba-v2/carga-inteligente.js" defer></script>'
   ).replace(
    'Prueba privada de clasificación.',
    'Cotizador inteligente privado: análisis automático de tamaños, CAD/Póster y rollo.'
   ).replace(
    '</head><body>',
    `<style>
     body{background:transparent}main{width:100%;max-width:none;margin:0;padding:16px 18px 24px;box-shadow:none}
     #zonaArchivos{padding:26px;border:2px dashed #5689af;background:#f1f8ff;border-radius:14px}
     #zonaArchivos p{font-size:18px}#zonaArchivos input{max-width:650px}
     main>h1{display:none}main>.nota{display:none}
     /* Un solo total: el importe vive en la barra fija del portal padre.
        Los errores se informan junto a cada archivo; el resumen sigue en DOM. */
     main>h2{display:none}#presupuesto{display:none}
     #estado{margin:7px 0 10px;font-size:13px}
     .grupo-pedido{margin:9px 0 12px}

     main>p:has(a[href="/prueba-cotizador-conjunto"]){display:none}
     #prepararPedido{display:none}
     #enviar-cotizacion-inteligente{border:0;border-radius:10px;padding:14px 20px;background:#0a5583;color:white;font-weight:700;font-size:16px;cursor:pointer}
     #lista{margin-bottom:20px}
     .tamano-rapido{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:7px;font-size:13px}
     .tamano-rapido .tamano-opcion{border:1px solid #b7c6d4;background:white;color:#173c61;border-radius:7px;padding:6px 11px;cursor:pointer}
     .tamano-rapido .tamano-opcion.seleccionada{background:#0a5583;border-color:#0a5583;color:white;font-weight:700}
     .tamano-rapido small{flex-basis:100%;color:#5a6371}
     @media(max-width:720px){main{padding:12px 4px 20px}#zonaArchivos{padding:15px}}
     </style></head><body>`
   ).replace(
    '</body></html>',
    `<script>
      if(window.parent!==window&&location.pathname==='/prueba-v2/carga-inteligente'){
       let previous=0;
       const inform=()=>{
        const height=Math.ceil(document.documentElement.scrollHeight);
        if(height!==previous&&height>300){
         previous=height;
         window.parent.postMessage({type:'SABER_SMART_RESIZE',height},location.origin);
        }
       };
       new ResizeObserver(inform).observe(document.body);
       addEventListener('load',inform);
       inform();
      }
     </script></body></html>`
   );
   return new Response(html,{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path==='/prueba-v2/carga-inteligente.js')
   return new Response(cargaClienteJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/cotizador'){
   // En la copia privada se apaga únicamente la telemetría de Google Analytics.
   const html=cotizadorV2OriginalHtml.replace(
    /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script>\s*<script>window\.dataLayer=[\s\S]*?<\/script>/,'');
   return new Response(html,{status:200,headers:{
    ...headers,'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path==='/prueba-v2/precios-web.json')
   return new Response(JSON.stringify(await preciosPrivados(env,request)),{status:200,headers:{
    ...headers,'Content-Type':'application/json; charset=utf-8'}});
  if(path==='/prueba-v2/cotizador-v2-ensayo-archivos.mjs')
   return new Response(v2ReaderClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/preparar-manifiesto.mjs')
   return new Response(v2ManifestClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/subir-vincular-pdf.mjs')
   return new Response(v2UploadClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/tus-directo.mjs'&&tusPrivadoConfigurado(env))
   return new Response(v2TUSClientJs,{status:200,headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/flujo-universal.mjs'&&universalUiConfigurado(env))
   return new Response(v2UniversalClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/tus-universal.mjs'&&universalUiConfigurado(env))
   return new Response(v2UniversalTUSClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/r2-prepago-flujo.mjs'&&r2PrepagoUiConfigurado(env))
   return new Response(v2R2PrepaidClientJs,{status:200,headers:{
    ...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path==='/prueba-v2/r2-grandes.mjs'&&
     env?.DOCS_R2_BIG_ENABLED==='PRIVATE_TEST_ONLY'&&env?.SABER_R2_GRANDES)
   return new Response(v2R2ClientJs,{status:200,headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  return closed();
 }catch{
  return testResponse({ok:false,error:'La pantalla privada no está lista'},503);
 }
}

export default {
  async fetch(request, env, ctx) {
    const page=new URL(request.url).pathname;
    if(page==='/internal/live/purge-file'){
      const {atenderPurgaArchivoLive}=await import('./purga-archivo-live-documentos.mjs');
      return atenderPurgaArchivoLive(request,env);
    }
    if(page==='/internal/r2-universal-purge-delivered'){
      const {atenderBorradoUniversalTUS}=await import("./r2-universal-purge-documentos.mjs");
      return atenderBorradoUniversalTUS(request,env);
    }
    if(page==='/internal/tus-purge-delivered')
      return recibirLimpiezaEntregadaInterna(request,env);
    // Comprador: pantalla TUS existente, sin contraseña de personal.
    // El único privilegio nuevo permite enviar y pagar en Sandbox.
    if(page==='/prueba-v2/pedido-cliente')
      return manejarPortalPedidosCliente(request,env,{
       paginaPedido:()=>tusPrivadoConfigurado(env)?paginaCotizadorTUSClientePruebas(
        env.DOCS_TURNSTILE_SITE_KEY,true,diagnosticarTUSPrivado(env),
        env.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED==='PRIVATE_TEST_ONLY',
        r2PrepagoUiConfigurado(env),universalUiConfigurado(env)):null
      });
    // Cotizador quote-only histórico: su cookie nunca autoriza TUS.
    if(page==='/prueba-v2/api/plazo-produccion'){
      const {plazoProduccionCliente}=await import('./plazo-produccion-cliente.mjs');
      return plazoProduccionCliente(request,env);
    }
    if(page==='/prueba-v2/cotizar-cliente')
      return manejarCotizadorCliente(request,env,{paginaCotizacion:paginaCargaUnica()});
    // DEMOSTRACIÓN VISUAL ANÓNIMA, SEPARADA DEL PORTAL PRIVADO.
    // Solo HTML saneado: sin JS comercial, sin fetch, sin carrito operativo.
    // El cotizador, precios D1, pedidos y Central conservan autenticación.
    // API de lectura sobre CSV publicado: precios verificados antes de consultar.
    // No se accede a D1, pagos, TUS ni datos privados; sin rutas de escritura.
    if(page==='/prueba-v2/diseno-sin-clave/catalogo.json'){
      if(request.method!=='GET')return new Response('Solo lectura',{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});
      const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0',
       'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow,noarchive','Referrer-Policy':'no-referrer'};
      try{return new Response(JSON.stringify(await consultarCatalogoPublicado()),{status:200,headers})}
      catch(error){return new Response(JSON.stringify({ok:false,products:[],error:'Catálogo temporalmente no disponible. No se pueden confirmar precios.',diagnostic:(String(error?.name||'Error')+': '+String(error?.message||'unknown')).slice(0,140)}),{status:503,headers})}
    }
    if(page==='/prueba-v2/diseno-sin-clave'||page==='/prueba-v2/diseno-sin-clave/ofertas.html'){
      if(request.method!=='GET')return new Response('Solo consulta',{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});
      const ofertas=page.endsWith('/ofertas.html');
      try{
        const html=prepararVistaDisenoAbierta(ofertas?ofertasSaberDirectoHtml:portadaSaberDirectoHtml,{ofertas,categoria:new URL(request.url).searchParams.get('categoria')||'',pedidoTUS:env?.DOCS_PUBLIC_ORDER_GATE_ENABLED==='PRIVATE_TEST_ONLY'&&tusPrivadoConfigurado(env)});
        return new Response(html,{status:200,headers:{
          'Content-Type':'text/html; charset=utf-8',
          'Cache-Control':'no-store, max-age=0',
          'X-Robots-Tag':'noindex,nofollow,noarchive',
          'X-Content-Type-Options':'nosniff',
          'Referrer-Policy':'no-referrer',
          'X-Frame-Options':'DENY',
          'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https://cdn.jsdelivr.net https://drive.google.com https://*.googleusercontent.com https://images.unsplash.com data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        }});
      }catch{return new Response('Vista no disponible',{status:503,headers:{'Cache-Control':'no-store'}})}
    }
    if(page==='/prueba-v2/diseno-saber-directo'||page==='/prueba-v2/diseno-saber-directo/ofertas.html')
      return v2PrivateBrowserResponse(request,env,page);
    if(page==='/prueba-v2/ingresar')return v2MobileInviteExchange(request,env);
    if(page==='/prueba-v2/admin-tarifario-ensayo')
      return probeTarifarioD1SoloOperador(request,env);
    if(page==='/prueba-v2/'||page==='/prueba-v2/orden-paquete'||page==='/prueba-v2/universal-paquete'||page==='/prueba-v2/r2-preprensa-personal'||page==='/prueba-v2/personal-descargar'||page==='/prueba-v2/cotizador'||
       page==='/prueba-v2/carga-inteligente'||
       page==='/prueba-v2/carga-inteligente.js'||
       page==='/prueba-v2/precios-web.json'||
       page==='/prueba-v2/cotizador-v2-ensayo-archivos.mjs'||
       page==='/prueba-v2/subir-vincular-pdf.mjs'||
       page==='/prueba-v2/tus-directo.mjs'||
       page==='/prueba-v2/r2-grandes.mjs'||
       page==='/prueba-v2/flujo-universal.mjs'||
       page==='/prueba-v2/tus-universal.mjs'||
       page==='/prueba-v2/r2-prepago-flujo.mjs'||
       page==='/prueba-v2/preparar-manifiesto.mjs')
      return v2PrivateBrowserResponse(request,env,page,{
        buyer:V2_BUYER_PUBLIC_ASSETS.has(page)&&await autorizadoPedidoCliente(request,env)
       });
     if(page==='/prueba-cotizador-pdf'&&request.method==='GET')return fase4Html(env);
    if(page==='/prueba-cotizador-lote'&&request.method==='GET')return pantallaLote(env);
    if(page==='/prueba-cotizador-lote-ampliado'&&request.method==='GET'){
      if(env?.DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY')
        return testResponse({ok:false,error:'Ensayo ampliado deshabilitado',paymentAuthorized:false},503);
      try{return new Response(paginaLotePdfAmpliado(env.DOCS_TURNSTILE_SITE_KEY),{
        headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
          'X-Robots-Tag':'noindex,nofollow','X-Frame-Options':'DENY'}})}
      catch{return testResponse({ok:false,error:'Turnstile sin configurar',paymentAuthorized:false},503)}
    }
    if(page==='/prueba-carga-unica'&&request.method==='GET')return new Response(paginaCargaUnica(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Frame-Options':'DENY'}});
    if(page==='/prueba-carga-unica.js'&&request.method==='GET')return new Response(cargaClienteJs,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    if(page==='/prueba-cotizador-conjunto'&&request.method==='GET')return new Response(paginaCotizadorConjunto(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
    if(page==='/prueba-cotizador-rapido'&&request.method==='GET')return paginaRapida();
    if(page==='/prueba-ploteos-rapido'&&request.method==='GET')return paginaPloteos();
    if(page==='/prueba-ploteos-rapido.js'&&request.method==='GET')return scriptPloteos();
    if(page==='/api/ensayo-ficha-central')return apiFichaCentralPrivada(request,env);
    if(page==='/api/ensayo-sincronizar-central')return apiFichaCentralPrivada(request,env,true);
    if(page==='/api/ensayo-preparar-mixto')return apiFichaCentralPrivada(request,env,false,true);
    if(page==='/api/ensayo-ficha-central-lote')return apiFichaCentralPrivada(request,env,false,false,true);
    if(page==='/api/ensayo-sincronizar-central-lote')return apiFichaCentralPrivada(request,env,true,false,true);
    if(page==='/api/ensayo-preparar-mixto-lote')return apiFichaCentralPrivada(request,env,false,true,true);
    if(page==='/api/ensayo-preparar-documentos')return apiFichaCentralPrivada(request,env,false,false,false,true);
    if(page==='/api/ensayo-probar-puente-central')return diagnosticoPuenteCentral(request,env);
    if(page==='/api/ensayo-preparar-documentos-v2')return apiFichaCentralPrivada(request,env,false,false,false,true,false,true);
    if(page==='/api/ensayo-preparar-documentos-v2-lote')return apiPrepararDocumentosV2Lote(request,env);
    // Acceso permanente POR D1: recibo consultado por HMAC, sin proof de 2h.
    // No revela objetos R2 a compradores ni genera pedido cobrable.
    if(page==='/prueba-v2/api/ensayo-r2-referencia-personal')
      return resolverReferenciaR2Personal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-r2-ficha-produccion-personal')
      return fichaR2Personal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-r2-descargar-d1-personal')
      return descargarR2PendientePorD1Personal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    // Originales grandes: descarga exclusiva del personal autorizado por Basic.
    // Nunca basta la cookie del comprador, y no se publica URL directa de R2.
    if(page==='/prueba-v2/api/ensayo-r2-descargar-personal')
      return descargarR2GrandePersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    // R2 de PDF grandes: mismo acceso que TUS pero bandera independiente.
    if(page==='/prueba-v2/api/ensayo-r2-prepago-checkout'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const data=buyer?await request.clone().json().catch(()=>null):null;
      const belongs=buyer&&
        await autorizadoPedidoClienteVinculado(request,env,data?.webOrderId);
      // Recuperación sólo para status; nunca inicia otro checkout.
      const resume=buyer&&!belongs&&data?.action==='status'&&
        await autorizadoRecuperacionR2Comprador(request,env,data?.webOrderId,{
         commercialOrderId:data?.commercialOrderId
        });
      return checkoutR2PrepaidSandboxDocumentos(request,env,{
        authorized:staff||belongs||resume
      });
    }
    if(page==='/prueba-v2/api/ensayo-r2-plan-universal'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      return cotizarPlanUniversalSinSubida(request,env,{
        authorized:staff||buyer
      });
    }
    if(page==='/prueba-v2/api/ensayo-r2-borrador-universal'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const input=buyer?await request.clone().json().catch(()=>null):null;
      const saved=await guardarBorradorUniversal(request,env,{
       authorized:staff||buyer
      });
      if(saved.ok&&buyer){
       const value=await saved.clone().json().catch(()=>null);
       if(value?.ok!==true||value.webOrderId!==input?.webOrderId||
          value.checkoutEnabled!==false||value.paymentAuthorized!==false)
        return testResponse({ok:false,error:'Borrador universal sin identidad verificable'},502);
       const cookie=await cookiePedidoClienteVinculado(request,env,value.webOrderId);
       if(!cookie)return testResponse({ok:false,error:'Sesión de pedido no vinculado'},503);
       const headers=new Headers(saved.headers);headers.append('Set-Cookie',cookie);
       return new Response(saved.body,{status:saved.status,headers});
      }
      return saved;
    }
    if(page==='/prueba-v2/api/ensayo-r2-orden-universal'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const input=buyer?await request.clone().json().catch(()=>null):null;
      const belongs=buyer&&await autorizadoPedidoClienteVinculado(
       request,env,input?.webOrderId);
      return prepararOrdenUniversalSinCheckout(request,env,{
       authorized:staff||belongs
      });
    }
    // MP LIVE: separado de /prueba-v2 y del checkout sandbox.
    // Origen de producción, cookie de comprador vinculada y HMAC obligatorios.
    // Con compuerta cerrada: 503 sin consultar Central ni generar cobros.
    // Cotizador comprador LIVE: usa el analizador consolidado, pero jamás rutas Sandbox.
    if(page==='/cotizar'){
      const buyer=await autorizadoCompradorLive(request,env);
      return paginaCotizarLive(request,env,{authorized:buyer});
    }
    if(page==='/api/pedido/plazo'){
      const {plazoProduccionCliente}=await import('./plazo-produccion-cliente.mjs');
      return plazoProduccionCliente(request,env);
    }
    if(page==='/cotizar/archivos'||page==='/cotizar/archivos.js'||
       page==='/cotizar/flujo-live.js'||page==='/api/pedido/live/materiales'||
       page==='/api/pedido/live/cotizar'){
      const live=env?.SABER_ENTORNO==='produccion'&&
       env?.DOCS_LIVE_UI_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_LIVE_SESSION_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       new URL(request.url).origin==='https://pedidos.libreriasaber.com.ar';
      if(!live||!await autorizadoCompradorLive(request,env))
       return testResponse({ok:false,error:'LIVE_COTIZADOR_CERRADO'},503);
      if(page==='/cotizar/archivos'&&request.method==='GET'){
       const html=prepararCotizadorArchivosLive(paginaCargaUnica());
       return new Response(html,{headers:{
        'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
        'Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
      }
      if(page==='/cotizar/archivos.js'&&request.method==='GET')
       return new Response(cargaClienteJs,{headers:{
        'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store,private',
        'X-Content-Type-Options':'nosniff'}});
      if(page==='/cotizar/flujo-live.js'&&request.method==='GET')
       return new Response(liveBuyerClientJs,{headers:{
        'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store,private',
        'X-Content-Type-Options':'nosniff'}});
      if(page==='/api/pedido/live/materiales'&&request.method==='GET')
       return catalogoMaterialesRapido(request,env);
      if(page==='/api/pedido/live/cotizar'){
       if(request.method!=='POST')return closed();
       const u=new URL(request.url);
       if(request.headers.get('Origin')!==u.origin||
        (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
        !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
        return testResponse({ok:false,error:'Origen no autorizado',paymentAuthorized:false},403);
       try{
        const raw=await request.text();
        if(raw.length>500000)return testResponse({ok:false,error:'Solicitud demasiado grande',paymentAuthorized:false},413);
        const payload=JSON.parse(raw);
        const prices=await preciosPrivados(env,request);
        return testResponse(cotizarCargaUnica({...payload,precios:prices}));
       }catch{return testResponse({ok:false,error:'Cotización LIVE indisponible o incompleta',paymentAuthorized:false},503)}
      }
      return closed();
    }
    if(page==='/pedido/recepcion-r2.js'){
      const allow=env?.SABER_ENTORNO==='produccion'&&
       env?.DOCS_MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_LIVE_RECEPCION_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_LIVE_R2_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_LIVE_R2_UPLOAD_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       env?.DOCS_LIVE_R2_STAGING_GATE==='GO_COMERCIAL_CONFIRMADO'&&
       new URL(request.url).origin==='https://pedidos.libreriasaber.com.ar'&&
       await autorizadoCompradorLive(request,env);
      if(!allow||request.method!=='GET')return closed();
      return new Response(livePostpayR2Js,{headers:{
       'Content-Type':'text/javascript; charset=utf-8',
       'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
       'X-Robots-Tag':'noindex,nofollow'}});
    }
    if(page==='/personal/precios'||page==='/personal/api/live-pricing'||
       page==='/personal/api/live-calendar'||
       page==='/personal/api/live-reconcile'||
       page==='/personal/api/live-forecast'||
       page==='/personal/api/live-status'||
       page==='/personal/central'||page==='/personal/api/live-board'||
       page==='/personal/paquete'||page==='/personal/transferencias'||
       page==='/personal/transferencias.js'||
       page==='/personal/api/live-transferencias-pendientes'||
       page==='/personal/api/live-transferencias-aprobar'||
       page==='/personal/api/live-paquete'||
       page==='/personal/api/live-descargar'||
       page==='/personal/api/live-r2-board'||
       page==='/personal/api/live-r2-inspection-source'||
       page==='/personal/api/live-r2-inspection-original'||
       page==='/personal/api/live-r2-inspection-confirm'){
      if(new URL(request.url).origin!=='https://pedidos.libreriasaber.com.ar')
       return closed();
      const auth=staffLiveAuthorized(request,env);
      if(auth==='off')return closed();
      if(auth!=='allow')
       return new Response('Acceso exclusivo de personal de Librería Saber',
        {status:401,headers:{'Cache-Control':'no-store',
         'WWW-Authenticate':'Basic realm="Libreria Saber Personal LIVE", charset="UTF-8"'}});
      if(page==='/personal/precios'){
       if(request.method!=='GET')return closed();
       const {paginaPreciosPersonalLive}=await import('./pagina-precios-personal-live.mjs');
       return new Response(paginaPreciosPersonalLive(),{headers:{
        'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow',
        'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
       }});
      }
      if(page==='/personal/api/live-pricing'){
       const {preciosPersonalLiveApi}=await import('./precios-personal-live-api.mjs');
       return preciosPersonalLiveApi(request,env);
      }
      if(page==='/personal/api/live-calendar'){
       const {agendaPersonalDocumentosLive}=await import('./agenda-personal-live-documentos.mjs');
       return agendaPersonalDocumentosLive(request,env,{authorized:true});
      }
      if(page==='/personal/api/live-reconcile'){
       const {rescatePersonalMPLive}=await import('./rescate-personal-mp-live.mjs');
       return rescatePersonalMPLive(request,env,{authorized:true});
      }
      if(page==='/personal/api/live-forecast'){
       const {previsionPersonalDocumentosLive}=await import('./prevision-personal-live-documentos.mjs');
       return previsionPersonalDocumentosLive(request,env,{authorized:true});
      }
      if(page==='/personal/api/live-status'){
        const {cambiarEstadoPersonalDocumentosLive}=await import('./estado-personal-live-documentos.mjs');
        return cambiarEstadoPersonalDocumentosLive(request,env,{authorized:true});
      }
      if(page==='/personal/central'){
        if(request.method!=='GET')return closed();
        return new Response(paginaCentralPersonalLive(),{headers:{
          'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
          'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow',
          'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        }});
      }
      if(page==='/personal/api/live-board'){
        const {inspeccionR2PersonalLive}=await import('./r2-inspeccion-personal-live.mjs');
        return inspeccionR2PersonalLive(request,env,{authorized:true});
      }
      if(page==='/personal/transferencias'){
       if(request.method!=='GET')return closed();
       return new Response(paginaTransferenciasPersonalLive(),{headers:{
        'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store,private',
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow',
        'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
       }});
      }
      if(page==='/personal/transferencias.js'){
       if(request.method!=='GET')return closed();
       return new Response(jsTransferenciasPersonalLive(),{headers:{
        'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store,private',
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'
       }});
      }
      if(page==='/personal/api/live-transferencias-pendientes'||
         page==='/personal/api/live-transferencias-aprobar')
       return transferenciasPersonalLive(request,env,{authorized:true});
      if(page==='/personal/paquete'){
       if(request.method!=='GET')return closed();
       return new Response(paginaPaqueteUniversalPersonal(),{
        headers:{'Content-Type':'text/html; charset=utf-8',
         'Cache-Control':'no-store, private','X-Robots-Tag':'noindex,nofollow',
         'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
      }
      if(page==='/personal/api/live-r2-board'||
         page==='/personal/api/live-r2-inspection-source'||
         page==='/personal/api/live-r2-inspection-original'||
         page==='/personal/api/live-r2-inspection-confirm'){
       const {inspeccionR2PersonalLive}=await import('./r2-inspeccion-personal-live.mjs');
       return inspeccionR2PersonalLive(request,env,{authorized:true});
      }
      if(request.method!=='POST')return closed();
      return page==='/personal/api/live-paquete'?
       consultarPaqueteUniversalPersonal(request,env,{authorized:true}):
       descargarUniversalPersonal(request,env,{authorized:true});
    }
    if(page==='/pedido/recepcion-tus.js'){
      const allow=env?.SABER_ENTORNO==='produccion'&&
        env?.DOCS_MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
        env?.DOCS_LIVE_RECEPCION_GATE==='GO_COMERCIAL_CONFIRMADO'&&
        env?.DOCS_LIVE_TUS_GATE==='GO_COMERCIAL_CONFIRMADO'&&
        new URL(request.url).origin==='https://pedidos.libreriasaber.com.ar'&&
        await autorizadoCompradorLive(request,env);
      if(!allow||request.method!=='GET')return closed();
      return new Response(livePostpayTusJs,{headers:{
        'Content-Type':'text/javascript; charset=utf-8',
        'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
        'X-Robots-Tag':'noindex,nofollow'}});
    }
    if(page==='/pedido/continuar')return paginaContinuarPagoLive(request,env,{authorized:await autorizadoCompradorLive(request,env)});
    if(page==='/pedido/estado')return paginaRetornoLive(request,env);
    if(page==='/api/pedido/live/sesion')return iniciarSesionCompradorLive(request,env);
    if(page==='/api/pedido/live/revincular'){
      const buyer=await autorizadoCompradorLive(request,env);
      return revincularOrdenLive(request,env,{authorized:buyer});
    }
    if(page==='/api/pedido/live/borrador'){
      if(env?.SABER_ENTORNO!=='produccion')
       return testResponse({ok:false,error:'LIVE_BORRADOR_CERRADO'},503);
      const buyer=await autorizadoCompradorLive(request,env);
      const input=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const created=await guardarBorradorUniversalLive(request,env,{authorized:buyer});
      if(!created.ok||!buyer)return created;
      const data=await created.clone().json().catch(()=>null);
      if(!data||data.webOrderId!==input?.webOrderId||
         data.checkoutEnabled!==false||data.paymentAuthorized!==false)
       return testResponse({ok:false,error:'LIVE_BORRADOR_NO_VINCULADO'},502);
      const cookie=await vinculoOrdenLive(request,env,data.webOrderId);
      if(!cookie)return testResponse({ok:false,error:'LIVE_SESION_NO_VINCULADA'},503);
      const headers=new Headers(created.headers);headers.append('Set-Cookie',cookie);
      return new Response(created.body,{status:created.status,headers});
    }
    if(page==='/api/pedido/live/orden'){
      if(env?.SABER_ENTORNO!=='produccion')
       return testResponse({ok:false,error:'LIVE_ORDEN_CERRADA'},503);
      const buyer=await autorizadoCompradorLive(request,env);
      const input=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const linked=buyer&&await autorizadoOrdenLive(
       request,env,input?.webOrderId);
      return crearOrdenUniversalLive(request,env,{authorized:linked});
    }
    if(page==='/api/pedido/live/r2/iniciar'||
       page==='/api/pedido/live/r2/parte'||
       page==='/api/pedido/live/r2/completar'||
       page==='/api/pedido/live/r2/verificar'||
       page==='/api/pedido/live/r2/recuperar'){
      const buyer=await autorizadoCompradorLive(request,env);
      return manejarR2MultipartLive(request,env,{authorized:buyer});
    }
    if(page==='/api/pedido/live/r2/preflight'){
      const buyer=await autorizadoCompradorLive(request,env);
      const input=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const linked=buyer&&await autorizadoOrdenLive(request,env,input?.orderId);
      return preflightOriginalR2Live(request,env,{authorized:linked});
    }
    if(page==='/api/pedido/live/tus/iniciar'||
       page==='/api/pedido/live/tus/confirmar'){
      const buyer=await autorizadoCompradorLive(request,env);
      const input=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const linked=buyer&&await autorizadoOrdenLive(
       request,env,input?.orderId);
      return page==='/api/pedido/live/tus/iniciar'?
       iniciarTUSUniversalLive(request,env,{authorized:linked}):
       confirmarTUSUniversalLive(request,env,{authorized:linked});
    }
    if(page==='/api/pedido/live/diagnostico-mp'){
      const {diagnosticarVendedorMPDesdeDocs}=await import('./diagnostico-mp-vendedor-live.mjs');
      return diagnosticarVendedorMPDesdeDocs(request,env);
    }
    if(page==='/api/pedido/live/transfer'){
      if(env?.SABER_ENTORNO!=='produccion')
       return testResponse({ok:false,error:'TRANSFER_LIVE_CERRADA'},503);
      const buyer=await autorizadoCompradorLive(request,env);
      const payload=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const linked=buyer&&await autorizadoOrdenLive(
       request,env,payload?.webOrderId);
      const {transferenciaLiveComprador}=await import('./transferencia-live-comprador.mjs');
      return transferenciaLiveComprador(request,env,{authorized:linked});
    }
    if(page==='/api/pedido/live/checkout'){
      if(env?.SABER_ENTORNO!=='produccion')
       return testResponse({ok:false,error:'MP LIVE no habilitado'},503);
      const buyer=await autorizadoCompradorLive(request,env);
      const payload=buyer&&request.method==='POST'?
       await request.clone().json().catch(()=>null):null;
      const linked=buyer&&await autorizadoOrdenLive(
       request,env,payload?.webOrderId);
      return pagoMPLiveComprador(request,env,{authorized:linked});
    }
    if(page==='/prueba-v2/api/ensayo-r2-checkout-universal'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const input=buyer?await request.clone().json().catch(()=>null):null;
      const belongs=buyer&&await autorizadoPedidoClienteVinculado(
       request,env,input?.webOrderId);
      return pagoSandboxUniversalDocumentos(request,env,{
       authorized:staff||belongs
      });
    }
    if(page==='/prueba-v2/api/ensayo-r2-prepago'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
        await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      // Clonar ANTES de consumir el cuerpo al cotizar. Nunca duplicar POST.
      const clientData=buyer?await request.clone().json().catch(()=>null):null;
      const result=await prepararR2PagoSinArchivo(request,env,{
        authorized:staff||buyer
      });
      if(result.ok&&buyer){
        const saved=await result.clone().json().catch(()=>null);
        if(saved?.ok!==true||saved?.webOrderId!==clientData?.webOrderId||
           saved?.filesUploaded!==false||saved?.paymentAuthorized!==false||
           saved?.quoteState!=='PRELIMINAR_SIN_ARCHIVO')
         return testResponse({ok:false,error:'Pedido no disponible para recuperar'},502);
        const link=await cookiePedidoClienteVinculado(request,env,clientData.webOrderId);
        const recovery=await cookieRecuperacionR2Comprador(request,env,
         clientData.webOrderId,saved.commercialOrderId);
        // No abrir pago si el pedido no puede reanudarse tras una suspensión.
        if(!link||!recovery)
         return testResponse({ok:false,error:'Recuperación del pedido no disponible'},503);
        const headers=new Headers(result.headers);
        headers.append('Set-Cookie',link);
        headers.append('Set-Cookie',recovery);
        return new Response(result.body,{status:result.status,headers});
      }
      return result;
    }
    // Sin bucket ni llave de firma, devuelve 503; nunca registra D1 o pagos.
    // El comprador solo sube partes para SU orden vinculada; el personal usa Basic.
    if(page.startsWith('/prueba-v2/api/ensayo-r2/')){
      const basic=v2PrivateBrowserAuthorized(request,env)==='allow';
      const staff=basic||await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      return manejarR2GrandePrivado(request,env,{
       stage:stageR2Compatible,
       // Solo el pago concilado por Central y ligado al SHA-256/bytes
       // autoriza la subida. Basic del operador NO saltea esta barrera.
       comprobarPagoCentral:async(orderId,meta)=>{
        // Histórico primero; universal sólo como segunda comprobación
        // HMAC exacta. Ninguna sesión ni bandera del navegador acredita pago.
        let classic=null;
        if(env.DOCS_R2_POSTPAY_REQUIRED==='PRIVATE_TEST_ONLY')
         classic=await comprobarPagoR2EnCentral({env,orderId,meta});
        if(classic)return classic;
        if(env.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY')
         return null;
        return comprobarPagoUniversalR2EnCentral({env,orderId,meta});
       },
       // El comprador sólo puede iniciar R2 para SU orden vinculada, incluso
       // si conoce un pago válido ajeno. Basic no salta el pago obligatorio.
       autorizadoIniciar:async orderId=>staff||(buyer&&(
        await autorizadoPedidoClienteVinculado(request,env,orderId)||
        await autorizadoRecuperacionR2Comprador(request,env,orderId))),
       autorizadoOrden:async orderId=>staff||(buyer&&(
        await autorizadoPedidoClienteVinculado(request,env,orderId)||
        await autorizadoRecuperacionR2Comprador(request,env,orderId))),
       vincularOrden:async orderId=>buyer?
        cookiePedidoClienteVinculado(request,env,orderId):null
      });
    }
    if(page==='/prueba-v2/api/ensayo-tus-universal-iniciar'||
       page==='/prueba-v2/api/ensayo-tus-universal-confirmar'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
       await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const body=buyer?await request.clone().json().catch(()=>null):null;
      const belongs=buyer&&await autorizadoPedidoClienteVinculado(request,env,body?.orderId);
      const authorized=staff||belongs;
      return page.endsWith('-iniciar')?
       iniciarLoteTUSUniversal(request,env,{authorized}):
       confirmarLoteTUSUniversal(request,env,{authorized});
    }
    // V1 TUS: solo entorno privado y autorizado, nunca comercial ni pagos.
    // Ficha D1 para el ZIP, estrictamente Basic del operador.
    // Canario 024: Basic de operador + HMAC interno; sin credenciales en navegador.
    if(page==='/prueba-v2/api/ensayo-tus-canaria-checkout')
      return checkoutCanarioTUSPersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-tus-pago-sandbox'){
      const staff=v2PrivateBrowserAuthorized(request,env)==='allow'||
       await v2SessionAuthorized(request,env);
      const buyer=!staff&&await autorizadoPedidoCliente(request,env);
      const data=buyer?await request.clone().json().catch(()=>null):null;
      const compradorAutorizado=buyer&&
       request.headers.get('Origin')===new URL(request.url).origin&&
       await autorizadoPedidoClienteVinculado(request,env,data?.webOrderId);
      return pagoTUSSandboxCliente(request,env,{authorized:staff||compradorAutorizado});
    }
     // Retención de PDF: SOLO simulación, protegida con Basic; sin DELETE real.
    if(page==='/prueba-v2/api/ensayo-tus-retencion')
      return simularLimpiezaTUS(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-universal-paquete-personal')
      return consultarPaqueteUniversalPersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-universal-descargar-personal')
      return descargarUniversalPersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/prueba-v2/api/ensayo-tus-paquete-manifiesto')
      return consultarPaqueteTUSPersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    // Descarga del operador: estrictamente Basic, nunca cookie de comprador.
    if(page==='/prueba-v2/api/ensayo-tus-descargar-personal')
      return descargarPdfTUSPersonal(request,env,{
       authorized:v2PrivateBrowserAuthorized(request,env)==='allow'
      });
    if(page==='/api/ensayo-tus-iniciar'||page==='/api/ensayo-tus-registrar'||
       page==='/api/ensayo-tus-recuperar'||page==='/prueba-v2/api/ensayo-tus-recuperar'||
       page==='/api/ensayo-tus-comprobar'||
       page==='/prueba-v2/api/ensayo-tus-iniciar'||page==='/prueba-v2/api/ensayo-tus-registrar'||
       page==='/prueba-v2/api/ensayo-tus-comprobar'||page==='/api/ensayo-tus-descargar'){
      const basic=v2PrivateBrowserAuthorized(request,env)==='allow';
      const staff=basic||await v2SessionAuthorized(request,env);
      const buyer=page==='/api/ensayo-tus-descargar'?false:
       (!staff&&await autorizadoPedidoCliente(request,env));
      const inicio=page.endsWith('/ensayo-tus-iniciar');
      const comprobar=page.endsWith('/ensayo-tus-comprobar');
      const data=buyer&&!comprobar?await request.clone().json().catch(()=>null):null;
      const compradorAutorizado=buyer&&(inicio||comprobar||
       await autorizadoPedidoClienteVinculado(request,env,data?.orderId));
      const authorized=page==='/api/ensayo-tus-descargar'?basic
       :(staff||compradorAutorizado);
      if(comprobar)return comprobarTUSAntesDeEnviar(request,env,{authorized});
      if(inicio){
        const result=await iniciarTandaTUSPrivada(request,env,{authorized});
        // Sólo al inicio exitoso se emite el vínculo comprador-orden.
        if(compradorAutorizado&&result.ok){
          const link=await cookiePedidoClienteVinculado(request,env,data?.orderId);
          if(link){
            const headers=new Headers(result.headers);
            headers.append('Set-Cookie',link);
            return new Response(result.body,{status:result.status,headers});
          }
        }
        return result;
      }
      if(page.endsWith('/ensayo-tus-registrar'))
        return finalizarPedidoTUSPrivado(request,env,{authorized,
         preciosServidor:authorized?await preciosPrivados(env,request):null});
      if(page.endsWith('/ensayo-tus-recuperar'))
        return recuperarPedidoTUSPrivado(request,env,{authorized});
      return descargarPdfTUSPersonal(request,env,{authorized});
    }
    if(page==='/api/ensayo-preparar-documentos-lote')return apiFichaCentralPrivada(request,env,false,false,true,true);
    if(page==='/api/ensayo-guardar-pdf-compuesto')return apiFichaCentralPrivada(request,env,false,false,false,false,true);
    if(page==='/api/ensayo-carga-unica'){
      if(request.method!=='POST')return closed();
      try{
        const origen=new URL(request.url).origin;
        if(request.headers.get('Origin')!==origen||
           (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
           !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
          return testResponse({ok:false,error:'Solicitud no autorizada.',paymentAuthorized:false},403);
        const body=await request.text();
        if(body.length>500000)throw Error('Datos demasiado extensos.');
        const solicitud=JSON.parse(body);
        // Separar la falta de sesión/catálogo D1 (503) de un PDF mal configurado (400).
        // No usar tarifas viejas si la revisión aprobada no está disponible.
        let tarifaVigente;
        try{tarifaVigente=await preciosPrivados(env,request);}
        catch(_){return testResponse({ok:false,error:'No pudimos verificar los precios vigentes. Actualizá la pantalla e intentá otra vez.',
          paymentAuthorized:false},503);}
        const data=cotizarCargaUnica({...solicitud,precios:tarifaVigente});
        return testResponse(data);
      }catch(_){return testResponse({ok:false,error:'Datos inválidos o trabajo pendiente de revisión.',paymentAuthorized:false},400)}
    }
    if(page==='/api/ensayo-materiales-ploteo')return catalogoPloteos(request,env);
    if(page==='/api/ensayo-ploteos-rapido')return cotizacionPloteos(request,env);
    if(page==='/prueba-cotizador-rapido.js'&&request.method==='GET')return scriptRapido();
    if(page==='/api/ensayo-materiales-rapido')return catalogoMaterialesRapido(request,env);
    if(page==='/api/ensayo-presupuesto-rapido')return cotizacionRapida(request,env);
    if(page==='/api/ensayo-cotizar-lote')return fase4QuoteLote(request,env);
    if(page==='/api/ensayo-cotizar-lote-ampliado')return fase4QuoteLote(request,env,true);
    if(page==='/api/ensayo-pdf')return fase4Transfer(request,env);
    if(page==='/api/ensayo-pdf-iniciar-lote')return fase4BatchStart(request,env);
    if(page==='/api/ensayo-pdf-ampliado')return fase4Transfer(request,env,true);
    if(page==='/api/ensayo-vincular-pdf-v2')return v2VincularPdf(request,env);
    if(page==='/api/ensayo-cotizar-ploteo-verificado')return v2CotizarPloteoVerificado(request,env);
    if(page==='/api/ensayo-cotizar')return fase4Quote(request,env);
    if(page==='/prueba-presupuesto'&&request.method==='GET')return presupuestoHtml(env);
    if(page==='/api/presupuesto-pdf')return presupuestoPost(request,env);
    if(page==='/prueba-validacion'&&request.method==='GET')return validarPdfHtml(env);
    if(page==='/api/validar-pdf')return verifyExistingPdf(request,env);
    if(page==='/prueba-pdf'&&request.method==='GET')return pilotHtml(env);
    if(page==='/api/piloto-pdf')return pilotPost(request,env);
    if(page==='/prueba-turnstile') {
      if(request.method==='GET')return testPage(env);
      if(request.method==='POST')return testTurnstilePost(request,env);
      return closed();
    }
    if(page==='/prueba-google'){
      if(request.method==='GET')return testPage(env,'google');
      if(request.method==='POST')return testGooglePing(request,env);
      return closed();
    }
    if(page==='/prueba-google-lote'){
      if(request.method==='GET')return testPage(env,'google-lote');
      if(request.method==='POST')return diagnosticoAutorizacionLoteSinArchivos(request,env);
      return closed();
    }
    // Este guardia permanece desactivado hasta revisión técnica formal.
    if (!INTERNAL_ALLOW_UPLOADS || env?.DOCS_UPLOAD_ENABLED !== 'true') {
      return closed();
    }
    // Aun habilitado, el receptor requiere validación del pedido en backend,
    // límites de abuso y Turnstile; no eliminar el bloqueo antes de implementarlos.
    if (request.method !== 'POST') return closed();
    return handleDocumentsPost(request, env);
  }
};
