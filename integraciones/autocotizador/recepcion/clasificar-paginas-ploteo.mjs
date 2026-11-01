import {clasificarCoberturaPloteo} from './clasificar-cobertura-ploteo.mjs';
import {contieneRotuloTecnico} from './refinar-tipo-plano.mjs';
import {ajustarPlanoTecnicoPorPagina} from './regla-comercial-ploteos.mjs';
import {evidenciaPlanoTecnico,esCadVectorialDenso,esCadPorEstructuraPDF,ameritaVerificarEstructura} from './discriminar-plano-denso.mjs';
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
   let rotuloTecnico=false,texto='',textos=0;
   try{
    const contenido=await page.getTextContent();
    textos=(contenido.items||[]).length;
    texto=(contenido.items||[]).map(item=>item.str||'').join(' ');
    rotuloTecnico=contieneRotuloTecnico(texto);
   }catch(_){/* Mantener clasificación visual ante textos ilegibles. */}
   let clasificada=ajustarPlanoTecnicoPorPagina(clasificacion,{rotuloTecnico});
   // Un PDF técnico puede contener decenas de miles de trazados rojos:
   // el color superficial NO significa Póster. Consultar los operadores
   // renderizados por PDF.js y excluir cualquier imagen o sombreado;
   // en caso de fallo, se mantiene la clasificación visual conservadora.
   if(ameritaVerificarEstructura({miniatura:clasificacion,texto,textos})){
    try{
     const operadores=await page.getOperatorList();
     if(esCadPorEstructuraPDF({miniatura:clasificacion,
       fnArray:operadores.fnArray,OPS:pdfjs.OPS,texto})){
      clasificada={...clasificada,modo:'cad',
       regla:'cad_vectorial_sin_imagenes',
       modoVisual:clasificacion.modo};
     }
    }catch(_){/* Nunca descartar un PDF si falla esta comprobación opcional. */}
   }
   // Sólo ante poster positivo CON rótulo de plano, un segundo muestreo
   // diferencia trama de líneas (cae fuerte al subir resolución) de tinta
   // plena (se mantiene). No rasterizar dos veces los demás documentos.
   if(clasificada.modo==='poster'&&clasificacion.modo==='poster'&&
      clasificacion.cobertura>=0.30&&evidenciaPlanoTecnico(texto)){
    const vAlta=page.getViewport({scale:720/Math.max(v.width,v.height)});
    const cAlta=document.createElement('canvas');
    cAlta.width=Math.max(1,Math.ceil(vAlta.width));
    cAlta.height=Math.max(1,Math.ceil(vAlta.height));
    try{
     const ctxAlta=cAlta.getContext('2d',{willReadFrequently:true});
     if(ctxAlta){
      ctxAlta.fillStyle='#fff';ctxAlta.fillRect(0,0,cAlta.width,cAlta.height);
      await page.render({canvasContext:ctxAlta,viewport:vAlta,
       background:'rgb(255,255,255)'}).promise;
      const pixelsAlta=ctxAlta.getImageData(0,0,cAlta.width,cAlta.height).data;
      const detalle=clasificarCoberturaPloteo(pixelsAlta,{
       ancho:cAlta.width,alto:cAlta.height
      });
      if(esCadVectorialDenso({miniatura:clasificacion,detalle,texto})){
       clasificada={...clasificada,modo:'cad',
        regla:'trama_vectorial_tecnica_dos_resoluciones',
        modoVisual:clasificacion.modo};
      }
     }
    }finally{cAlta.width=0;cAlta.height=0;}
   }
   modos.push({numero:i,...clasificada});
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
