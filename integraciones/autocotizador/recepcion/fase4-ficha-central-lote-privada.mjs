/** Validación PRIVADA de varios PDFs recibidos por el GAS de pruebas.
 * Este módulo no acepta el estado de archivos informado por el navegador:
 * consulta cada recibo en Google, reconstruye bytes HMAC y verifica su SHA.
 * Límite temporal FASE4: hasta 5 sesiones de PDF de <=1 MiB cada una.
 */
import {leerPdfFase4Privado} from './leer-pdf-fase4-privado.mjs';
import {conectarRecepcionConCentral} from './puente-recepcion-central.mjs';
const SESSION=/^DOC-[a-f0-9-]{36}$/i;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
export async function fase4FichaCentralLotePrivada({
 sesiones,consultarFirmado,preciosServidor,
 maxFiles=5,maxFileBytes=1024*1024
}){
 if(![[5,1024*1024],[30,20*1024*1024]].some(x=>x[0]===maxFiles&&x[1]===maxFileBytes)||
    !Array.isArray(sesiones)||sesiones.length<1||sesiones.length>maxFiles||
    typeof consultarFirmado!=='function')
  throw Error('Lote privado no autorizado o supera el cupo del receptor.');
 const ids=new Set(),files=new Set(),receipts=[],configs=[],byFile=new Map();
 let orderId=null;
 // Una consulta puede fallar o encontrar un archivo sin confirmar. En ese caso
 // NO se envía ninguna ficha a D1 ni se confirma precio al comprador.
 for(const entry of sesiones){
  const session=entry?.sesion,config=entry?.opciones;
  if(!session||!SESSION.test(session.uploadId||'')||
     typeof session.token!=='string'||session.token.length<16||
     session.token.length>256||ids.has(session.uploadId)||
     !config||typeof config!=='object'||Array.isArray(config))
   throw Error('Sesión repetida, incompleta o sin opciones.');
  ids.add(session.uploadId);
  const safe={uploadId:session.uploadId,token:session.token};
  const info=await consultarFirmado({op:'multiInfo',...safe});
  const status=await consultarFirmado({op:'multiVerifiedStatus',...safe});
  if(!info||info.ok!==true||info.receiptState!=='pages_verified'||
     info.receiptId!==session.uploadId||!status||status.ok!==true||
     status.receiptId!==session.uploadId||status.status!=='verified'||
     status.verified!==true||status.storageVerified!==true||
     status.pageVerification!=='server'||status.paymentAuthorized!==false||
     info.orderId!==status.orderId||info.fileId!==status.fileId||
     info.name!==status.name||info.mode!==status.mode||
     info.bytes!==status.bytes||info.sha256!==status.sha256||
     info.pages!==status.pages||info.privateChunkBytes!==256*1024||
     !FILE.test(info.fileId||'')||files.has(info.fileId)||
     !SESSION.test(info.receiptId||'')||
     !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(info.orderId||'')||
     typeof info.name!=='string'||!/\.pdf$/i.test(info.name)||
     !['bn','color'].includes(info.mode)||
     !Number.isSafeInteger(info.pages)||info.pages<1||info.pages>2000||
     !Number.isSafeInteger(info.bytes)||info.bytes<5||info.bytes>maxFileBytes||
     !SHA.test(info.sha256||''))
   throw Error('Faltan recibos íntegros y confirmados en Google.');
  if(orderId!==null&&orderId!==info.orderId)
   throw Error('El lote contiene archivos de pedidos diferentes.');
  orderId=info.orderId;files.add(info.fileId);
  const {fileId,orderId:ignored,nombre,modo,paginas,...rest}=config;
  configs.push({...rest,fileId:info.fileId,nombre:info.name,modo:info.mode});
  receipts.push(status);
  byFile.set(info.fileId,{safe,receiptId:info.receiptId,
   bytes:info.bytes,sha256:info.sha256});
 }
 // La verificación completa de SHA, estructura PDF, páginas reales, catálogo y
 // totales se concentra en un solo pipeline de producción.
 return conectarRecepcionConCentral({
  orderId,configuraciones:configs,preciosServidor,
  consultarRecibosPrivados:async()=>receipts,
  descargarPdfPrivado:async({fileId,receiptId,expectedBytes})=>{
   const file=byFile.get(fileId);
   if(!file||file.receiptId!==receiptId||file.bytes!==expectedBytes)
    throw Error('El PDF privado no corresponde al recibo verificado.');
   return leerPdfFase4Privado({
    session:file.safe,receiptId:file.receiptId,bytes:file.bytes,
    sha256:file.sha256,consultarFirmado,maxFileBytes
   });
  }
 });
}
