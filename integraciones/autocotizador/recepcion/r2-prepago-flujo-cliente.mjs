/**
 * Controlador del comprador para UN PDF grande (40–200 MiB).
 * ÚNICO punto de entrada R2: enviar SOLO tras status=pagado_esperando_archivo.
 * En ausencia de pago no puede llamar a ningún endpoint /ensayo-r2/iniciar.
 * El PDF permanece en el File local; storage sólo guarda reintentos por sesión.
 */
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
import {enviarArchivoR2Grande} from './r2-pdf-grandes-cliente.mjs';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const MIB=1024*1024;
const checkoutPath='/prueba-v2/api/ensayo-r2-prepago-checkout';
const quotePath='/prueba-v2/api/ensayo-r2-prepago';
function valideUrl(url){
 let u;try{u=new URL(url)}catch{}
 if(!u||u.protocol!=='https:'||u.username||u.password||u.hash||
  !/(^|\.)mercadopago\.com(\.ar)?$/.test(u.hostname))
  throw Error('PREPAGO_ENLACE_MP_NO_SEGURO');
 return u.href;
}
async function postJson(fetcher,route,body){
 const response=await fetcher(route,{method:'POST',credentials:'same-origin',
  redirect:'error',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)});
 const payload=await response.json().catch(()=>null);
 if(!response.ok||payload?.ok!==true)
  throw Error('PREPAGO_'+String(payload?.error||'SERVICIO_NO_DISPONIBLE').slice(0,150));
 return payload;
}
export function crearFlujoR2PagoAntesDeCarga({
 file,archivos,webOrderId,fetcher=fetch,
 uploader=enviarArchivoR2Grande,
 hasher=sha256PdfLocalPorFragmentos,
 onProgress=()=>{},onState=()=>{},
 storage=typeof sessionStorage==='undefined'?null:sessionStorage,
 restaurarPago=null
}={}){
 if(!file||typeof file.slice!=='function'||
  typeof file.name!=='string'||!/\.pdf$/i.test(file.name)||
  file.name.length>120||!Number.isSafeInteger(file.size)||
  file.size<=40*MIB||file.size>200*MIB||
  !Array.isArray(archivos)||archivos.length!==1||
  !Array.isArray(archivos[0]?.paginas)||archivos[0].paginas.length<1||
  archivos[0].paginas.length>2000||archivos[0].servicio!=='auto'||
  !WEB.test(webOrderId||'')||
  typeof fetcher!=='function'||typeof uploader!=='function'||
  typeof hasher!=='function'||typeof onProgress!=='function'||
  typeof onState!=='function')
  throw Error('PREPAGO_PLOTEO_GRANDE_NO_VALIDO');
 if(restaurarPago!==null&&(!restaurarPago||
    !/^[a-f0-9-]{36}$/i.test(restaurarPago.commercialOrderId||'')||
    !Number.isSafeInteger(restaurarPago.amountArs)||restaurarPago.amountArs<1||
    !/^[a-f0-9]{64}$/.test(restaurarPago.sha256||'')))
  throw Error('PREPAGO_RECUPERACION_NO_VALIDA');
 const fileId='planoA1',pages=archivos[0].paginas.length;
 let phase=restaurarPago?'archivo_pendiente_de_comparar':'seleccionado',
  sha256=restaurarPago?.sha256||null,
  commercialOrderId=restaurarPago?.commercialOrderId||null,
  amountArs=restaurarPago?.amountArs||null,checkoutUrl=null,lastResult=null;
 const emit=()=>onState(Object.freeze({
  phase,commercialOrderId,amountArs,checkoutUrl,webOrderId,
  sha256Verified:phase==='carga_verificada',
  uploaded:phase==='carga_verificada'
 }));
 const transition=next=>{phase=next;emit()};
 emit();
 return {
  get phase(){return phase},
  get amountArs(){return amountArs},
  get checkoutUrl(){return checkoutUrl},
  get webOrderId(){return webOrderId},
  get sha256(){return sha256},
  get commercialOrderId(){return commercialOrderId},
  async validarRestauracion(){
   if(phase!=='archivo_pendiente_de_comparar')
    throw Error('PREPAGO_RECUPERACION_NO_DISPONIBLE');
   // El almacenamiento local no acredita ni autoriza pagos: primero verificar
   // todos los bytes originales; después consultar el estado a Central.
   const actual=await hasher(file,{onProgress});
   if(actual!==sha256){
    transition('archivo_no_coincide');
    throw Error('PREPAGO_PDF_DIFERENTE_AL_COTIZADO');
   }
   transition('esperando_pago');
   return {webOrderId,commercialOrderId,amountArs};
  },
  async preparar(){
   if(phase!=='seleccionado')throw Error('PREPAGO_ESTADO_INCORRECTO');
   transition('calculando_hash_local');
   // No Blob.arrayBuffer completo: leer un MiB por vez, sin R2.
   sha256=await hasher(file,{onProgress});
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error('PREPAGO_SHA256_INVALIDO');
   transition('registrando_presupuesto');
   const saved=await postJson(fetcher,quotePath,{webOrderId,
    fileId,bytes:file.size,sha256,archivos});
   if(saved.webOrderId!==webOrderId||saved.filesUploaded!==false||
      saved.paymentAuthorized!==false||saved.uploadAuthorized!==false||
      saved.quoteState!=='PRELIMINAR_SIN_ARCHIVO'||
      !/^[a-f0-9-]{36}$/i.test(saved.commercialOrderId||'')||
      !Number.isSafeInteger(saved.amountArs)||saved.amountArs<1)
    throw Error('PREPAGO_BORRADOR_SERVIDOR_INVALIDO');
   commercialOrderId=saved.commercialOrderId;
   amountArs=saved.amountArs;
   transition('presupuesto_sin_archivo');
   return {commercialOrderId,amountArs};
  },
  async iniciarPagoSandbox(){
   if(phase!=='presupuesto_sin_archivo')throw Error('PREPAGO_PAGO_NO_DISPONIBLE');
   const data=await postJson(fetcher,checkoutPath,{action:'start',
    webOrderId,commercialOrderId});
   if(data.webOrderId!==webOrderId||data.commercialOrderId!==commercialOrderId||
      data.amountArs!==amountArs||data.estado!=='pendiente'||
      data.uploadAuthorized!==false)
    throw Error('PREPAGO_PASARELA_NO_COINCIDE');
   checkoutUrl=valideUrl(data.checkoutUrl);
   transition('esperando_pago');
   return checkoutUrl;
  },
  async consultarPago(){
   if(!['esperando_pago','pagado_esperando_subida','revocado'].includes(phase))
    throw Error('PREPAGO_CONSULTA_NO_DISPONIBLE');
   const data=await postJson(fetcher,checkoutPath,{action:'status',
    webOrderId,commercialOrderId});
   if(data.webOrderId!==webOrderId||data.commercialOrderId!==commercialOrderId||
      data.amountArs!==amountArs||data.filesUploaded!==false)
    throw Error('PREPAGO_ESTADO_CENTRAL_NO_COINCIDE');
   if(data.estado==='revocado'){
    transition('revocado');return 'revocado';
   }
   if(data.estado==='pagado_esperando_archivo'&&data.uploadAuthorized===true){
    transition('pagado_esperando_subida');return 'pagado';
   }
   if(data.estado!=='pendiente'||data.uploadAuthorized!==false)
    throw Error('PREPAGO_ESTADO_CENTRAL_INVALIDO');
   transition('esperando_pago');return 'pendiente';
  },
  async subirDespuesDePagar(){
   if(phase!=='pagado_esperando_subida')
    throw Error('PREPAGO_R2_BLOQUEADO_SIN_PAGO');
   transition('subiendo_pdf_pagado');
   try{
    // El Worker repite la consulta firmada a D1 antes de crear la sesión
    // multipart y antes de cada parte, incluso con esta sesión pagada.
    lastResult=await uploader({file,orderId:webOrderId,fetcher,storage,
     meta:{fileId,name:file.name,mode:archivos[0].modo,
      bytes:file.size,sha256,pages},
     onProgress});
    if(lastResult?.sha256Verificado!==true||
       lastResult?.sha256!==sha256||
       lastResult?.bytes!==file.size||
       lastResult?.contenidoPdfVerificado!==false)
     throw Error('PREPAGO_CARGA_NO_VERIFICADA');
    transition('carga_verificada');
    return lastResult;
   }catch(error){
    transition('pagado_esperando_subida');
    throw error;
   }
  },
  get result(){return lastResult}
 };
}
