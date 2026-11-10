/**
 * Planeamiento UNIVERSAL de recepción, sin transferir bytes ni crear pedido.
 * El destino (A4/A3/CAD/póster) proviene del motor de precios existente.
 * El transporte TUS/R2 depende EXCLUSIVAMENTE de los bytes de cada PDF.
 *
 * No crea preferencias MP, registros D1 ni upload multipart; no autoriza pago.
 * Se exige la versión APROBADA del tarifario privado y comparación posterior
 * del PDF recibido antes de autorizar impresión.
 */
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {decidirTransportePDF,LIMITE_TUS_PDF_BYTES,LIMITE_R2_PDF_BYTES} from './seleccionar-transporte-pdf.mjs';
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const NAME=/\.pdf$/i;
const MAX_FILES=10;
const MAX_TUS_BATCH=60*1024*1024;
const invalid=(reason)=>{throw Error('R2_PLAN_UNIVERSAL_'+reason)};
export const REGLAS_RECEPCION_UNIVERSAL=Object.freeze({
 archivosMaximos:MAX_FILES,
 pdfTusMaxBytes:LIMITE_TUS_PDF_BYTES,
 pdfR2MaxBytes:LIMITE_R2_PDF_BYTES,
 loteTusMaxBytes:MAX_TUS_BATCH
});

/**
 * @param {object} input
 * @param {Array} input.archivos - declaraciones de configuración del motor vigente
 * @param {Array} input.manifiestos - [{fileId,nombre,bytes,sha256}], orden 1:1
 * @param {object} input.tarifario - lectura autenticada D1 con revisión aprobada
 *
 * El precio no se recibe de la UI. Si hay un PDF sin cotizar o fuera de cupo,
 * NO se genera borrador que pueda terminar pagándose parcialmente.
 */
export function prepararPlanRecepcionUniversal({archivos,manifiestos,tarifario,produccion=false}={}){
 if(!tarifario||tarifario.source!==(produccion?'production-d1-approved-only':'private-d1-approved-only')||
    !Number.isSafeInteger(tarifario.revision)||tarifario.revision<1||
    tarifario.prices?.priceVersion!=='d1-approved-revision-'+tarifario.revision)
  invalid('TARIFAS_NO_APROBADAS');
 if(!Array.isArray(archivos)||!Array.isArray(manifiestos)||
    !archivos.length||archivos.length>MAX_FILES||manifiestos.length!==archivos.length)
  invalid('ARCHIVOS_NO_COINCIDEN');
 const seen=new Set();
 let tusBytes=0;
 const meta=manifiestos.map((m,i)=>{
  const a=archivos[i];
  if(!m||typeof m!=='object'||Array.isArray(m)||
     Object.keys(m).sort().join(',')!=='bytes,fileId,nombre,sha256'||
     !ID.test(m.fileId||'')||seen.has(m.fileId)||!SHA.test(m.sha256||'')||
     typeof m.nombre!=='string'||m.nombre.length<1||m.nombre.length>120||
     !NAME.test(m.nombre)||m.nombre!==a?.nombre)
   invalid('MANIFIESTO_INVALIDO');
  seen.add(m.fileId);
  const transport=decidirTransportePDF(m.bytes);
  if(transport.ruta==='invalido'||transport.ruta==='supera_cupo')
   invalid('TAMANO_FUERA_DE_LIMITE');
  if(transport.ruta==='tus')tusBytes+=m.bytes;
  return {indice:i,fileId:m.fileId,nombre:m.nombre,bytes:m.bytes,
    sha256:m.sha256,transporte:transport.ruta,pagoPrevioR2:transport.pagoPrevio};
 });
 if(tusBytes>MAX_TUS_BATCH)invalid('LOTE_TUS_EXCEDIDO');
 let quote;
 try{quote=cotizarCargaUnica({archivos,precios:tarifario.prices})}
 catch{invalid('COTIZACION_INVALIDA')}
 if(quote.estado!=='PRELIMINAR'||quote.paymentAuthorized!==false||
    quote.pendientes?.length||!Array.isArray(quote.plan)||
    quote.plan.length!==archivos.length||
    !Number.isSafeInteger(quote.total)||quote.total<1||quote.total>50000000)
  invalid('PRESUPUESTO_INCOMPLETO');
 const lines=meta.map(m=>{
  const selected=quote.plan.filter(p=>p.indice===m.indice);
  if(selected.length!==1)invalid('CLASIFICACION_AMBIGUA');
  const plan=selected[0];
  if(!['documentos','ploteos','stickers','fotos','corte','grafica'].includes(plan.destino))
   invalid('SERVICIO_INCOMPATIBLE');
  if(!Array.isArray(plan.paginasElegidas)||!plan.paginasElegidas.length)
   invalid('PAGINAS_NO_COINCIDEN');
  return Object.freeze({...m,destino:plan.destino,
    formatoFinal:plan.formatoFinal||null,
    paginasElegidas:plan.paginasElegidas.slice(),
    estado:'PENDIENTE_DE_ORIGINAL_VERIFICADO'});
 });
 if(!produccion&&!lines.some(l=>l.transporte==='r2'))
  invalid('SIN_ARCHIVOS_GRANDES');
 return Object.freeze({
  schema:'saber-r2-plan-multifamilia-v1',
  priceRevision:tarifario.prices.priceVersion,
  quoteState:'PRELIMINAR_SIN_ORIGINALES',
  totalArs:quote.total,
  documentos:lines.filter(x=>x.destino==='documentos').length,
  ploteos:lines.filter(x=>x.destino==='ploteos').length,
  archivos:lines,
  requierePagoAntesDeR2:true,
  filesUploaded:false,
  paymentAuthorized:false,
  productionAuthorized:false,
  // Nunca confundir el precio declarado con validación de páginas/tipo de PDF.
  requierePreprensaPosterior:true
 });
}
