/**
 * Lectura de páginas local y preliminar: NO sube archivos, NO confirma precios ni pagos.
 * Usa pdf-lib empaquetado junto con el frontend y procesa con concurrencia acotada.
 * Nunca se aceptan estas páginas como recibos confiables para checkout.
 */
import {PDFDocument} from 'pdf-lib';

export async function leerPaginasLocales(archivos,{concurrencia=2,maxArchivos=30,maxBytesPorArchivo=100*1024*1024,onProgreso=()=>{}}={}){
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
      throw Error('Archivo PDF no admitido o demasiado grande.');
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
    resultado.error=/encrypted|password|encrypt/i.test(String(e?.message||e))
      ?'PDF protegido: necesitaremos otro archivo sin contraseña.'
      :'No pudimos leer las páginas de este PDF.';
   }
   resultados[indice]=resultado;
   terminados++;
   onProgreso({terminados,total:archivos.length,resultado:{...resultado}});
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrencia,archivos.length)},()=>trabajador()));
 return {
  documentos:resultados,
  paginasTotales:resultados.reduce((n,x)=>n+(x.paginas||0),0),
  completos:resultados.every(x=>x.estado==='preliminar'),
  estado:'SOLO_PRELIMINAR',
  aptoParaCobro:false
 };
}
