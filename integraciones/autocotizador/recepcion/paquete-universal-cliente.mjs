/**
 * Personal: ZIP production download with numbered, original PDFs + A4 sheet.
 * Paid mixed batches stay PREPRESS PENDING until operator verifies contents.
 * Desktop Chrome/Edge stream 2 GiB directly to disk. No files in cloud ZIP.
 */
import {escribirZipUniversal} from './zip-universal-stream.mjs';
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
const $=id=>document.getElementById(id);
const webOrderId=new URL(location.href).searchParams.get('webOrderId')||'';
const liveStaff=location.pathname==='/personal/paquete';
const packageAPI=liveStaff?'/personal/api/live-paquete':'/prueba-v2/api/ensayo-universal-paquete-personal';
const originalAPI=liveStaff?'/personal/api/live-descargar':'/prueba-v2/api/ensayo-universal-descargar-personal';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const MiB=1048576;
const button=$('zip'),state=$('estado'),number=$('numero'),detail=$('detalle');
let ficha=null,active=false;
const name=i=>'PDF_'+String(i+1).padStart(2,'0')+'.pdf';
async function post(route,body){
 const response=await fetch(route,{method:'POST',credentials:'same-origin',
  cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error('La Central no confirmó el pedido. HTTP '+response.status);
 return response;
}
export function convertirTrabajoZIPUniversal(t){
 const c=t?.configuracion,d=t?.detalle;
 if(!c||!d||!Array.isArray(c.paginas)||!c.paginas.length||
    !Array.isArray(t.paginasElegidas)||!t.paginasElegidas.length||
    typeof t.nombreOriginal!=='string')
  throw Error('Instrucciones del archivo incompletas');
 return {orden:t.orden,nombreOriginal:t.nombreOriginal,servicio:t.servicio,
  paginasOriginales:c.paginas.length,paginasElegidas:t.paginasElegidas,
  copias:c.copias,formatoFinal:t.formatoFinal,modo:c.modo,
  carasPresupuestadas:c.caras,paginasPorCaraPresupuestadas:c.paginasPorHoja||1,
  material:c.modo==='bn'?'estandar':c.materialColor,
  tipoAnillado:c.anillado,grupoAnillado:c.grupoAnillado,
  planoPorPagina:t.servicio==='ploteos'?d.paginas?.map((p,i)=>({
   numeroOriginal:t.paginasElegidas[i],modo:p.modo,anchoCm:p.anchoCm,
   altoCm:p.altoCm,rollo:p.material,papel:p.papel
  })):null,
  medidasOriginalesCm:c.paginas.map(p=>({pagina:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm})),
  descripcion:'Pedido PDF universal. Original y preprensa requieren control antes de imprimir.'};
}
function resumirPaginasElegidas(paginas){
 if(!Array.isArray(paginas)||paginas.length===0)return 'SIN PÁGINAS: revisar';
 const ranges=[];
 let start=null,last=null;
 const push=()=>{
  if(start!==null)ranges.push(start===last?String(start):String(start)+'-'+String(last));
 };
 for(const n of paginas){
  if(!Number.isSafeInteger(n)||n<1)throw Error('Páginas seleccionadas inválidas');
  if(last!==null&&n===last+1){last=n;continue}
  push();start=n;last=n;
 }
 push();
 return ranges.join(', ');
}
function validarZIPDeProduccion(entries,ficha,instruccion){
 if(entries.length!==ficha.trabajos.length+1||
    entries.length<2||entries.length>11||
    entries.some((entry,i)=>i<ficha.trabajos.length&&entry.name!==name(i))||
    entries.at(-1)?.name!=='ORDEN_'+ficha.numeroOrden+'_INSTRUCCIONES.pdf'||
    !(instruccion instanceof Blob)||instruccion.size<400)
  throw Error('ZIP incompleto: falta original o instrucciones de impresión');
}
function filas(t,i){
 const config=t.configuracion,details=t.detalle;
 const values=[
  ['Archivo de este ZIP',name(i)],
  ['Original del cliente',t.nombreOriginal],
  ['Servicio',t.servicio==='ploteos'?'Ploteo CAD/Póster':'Impresión A4/A3'],
  ['Páginas originales',config.paginas.length],
  ['Páginas elegidas',resumirPaginasElegidas(t.paginasElegidas)],
  ['Tamaño final',t.formatoFinal==='original'?'Tamaño real / 100 %':String(t.formatoFinal).toUpperCase()+' (aplicar a TODAS las páginas, incluso originales mixtos)'],
  ['Copias',config.copias],
  ['Color',config.modo==='bn'?'Blanco y negro':'Color'],
  ['Caras',config.caras==='double'?'Doble faz':'Simple faz'],
  ['Páginas por cara',config.paginasPorHoja||1],
  ['Papel impresión',config.modo==='bn'?'Estándar':config.materialColor||'Verificar'],
  ['Anillado',config.anillado==='ninguno'?'Sin anillado':
   config.anillado==='individual'?'Por archivo':'Grupo '+String(config.grupoAnillado||'?')],
  ['Control obligatorio','NO IMPRIMIR hasta verificar medida real, escala, composición, color, papel y original']
 ];
 if(t.servicio==='ploteos'){
  values.push(['Escala del ploteo','100 % / tamaño real. No ajustar a papel ni recortar']);
  if(!Array.isArray(details.paginas)||details.paginas.length!==t.paginasElegidas.length)
   throw Error('Faltan las instrucciones de rollos y páginas');
  details.paginas.forEach((p,k)=>{
   values.push(['Página '+t.paginasElegidas[k],
    (p.modo==='cad'?'CAD':'Póster')+' · '+p.anchoCm+' x '+p.altoCm+
    ' cm · Rollo '+p.material+' · '+(p.papel==='recubierto'?'Recubierto':'Obra 80 g')]);
  });
 }else{
  values.push(['Escala documental',
   config.paginasPorHoja>1?'Múltiples páginas por hoja. Vista previa obligatoria':
   t.formatoFinal==='a4'?
    'PAPEL A4: ajustar proporcionalmente CADA página al A4, orientar automáticamente, no recortar. Originales Legal u otros tamaños también van en A4; comprobar vista previa.':
   ['a5','personalizado_a4'].includes(t.formatoFinal)?
    'Tamaño real / 100 %; no ampliar':'Ajustar proporcionalmente sin recortar']);
 }
 return values;
}
function instruccionesPdf(f){
 const mapped=f.trabajos.map(convertirTrabajoZIPUniversal);
 const enriched={...f,trabajos:mapped,
  estadoPago:'PAGADO_VERIFICADO',pagoVerificado:true};
 const lines=f.trabajos.map(filas);
 const instruction=generarPdfOrdenTrabajo(enriched,lines);
 if(!(instruction instanceof Blob)||instruction.size<400||instruction.size>2*MiB)
  throw Error('La hoja A4 no pudo generarse');
 return instruction;
}
async function obtenerArchivo(t){
 const response=await post(originalAPI,{
  webOrderId,fileId:t.fileId});
 if(!response.headers.get('Content-Type')?.startsWith('application/pdf')||
    !response.body)
  throw Error('El archivo no fue validado por el servidor: '+t.orden);
 const length=Number(response.headers.get('Content-Length'));
 if(!Number.isSafeInteger(length)||length!==t.bytes)
  throw Error('El archivo no coincide en tamaño: '+t.orden);
 return response;
}
async function descargarZIP(){
 if(active||!ficha)return;
 active=true;button.disabled=true;
 let writer=null;
 try{
  const sum=ficha.trabajos.reduce((a,t)=>a+t.bytes,0);
  if(sum<5||sum>2200*MiB)throw Error('Tamaño de paquete inválido');
  const instruccion=instruccionesPdf(ficha);
  const nombre='ORDEN_'+ficha.numeroOrden+'.zip';
  if(typeof window.showSaveFilePicker==='function'){
   const handle=await window.showSaveFilePicker({
    suggestedName:nombre,
    types:[{description:'ZIP de originales e instrucciones',accept:{'application/zip':['.zip']}}]
   });
   writer=await handle.createWritable();
   const entries=ficha.trabajos.map((t,i)=>({
    name:name(i),expectedBytes:t.bytes,expectedSha256:t.sha256,
    open:async()=>{state.textContent='Verificando '+name(i)+' desde la Central…';
     return (await obtenerArchivo(t)).body;}
   }));
   entries.push({name:'ORDEN_'+ficha.numeroOrden+'_INSTRUCCIONES.pdf',
    expectedBytes:instruccion.size,expectedSha256:null,
    open:async()=>instruccion.stream()});
   validarZIPDeProduccion(entries,ficha,instruccion);
   const written=await escribirZipUniversal({entries,output:writer,
    onProgress:p=>{state.textContent='ZIP '+p.file+'/'+p.count+' · '+
     Math.round(p.bytes/MiB)+' / '+Math.round(p.totalBytes/MiB)+' MiB'}});
   writer=null;
   if(!written.ok||written.files!==entries.length)throw Error('ZIP incompleto');
   state.textContent='ZIP completo guardado: '+nombre+'. Los originales conservan sus bytes. PREPRENSA PENDIENTE: no imprimir sin revisar.';
  }else{
   if(sum+instruccion.size>150*MiB)
    throw Error('Para este tamaño usá Chrome o Edge en una computadora. Tu navegador no permite guardar el ZIP grande en streaming.');
   const entries=[];
   for(let i=0;i<ficha.trabajos.length;i++){
    const t=ficha.trabajos[i],response=await obtenerArchivo(t);
    const blob=await response.blob();
    if(blob.size!==t.bytes||await sha256PdfLocalPorFragmentos(blob)!==t.sha256)
     throw Error('El PDF original '+t.orden+' no coincidió con la Central');
    entries.push({name:name(i),blob});
   }
   entries.push({name:'ORDEN_'+ficha.numeroOrden+'_INSTRUCCIONES.pdf',blob:instruccion});
   validarZIPDeProduccion(entries,ficha,instruccion);
   const zip=await crearZipSinCompresion(entries,{maxBytes:160*MiB});
   const url=URL.createObjectURL(zip),a=document.createElement('a');
   a.href=url;a.download=nombre;document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   state.textContent='ZIP completo preparado. PREPRENSA PENDIENTE: revisar antes de imprimir.';
  }
 }catch(e){
  if(writer&&typeof writer.abort==='function')await writer.abort().catch(()=>{});
  const msg=e?.name==='AbortError'?'El operador canceló el guardado.':
   String(e?.message||e);
  state.textContent='ZIP no completado: '+msg+' No se modificó ningún original.';
 }finally{active=false;button.disabled=false}
}
button?.addEventListener('click',()=>void descargarZIP());
(async()=>{
 try{
  if(liveStaff&&!webOrderId){
   state.textContent='Elegí una orden pagada en la lista de inspección R2 que aparece abajo, o ingresá desde la Central de Pedidos. No hace falta copiar referencias.';
   return;
  }
  if(!WEB.test(webOrderId))throw Error('Número de pedido inválido');
  const r=await post(packageAPI,{webOrderId});
  const x=await r.json();
  if(x?.ok!==true||x.schema!=='saber-central-r2-universal-package-manifest-v1'||
     x.webOrderId!==webOrderId||x.estadoPago!=='PAGADO_VERIFICADO'||
     x.pagoVerificado!==true||x.preprensaPendiente!==true||
     !/^\d{3,}$/.test(x.numeroOrden||'')||
     !Array.isArray(x.trabajos)||x.trabajos.length<1||
     x.trabajos.length>10||
     x.trabajos.some((t,i)=>t.orden!==i+1||
      !SHA.test(t.sha256||'')||!['tus','r2'].includes(t.transporte)))
   throw Error('La ficha del pedido no es válida');
  ficha=x;number.textContent='Orden '+x.numeroOrden;
  detail.textContent=x.trabajos.length+' PDF · $'+x.importe+
   ' · '+x.trabajos.filter(t=>t.transporte==='r2').length+' R2 y '+
   x.trabajos.filter(t=>t.transporte==='tus').length+' TUS';
  state.textContent='Todos los originales tienen recibo verificado. Descargá el ZIP y controlá la preprensa.';
  button.disabled=false;
 }catch(e){
  const r2File=new URL(location.href).searchParams.get('fileId')||'';
  state.textContent=liveStaff&&/^[A-Za-z0-9_-]{1,80}$/.test(r2File)?
   'Primero inspeccioná el PDF R2 en el panel de abajo. El ZIP se habilita automáticamente después de registrar la inspección.':
   'No se habilita el ZIP: '+String(e?.message||e);
 }
})();
