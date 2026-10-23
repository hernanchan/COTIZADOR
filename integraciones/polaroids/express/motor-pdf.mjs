/**
 * Polaroids Express · motor de PDF para ejecutar SOLO en backend.
 * No necesita originales, recortes individuales guardados ni encuadres JSON.
 * Consume recortes JPEG 886x886, genera hojas A4 guillotinables (6 por hoja).
 * No retorna ningún documento al cliente; el adaptador privado lo persiste.
 */
export const EXPRESS=Object.freeze({
 maxFotos:24,maxHojas:4,porHoja:6,
 anchoHojaMm:210,altoHojaMm:297,
 anchoPolaroidMm:85,altoPolaroidMm:90,
 imagenMm:75,imagenMargenIzquierdoMm:5,imagenMargenSuperiorMm:4,
 ladoRecortePx:886,maxRecorteBytes:450000,
 precioPorHoja:3000,maxPdfBytes:12*1024*1024
});
const pt=mm=>mm*72/25.4;
const validJpeg=bytes=>bytes instanceof Uint8Array&&bytes.byteLength>=80&&
 bytes.byteLength<=EXPRESS.maxRecorteBytes&&
 bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
export function verificarHojasExpress(hojas){
 if(!Array.isArray(hojas)||hojas.length<1||hojas.length>EXPRESS.maxHojas)
  throw Error('Polaroids Express admite entre 1 y 4 hojas A4.');
 let fotos=0;
 hojas.forEach((hoja,i)=>{
  if(!Array.isArray(hoja)||hoja.length<1||hoja.length>6||
     (i<hojas.length-1&&hoja.length!==6)||
     hoja.some(x=>!validJpeg(x)))
   throw Error('Cada hoja requiere hasta 6 recortes JPEG optimizados.');
  fotos+=hoja.length;
 });
 if(fotos<1||fotos>EXPRESS.maxFotos)
  throw Error('Máximo 24 fotografías por pedido Express.');
 return Object.freeze({fotos,hojas:hojas.length,precioOrientativo:hojas.length*EXPRESS.precioPorHoja});
}
function marcas(page,{rgb,x0,y0}){
 const xCuts=[x0,x0+85,x0+170];
 const yCuts=[y0,y0+90,y0+180,y0+270];
 const black=rgb(0.07,0.07,0.07),thickness=pt(.20);
 const H=EXPRESS.altoHojaMm;
 const line=(x1,y1,x2,y2)=>page.drawLine({
  start:{x:pt(x1),y:pt(H-y1)},end:{x:pt(x2),y:pt(H-y2)},
  thickness,color:black
 });
 // Marcas fuera de las Polaroids, una sola marca por guillotinado.
 for(const x of xCuts){
  line(x,y0-3.5,x,y0-.8);
  line(x,y0+270+.8,x,y0+270+3.5);
 }
 for(const y of yCuts){
  line(x0-3.5,y,x0-.8,y);
  line(x0+170+.8,y,x0+170+3.5,y);
 }
}
/** La biblioteca `pdf-lib` se inyecta en el Worker, nunca en el navegador. */
export async function generarPdfExpress({hojas,pdfLib}){
 const resumen=verificarHojasExpress(hojas);
 if(!pdfLib?.PDFDocument?.create||!pdfLib.rgb)
  throw Error('Motor PDF del servidor no disponible.');
 const pdf=await pdfLib.PDFDocument.create();
 pdf.setTitle('Polaroids Librería Saber');
 pdf.setSubject('Impresión privada A4 · 6 polaroids por hoja');
 // Fechas fijas: mismo material produce los mismos bytes en un reintento.
 pdf.setCreationDate(new Date('2020-01-01T00:00:00.000Z'));
 pdf.setModificationDate(new Date('2020-01-01T00:00:00.000Z'));
 pdf.setCreator('Libreria Saber Express');
 pdf.setProducer('Libreria Saber Express');
 for(let h=0;h<hojas.length;h++){
  const page=pdf.addPage([pt(210),pt(297)]);
  const x0=20,y0=13.5;
  for(let i=0;i<hojas[h].length;i++){
   const bytes=hojas[h][i];
   let image;
   try{image=await pdf.embedJpg(bytes)}
   catch(_){throw Error('El recorte no es un JPEG válido.');}
   if(image.width!==EXPRESS.ladoRecortePx||image.height!==EXPRESS.ladoRecortePx)
    throw Error('El recorte debe tener resolución de 886 × 886 píxeles.');
   const col=i%2,row=Math.floor(i/2);
   const x=x0+col*85+EXPRESS.imagenMargenIzquierdoMm;
   const y=y0+row*90+EXPRESS.imagenMargenSuperiorMm;
   page.drawImage(image,{
    x:pt(x),y:pt(297-y-EXPRESS.imagenMm),
    width:pt(EXPRESS.imagenMm),height:pt(EXPRESS.imagenMm)
   });
  }
  marcas(page,{rgb:pdfLib.rgb,x0,y0});
 }
 const bytes=new Uint8Array(await pdf.save({useObjectStreams:true}));
 if(bytes.length<100||bytes.length>EXPRESS.maxPdfBytes||
    String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
  throw Error('PDF final demasiado grande o inválido.');
 return Object.freeze({...resumen,pdfBytes:bytes});
}
/** El PDF se escribe UNA vez en Drive, únicamente desde el backend protegido. */
export async function guardarPedidoPdfExpress({
 referencia,hojas,pdfLib,guardarPdfPrivado,subtle=crypto.subtle
}){
 if(typeof referencia!=='string'||!/^POL-[A-F0-9]{24}$/.test(referencia)||
    typeof guardarPdfPrivado!=='function')
  throw Error('Recepción protegida Express no configurada.');
 const result=await generarPdfExpress({hojas,pdfLib});
 const hash=Array.from(new Uint8Array(await subtle.digest('SHA-256',result.pdfBytes)),
  x=>x.toString(16).padStart(2,'0')).join('');
 const receipt=await guardarPdfPrivado({
  referencia,
  archivo:referencia+'_IMPRIMIR.pdf',
  contenidoPdf:result.pdfBytes,
  bytes:result.pdfBytes.length,
  sha256:hash,
  paginas:result.hojas,
  fotos:result.fotos
 });
 if(!receipt||receipt.ok!==true||receipt.verified!==true||
    receipt.referencia!==referencia||receipt.sha256!==hash||
    receipt.bytes!==result.pdfBytes.length||receipt.paginas!==result.hojas)
  throw Error('Drive todavía no confirmó el PDF final.');
 // Nunca se entregan bytes del PDF ni una URL de descarga al cliente.
 return Object.freeze({
  ok:true,referencia,fotos:result.fotos,hojas:result.hojas,
  precioOrientativo:result.precioOrientativo,
  pdfPrivadoVerificado:true,permiteDescargaCliente:false,
  pdfSha256:hash,pdfTamanoBytes:result.pdfBytes.length
 });
}
