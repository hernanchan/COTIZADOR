/**
 * Lectura de dimensiones grandes SIN cargar el original entero en RAM.
 * PDF.js se inyecta para no enlazar una dependencia nueva al Worker de clientes.
 *
 * Requiere reader vinculado a R2/D1/ETag (abrirRangosR2Privados) y PDF.js
 * 3.11.174 con PDFDataRangeTransport. Sólo obtiene número y medidas; NO
 * renderiza una página ni acredita precio o PDF imprimible.
 *
 * Política: hasta 700 rangos adicionales, máximo 48 MiB leídos acumulados,
 * y 2.000 páginas. Si falla lectura o el parser, NO COTIZAR.
 */
const INITIAL_BYTES=65536;
const MAX_BYTES_READ=48*1024*1024;
const MAX_CALLS=700;
export const BIG_PDF_METADATA_LIMITS=Object.freeze({
 initialBytes:INITIAL_BYTES,maxReadBytes:MAX_BYTES_READ,maxCalls:MAX_CALLS,
 maxPages:2000
});
const round=v=>Math.round(v*1000)/1000;
export async function inspeccionarMedidasPdfGrandePorRangos({
 reader,pdfjs,maxPages=2000
}={}){
 if(!reader||typeof reader.leer!=='function'||
    !Number.isSafeInteger(reader.bytes)||reader.bytes<=40*1024*1024||
    reader.bytes>256*1024*1024||
    !pdfjs||typeof pdfjs.getDocument!=='function'||
    typeof pdfjs.PDFDataRangeTransport!=='function'||
    !Number.isInteger(maxPages)||maxPages<1||maxPages>2000)
  throw Error('R2_PDF_RANGOS_ANALIZADOR_NO_ADMITIDO');
 const firstBytes=Math.min(INITIAL_BYTES,reader.bytes);
 const initial=await reader.leer(0,firstBytes);
 if(!(initial instanceof Uint8Array)||initial.byteLength!==firstBytes||
    new TextDecoder().decode(initial.subarray(0,5))!=='%PDF-')
  throw Error('R2_PDF_CABECERA_NO_VALIDA');
 let readBytes=initial.byteLength,calls=1,failed=null,task=null;
 let rejectDownload;
 const rejectedDownload=new Promise((_,reject)=>{rejectDownload=reject});
 // Observar siempre el rechazo, aun si getDocument falla antes.
 void rejectedDownload.catch(()=>{});
 const transport=new pdfjs.PDFDataRangeTransport(reader.bytes,initial);
 transport.requestDataRange=(begin,end)=>{
  (async()=>{
   try{
    if(failed)return;
    if(!Number.isSafeInteger(begin)||!Number.isSafeInteger(end)||
       begin<0||end<=begin||end>reader.bytes||
       end-begin>Math.min(reader.maxReadBytes||2*1024*1024,2*1024*1024)||
       ++calls>MAX_CALLS||readBytes+(end-begin)>MAX_BYTES_READ)
      throw Error('R2_PDF_RANGO_PRESUPUESTO');
    readBytes+=end-begin; // asignar cuota ANTES del GET
    const bytes=await reader.leer(begin,end-begin);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==end-begin)
      throw Error('R2_PDF_RANGO_TRUNCADO');
    if(!failed)transport.onDataRange(begin,bytes);
   }catch(error){
    if(!failed){
     failed=error;
     rejectDownload(error);
     void task?.destroy?.().catch(()=>{});
    }
   }
  })();
 };
 try{
  task=pdfjs.getDocument({
   range:transport,disableAutoFetch:true,disableStream:true,
   rangeChunkSize:65536,isEvalSupported:false,disableFontFace:true,
   stopAtErrors:true
  });
  const doc=await Promise.race([task.promise,rejectedDownload]);
  try{
   const pages=doc.numPages;
   if(!Number.isSafeInteger(pages)||pages<1||pages>maxPages)
    throw Error('R2_PDF_PAGINAS_NO_ADMITIDAS');
   const paginas=[];
   for(let pageNo=1;pageNo<=pages;pageNo++){
    const p=await Promise.race([doc.getPage(pageNo),rejectedDownload]);
    try{
     const v=p.getViewport({scale:1});
     const anchoCm=v.width*2.54/72,altoCm=v.height*2.54/72;
     if(!Number.isFinite(anchoCm)||!Number.isFinite(altoCm)||
        anchoCm<=0||altoCm<=0||anchoCm>2000||altoCm>2000)
      throw Error('R2_PDF_DIMENSIONES_INVALIDAS');
     paginas.push(Object.freeze({numero:pageNo,
      anchoCm:round(anchoCm),altoCm:round(altoCm)}));
    }finally{p.cleanup?.()}
   }
   return Object.freeze({
    paginas:Object.freeze(paginas),total:pages,
    bytes:reader.bytes,bytesLeidos:readBytes,solicitudesRango:calls,
    lector:'PDFJS_RANGOS_SIN_RENDER',
    verificacion:'METADATOS_SERVIDOR_PRELIMINARES',
    contenidoPdfVerificado:false,paymentAuthorized:false,
    aptoParaCobro:false,impresionAutomaticaAutorizada:false
   });
  }finally{await doc.destroy()}
 }finally{
  try{await task?.destroy?.()}catch{}
 }
}
