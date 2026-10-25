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
// Sólo en memoria de esta vista: la tienda jamás recibe los bytes del PDF.
const seleccionPorFormulario=new WeakMap();

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
  // Un PDF con cabecera válida puede fallar al leer su catálogo de páginas.
  // La revisión del árbol de páginas también debe estar protegida.
  const paginasLeidas=pdf.getPageCount();
  if(!Number.isSafeInteger(paginasLeidas)||paginasLeidas<1||paginasLeidas>MAX_PAGES)
   throw Error('El PDF excede el límite de páginas de este ensayo.');
  const fingerprint=new Uint8Array(await crypto.subtle.digest('SHA-256',array));
  const sha256=Array.from(fingerprint,b=>b.toString(16).padStart(2,'0')).join('');
  return Object.freeze({nombre:file.name,paginas:paginasLeidas,bytes:file.size,
   sha256,verificacion:'LOCAL_PRELIMINAR',subido:false,pagoAutorizado:false});
 }catch(err){
  if(/encrypt|password|protected/i.test(String(err?.message||'')))
   throw Error('El PDF está protegido con contraseña y requiere revisión.');
  throw Error('No pudimos leer las páginas del PDF.');
 }

}

export function montarAsistentePdf(app,{leer=leerPaginasPdfCotizador,antesDeCotizar=()=>{}}={}){
 if(!app||!app.isConnected||!app.querySelector('#pages')||
    app.querySelector('#saberEnsayoPdf'))return false;
 // El formulario se vuelve a crear al editar el trabajo: no heredar otro PDF.
 seleccionPorFormulario.delete(app);
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
 note.textContent='El PDF se analiza en este dispositivo. Al cotizar, su nombre se vincula a ese trabajo como pendiente de envío. No se sube a Drive, no se adjunta al carrito y deberás enviarlo para confirmarlo.';
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
 const calculate=app.querySelector('#calc');
 if(calculate&&typeof calculate.onclick==='function'){
  const original=calculate.onclick;
  calculate.onclick=function(event){
   const actual=seleccionPorFormulario.get(app);
   const pages=Number(pagesInput.value);
   const ref=actual&&Number.isSafeInteger(pages)&&pages===actual.paginas
    ?Object.freeze({...actual.referencia}):null;
   antesDeCotizar(ref);
   try{return original.call(this,event)}finally{antesDeCotizar(null)}
  };
 }
 let seq=0;
 input.onchange=async()=>{
  const current=++seq,file=input.files?.[0];
  seleccionPorFormulario.delete(app);
  if(!file){status.textContent='Sin archivo seleccionado.';
   const calculate=app.querySelector('#calc');if(calculate)calculate.disabled=false;
   return}
  const calculate=app.querySelector('#calc');
  if(calculate)calculate.disabled=true;
  status.textContent='Leyendo páginas del PDF…';
  try{
   const read=await leer(file);
   if(current!==seq||!box.isConnected||!pagesInput.isConnected)return;
   if(!Number.isSafeInteger(read.paginas)||read.paginas<1||
      !/^[a-f0-9]{64}$/.test(read.sha256||'')||
      !Number.isSafeInteger(read.bytes)||read.bytes<5||read.bytes>MAX_BYTES||
      read.verificacion!=='LOCAL_PRELIMINAR'||read.subido!==false||
      read.pagoAutorizado!==false)
    throw Error('La lectura no devolvió una referencia preliminar.');
   const id=globalThis.crypto?.randomUUID?.();
   if(!/^[a-f0-9-]{36}$/i.test(id||''))
    throw Error('No se pudo identificar el archivo de manera segura.');
   seleccionPorFormulario.set(app,{file,paginas:read.paginas,
    referencia:Object.freeze({schema:'saber-pdf-local-pendiente-v1',localRef:id,
     nombre:read.nombre.slice(0,180),bytes:read.bytes,sha256:read.sha256,
     paginas:read.paginas,estado:'PENDIENTE_DE_ENVIO',
     recibido:false,verificadoServidor:false})});
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
