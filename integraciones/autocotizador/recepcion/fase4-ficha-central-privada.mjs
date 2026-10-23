/** Adaptador privado al receptor GAS FASE4. Sólo llamar tras autenticar operador.
 * La función consultarFirmado DEBE ser HMAC Cloudflare-Apps Script, nunca pública.
 */
import {leerPdfFase4Privado} from './leer-pdf-fase4-privado.mjs';
import {conectarRecepcionConCentral} from './puente-recepcion-central.mjs';
const SESSION=/^DOC-[a-f0-9-]{36}$/i;
export async function fase4FichaCentralPrivada({sesion,opciones,consultarFirmado,preciosServidor}){
 if(!sesion||!SESSION.test(sesion.uploadId||'')||
    typeof sesion.token!=='string'||sesion.token.length<16||
    sesion.token.length>256||typeof consultarFirmado!=='function'||
    !opciones||typeof opciones!=='object'||Array.isArray(opciones))
  throw Error('No existe una sesión privada comprobable.');
 const sesionSegura={uploadId:sesion.uploadId,token:sesion.token};
 const info=await consultarFirmado({op:'multiInfo',...sesionSegura});
 const status=await consultarFirmado({op:'multiVerifiedStatus',...sesionSegura});
 if(!info||info.ok!==true||!status||status.ok!==true||
    status.status!=='verified'||status.verified!==true||
    status.paymentAuthorized!==false||status.storageVerified!==true||
    status.pageVerification!=='server'||info.receiptState!=='pages_verified'||
    info.receiptId!==sesion.uploadId||status.receiptId!==sesion.uploadId||
    info.orderId!==status.orderId||info.fileId!==status.fileId||
    info.name!==status.name||info.mode!==status.mode||
    info.bytes!==status.bytes||info.sha256!==status.sha256||
    info.pages!==status.pages||info.privateChunkBytes!==256*1024)
  throw Error('Falta una constancia verificable del receptor.');
 const {fileId,orderId,nombre,modo,paginas,...otras}=opciones;
 const configuracion={...otras,fileId:info.fileId,nombre:info.name,modo:info.mode};
 return conectarRecepcionConCentral({
  orderId:info.orderId,configuraciones:[configuracion],preciosServidor,
  consultarRecibosPrivados:async()=>[status],
  descargarPdfPrivado:async()=>leerPdfFase4Privado({
   session:sesionSegura,receiptId:info.receiptId,
   bytes:info.bytes,sha256:info.sha256,consultarFirmado
  })
 });
}
