/**
 * Lectura de páginas local y preliminar: NO sube archivos, NO confirma precios ni pagos.
 * Usa pdf-lib empaquetado junto con el frontend y procesa con concurrencia acotada.
 * Nunca se aceptan estas páginas como recibos confiables para checkout.
 */
import {PDFDocument} from 'pdf-lib';

export async function leerPaginasLocales(archivos,{concurrencia=2,maxArchivos=30,maxBytesPorArchivo=250*1024*1024,onProgreso=()=>{}}={}){
 if(!Array.isArray(archivos)||archivos.length===0||archivos.length>maxArchivos)
  throw Error('Seleccioná entre uno y '+maxArchivos+' archivos PDF.');
 if(!Number.isSafeInteger(concurrencia)||concurrencia<1||concurrencia>4)
  throw Error('Concurrencia inválida.');
 const resultados=new Array(archivos.length);
 let siguiente=0,terminados=0;
 async function trabajador(){
  while(siguiente<archivos.length){
   const indice=siguiente++,archivo=archivos[indice];
   const resultado={indice,nombre:String(archivo?.name||''),paginas:null,bytes:archivo?.size||0,estado:'error',error:null};
   try {
    if(!/\.pdf$/i.test(resultado.nombre)||!Number.isSafeInteger(archivo.size)||archivo.size<5||
      archivo.size>maxBytesPorArchivo||typeof archivo.arrayBuffer!=='function')
      throw Error('Este archivo no es un PDF válido o supera el límite de '+Math.round(maxBytesPorArchivo/1048576)+' MB.');
    // Procesamos cada PDF grande de forma secuencial para limitar picos de memoria.
    const buffer=await archivo.arrayBuffer();
    if(buffer.byteLength!==archivo.size)throw Error('La lectura quedó incompleta.');
    const inicio=new Uint8Array(buffer,0,Math.min(5,buffer.byteLength));
    if(String.fromCharCode(...inicio)!=='%PDF-')throw Error('Archivo sin cabecera PDF.');
    const doc=await PDFDocument.load(buffer,{updateMetadata:false,throwOnInvalidObject:true});
    const paginas=doc.getPageCount();
    if(!Number.isSafeInteger(paginas)||paginas<1||paginas>20000)
      throw Error('Cantidad de páginas no válida.');
    resultado.paginas=paginas;resultado.estado='preliminar';
   }catch(e){
    const detalle=String(e?.message||e);
    resultado.error=/encrypted|password|encrypt/i.test(detalle)
      ?'PDF protegido: necesitaremos otro archivo sin contraseña.'
      :/supera el límite/.test(detalle)?detalle
      :'No pudimos leer este PDF. Puede ser demasiado pesado para la memoria del dispositivo o estar dañado.';
   }
   resultados[indice]=resultado;
   terminados++;
   onProgreso({terminados,total:archivos.length,resultado:{...resultado}});
  }
 }
 const hayGrandes=archivos.some(f=>f&&f.size>40*1024*1024);
 await Promise.all(Array.from({length:hayGrandes?1:Math.min(concurrencia,archivos.length)},()=>trabajador()));
 return {
  documentos:resultados,
  paginasTotales:resultados.reduce((n,x)=>n+(x.paginas||0),0),
  completos:resultados.every(x=>x.estado==='preliminar'),
  estado:'SOLO_PRELIMINAR',
  aptoParaCobro:false
 };
}
