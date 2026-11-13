/** Normaliza JPG/PNG en PDF imprimibles, SOLO en memoria del comprador.
 * El servidor, TUS, R2 y el ZIP mantienen su contrato de PDF verificado.
 * No sustituye el editor Polaroids ni aplica precios o pagos.
 */
import {PDFDocument} from 'pdf-lib';

const MAX_FOTOS=30,MAX_GRUPO=10,MAX_BYTES_IMAGEN=25*1024*1024;
const MAX_BYTES_PDF=200*1024*1024;
const PNG=[137,80,78,71,13,10,26,10];
const esImagen=f=>/\.(jpe?g|png)$/i.test(f?.name||'');
const esPdf=f=>/\.pdf$/i.test(f?.name||'');
function formato(bytes,nombre){
 const png=PNG.every((n,i)=>bytes[i]===n);
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(/\.png$/i.test(nombre)&&png)return 'png';
 if(/\.jpe?g$/i.test(nombre)&&jpg)return 'jpg';
 throw Error('La imagen '+nombre+' no coincide con un JPG o PNG válido.');
}
async function crearPdfImagenes(imagenes,num,{independiente=false}={}){
 const pdf=await PDFDocument.create();
 for(const file of imagenes){
  if(!Number.isSafeInteger(file.size)||file.size<50||file.size>MAX_BYTES_IMAGEN)
   throw Error('Imagen fuera del máximo de 25 MB: '+file.name);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const tipo=formato(bytes,file.name);
  let image;
  try{image=tipo==='png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes)}
  catch{throw Error('No pudimos leer la imagen '+file.name+'.')}
  if(!(image.width>0&&image.height>0)||image.width*image.height>90000000)
   throw Error('La imagen '+file.name+' supera la resolución admitida.');
  // Página con proporción original, sin recorte ni ampliación artificial.
  // El cliente elige después A4/A3 o servicio Fotos y composición 1/2/4/9.
  const scale=Math.min(595.28/image.width,841.89/image.height);
  const width=Math.max(1,image.width*scale),height=Math.max(1,image.height*scale);
  const page=pdf.addPage([width,height]);
  page.drawImage(image,{x:0,y:0,width,height});
 }
 pdf.setTitle('Imágenes para impresión - Librería Saber');
 const bytes=await pdf.save({useObjectStreams:true});
 if(bytes.length<100||bytes.length>MAX_BYTES_PDF)
  throw Error('El PDF de imágenes supera el máximo de 200 MB.');
 const original=independiente?String(imagenes[0]?.name||'imagen').replace(/\.(jpe?g|png)$/i,'').replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(0,75):'';
 const name=independiente?'imagen-'+String(num).padStart(2,'0')+'-'+original+'.pdf':
  'imagenes-'+String(num).padStart(2,'0')+'-'+imagenes.length+'-fotos.pdf';
 return new File([bytes],name,{type:'application/pdf'});
}
/** Devuelve PDF originales sin cambios. Por defecto cada JPG/PNG es un trabajo
 * autónomo, con modo, copias y papel propios. Sólo al elegir explícitamente
 * configuración común se agrupan fotos contiguas (hasta 10 por PDF).
 * Se conserva el orden original y ninguna imagen se envía al servidor.
 */
export async function normalizarArchivosImpresion(files,{agruparImagenes=false}={}){
 if(!Array.isArray(files)||files.length<1) return {files:[],images:0};
 if(typeof agruparImagenes!=='boolean')throw Error('Modo de imágenes inválido');
 const imageCount=files.filter(esImagen).length;
 if(imageCount>MAX_FOTOS)throw Error('Máximo 30 imágenes JPG/PNG por selección.');
 const result=[],grupo=[];
 let number=0;
 const flush=async()=>{
  if(!grupo.length)return;
  result.push(await crearPdfImagenes(grupo,++number,{independiente:!agruparImagenes}));
  grupo.length=0;
 };
 for(const file of files){
  if(esImagen(file)){
   grupo.push(file);
   if(!agruparImagenes||grupo.length===MAX_GRUPO)await flush();
  }else if(esPdf(file)){
   await flush();
   result.push(file);
  }else throw Error('Sólo se admiten PDF, JPG y PNG.');
 }
 await flush();
 return {files:result,images:imageCount};
}
