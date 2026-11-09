/**
 * Preprensa LOCAL de un original R2 ya descargado por personal autenticado.
 * Se ejecuta en PC/runner con memoria suficiente: NUNCA importar en Worker.
 * No comunica con Mercado Pago, D1 ni R2 y NO concede permiso de impresión.
 */
import {readFile,stat,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {medidasPdfServidor} from './medidas-pdf-servidor.mjs';
import {evaluarRiesgoPreprensaPloteo} from './riesgo-preprensa-ploteo.mjs';
const MIN=40*1024*1024,MAX=200*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const limitCm=0.1; // Un milímetro; NO redondear dimensiones ni improvisar formato.

export function compararGeometriaR2(declaradas,medidas){
 if(!Array.isArray(declaradas)||!Array.isArray(medidas)||
    declaradas.length<1||declaradas.length>2000)
  throw Error('R2_PREPRENSA_DECLARACION_INVALIDA');
 const inconsistencias=[];
 if(declaradas.length!==medidas.length){
  inconsistencias.push({tipo:'CANTIDAD_PAGINAS',declaradas:declaradas.length,reales:medidas.length});
 }
 for(let i=0;i<Math.min(declaradas.length,medidas.length);i++){
  const d=declaradas[i],m=medidas[i];
  if(!d||d.numero!==i+1||!Number.isFinite(d.anchoCm)||!Number.isFinite(d.altoCm)||
   d.anchoCm<=0||d.altoCm<=0||d.anchoCm>2000||d.altoCm>2000||
   !['cad','poster'].includes(d.modo)||
   !m||!Number.isFinite(m.anchoCm)||!Number.isFinite(m.altoCm))
   throw Error('R2_PREPRENSA_DECLARACION_INVALIDA');
  if(Math.abs(d.anchoCm-m.anchoCm)>limitCm||
     Math.abs(d.altoCm-m.altoCm)>limitCm){
   inconsistencias.push({tipo:'MEDIDA_PAGINA',pagina:i+1,
    declaradaCm:[d.anchoCm,d.altoCm],
    medidaCm:[m.anchoCm,m.altoCm]});
  }
 }
 return Object.freeze({coinciden:inconsistencias.length===0,inconsistencias});
}
export async function revisarPdfR2Local({
 filePath,webOrderId,commercialOrderId,receiptId,expectedSha256,
 expectedBytes,paginasDeclaradas,amountArs,preparacion=medidasPdfServidor
}={}){
 if(typeof filePath!=='string'||!filePath||!WEB.test(webOrderId||'')||
    !uuid.test(commercialOrderId||'')||
    !/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(receiptId||'')||
    !SHA.test(expectedSha256||'')||!Number.isSafeInteger(expectedBytes)||
    expectedBytes<=MIN||expectedBytes>MAX||
    !Number.isSafeInteger(amountArs)||amountArs<1||
    !Array.isArray(paginasDeclaradas)||paginasDeclaradas.length<1||
    paginasDeclaradas.length>2000)
  throw Error('R2_PREPRENSA_MANIFIESTO_INVALIDO');
 const metadata=await stat(filePath);
 if(!metadata.isFile()||metadata.size!==expectedBytes)
  throw Error('R2_PREPRENSA_LONGITUD_INCORRECTA');
 // Verificación en streaming primero. Un nombre de archivo nunca es autoridad.
 const digest=createHash('sha256');
 const input=await open(filePath,'r');
 try{
  const chunk=Buffer.alloc(1024*1024);
  let pos=0;
  while(pos<expectedBytes){
   const len=Math.min(chunk.length,expectedBytes-pos);
   const {bytesRead}=await input.read(chunk,0,len,pos);
   if(bytesRead<=0)throw Error('R2_PREPRENSA_LECTURA_INCOMPLETA');
   digest.update(chunk.subarray(0,bytesRead));
   pos+=bytesRead;
  }
 }finally{await input.close()}
 if(digest.digest('hex')!==expectedSha256)
  throw Error('R2_PREPRENSA_SHA256_DIFERENTE');
 // Sólo una estación/runner con RAM suficiente, nunca un Cloudflare Worker.
 const bytes=new Uint8Array(await readFile(filePath));
 let measured;
 try{measured=await preparacion(bytes,{maxPaginas:2000})}
 catch{throw Error('R2_PREPRENSA_PDF_NO_ANALIZABLE')}
 const geometry=compararGeometriaR2(paginasDeclaradas,measured.pageMetrics);
 const paginas=measured.pageMetrics.map((p,i)=>({
  numero:i+1,anchoCm:p.anchoCm,altoCm:p.altoCm
 }));
 const riesgo=evaluarRiesgoPreprensaPloteo({bytes:expectedBytes,paginas});
 return Object.freeze({
  schema:'saber-r2-informe-preprensa-local-v1',
  webOrderId,commercialOrderId,receiptId,
  sha256Verificado:true,bytesVerificados:expectedBytes,
  declaredPages:paginasDeclaradas.length,measuredPages:measured.pageCount,
  measuredDimensions:paginas,
  geometryMatchesQuote:geometry.coinciden,issues:geometry.inconsistencias,
  amountPaidArs:amountArs,
  priceRecalculated:false,
  cadPosterClassificationVerified:false,
  originalPreserved:true,
  copyForPlotterRequired:riesgo.requiereCopiaPreparada,
  risk:riesgo,
  status:geometry.coinciden?'CONTENIDO_Y_PRECIO_PENDIENTES_REVISION':
   'MEDIDAS_DISTINTAS_REQUIERE_RECOTIZACION',
  registeredInCommercialManifest:false,
  readyForPrinting:false,productionAuthorized:false
 });
}
