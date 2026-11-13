/** Subida R2 LIVE luego de pago: re-selección PDF y SHA local completos.
 * Nunca guarda originales ni permite modo Sandbox. El multipart se inicia
 * solo después de verificar pago y reservar cuota en Central D1.
 */
import {leerPedidoPostpagoLive} from './recepcion-tus-live-cliente.mjs';
export {leerPedidoPostpagoLive} from './recepcion-tus-live-cliente.mjs';
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
import {enviarArchivoR2Grande} from './r2-pdf-grandes-cliente.mjs';
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const SHA=/^[a-f0-9]{64}$/;
const post=async(fetcher,data)=>{
 const r=await fetcher('/api/pedido/live/checkout',{method:'POST',
  credentials:'same-origin',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const result=await r.json().catch(()=>null);
 if(!r.ok||result?.ok!==true)throw Error('LIVE_R2_PAGO_NO_RESPONDE');
 return result;
};
export async function enviarPDFsR2PagadosLive({
 selectedFiles,storage=typeof sessionStorage==='undefined'?null:sessionStorage,
 origin=typeof location==='undefined'?null:location.origin,
 fetcher=fetch,hasher=sha256PdfLocalPorFragmentos,
 uploader=enviarArchivoR2Grande,onProgress=()=>{}
}={}){
 if(origin!==ORIGIN||!Array.isArray(selectedFiles)||
  typeof fetcher!=='function'||typeof hasher!=='function'||
  typeof uploader!=='function')
  throw Error('LIVE_R2_COMPRADOR_NO_VERIFICABLE');
 const {order,metas}=leerPedidoPostpagoLive(storage);
 const large=metas.filter(m=>m.transport==='r2');
 if(!large.length||selectedFiles.length!==large.length)
  throw Error('LIVE_R2_SELECCION_INCOMPLETA');
 const originals=[];
 for(const file of selectedFiles){
  if(!file||typeof file.slice!=='function'||!Number.isSafeInteger(file.size)||
    typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.pdf')||
    file.size<=40*1048576||file.size>200*1048576)
   throw Error('LIVE_R2_ARCHIVO_NO_VALIDO');
  const prefix=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...prefix)!=='%PDF-')throw Error('LIVE_R2_NO_PDF');
  const hash=await hasher(file,{onProgress:p=>onProgress({
   phase:'hash',name:file.name,...p})});
  if(!SHA.test(hash))throw Error('LIVE_R2_SHA_INVALIDO');
  originals.push({file,sha256:hash,used:false});
 }
 const jobs=[];
 for(const m of large){
  const match=originals.find(x=>!x.used&&x.file.name===m.name&&
   x.file.size===m.bytes&&x.sha256===m.sha256);
  if(!match)throw Error('LIVE_R2_ORIGINAL_DISTINTO');
  match.used=true;jobs.push({file:match.file,meta:m});
 }
 if(originals.some(x=>!x.used))throw Error('LIVE_R2_ORIGINAL_EXTRA');
 const status=await post(fetcher,{action:'status',
  webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId});
 if(status.webOrderId!==order.webOrderId||
  status.commercialOrderId!==order.commercialOrderId||
  status.estado!=='pagado_esperando_archivos'||status.uploadAuthorized!==true||
  status.productionAuthorized!==false||status.fileCount!==metas.length)
  throw Error('LIVE_R2_PAGO_NO_CONCILIADO');
 const results=[];
 const batchBytes=jobs.reduce((sum,j)=>sum+j.file.size,0);
 let confirmedBytes=0;
 for(let i=0;i<jobs.length;i++){
  const {file,meta}=jobs[i];
  const result=await uploader({file,orderId:order.webOrderId,
   fetcher,storage,origin,mode:'live',requireCentralStaging:true,
   meta:{fileId:meta.fileId,name:meta.name,mode:meta.mode,
    bytes:meta.bytes,sha256:meta.sha256,pages:meta.pages},
   onProgress:p=>{
    const current=Math.min(file.size,Math.max(0,Number(p.bytesUploaded)||0));
    const bytesUploaded=confirmedBytes+current;
    const batchPercent=Math.min(99,Math.floor(100*bytesUploaded/batchBytes));
    onProgress({index:i+1,total:jobs.length,...p,
     batchBytesUploaded:bytesUploaded,batchTotalBytes:batchBytes,
     batchPercent});
   }});
  if(result?.sha256Verificado!==true||result.sha256!==meta.sha256||
    result.bytes!==meta.bytes||result.stagedForCentral!==true||
    result.contenidoPdfVerificado!==false||result.registeredInD1!==false)
   throw Error('LIVE_R2_CENTRAL_NO_VERIFICO');
  confirmedBytes+=file.size;
  onProgress({phase:'archivo-verificado',index:i+1,total:jobs.length,
   batchBytesUploaded:confirmedBytes,batchTotalBytes:batchBytes,
   batchPercent:i===jobs.length-1?100:Math.min(99,Math.floor(100*confirmedBytes/batchBytes)),
   fileId:meta.fileId});
  results.push({fileId:meta.fileId,sha256Verificado:true,
   preprensaPendiente:true});
 }
 return {ok:true,stagedFiles:results.length,
  files:results,productionAuthorized:false,preprensaPendiente:true};
}
