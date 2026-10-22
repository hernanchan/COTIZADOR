/**
 * Detecta dimensiones físicas de cada página sin subir el PDF. Sólo preliminar.
 * Respeta CropBox visible, rotación de página y /UserUnit del PDF.
 * El cálculo debe verificarse nuevamente en backend al recibir originales.
 */
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';

export async function leerMedidasPloteo(file,{maxBytes=250*1024*1024,maxPaginas=2000}={}){
 if(!file||!/\.pdf$/i.test(String(file.name))||
    !Number.isSafeInteger(file.size)||file.size<5||file.size>maxBytes)
   throw Error('PDF inválido o mayor de 250 MB.');
 const buffer=await file.arrayBuffer();
 if(buffer.byteLength!==file.size||
    String.fromCharCode(...new Uint8Array(buffer,0,5))!=='%PDF-')
   throw Error('No se pudo leer el archivo PDF completo.');
 const pdf=await PDFDocument.load(buffer,{updateMetadata:false,throwOnInvalidObject:true});
 const total=pdf.getPageCount();
 if(total<1||total>maxPaginas)throw Error('El PDF tiene demasiadas páginas para este ensayo.');
 const paginas=[];
 for(let i=0;i<total;i++){
  const p=pdf.getPage(i);
  const box=p.getCropBox();
  const media=p.getMediaBox();
  // Usar región visible únicamente si la CropBox es válida y está dentro de MediaBox.
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
  const anchoCm=Math.round(anchoPt*2.54/72*1000)/1000;
  const altoCm=Math.round(altoPt*2.54/72*1000)/1000;
  if(!Number.isFinite(anchoCm)||!Number.isFinite(altoCm)||
    anchoCm<=0||altoCm<=0||anchoCm>2000||altoCm>2000)
   throw Error('Tamaño físico fuera del rango de ploteo.');
  paginas.push({numero:i+1,anchoCm,altoCm});
 }
 return {paginas,total,verificacion:'LOCAL_PRELIMINAR',aptoParaCobro:false};
}
