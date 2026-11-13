/** Retorno Mercado Pago: SOLO re-selección y revalidación de archivos TUS.
 * Nunca se fía del redirect, ni conserva archivos ni claves de servicio.
 * La autorización final de cada PDF la emite Central LIVE al Worker.
 */
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
const HOST='https://pedidos.libreriasaber.com.ar';
const ORDER=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIB=1048576;
const KEY='saber-live-archivos-v1';
const ORDER_KEY='saber-live-pedido-v1';
const validMeta=m=>m&&Object.keys(m).sort().join(',')==='bytes,fileId,mode,name,pages,sha256,transport'&&
 /^[A-Za-z0-9_-]{1,80}$/.test(m.fileId||'')&&
 typeof m.name==='string'&&m.name.length<=120&&/\.pdf$/i.test(m.name)&&
 SHA.test(m.sha256||'')&&['bn','color'].includes(m.mode)&&
 ['tus','r2'].includes(m.transport)&&
 Number.isSafeInteger(m.bytes)&&m.bytes>=5&&m.bytes<=200*MIB&&
 m.transport===(m.bytes<=40*MIB?'tus':'r2')&&
 Number.isSafeInteger(m.pages)&&m.pages>=1&&m.pages<=2000;
const post=async(fetcher,path,data)=>{
 const res=await fetcher(path,{method:'POST',credentials:'same-origin',
  redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const result=await res.json().catch(()=>null);
 if(!res.ok||result?.ok!==true)throw Error(String(result?.error||'LIVE_TUS_SERVICIO').slice(0,100));
 return result;
};
export function leerPedidoPostpagoLive(storage){
 let order,manifest;
 try{order=JSON.parse(storage.getItem(ORDER_KEY)||'null');
  manifest=JSON.parse(storage.getItem(KEY)||'null')}catch{}
 if(!order||Object.keys(order).sort().join(',')!=='commercialOrderId,webOrderId'||
  !ORDER.test(order.webOrderId||'')||!UUID.test(order.commercialOrderId||'')||
  !manifest||Object.keys(manifest).sort().join(',')!=='commercialOrderId,metas,webOrderId'||
  manifest.webOrderId!==order.webOrderId||
  manifest.commercialOrderId!==order.commercialOrderId||
  !Array.isArray(manifest.metas)||manifest.metas.length<1||manifest.metas.length>10||
  manifest.metas.some(m=>!validMeta(m))||
  new Set(manifest.metas.map(m=>m.fileId)).size!==manifest.metas.length)
  throw Error('LIVE_TUS_REFERENCIA_NO_DISPONIBLE');
 return {order:Object.freeze(order),metas:manifest.metas.map(x=>Object.freeze(x))};
}
export async function enviarPDFsTUSPagadosLive({
 selectedFiles,storage=sessionStorage,origin=location.origin,
 fetcher=fetch,hasher=sha256PdfLocalPorFragmentos,
 onProgress=()=>{},
 loadUploader=()=>import('https://releases.transloadit.com/uppy/v3.6.1/uppy.min.mjs')
}={}){
 if(origin!==HOST||!Array.isArray(selectedFiles)||
  typeof fetcher!=='function'||typeof hasher!=='function')
  throw Error('LIVE_TUS_ORIGEN_INVALIDO');
 const {order,metas}=leerPedidoPostpagoLive(storage);
 const tus=metas.filter(m=>m.transport==='tus'),r2=metas.filter(m=>m.transport==='r2');
 if(tus.length===0)throw Error('LIVE_TUS_SIN_ARCHIVOS_CHICOS');
 if(selectedFiles.length!==tus.length)throw Error('LIVE_TUS_SELECCION_INCOMPLETA');
 let total=0;
 const work=[],verified=[];
 // Puede haber dos PDF con el mismo nombre y tamaño en distintas carpetas.
 // Emparejar por SHA y consumir cada selección una sola vez.
 for(const f of selectedFiles){
  if(!f||typeof f.slice!=='function'||!Number.isSafeInteger(f.size)||
     !String(f.name||'').toLowerCase().endsWith('.pdf'))throw Error('LIVE_TUS_NO_ES_PDF');
  const header=new Uint8Array(await f.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...header)!=='%PDF-')throw Error('LIVE_TUS_NO_ES_PDF');
  const hash=await hasher(f,{onProgress:p=>onProgress({phase:'hash',file:f.name,...p})});
  if(!SHA.test(hash))throw Error('LIVE_TUS_SHA_INVALIDO');
  verified.push({file:f,hash,used:false});
 }
 for(const m of tus){
  const match=verified.find(v=>!v.used&&v.file.name===m.name&&
    v.file.size===m.bytes&&v.hash===m.sha256);
  if(!match)throw Error('LIVE_TUS_SHA_DISTINTO');
  match.used=true;total+=m.bytes;work.push({meta:m,file:match.file});
 }
 if(verified.some(v=>!v.used))throw Error('LIVE_TUS_ARCHIVO_EXTRA');
 if(total>60*MIB)throw Error('LIVE_TUS_CUPO_EXCEDIDO');
 // Esta respuesta procede de la conciliación en D1, nunca de parámetros MP.
 const status=await post(fetcher,'/api/pedido/live/checkout',{
  action:'status',webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId});
 if(status.webOrderId!==order.webOrderId||
  status.commercialOrderId!==order.commercialOrderId||
  status.estado!=='pagado_esperando_archivos'||status.uploadAuthorized!==true||
  status.productionAuthorized!==false||status.fileCount!==metas.length)
  throw Error('LIVE_TUS_PAGO_NO_CONCILIADO');
 const started=await post(fetcher,'/api/pedido/live/tus/iniciar',{orderId:order.webOrderId,
  metas:work.map(t=>({fileId:t.meta.fileId,name:t.meta.name,sha256:t.meta.sha256,
   bytes:t.meta.bytes,pages:t.meta.pages,mode:t.meta.mode}))});
 if(started.orderId!==order.webOrderId||started.sessions?.length!==work.length||
  started.bucket==='saber-tus-lab'||!/^[a-z0-9]{15,30}$/.test(started.projectRef||'')||
  started.projectRef==='qkbbqzbannyhuanngjpw'||
  typeof started.publishableKey!=='string'||started.publishableKey.length<30||
  started.productionAuthorized!==false||started.paymentAuthorized!==false)
  throw Error('LIVE_TUS_FIRMAS_NO_CONCILIAN');
 for(let i=0;i<work.length;i++){
  const m=work[i].meta,s=started.sessions[i];
  if(s.fileId!==m.fileId||s.bytes!==m.bytes||s.pages!==m.pages||
   typeof s.signature!=='string'||s.signature.length<12||
   typeof s.proof!=='string'||s.proof.length<40||
   typeof s.objectName!=='string'||
   !s.objectName.startsWith('v2/'+order.webOrderId+'/'))
   throw Error('LIVE_TUS_FIRMA_AJENA');
 }
 const mod=await loadUploader();
 if(typeof mod?.Uppy!=='function'||typeof mod?.Tus!=='function')
  throw Error('LIVE_TUS_CARGADOR_NO_DISPONIBLE');
 const uppy=new mod.Uppy({autoProceed:false,restrictions:{
  minNumberOfFiles:work.length,maxNumberOfFiles:work.length,
  maxFileSize:40*MIB,allowedFileTypes:['.pdf','application/pdf']}});
 uppy.use(mod.Tus,{
  endpoint:'https://'+started.projectRef+'.storage.supabase.co/storage/v1/upload/resumable/sign',
  headers:f=>({apikey:started.publishableKey,'x-signature':f.meta.liveSignature}),
  uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
  retryDelays:[0,1000,3000,5000],chunkSize:6*MIB,limit:2,
  allowedMetaFields:['bucketName','objectName','contentType','cacheControl']
 });
 const uploadedByFile=new Map();
 uppy.on('upload-progress',(f,p)=>{
  // Uppy informa bytes por ARCHIVO, no por lote. Sumar las cantidades
  // confirmadas sin duplicar y no declarar 100% hasta el recibo D1.
  const id=String(f?.id||''),length=Math.max(0,Number(f?.size)||0);
  const current=Math.min(length,Math.max(0,Number(p?.bytesUploaded)||0));
  uploadedByFile.set(id,Math.max(uploadedByFile.get(id)||0,current));
  const bytesUploaded=[...uploadedByFile.values()].reduce((a,b)=>a+b,0);
  const percent=Math.min(99,Math.floor(100*bytesUploaded/total));
  onProgress({phase:'upload',file:f?.name||'',bytesUploaded,totalBytes:total,percent});
 });
 try{
  work.forEach((w,i)=>{
   const s=started.sessions[i];
   const id=uppy.addFile({name:w.file.name,data:w.file,type:'application/pdf',
    source:'saber-live'});
   uppy.setFileMeta(id,{bucketName:started.bucket,objectName:s.objectName,
    contentType:'application/pdf',cacheControl:'0',liveSignature:s.signature});
  });
  const uploaded=await uppy.upload();
  if(uploaded.failed?.length||uploaded.successful?.length!==work.length)
   throw Error('LIVE_TUS_SUBIDA_INCOMPLETA');
  onProgress({phase:'verificando-recibos',bytesUploaded:total,totalBytes:total,percent:99});
  const done=await post(fetcher,'/api/pedido/live/tus/confirmar',{
   orderId:order.webOrderId,
   entries:started.sessions.map(s=>({proof:s.proof}))});
  if(done.webOrderId!==order.webOrderId||done.savedFiles!==work.length||
    done.productionAuthorized!==false||done.receipts?.length!==work.length||
    done.receipts.some((x,i)=>x.fileId!==work[i].meta.fileId||x.saved!==true))
   throw Error('LIVE_TUS_RECIBOS_INCONSISTENTES');
  onProgress({phase:'recibido',bytesUploaded:total,totalBytes:total,percent:100});
  return {ok:true,savedFiles:work.length,pendingR2:r2.length,
   productionAuthorized:false};
 }finally{uppy.close?.()}
}
