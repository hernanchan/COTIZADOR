/**
 * Analisis local de PDF grandes: NUNCA envia PDF a Cloudflare R2 ni al Worker.
 * Lee pocos fragmentos con File.slice y pasa PDFDataRangeTransport a PDF.js.
 * La cotizacion resultante es PRELIMINAR; no acredita páginas ante el servidor.
 */
import {inspeccionarMedidasPdfGrandePorRangos}
 from './medidas-pdf-grande-rangos.mjs';
const MIB=1024*1024,MB40=40*MIB,MB250=250*MIB;
const WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
export async function leerMedidasPdfGrandeLocal(file,{pdfjs=globalThis.pdfjsLib}={}){
 if(!file||typeof file.slice!=='function'||
   !Number.isSafeInteger(file.size)||file.size<=MB40||file.size>MB250||
   !/\.pdf$/i.test(String(file.name||''))||
   !pdfjs?.getDocument||!pdfjs?.PDFDataRangeTransport)
  throw Error('LECTURA_LOCAL_RANGOS_NO_DISPONIBLE');
 // El Worker JS de CDN sólo corresponde al navegador. En los tests
 // Node, pdfjs-dist usa su propio worker local (no admite URL HTTP).
 if(typeof window!=='undefined'&&typeof document!=='undefined'&&
    pdfjs.GlobalWorkerOptions)pdfjs.GlobalWorkerOptions.workerSrc=WORKER;
 const reader={
  bytes:file.size,maxReadBytes:2*MIB,
  async leer(offset,length){
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||
    offset<0||length<1||length>2*MIB||offset+length>file.size)
    throw Error('LECTURA_LOCAL_RANGO_INVALIDO');
   const fragment=file.slice(offset,offset+length,'application/octet-stream');
   if(fragment.size!==length||typeof fragment.arrayBuffer!=='function')
    throw Error('LECTURA_LOCAL_FRAGMENTO_INVALIDO');
   const bytes=new Uint8Array(await fragment.arrayBuffer());
   if(bytes.byteLength!==length)throw Error('LECTURA_LOCAL_FRAGMENTO_TRUNCADO');
   return bytes;
  }
 };
 const metrics=await inspeccionarMedidasPdfGrandePorRangos({reader,pdfjs});
 return Object.freeze({
  paginas:metrics.paginas,total:metrics.total,
  verificacion:'LOCAL_PRELIMINAR',lector:'PDFJS_FILE_SLICE',
  bytesAnalizados:metrics.bytesLeidos,fragmentosLeidos:metrics.solicitudesRango,
  aptoParaCobro:false,r2UploadPerformed:false
 });
}
