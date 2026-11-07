/**
 * Recepcion R2 de PDF grandes — API del Worker exclusivamente experimental.
 * No importa este modulo el cotizador publico. No registra D1 ni habilita pagos.
 * Autorizacion adicional: el comprador debe poseer cookie vinculada al orderId
 * de cada recibo. Una firma R2 NO sirve por si sola como permiso de acceso.
 */
import {iniciarR2Grande,subirParteR2Grande,completarR2Grande,
 leerReciboR2,validarMetaR2} from './r2-pdf-grandes-privado.mjs';
import {verificarIntegridadR2Grande} from './r2-pdf-integridad-stream.mjs';
import {reservarR2GrandeAntesDeSubir} from './r2-grandes-reserva-central.mjs';
import {enviarPreRecepcionR2Central} from './r2-grandes-enviar-central.mjs';
import {pagoAprobadoParaR2,R2_PAID_GATE} from './r2-recepcion-solo-pagada.mjs';

const FLAG='PRIVATE_TEST_ONLY';
const ROOT='/prueba-v2/api/ensayo-r2/';
const CONFIRM=Object.freeze({checkoutEnabled:false,paymentAuthorized:false,
 listoParaProducir:false,registeredInD1:false});
const reply=(value,status=200,headers={})=>new Response(JSON.stringify({...CONFIRM,...value}),
 {status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',...headers}});
function validarEntorno(env){
 const secret=env?.DOCS_R2_RECEIPT_KEY;
 return env?.DOCS_R2_BIG_ENABLED===FLAG &&
  typeof secret==='string'&&secret.length>=32&&secret.length<=2048&&
  ![env?.DOCS_TUS_RECEIPT_KEY,env?.DOCS_V2_PRIVATE_UI_SECRET,env?.CENTRAL_BRIDGE_KEY].includes(secret)&&
  !!env?.SABER_R2_GRANDES&&typeof env.SABER_R2_GRANDES.createMultipartUpload==='function'&&
  typeof env.SABER_R2_GRANDES.resumeMultipartUpload==='function';
}
function allowedOrigin(request){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 return url.protocol==='https:'&&origin===url.origin&&
  (!request.headers.get('Sec-Fetch-Site')||request.headers.get('Sec-Fetch-Site')==='same-origin');
}
async function bodyJSON(request,maxBytes=12288){
 const len=request.headers.get('Content-Length');
 if(len!==null&&Number(len)>maxBytes)throw Error('R2_SOLICITUD_EXTENSA');
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('R2_TIPO_INCORRECTO');
 const str=await request.text();
 if(str.length>maxBytes)throw Error('R2_SOLICITUD_EXTENSA');
 const data=JSON.parse(str);
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('R2_SOLICITUD_INCORRECTA');
 return data;
}
export async function manejarR2GrandePrivado(request,env,{
 autorizadoIniciar=async()=>false,autorizadoOrden=async()=>false,
 comprobarPagoCentral=async()=>null,
 vincularOrden=async()=>null,now,subtle,digestFactory,
 stage=enviarPreRecepcionR2Central,
 reserve=reservarR2GrandeAntesDeSubir,uuid=()=>crypto.randomUUID(),
}={}){
 const url=new URL(request.url),route=url.pathname;
 if(!route.startsWith(ROOT))return reply({ok:false,error:'Ruta R2 inexistente'},404);
 const action=route.slice(ROOT.length);
 if(!['iniciar','parte','completar','verificar'].includes(action))
  return reply({ok:false,error:'Ruta R2 inexistente'},404);
 // Nunca permitir uploads cuando no esta implementada la compuerta postpago.
 // El flag no autoriza nada: requiere verificacion Central en cada operacion.
 if(env?.[R2_PAID_GATE.flag]!==R2_PAID_GATE.value)
  return reply({ok:false,error:'Recepción R2 requiere pago previo verificado'},503);
 // 503 antes de cualquier escritura: no cargar nada cuando no esta el bucket.
 if(!validarEntorno(env))
  return reply({ok:false,error:'Recepcion de PDF grandes no habilitada'},503);
 if(!allowedOrigin(request))
  return reply({ok:false,error:'Origen no autorizado'},403);
 const expectedMethod=action==='parte'?'PUT':'POST';
 if(request.method!==expectedMethod)
  return reply({ok:false,error:'Metodo no admitido'},405);
 if(url.searchParams.size!==(action==='parte'?1:0)||
  (action==='parte'&&!url.searchParams.has('n')))
  return reply({ok:false,error:'Parametros incorrectos'},400);
 try{
  const options={bucket:env.SABER_R2_GRANDES,secret:env.DOCS_R2_RECEIPT_KEY,
   ...(typeof now==='function'?{now}:{}),
   ...(subtle?{subtle}:{})};
  if(action==='iniciar'){
   if(env.DOCS_R2_QUOTA_ENABLED!==FLAG)
    return reply({ok:false,error:'Recepción R2 bloqueada: cupo sin habilitar'},503);
   const data=await bodyJSON(request);
   if(!data||Object.keys(data).sort().join(',')!=='meta,orderId')
    return reply({ok:false,error:'Datos de inicio incorrectos'},422);
   if(!await autorizadoIniciar(data.orderId))
    return reply({ok:false,error:'Sesion de comprador no autorizada'},403);
   // IMPRESCINDIBLE: validar ANTES de reservar cuota o crear multipart R2.
   const receipt=await comprobarPagoCentral(data.orderId);
   if(!pagoAprobadoParaR2(receipt,data.orderId,
      typeof now==='function'?now():Math.floor(Date.now()/1000)))
    return reply({ok:false,error:'R2_PAGO_NO_CONFIRMADO'},402);
   validarMetaR2(data.meta);
   // Primero reservar espacio global y del pedido en la Central con SQL atómico.
   // Una cuenta con R2 habilitado pero sin cuota NO puede crear uploads.
   const objectUUID=uuid();
   const reserved=await reserve({env,orderId:data.orderId,meta:data.meta,objectUUID});
   if(reserved?.reserved!==true||reserved.objectUUID!==objectUUID||
      reserved.orderId!==data.orderId||reserved.bytes!==data.meta?.bytes||
      reserved.paymentAuthorized!==false)
    throw Error('R2_CUPO_NO_CONFIRMADO');
   const session=await iniciarR2Grande({...options,orderId:data.orderId,
    meta:data.meta,uuid:()=>objectUUID});
   // Solo la autorizacion de inicio emite enlace de cookie comprador->orden.
   const link=await vincularOrden(data.orderId);
   return reply({ok:true,session},200,link?{'Set-Cookie':link}:{});
  }
  // Validar firma y ORDEN antes de tocar el bucket. Evita usar sesiones
  // robadas desde otro navegador aunque conozcan uploadId, HMAC y la ruta.
  const data=action==='completar'||action==='verificar'?await bodyJSON(request):null;
  if(data&&Object.keys(data).sort().join(',')!==(action==='verificar'?'proof':'proof,uploadedParts'))
   return reply({ok:false,error:'Datos de cierre incorrectos'},422);
  const proof=action==='parte'?request.headers.get('X-Saber-R2-Proof'):data?.proof;
  const c=await leerReciboR2(proof,options);
  if(!await autorizadoOrden(c.orderId))
   return reply({ok:false,error:'El PDF pertenece a otra sesion'},403);
  // Revalidar pago en cada reintento/parcialidad; un uploadId firmado no es
  // licencia perpetua para crear objetos si el pago fue revertido.
  const pagoActual=await comprobarPagoCentral(c.orderId);
  if(!pagoAprobadoParaR2(pagoActual,c.orderId,
     typeof now==='function'?now():Math.floor(Date.now()/1000)))
   return reply({ok:false,error:'R2_PAGO_NO_CONFIRMADO'},402);
  if(action==='parte'){
   const n=url.searchParams.get('n');
   if(!/^[1-9][0-9]{0,2}$/.test(n||''))
    return reply({ok:false,error:'Numero de parte incorrecto'},400);
   const part=await subirParteR2Grande({...options,proof,partNumber:Number(n),request});
   return reply({ok:true,...part});
  }
  if(action==='verificar'){
   const result=await verificarIntegridadR2Grande({...options,proof,
    ...(digestFactory?{digestFactory}:{})});
   const pending=await stage({env,claim:c,verified:result,
    ...(typeof now==='function'?{now}:{}),
    ...(subtle?{subtle}:{})});
   return reply({ok:true,result:{...result,
    stagedForCentral:pending.stagedForCentral===true}});
  }
  const result=await completarR2Grande({...options,proof,uploadedParts:data.uploadedParts});
  return reply({ok:true,result});
 }catch(error){
  const code=typeof error?.message==='string'&&/^R2_[A-Z0-9_]{3,60}$/.test(error.message)
   ?error.message:'R2_OPERACION_NO_COMPLETADA';
  console.warn('saber_r2_big_rejected',code);
  return reply({ok:false,error:code},code==='R2_CUPO_AGOTADO'?429:422);
 }
}
