/**
 * Cliente TUS del cotizador V2 PRIVADO: reemplaza SOLO el transporte de PDFs.
 * Conserva análisis A4/A3, CAD/Póster, opciones y precio preliminar existentes.
 * No envía originales a Apps Script, no maneja pagos ni conoce service_role.
 *
 * Importar dinámicamente por el Worker cuando el flag de ensayo esté activo.
 */
const LIMIT=20*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const PDF=/\.pdf$/i;
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const call=async(path,body,fetcher)=>{
 const response=await fetcher(path,{
  method:'POST',credentials:'same-origin',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true)
  throw Error((data?.error||'No se pudo completar el ensayo TUS.')+
   (typeof data?.etapa==='string'&&/^[A-Z0-9_]{3,40}$/.test(data.etapa)?' ['+data.etapa+']':''));
 return data;
};
export function normalizarTrabajoTUS(d,plan){
 const r=d?.reference,meta=plan?.meta;
 if(!r||!meta||!FILE.test(meta.fileId||'')||
    !['bn','color'].includes(meta.mode)||!SHA.test(meta.sha256||'')||
    typeof meta.name!=='string'||!PDF.test(meta.name)||meta.name.length>120||
    meta.sha256!==r.sha256||meta.name!==r.nombre||meta.bytes!==r.bytes||
    !Number.isSafeInteger(r.paginas)||r.paginas<1||r.paginas>2000||
    !Number.isSafeInteger(meta.bytes)||meta.bytes<5||meta.bytes>LIMIT||
    !d.archivoLocal||d.archivoLocal.name!==meta.name||d.archivoLocal.size!==meta.bytes)
  throw Error('Archivo local no corresponde al presupuesto.');
 const options=plan?.opcionesKey&&plan.opcionesKey!=='null'
  ?JSON.parse(plan.opcionesKey):null;
 const plot=d.ploteo||null;
 if(!plot&&!options)throw Error('Opciones de impresión incompletas.');
 const opcionTUS={
  servicio:'auto',seleccion:plot?'original':options.formato,
  paginasSeleccionadas:'',copias:plot?plot.copias:options.copias,
  modo:meta.mode,caras:plot?'simple':options.caras,
  paginasPorHoja:plot?1:(options.paginasPorHoja??1),
  papelPoster:plot?plot.papelPoster:'obra80',
  anillado:plot?'ninguno':options.anillado,grupoAnillado:'',
  materialColor:plot?'obra70':options.materialColor,
  productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1,
  ...(plot?{clasificacionCliente:plot.clasificacionCliente}:{})
 };
 if(!Number.isSafeInteger(opcionTUS.copias)||opcionTUS.copias<1||
    opcionTUS.copias>200||
    !['simple','double'].includes(opcionTUS.caras)||
    !['a5','a4','a3','original'].includes(opcionTUS.seleccion)||
    !['ninguno','individual'].includes(opcionTUS.anillado))
  throw Error('Opciones TUS incompatibles.');
 return {
  d,archivo:d.archivoLocal,
  meta:{fileId:meta.fileId,name:meta.name,mode:meta.mode,
   bytes:meta.bytes,sha256:meta.sha256,pages:r.paginas},
  opciones:opcionTUS
 };
}
export async function enviarPedidoTUSV2({
 orderId,clientOrderId,trabajos,onProgress=()=>{},
 fetcher=fetch,loadUploader=()=>import('https://releases.transloadit.com/uppy/v3.6.1/uppy.min.mjs')
}={}){
 if(!WEB.test(orderId||'')||!UUID.test(clientOrderId||'')||
    !Array.isArray(trabajos)||trabajos.length<1||trabajos.length>10||
    typeof onProgress!=='function')throw Error('Pedido privado de PDF incorrecto.');
 const ids=new Set();let totalBytes=0;
 for(const t of trabajos){
  if(!t?.archivo||!t.meta||ids.has(t.meta.fileId)||
     typeof t.archivo.arrayBuffer!=='function'||t.archivo.size!==t.meta.bytes)
   throw Error('Trabajo TUS duplicado o sin archivo.');
  ids.add(t.meta.fileId);totalBytes+=t.meta.bytes;
 }
 if(totalBytes>60*1024*1024)throw Error('Tanda mayor que 60 MiB.');
 const mod=await loadUploader();
 if(typeof mod?.Uppy!=='function'||typeof mod?.Tus!=='function')
  throw Error('Cargador TUS no disponible.');
 const {Uppy,Tus}=mod;
 onProgress({phase:'autorizacion',count:trabajos.length,total:trabajos.length});
 const started=await call('/prueba-v2/api/ensayo-tus-iniciar',{
  orderId,metas:trabajos.map(t=>t.meta)
 },fetcher);
 if(started.orderId!==orderId||started.sessions?.length!==trabajos.length||
    started.paymentAuthorized!==false||
    !/^[a-z0-9]{20,}$/.test(started.projectRef||'')||
    typeof started.publishableKey!=='string'||!started.publishableKey||
    started.bucket!=='saber-tus-lab')
  throw Error('El almacenamiento respondió con una sesión incompatible.');
 for(let i=0;i<trabajos.length;i++){
  const r=started.sessions[i],m=trabajos[i].meta;
  if(r.fileId!==m.fileId||r.bytes!==m.bytes||r.pages!==m.pages||
    typeof r.signature!=='string'||!r.signature||
    typeof r.proof!=='string'||!r.proof||
    typeof r.objectName!=='string'||!r.objectName.startsWith('v2/'+orderId+'/'))
   throw Error('Firma de archivo incompatible con el trabajo.');
 }
 const uppy=new Uppy({
  autoProceed:false,
  restrictions:{minNumberOfFiles:trabajos.length,maxNumberOfFiles:trabajos.length,
   maxFileSize:LIMIT,allowedFileTypes:['.pdf','application/pdf']}
 });
 uppy.use(Tus,{
  endpoint:'https://'+started.projectRef+'.storage.supabase.co/storage/v1/upload/resumable/sign',
  headers:file=>({apikey:started.publishableKey,
   'x-signature':file.meta.labSignature}),
  uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
  retryDelays:[0,1000,3000,5000],chunkSize:6*1024*1024,limit:2,
  allowedMetaFields:['bucketName','objectName','contentType','cacheControl']
 });
 const t0=performance.now();
 const statuses=new Map();
 uppy.on('upload-progress',(file,p)=>{
  statuses.set(file.id,p.bytesUploaded||0);
  const bytes=[...statuses.values()].reduce((n,v)=>n+v,0);
  onProgress({phase:'transferencia',bytesUploaded:bytes,totalBytes,
   percent:Math.min(100,Math.floor(100*bytes/totalBytes))});
 });
 try{
  trabajos.forEach((t,i)=>{
   const r=started.sessions[i],id=uppy.addFile({
    name:t.archivo.name,data:t.archivo,type:'application/pdf',
    source:'saber-privado'
   });
   uppy.setFileMeta(id,{
    bucketName:started.bucket,objectName:r.objectName,
    contentType:'application/pdf',cacheControl:'0',labSignature:r.signature
   });
  });
  const completed=await uppy.upload();
  if(completed.failed?.length||completed.successful?.length!==trabajos.length)
   throw Error('No se completaron todos los PDF en Supabase.');
  onProgress({phase:'servidor',count:trabajos.length,total:trabajos.length});
  // La respuesta definitiva viene del MOTOR ACTUAL, que vuelve a leer
  // TODOS los archivos, verifica SHA+páginas+medidas y recalcula precios.
  const finalized=await call('/prueba-v2/api/ensayo-tus-registrar',{
   orderId,clientOrderId,
   entries:trabajos.map((t,i)=>({
    proof:started.sessions[i].proof,opciones:t.opciones
   }))
  },fetcher);
  if(finalized.webOrderId!==orderId||
     finalized.archivosVerificados!==trabajos.length||
     !Number.isSafeInteger(finalized.totalArs)||finalized.totalArs<1||
     finalized.checkoutEnabled!==false||finalized.paymentAuthorized!==false||
     finalized.listoParaProducir!==false||
     typeof finalized.orderId!=='string')
   throw Error('La Central no devolvió un pedido completo y sin cobro.');
  onProgress({phase:'registrado',count:trabajos.length,total:trabajos.length,
   tiempoMs:Math.round(performance.now()-t0)});
  return Object.freeze(finalized);
 }finally{
  // Uppy no conserva los objetos File luego de un ensayo exitoso.
  // Si falla el stage, los originales siguen en Supabase en bucket privado
  // para conciliación del operador, nunca se borran a ciegas.
  uppy.close?.();
 }
}
