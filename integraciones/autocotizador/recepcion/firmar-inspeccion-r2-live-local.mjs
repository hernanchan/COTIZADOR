/** Estación de preprensa: firma un informe creado DESPUÉS de leer
 * el PDF real y comprobar su SHA-256 con revisarPdfR2Local.
 * Este módulo Node no se importa en Cloudflare Workers.
 */
import {createHmac} from 'node:crypto';
const SHA=/^[a-f0-9]{64}$/,ID=/^[A-Za-z0-9_-]{1,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
export function firmarInformeR2LiveLocal({
 informe,fileId,quoteHash,secret,issuedAt=Math.floor(Date.now()/1000)
}={}){
 if(!informe||informe.schema!=='saber-r2-informe-preprensa-local-v1'||
   informe.sha256Verificado!==true||!SHA.test(informe.sha256Original||'')||
   informe.originalPreserved!==true||
   informe.priceRecalculated!==false||
   informe.productionAuthorized!==false||
   informe.readyForPrinting!==false||
   informe.geometryMatchesQuote!==true||
   !WEB.test(informe.webOrderId||'')||
   !UUID.test(informe.commercialOrderId||'')||
   !/^DOC-[a-f0-9-]{36}$/i.test(informe.receiptId||'')||
   !ID.test(fileId||'')||!SHA.test(quoteHash||'')||
   !Number.isSafeInteger(informe.bytesVerificados)||
   informe.bytesVerificados<=40*1048576||
   informe.bytesVerificados>200*1048576||
   !Number.isSafeInteger(informe.measuredPages)||
   informe.measuredPages!==informe.declaredPages||
   !Array.isArray(informe.measuredDimensions)||
   informe.measuredDimensions.length!==informe.measuredPages||
   !Array.isArray(informe.issues)||
   informe.issues.some(x=>x?.tipo!=='FICHA_COTIZADA_NO_DISPONIBLE')||
   !Number.isSafeInteger(issuedAt)||issuedAt<1700000000||
   typeof secret!=='string'||secret.length<32)
  throw Error('R2_LIVE_INFORME_NO_APTO');
 const measured=informe.measuredDimensions.map((d,i)=>{
  if(!d||d.numero!==i+1||!Number.isFinite(d.anchoCm)||
   !Number.isFinite(d.altoCm)||d.anchoCm<=0||d.altoCm<=0)
   throw Error('R2_LIVE_INFORME_MEDIDA');
  return {numero:d.numero,anchoCm:d.anchoCm,altoCm:d.altoCm};
 });
 const proof={
  schema:'saber-r2-live-inspection-proof-v1',
  webOrderId:informe.webOrderId,
  commercialOrderId:informe.commercialOrderId,
  fileId,receiptId:informe.receiptId,quoteHash,
  sha256:informe.sha256Original,bytes:informe.bytesVerificados,
  issuedAt,measuredDimensions:measured
 };
 const signature=createHmac('sha256',secret).update(JSON.stringify(proof)).digest('hex');
 return Object.freeze({proof,signature});
}
