/**
 * Composición privada de PDF documental. Nunca expone ni descarga archivos
 * del comprador y NUNCA valida pagos: trabaja sólo con bytes previamente
 * comprobados por SHA-256 y número de páginas en el backend.
 *
 * 1/2/4/9 páginas por cara, copias y separación de juegos para doble faz.
 * PDF incrustado sin rasterización: preserva la nitidez vectorial original.
 */
import {PDFDocument} from 'pdf-lib';
const TAMANOS={a4:[595.275591,841.889764],a3:[841.889764,1190.551181]};
const OPCIONES=new Set([1,2,4,9]);
const MAX_BYTES=20*1024*1024,MAX_CARAS=2000;
const ok=n=>Number.isSafeInteger(n)&&n>0;
export async function componerDocumentoPdfPrivado({
 pdfOriginal,paginas,formatoHoja='a4',orientacion='vertical',
 paginasPorCara=1,copias=1,dobleFaz=false,margenMm=5
}){
 if(!(pdfOriginal instanceof Uint8Array)||pdfOriginal.length<30||
    pdfOriginal.length>MAX_BYTES)
  throw Error('PDF original sin verificación o fuera de cuota privada.');
 if(!Array.isArray(paginas)||paginas.length<1||paginas.length>2000||
    paginas.some(p=>!ok(p))||new Set(paginas).size!==paginas.length)
  throw Error('Páginas inválidas, vacías o duplicadas.');
 if(!Object.hasOwn(TAMANOS,formatoHoja)||
    !['vertical','horizontal'].includes(orientacion)||
    !OPCIONES.has(paginasPorCara)||!ok(copias)||copias>200||
    typeof dobleFaz!=='boolean'||!Number.isFinite(margenMm)||
    margenMm<0||margenMm>20)
  throw Error('Opciones de composición no admitidas.');
 const cantidadCaras=Math.ceil(paginas.length/paginasPorCara);
 const carasPorJuego=cantidadCaras+(dobleFaz&&cantidadCaras%2?1:0);
 if(carasPorJuego*copias>MAX_CARAS)throw Error('Trabajo fuera del máximo de caras.');
 let original;
 try{original=await PDFDocument.load(pdfOriginal,{updateMetadata:false})}
 catch{throw Error('PDF dañado o protegido: requiere revisión manual.')}
 if(paginas.some(p=>p>original.getPageCount()))
  throw Error('Páginas elegidas fuera del PDF original.');
 if(paginas.some(i=>{
  const angle=original.getPage(i-1).getRotation()?.angle||0;
  return !Number.isInteger(angle)||((angle%360+360)%360)!==0;
 }))throw Error('Páginas rotadas: requieren revisión para evitar cambios de diseño.');
 const out=await PDFDocument.create();
 // Un PDF válido puede tener páginas sin /Contents (completamente en blanco).
 // pdf-lib no permite incrustarlas; conservar su posición como espacio blanco
 // sin rasterizar ni desplazar el resto de las páginas.
 const positions=paginas.map((p,i)=>original.getPage(p-1).node.Contents()?i:-1)
  .filter(i=>i>=0);
 const sourcePages=positions.map(i=>paginas[i]-1);
 const embeddedNonBlank=sourcePages.length?
  await out.embedPdf(pdfOriginal,sourcePages):[];
 const embedded=paginas.map(()=>null);
 for(let i=0;i<positions.length;i++)embedded[positions[i]]=embeddedNonBlank[i];
 const size=TAMANOS[formatoHoja],landscape=orientacion==='horizontal';
 const width=landscape?size[1]:size[0],height=landscape?size[0]:size[1];
 const margin=margenMm*72/25.4,usableW=width-2*margin,usableH=height-2*margin;
 if(!(usableW>0&&usableH>0))throw Error('Sin superficie imprimible.');
 const cols=paginasPorCara===2?(landscape?2:1):Math.sqrt(paginasPorCara);
 const rows=paginasPorCara===2?(landscape?1:2):Math.sqrt(paginasPorCara);
 const boxW=usableW/cols,boxH=usableH/rows;
 const caras=[];
 for(let copy=0;copy<copias;copy++){
  for(let face=0;face<carasPorJuego;face++){
   const page=out.addPage([width,height]),layout=[];
   for(let pos=0;pos<paginasPorCara;pos++){
    const index=face*paginasPorCara+pos;
    if(index>=paginas.length)break;
    const embeddedPage=embedded[index];
    if(!embeddedPage){
     layout.push({paginaOriginal:paginas[index],posicion:pos+1,
      enBlanco:true,x:null,y:null,ancho:0,alto:0});
     continue;
    }
    if(!(embeddedPage.width>0&&embeddedPage.height>0))
     throw Error('Origen sin dimensiones válidas.');
    const scale=Math.min(boxW/embeddedPage.width,boxH/embeddedPage.height);
    const w=embeddedPage.width*scale,h=embeddedPage.height*scale;
    const col=pos%cols,row=Math.floor(pos/cols);
    const x=margin+col*boxW+(boxW-w)/2;
    const y=height-margin-(row+1)*boxH+(boxH-h)/2;
    if(x<0||y<0||x+w>width+0.001||y+h>height+0.001)
     throw Error('La página se sale del papel.');
    page.drawPage(embeddedPage,{x,y,width:w,height:h});
    layout.push({paginaOriginal:paginas[index],posicion:pos+1,
     x,y,ancho:w,alto:h});
   }
   caras.push({juego:copy+1,caraEnJuego:face+1,
    hojaEnJuego:dobleFaz?Math.floor(face/2)+1:face+1,
    lado:dobleFaz?(face%2?'dorso':'frente'):'frente',
    enBlanco:layout.length===0,paginas:layout});
  }
 }
 out.setProducer('Libreria Saber - ensayo privado sin liberacion comercial');
 const pdfBytes=await out.save({useObjectStreams:true});
 if(pdfBytes.length>90*1024*1024)
  throw Error('Archivo de impresión excede el máximo del ensayo.');
 return Object.freeze({pdfBytes,ficha:Object.freeze({
  schema:'saber-documentos-pdf-compuesto-ensayo-v1',
  paginasOriginales:original.getPageCount(),paginasElegidas:[...paginas],
  formatoHoja,orientacion,paginasPorCara,copias,dobleFaz,margenMm,
  carasTotales:caras.length,
  hojasFisicas:copias*(dobleFaz?carasPorJuego/2:carasPorJuego),
  caras,
  pdfImprimibleVerificado:false,guardadoEnDrive:false,
  listoParaProducir:false,paymentAuthorized:false,
  estado:'PDF_COMPUESTO_LOCAL_NO_LIBERADO'
 })});
}
