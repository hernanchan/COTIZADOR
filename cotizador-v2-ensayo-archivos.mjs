/**
 * Ensayo opt-in acoplado al cotizador público V2 SIN cambiar sus tarifas,
 * promociones, carrito ni flujo de compra.
 *
 * Analiza un PDF en memoria del navegador y propone número de páginas.
 * NO transmite el PDF, NO adjunta archivos al carrito y NO confirma
 * recepción, precio o producción. Antes de publicar, alojar pdf-lib
 * localmente en vez de utilizar la CDN de este prototipo.
 */
const LIB_URL='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const MAX_BYTES=20*1024*1024;
const MAX_PAGES=2000;
let libraryPromise=null;

function loadPdfLib(){
 if(globalThis.PDFLib?.PDFDocument)return Promise.resolve(globalThis.PDFLib);
 if(libraryPromise)return libraryPromise;
 libraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=LIB_URL;
  script.async=true;
  script.referrerPolicy='no-referrer';
  script.crossOrigin='anonymous';
  script.onload=()=>globalThis.PDFLib?.PDFDocument
   ?resolve(globalThis.PDFLib):reject(Error('No se cargó el lector de PDF.'));
  script.onerror=()=>reject(Error('No se pudo iniciar el lector de PDF.'));
  document.head.appendChild(script);
 }).catch(e=>{libraryPromise=null;throw e});
 return libraryPromise;
}

export async function leerPaginasPdfCotizador(file,{obtenerLibreria=loadPdfLib}={}){
 if(!file||!/\.pdf$/i.test(String(file.name||''))||
    !Number.isSafeInteger(file.size)||file.size<5||file.size>MAX_BYTES||
    typeof file.arrayBuffer!=='function')
  throw Error('Elegí un PDF de hasta 20 MB para este ensayo.');
 const array=await file.arrayBuffer();
 if(array.byteLength!==file.size||
    String.fromCharCode(...new Uint8Array(array,0,5))!=='%PDF-')
  throw Error('El archivo no es un PDF válido.');
 let pdf;
 try{
  const {PDFDocument}=await obtenerLibreria();
  pdf=await PDFDocument.load(array,{
   ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true
  });
 }catch(err){
  if(/encrypt|password|protected/i.test(String(err?.message||'')))
   throw Error('El PDF está protegido con contraseña y requiere revisión.');
  throw Error('No pudimos leer las páginas del PDF.');
 }
 const pages=pdf.getPageCount();
 if(!Number.isSafeInteger(pages)||pages<1||pages>MAX_PAGES)
  throw Error('El PDF excede el límite de páginas de este ensayo.');
 return Object.freeze({nombre:file.name,paginas:pages,bytes:file.size,
  verificacion:'LOCAL_PRELIMINAR',subido:false,pagoAutorizado:false});
}

export function montarAsistentePdf(app){
 if(!app||!app.isConnected||!app.querySelector('#pages')||
    app.querySelector('#saberEnsayoPdf'))return false;
 const pagesInput=app.querySelector('#pages');
 const host=pagesInput.closest('.card');
 if(!host)return false;
 const box=document.createElement('section');
 box.id='saberEnsayoPdf';
 box.className='card';
 box.style.cssText='border:1px solid #c8d8e7;background:#f4f8fc';
 const heading=document.createElement('strong');
 heading.textContent='Leer páginas de un PDF (prueba privada)';
 const note=document.createElement('p');
 note.style.cssText='font-size:12px;color:#596d80;line-height:1.45';
 note.textContent='El PDF se analiza en este dispositivo. No se sube, no se adjunta al carrito y deberás enviarlo al confirmar el trabajo. Podés seguir cotizando manualmente.';
 const label=document.createElement('label');
 label.className='field';
 label.textContent='Seleccionar un PDF · máximo 20 MB';
 const input=document.createElement('input');
 input.type='file';input.accept='.pdf,application/pdf';
 label.appendChild(input);
 const status=document.createElement('p');
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 status.style.cssText='font-size:12px;line-height:1.45;color:#0a3158';
 status.textContent='Sin archivo seleccionado.';
 box.append(heading,note,label,status);
 host.parentNode.insertBefore(box,host);
 let seq=0;
 input.onchange=async()=>{
  const current=++seq,file=input.files?.[0];
  if(!file){status.textContent='Sin archivo seleccionado.';return}
  const calculate=app.querySelector('#calc');
  if(calculate)calculate.disabled=true;
  status.textContent='Leyendo páginas del PDF…';
  try{
   const read=await leerPaginasPdfCotizador(file);
   if(current!==seq||!box.isConnected||!pagesInput.isConnected)return;
   pagesInput.value=String(read.paginas);
   status.textContent=read.nombre+' · '+read.paginas+' páginas detectadas. Precio preliminar: confirmá tamaño, B/N o color, material, caras y copias. El PDF no se envió.';
  }catch(e){
   if(current!==seq||!box.isConnected)return;
   status.textContent=String(e.message||'No se pudo leer el PDF.')+' Podés ingresar las páginas manualmente.';
  }finally{
   if(current===seq&&box.isConnected&&calculate)calculate.disabled=false;
  }
 };
 return true;
}
