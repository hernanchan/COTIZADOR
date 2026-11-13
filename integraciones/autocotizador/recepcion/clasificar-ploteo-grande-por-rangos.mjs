/**
 * Clasificación visual LOCAL de PDF ploteo >40 MiB y varias páginas.
 * PDF.js recibe sólo rangos File.slice, no un arrayBuffer del original.
 * Hasta 12 páginas y 128 MiB de lectura acumulada. No sube bytes ni imágenes.
 * Conservador: si cualquier página falla, no emite clasificación de lote.
 * No modifica tarifas, no autoriza pago o impresión sin validación posterior.
 */
import {clasificarCoberturaPloteo} from './clasificar-cobertura-ploteo.mjs';
import {ajustarPlanoTecnicoPorPagina} from './regla-comercial-ploteos.mjs';

const MIB=1048576,MAX_READ=128*MIB,MAX_CALLS=1500,MAX_PAGES=12;
const WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function clasificarPloteoGrandePorRangos(file,{
 paginas,seleccionadas=null,pdfjs=globalThis.pdfjsLib,
 signal=null,maxAnalysisMs=12000,
 createCanvas=()=>document.createElement('canvas'),
 onProgreso=()=>{}
}={}){
 if(!file||typeof file.slice!=='function'||
    !Number.isSafeInteger(file.size)||file.size<=40*MIB||file.size>200*MIB||
    !/\.pdf$/i.test(String(file.name||''))||
    !Array.isArray(paginas)||paginas.length<1||paginas.length>MAX_PAGES||
    paginas.some((p,i)=>p?.numero!==i+1||
      !Number.isFinite(p?.anchoCm)||!Number.isFinite(p?.altoCm)||
      p.anchoCm<=0||p.altoCm<=0)||
    typeof pdfjs?.getDocument!=='function'||
    typeof pdfjs?.PDFDataRangeTransport!=='function')
  return null;
 const targets=seleccionadas===null?paginas.map(p=>p.numero):seleccionadas;
 if(!Array.isArray(targets)||!targets.length||targets.length>MAX_PAGES||
    targets.some(n=>!Number.isSafeInteger(n)||n<1||n>paginas.length)||
    new Set(targets).size!==targets.length)return null;
 let readBytes=0,calls=0,failed=null,task=null,doc=null;
 let timedOut=false,timer=null,onAbort=null;
 const stopped=new Promise((_,reject)=>{
  timer=setTimeout(()=>{timedOut=true;reject(Error('PLOTEO_ANALISIS_LENTO'))},
   Math.min(30000,Math.max(3000,Number(maxAnalysisMs)||12000)));
  if(signal){
   onAbort=()=>{timedOut=true;reject(Error('PLOTEO_ANALISIS_CANCELADO'))};
   signal.addEventListener('abort',onAbort,{once:true});
   if(signal.aborted)onAbort();
  }
 });
 void stopped.catch(()=>{});
 const wait=p=>Promise.race([p,failedRanges,stopped]);
 let rejectRanges;
 const failedRanges=new Promise((_,reject)=>{rejectRanges=reject});
 void failedRanges.catch(()=>{});
 const get=async(offset,length)=>{
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||
    length<1||length>2*MIB||offset<0||offset+length>file.size||
    ++calls>MAX_CALLS||readBytes+length>MAX_READ)
   throw Error('PLOTEO_RANGOS_LIMITE_LECTURA');
  readBytes+=length;
  const part=file.slice(offset,offset+length,'application/octet-stream');
  if(part.size!==length)throw Error('PLOTEO_RANGO_INVALIDO');
  const value=new Uint8Array(await part.arrayBuffer());
  if(value.byteLength!==length)throw Error('PLOTEO_RANGO_INCOMPLETO');
  return value;
 };
 try{
  const initial=await Promise.race([get(0,Math.min(65536,file.size)),stopped]);
  if(new TextDecoder().decode(initial.subarray(0,5))!=='%PDF-')return null;
  if(typeof window!=='undefined'&&typeof document!=='undefined'&&
     pdfjs.GlobalWorkerOptions)pdfjs.GlobalWorkerOptions.workerSrc=WORKER;
  const transport=new pdfjs.PDFDataRangeTransport(file.size,initial);
  transport.requestDataRange=(begin,end)=>{
   (async()=>{
    try{
     if(failed)return;
     const bytes=await get(begin,end-begin);
     if(!failed)transport.onDataRange(begin,bytes);
    }catch(err){
     if(!failed){
      failed=err;rejectRanges(err);
      void task?.destroy?.().catch(()=>{});
     }
    }
   })();
  };
  task=pdfjs.getDocument({range:transport,disableAutoFetch:true,disableStream:true,
   rangeChunkSize:65536,isEvalSupported:false,disableFontFace:true,stopAtErrors:true});
  doc=await wait(task.promise);
  if(doc.numPages!==paginas.length||doc.numPages>MAX_PAGES)return null;
  const resultado=[];
  for(const n of targets){
   const page=await wait(doc.getPage(n));
   const viewportRaw=page.getViewport({scale:1});
   if(!Number.isFinite(viewportRaw.width)||!Number.isFinite(viewportRaw.height)||
       viewportRaw.width<=0||viewportRaw.height<=0)return null;
   const scale=360/Math.max(viewportRaw.width,viewportRaw.height);
   const viewport=page.getViewport({scale});
   const canvas=createCanvas();
   let context;
   try{
    canvas.width=Math.max(1,Math.ceil(viewport.width));
    canvas.height=Math.max(1,Math.ceil(viewport.height));
    context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return null;
    context.fillStyle='#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    await wait(page.render({canvasContext:context,viewport,
     background:'rgb(255,255,255)'}).promise);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    const cls=ajustarPlanoTecnicoPorPagina(
     clasificarCoberturaPloteo(pixels,{ancho:canvas.width,alto:canvas.height}));
    if(!['cad','poster'].includes(cls.modo)||
       !Number.isFinite(cls.cobertura)||cls.cobertura<=0)
      return null;
    resultado.push(Object.freeze({numero:n,modo:cls.modo,
     cobertura:cls.cobertura,plenoContinuo:cls.plenoContinuo}));
    onProgreso({terminadas:resultado.length,total:targets.length,
     numeroPagina:n,originales:doc.numPages});
   }finally{
    canvas.width=0;canvas.height=0;
    page.cleanup?.();
   }
  }
  return Object.freeze({altaConfianza:true,metodo:'VISUAL_PDFJS_RANGOS',
   paginas:Object.freeze(resultado),bytesLeidos:readBytes,
   solicitudesRango:calls,originalSubido:false,
   permiteImprimirSinRevisar:false});
 }catch{return null}
 finally{
  clearTimeout(timer);
  if(signal&&onAbort)signal.removeEventListener('abort',onAbort);
  // Evitar que la limpieza asíncrona de un parser atascado mantenga bloqueada
  // la pantalla. Detener el worker sin esperar el resultado si venció el plazo.
  if(timedOut){
   try{void task?.destroy?.()?.catch?.(()=>{})}catch{}
  }else{
   try{await doc?.destroy?.()}catch{}
   try{await task?.destroy?.()}catch{}
  }
 }
}
