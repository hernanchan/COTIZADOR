/**
 * Detecta dimensiones físicas de cada página localmente, sin transmitir PDF.
 * Respeta CropBox visible, rotación de página y /UserUnit.
 * En casos donde pdf-lib no puede abrir un escaneo complejo, PDF.js permite
 * recuperar dimensiones para COTIZACIÓN PRELIMINAR; el backend verifica de nuevo.
 */
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';

function chequearDimensiones(anchoCm,altoCm){
 if(!Number.isFinite(anchoCm)||!Number.isFinite(altoCm)||
    anchoCm<=0||altoCm<=0||anchoCm>2000||altoCm>2000)
  throw Error('Tamaño físico fuera del rango de ploteo.');
 return {anchoCm:Math.round(anchoCm*1000)/1000,
  altoCm:Math.round(altoCm*1000)/1000};
}

/**
 * No renderizar visualmente miles de páginas A4/A3: la cobertura CAD/Póster
 * sólo define precio y rollo de trabajos mayores a A3.
 */
export function requiereClasificacionVisualPloteo(paginas){
 if(!Array.isArray(paginas)||!paginas.length)
  throw Error('Sin páginas para clasificar');
 return paginas.some(p=>Math.max(p.anchoCm,p.altoCm)>42.03||
  Math.min(p.anchoCm,p.altoCm)>29.73);
}

export async function recuperarMedidasConPdfJs(buffer,{maxPaginas=2000,
 pdfjs=globalThis.pdfjsLib}={}){
 if(!pdfjs?.getDocument)
  throw Error('El PDF necesita revisión: lector alternativo no disponible.');
 // PDF.js recibe su propia copia; su API puede transferir el ArrayBuffer
 // al worker, por lo que nunca cedemos el buffer original.
 const task=pdfjs.getDocument({
  data:new Uint8Array(buffer.slice(0)),
  isEvalSupported:false,disableFontFace:true
 });
 let doc;
 try{
  doc=await task.promise;
  const total=doc.numPages;
  if(!Number.isSafeInteger(total)||total<1||total>maxPaginas)
   throw Error('El PDF tiene demasiadas páginas para este ensayo.');
  const paginas=[];
  for(let i=1;i<=total;i++){
   const p=await doc.getPage(i);
   try{
    // PDF.js ya incorpora CropBox, rotación y UserUnit en el viewport.
    const view=p.getViewport({scale:1});
    const medidas=chequearDimensiones(view.width*2.54/72,view.height*2.54/72);
    paginas.push({numero:i,...medidas});
   }finally{p.cleanup?.()}
  }
  return {paginas,total,verificacion:'LOCAL_PRELIMINAR',
   lector:'PDFJS_ALTERNATIVO',aptoParaCobro:false};
 }finally{
  if(doc)await doc.destroy();
  else await task.destroy?.();
 }
}

export async function leerMedidasPloteo(file,{maxBytes=250*1024*1024,maxPaginas=2000,pdfjs=globalThis.pdfjsLib}={}){
 if(!file||!/\.pdf$/i.test(String(file.name))||
    !Number.isSafeInteger(file.size)||file.size<5||file.size>maxBytes)
   throw Error('PDF inválido o mayor de 250 MB.');
 const buffer=await file.arrayBuffer();
 if(buffer.byteLength!==file.size||
    String.fromCharCode(...new Uint8Array(buffer,0,5))!=='%PDF-')
   throw Error('No se pudo leer el archivo PDF completo.');
 let pdf;
 try{
  pdf=await PDFDocument.load(buffer,{updateMetadata:false,throwOnInvalidObject:true});
 }catch(error){
  if(/encrypt|password|protected|contraseña/i.test(String(error?.message||'')))
   throw Error('PDF protegido por contraseña: requiere revisión.');
  try{return await recuperarMedidasConPdfJs(buffer,{maxPaginas,pdfjs})}
  catch(otro){
   throw Error('No fue posible leer las dimensiones del PDF con ninguno de los lectores. '+
    String(otro?.message||otro));
  }
 }
 const total=pdf.getPageCount();
 if(total<1||total>maxPaginas)throw Error('El PDF tiene demasiadas páginas para este ensayo.');
 const paginas=[];
 for(let i=0;i<total;i++){
  const p=pdf.getPage(i);
  const box=p.getCropBox();
  const media=p.getMediaBox();
  const valido=Number.isFinite(box.width)&&Number.isFinite(box.height)&&
   box.width>0&&box.height>0&&box.x>=media.x-0.01&&box.y>=media.y-0.01&&
   box.x+box.width<=media.x+media.width+0.01&&box.y+box.height<=media.y+media.height+0.01;
  const rect=valido?box:media;
  const unidad=p.node.get(PDFName.of('UserUnit'));
  const factor=unidad instanceof PDFNumber?unidad.asNumber():1;
  if(!Number.isFinite(factor)||factor<=0||factor>75000)throw Error('Escala física PDF inválida.');
  const giro=((p.getRotation().angle%360)+360)%360;
  if(![0,90,180,270].includes(giro))throw Error('Rotación PDF no compatible.');
  const anchoPt=(giro===90||giro===270?rect.height:rect.width)*factor;
  const altoPt=(giro===90||giro===270?rect.width:rect.height)*factor;
  const medidas=chequearDimensiones(anchoPt*2.54/72,altoPt*2.54/72);
  paginas.push({numero:i+1,...medidas});
 }
 return {paginas,total,verificacion:'LOCAL_PRELIMINAR',
  lector:'PDF_LIB_PRINCIPAL',aptoParaCobro:false};
}
