/** TUS for the SMALL files of one already paid universal PDF order.
 * Reuses Supabase signed resumable sessions. Never calls the old
 * /ensayo-tus-registrar endpoint, which would create a second order.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const MIB=1048576;
async function post(fetcher,url,p){
 const r=await fetcher(url,{method:'POST',credentials:'same-origin',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
 const d=await r.json().catch(()=>null);
 if(!r.ok||d?.ok!==true)throw Error('TUS_UNIVERSAL_'+
  String(d?.error||'NO_DISPONIBLE').slice(0,100));
 return d;
}
export async function enviarTUSUniversalPagado({
 orderId,trabajos,fetcher=fetch,onProgress=()=>{},
 loadUploader=()=>import('https://releases.transloadit.com/uppy/v3.6.1/uppy.min.mjs')
}={}){
 if(!WEB.test(orderId||'')||!Array.isArray(trabajos)||
    trabajos.length<1||trabajos.length>10||
    typeof fetcher!=='function'||typeof onProgress!=='function')
  throw Error('TUS_UNIVERSAL_LOTE_INVALIDO');
 const seen=new Set();let bytes=0;
 for(const t of trabajos){
  const m=t?.meta;
  if(!m||!FILE.test(m.fileId||'')||seen.has(m.fileId)||
     !SHA.test(m.sha256||'')||
     !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>40*MIB||
     !Number.isSafeInteger(m.pages)||m.pages<1||m.pages>2000||
     typeof m.name!=='string'||!/\.pdf$/i.test(m.name)||m.name.length>120||
     !['bn','color'].includes(m.mode)||
     !t.file||t.file.name!==m.name||t.file.size!==m.bytes)
   throw Error('TUS_UNIVERSAL_PDF_INCOMPATIBLE');
  seen.add(m.fileId);bytes+=m.bytes;
 }
 if(bytes>60*MIB)throw Error('TUS_UNIVERSAL_LOTE_EXCEDE_CUPO');
 const r=await post(fetcher,'/prueba-v2/api/ensayo-tus-universal-iniciar',{
  orderId,metas:trabajos.map(x=>x.meta)});
 if(r.orderId!==orderId||r.sessions?.length!==trabajos.length||
    r.bucket!=='saber-tus-lab'||
    typeof r.publishableKey!=='string'||!r.publishableKey||
    !/^[a-z0-9]{20,}$/.test(r.projectRef||''))
  throw Error('TUS_UNIVERSAL_FIRMAS_INVALIDAS');
 const sessions=r.sessions;
 for(let i=0;i<sessions.length;i++){
  const s=sessions[i],m=trabajos[i].meta;
  if(s.fileId!==m.fileId||s.bytes!==m.bytes||s.pages!==m.pages||
     typeof s.signature!=='string'||!s.signature||
     typeof s.proof!=='string'||!s.proof||
     typeof s.objectName!=='string'||!s.objectName.startsWith('v2/'+orderId+'/'))
   throw Error('TUS_UNIVERSAL_RECIBO_AJENO');
 }
 const mod=await loadUploader();
 if(typeof mod?.Uppy!=='function'||typeof mod?.Tus!=='function')
  throw Error('TUS_UNIVERSAL_CARGADOR_NO_DISPONIBLE');
 const uppy=new mod.Uppy({autoProceed:false,restrictions:{
  minNumberOfFiles:trabajos.length,maxNumberOfFiles:trabajos.length,
  maxFileSize:40*MIB,allowedFileTypes:['.pdf','application/pdf']}});
 uppy.use(mod.Tus,{
  endpoint:'https://'+r.projectRef+'.storage.supabase.co/storage/v1/upload/resumable/sign',
  headers:f=>({apikey:r.publishableKey,'x-signature':f.meta.labSignature}),
  uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
  retryDelays:[0,1000,3000,5000],chunkSize:6*MIB,limit:2,
  allowedMetaFields:['bucketName','objectName','contentType','cacheControl']
 });
 const progress=new Map();
 uppy.on('upload-progress',(f,p)=>{
  progress.set(f.id,p.bytesUploaded||0);
  const done=[...progress.values()].reduce((a,b)=>a+b,0);
  onProgress({phase:'tus',bytesUploaded:done,totalBytes:bytes,
   percent:Math.floor(done*100/bytes)});
 });
 try{
  trabajos.forEach((t,i)=>{
   const s=sessions[i],id=uppy.addFile({
    name:t.file.name,data:t.file,type:'application/pdf',source:'saber-universal'
   });
   uppy.setFileMeta(id,{bucketName:r.bucket,objectName:s.objectName,
    contentType:'application/pdf',cacheControl:'0',labSignature:s.signature});
  });
  const done=await uppy.upload();
  if(done.failed?.length||done.successful?.length!==trabajos.length)
   throw Error('TUS_UNIVERSAL_ARCHIVOS_INCOMPLETOS');
  onProgress({phase:'verificacion',files:trabajos.length});
  // The dedicated endpoint verifies SHA, pages and physical dimensions and
  // links receipts to the already-paid commercialOrderId. NO second checkout.
  const linked=await post(fetcher,'/prueba-v2/api/ensayo-tus-universal-confirmar',{
   orderId,entries:sessions.map(s=>({proof:s.proof}))});
  if(linked.webOrderId!==orderId||linked.savedFiles!==trabajos.length||
     linked.productionAuthorized!==false||linked.receipts?.length!==trabajos.length||
     linked.receipts.some((x,i)=>x.fileId!==trabajos[i].meta.fileId||x.saved!==true))
   throw Error('TUS_UNIVERSAL_CENTRAL_NO_CONCILIA');
  return {ok:true,fileIds:linked.receipts.map(r=>r.fileId),
   savedFiles:linked.savedFiles,productionAuthorized:false};
 }finally{uppy.close?.()}
}
