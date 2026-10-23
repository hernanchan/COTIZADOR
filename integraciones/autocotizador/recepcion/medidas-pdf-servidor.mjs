/** Dimensiones de páginas leídas de bytes PRIVADOS de Drive, no desde el cliente.
 * Sin análisis de cobertura/rótulos no clasificamos automáticamente CAD o Póster:
 * "sin-clasificar" obliga a revisión cuando la cotización requiere esa distinción.
 */
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
export async function medidasPdfServidor(bytes,{parser=PDFDocument.load,maxPaginas=2000}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<5||
    String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
  throw Error('El PDF privado no contiene una cabecera válida.');
 let pdf;
 try{pdf=await parser(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true})}
 catch(_){throw Error('El servidor no puede analizar este PDF.');}
 const n=pdf.getPageCount();
 if(!Number.isSafeInteger(n)||n<1||n>maxPaginas)throw Error('Cantidad de páginas fuera del límite.');
 const pageMetrics=[];
 for(let i=0;i<n;i++){
  const p=pdf.getPage(i);
  const media=p.getMediaBox(),crop=p.getCropBox();
  const valido=Number.isFinite(crop.width)&&Number.isFinite(crop.height)&&
   crop.width>0&&crop.height>0&&crop.x>=media.x-0.01&&crop.y>=media.y-0.01&&
   crop.x+crop.width<=media.x+media.width+0.01&&crop.y+crop.height<=media.y+media.height+0.01;
  const box=valido?crop:media;
  const unit=p.node.get(PDFName.of('UserUnit'));
  const factor=unit instanceof PDFNumber?unit.asNumber():1;
  const rotation=((p.getRotation().angle%360)+360)%360;
  if(!Number.isFinite(factor)||factor<=0||factor>75000||![0,90,180,270].includes(rotation))
   throw Error('La escala o rotación del PDF requiere revisión.');
  const swap=rotation===90||rotation===270;
  const anchoCm=Math.round((swap?box.height:box.width)*factor*2.54/72*1000)/1000;
  const altoCm=Math.round((swap?box.width:box.height)*factor*2.54/72*1000)/1000;
  if(!Number.isFinite(anchoCm)||!Number.isFinite(altoCm)||anchoCm<=0||altoCm<=0||
     anchoCm>2000||altoCm>2000)throw Error('Medidas físicas fuera de rango.');
  pageMetrics.push({anchoCm,altoCm,modo:'sin-clasificar'});
 }
 return Object.freeze({pageCount:n,pageMetrics});
}
