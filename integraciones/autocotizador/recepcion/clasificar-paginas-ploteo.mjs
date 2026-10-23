import {clasificarCoberturaPloteo} from './clasificar-cobertura-ploteo.mjs';
import {contieneRotuloTecnico} from './refinar-tipo-plano.mjs';
import {ajustarPlanoTecnicoPorPagina} from './regla-comercial-ploteos.mjs';
// PDF.js fijado en una versión conocida; procesa las páginas localmente.
// No enviar bytes ni capturas del PDF a servicios externos.
const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
export async function clasificarPaginasPloteo(file,{onProgreso=()=>{},maxPaginas=2000}={}){
 const pdfjs=globalThis.pdfjsLib;
 if(!pdfjs?.getDocument)throw Error('No está disponible el analizador visual de PDF. Este documento requiere revisión de Librería Saber.');
 pdfjs.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
 const buffer=await file.arrayBuffer();
 const lector=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,disableFontFace:true});
 let pdf;
 try{
  pdf=await lector.promise;
  if(pdf.numPages<1||pdf.numPages>maxPaginas)throw Error('El PDF supera la cantidad de páginas admitidas.');
  const modos=[];
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);
   const v=page.getViewport({scale:1});
   if(!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<=0||v.height<=0)
    throw Error('No se puede analizar la dimensión visual.');
   const scale=360/Math.max(v.width,v.height);
   const viewport=page.getViewport({scale});
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.ceil(viewport.width));
   canvas.height=Math.max(1,Math.ceil(viewport.height));
   const context=canvas.getContext('2d',{willReadFrequently:true});
   if(!context)throw Error('El navegador no admite análisis visual de PDF.');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   await page.render({canvasContext:context,viewport,background:'rgb(255,255,255)'}).promise;
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
   const clasificacion=clasificarCoberturaPloteo(pixels,{ancho:canvas.width,alto:canvas.height});
   let rotuloTecnico=false;
   try{const texto=await page.getTextContent();rotuloTecnico=contieneRotuloTecnico((texto.items||[]).map(item=>item.str||'').join(' '));}catch(_){/* Sin rótulo comprobado, sin ajuste automático. */}
   modos.push({numero:i,...ajustarPlanoTecnicoPorPagina(clasificacion,{rotuloTecnico})});
   canvas.width=0;canvas.height=0;
   page.cleanup();
   onProgreso({terminadas:i,total:pdf.numPages,clasificacion});
  }
  return modos;
 }finally{
  if(pdf)await pdf.destroy();
  else await lector.destroy();
 }
}
