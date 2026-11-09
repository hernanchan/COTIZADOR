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
/**
 * Contrasta la ficha cotizada conservada en D1 con las medidas del original.
 * El modo CAD/póster, papel, rollo y copias permanecen bajo revisión del
 * operador: una coincidencia geométrica no valida contenido ni tarifa.
 * NO altera la suma cobrada ni autoriza producción.
 */
export function cotejarFichaCotizadaR2(quoteSnapshot,medidas,amountArs){
 const base={productionAuthorized:false,priceRecalculated:false,
  requiresOperatorReview:true,classificationVerified:false,materialsVerified:false};
 if(quoteSnapshot===null||quoteSnapshot===undefined)
  return Object.freeze({...base,quoteSnapshotAvailable:false,geometryMatchesQuote:false,
   issues:[{tipo:'FICHA_COTIZADA_NO_DISPONIBLE'}],
   state:'REQUIERE_REVISION_COMERCIAL'});
 const q=quoteSnapshot;
 if(!q||typeof q!=='object'||Array.isArray(q)||
  q.schema!=='saber-r2-cotizacion-firmada-v1'||
  !Array.isArray(q.paginas)||q.paginas.length<1||q.paginas.length>2000||
  !Number.isSafeInteger(q.importeArs)||q.importeArs<1||
  !Number.isSafeInteger(q.copias)||q.copias<1||q.copias>500||
  !['bn','color'].includes(q.modoImpresion)||
  !['obra80','recubierto'].includes(q.papelPoster)||
  !/^rollo\d+$/.test(q.rolloBase||'')||
  q.paginas.some(p=>!Array.isArray(p)||p.length!==5||
   !Number.isFinite(p[0])||p[0]<=0||p[0]>2000||
   !Number.isFinite(p[1])||p[1]<=0||p[1]>2000||
   !['cad','poster'].includes(p[2])||
   !/^(rollo|rec)\d+$/.test(p[3]||'')||
   !['obra80','recubierto'].includes(p[4])))
  throw Error('R2_PREPRENSA_FICHA_COTIZADA_INVALIDA');
 const declaradas=q.paginas.map((p,i)=>({
  numero:i+1,anchoCm:p[0],altoCm:p[1],modo:p[2]
 }));
 const geometry=compararGeometriaR2(declaradas,medidas);
 const issues=[...geometry.inconsistencias];
 if(q.importeArs!==amountArs)
  issues.push({tipo:'IMPORTE_PAGADO_NO_COINCIDE_CON_FICHA',
   importeFichaArs:q.importeArs,importePagadoArs:amountArs});
 // Cada soporte/papel/copia y la clasificación requieren comprobación
 // humana incluso si dimensiones y valor pagado coinciden.
 return Object.freeze({...base,quoteSnapshotAvailable:true,
  declaredCopies:q.copias,declaredPaper:q.papelPoster,declaredRoll:q.rolloBase,
  declaredClasses:q.paginas.map(p=>p[2]),
  geometryMatchesQuote:geometry.coinciden,
  issues,state:issues.length?'DIFERENCIA_REQUIERE_REVISION_COMERCIAL':
   'GEOMETRIA_COINCIDE_RESTA_VALIDAR_CONTENIDO_Y_PRECIO'});
}

export async function revisarPdfR2Local({
 filePath,webOrderId,commercialOrderId,receiptId,expectedSha256,
 expectedBytes,paginasDeclaradas,amountArs,quoteSnapshot=null,preparacion=medidasPdfServidor
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
 const cotejo=cotejarFichaCotizadaR2(quoteSnapshot,measured.pageMetrics,amountArs);
 return Object.freeze({
  schema:'saber-r2-informe-preprensa-local-v1',
  webOrderId,commercialOrderId,receiptId,
  sha256Verificado:true,bytesVerificados:expectedBytes,
  declaredPages:paginasDeclaradas.length,measuredPages:measured.pageCount,
  measuredDimensions:paginas,
  geometryMatchesQuote:geometry.coinciden&&(!quoteSnapshot||cotejo.geometryMatchesQuote),
  issues:[...geometry.inconsistencias,...cotejo.issues],
  cotejoFichaCotizada:cotejo,
  amountPaidArs:amountArs,
  priceRecalculated:false,
  cadPosterClassificationVerified:false,
  originalPreserved:true,
  copyForPlotterRequired:riesgo.requiereCopiaPreparada,
  risk:riesgo,
  status:!geometry.coinciden?'MEDIDAS_DISTINTAS_REQUIERE_RECOTIZACION':
   (quoteSnapshot&&cotejo.issues.length?'DIFERENCIA_REQUIERE_REVISION_COMERCIAL':
    'CONTENIDO_Y_PRECIO_PENDIENTES_REVISION'),
  registeredInCommercialManifest:false,
  readyForPrinting:false,productionAuthorized:false
 });
}
