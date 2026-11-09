/** One quote, one Sandbox checkout, mixed TUS/R2 upload AFTER payment.
 * For every PDF >40 MiB route R2 regardless of A4/A3/CAD/poster.
 * Never sends originals with a quote request.
 */
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
import {enviarArchivoR2Grande} from './r2-pdf-grandes-cliente.mjs';
import {enviarTUSUniversalPagado} from './tus-universal-directo-cliente.mjs';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9-]{36}$/i;
const MIB=1048576;
const money=x=>Number.isSafeInteger(x)&&x>0&&x<=50000000;
function mpUrl(value){
 let url;try{url=new URL(value)}catch{}
 if(!url||url.protocol!=='https:'||url.username||url.password||
    url.hash||!/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname))
  throw Error('UNIVERSAL_PAGO_URL_INSEGURA');
 return url.href;
}
async function post(fetcher,path,payload){
 const r=await fetcher(path,{method:'POST',redirect:'error',
  credentials:'same-origin',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>null);
 if(!r.ok||body?.ok!==true)
  throw Error('UNIVERSAL_'+String(body?.error||'SERVICIO_TEMPORALMENTE_NO_DISPONIBLE').slice(0,120));
 return body;
}
export function crearFlujoUniversalPDF({
 files,archivos,webOrderId,telefono,fetcher=fetch,
 hasher=sha256PdfLocalPorFragmentos,
 uploadR2=enviarArchivoR2Grande,uploadTus=enviarTUSUniversalPagado,
 uuid=()=>crypto.randomUUID(),
 onProgress=()=>{},onState=()=>{},
 storage=typeof sessionStorage==='undefined'?null:sessionStorage
}={}){
 if(!WEB.test(webOrderId||'')||typeof telefono!=='string'||
    !/^\+?[0-9 ()-]{10,26}$/.test(telefono)||
    telefono.replace(/\D/g,'').length<10||telefono.replace(/\D/g,'').length>15||
    !Array.isArray(files)||
    !Array.isArray(archivos)||files.length!==archivos.length||
    files.length<1||files.length>10||
    typeof fetcher!=='function'||typeof hasher!=='function'||
    typeof uploadR2!=='function'||typeof uploadTus!=='function'||
    typeof uuid!=='function'||typeof onState!=='function')
  throw Error('UNIVERSAL_LOTE_INVALIDO');
 let tusBytes=0,r2Count=0;
 for(let i=0;i<files.length;i++){
  const file=files[i],config=archivos[i];
  if(!file||typeof file.slice!=='function'||
     !Number.isSafeInteger(file.size)||file.size<5||file.size>200*MIB||
     typeof file.name!=='string'||!/\.pdf$/i.test(file.name)||file.name.length>120||
     !config||config.nombre!==file.name||
     !['bn','color'].includes(config.modo)||
     !Array.isArray(config.paginas)||!config.paginas.length||
     config.paginas.length>2000)
   throw Error('UNIVERSAL_ARCHIVOS_NO_COINCIDEN');
  if(file.size>40*MIB)r2Count++;
  else tusBytes+=file.size;
 }
 if(!r2Count||tusBytes>60*MIB)
  throw Error('UNIVERSAL_CUPO_RECEPCION_INVALIDO');
 let phase='seleccionado',draftId=null,quoteHash=null,
  commercialOrderId=null,numeroOrden=null,totalArs=null,
  checkoutUrl=null,plan=[],uploadComplete=new Set(),
  pendingTUS=false,lastError=null;
 const emit=()=>onState(Object.freeze({phase,webOrderId,numeroOrden,
  commercialOrderId,totalArs,checkoutUrl,
  receivedCount:uploadComplete.size,filesCount:files.length,lastError}));
 const transition=next=>{phase=next;emit()};
 emit();
 async function preparar(){
  if(phase!=='seleccionado')throw Error('UNIVERSAL_FASE_DE_PREPARACION');
  transition('calculando_hash');
  const manifests=[];
  const ids=new Set();
  for(let i=0;i<files.length;i++){
   const file=files[i],head=new Uint8Array(await file.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...head)!=='%PDF-')
    throw Error('UNIVERSAL_PDF_CABECERA_INVALIDA');
   const sha=await hasher(file,{onProgress:p=>onProgress({
    phase:'hash',index:i+1,count:files.length,...p
   })});
   if(!SHA.test(sha||''))throw Error('UNIVERSAL_SHA_NO_CONFIRMADO');
   const id='pdf_'+i+'_'+uuid().replaceAll('-','');
   if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||ids.has(id))throw Error('UNIVERSAL_ARCHIVO_ID');
   ids.add(id);
   manifests.push({fileId:id,nombre:file.name,bytes:file.size,sha256:sha});
  }
  plan=manifests.map((m,i)=>Object.freeze({
   ...m,transport:m.bytes>40*MIB?'r2':'tus',
   file:files[i],config:archivos[i]
  }));
  transition('registrando_presupuesto');
  const saved=await post(fetcher,'/prueba-v2/api/ensayo-r2-borrador-universal',{
   webOrderId,archivos,manifiestos:manifests});
  if(saved.webOrderId!==webOrderId||saved.fileCount!==files.length||
     !money(saved.totalArs)||!UUID.test(saved.draftId||'')||
     !SHA.test(saved.quoteHash||'')||
     saved.paymentAuthorized!==false||saved.checkoutEnabled!==false||
     saved.filesUploaded!==false)
   throw Error('UNIVERSAL_FICHA_D1_DISTINTA');
  draftId=saved.draftId;quoteHash=saved.quoteHash;
  const created=await post(fetcher,'/prueba-v2/api/ensayo-r2-orden-universal',{
   webOrderId,draftId,quoteHash,telefono});
  if(created.webOrderId!==webOrderId||!UUID.test(created.commercialOrderId||'')||
     created.fileCount!==files.length||created.totalArs!==saved.totalArs||
     !/^[0-9]{3,}$/.test(created.numeroOrden||'')||
     created.checkoutEnabled!==false||created.uploadAuthorized!==false||
     created.productionAuthorized!==false)
   throw Error('UNIVERSAL_ORDEN_COMERCIAL_DISTINTA');
  commercialOrderId=created.commercialOrderId;
  numeroOrden=created.numeroOrden;totalArs=created.totalArs;
  transition('presupuesto_sin_archivos');
  return {webOrderId,commercialOrderId,numeroOrden,totalArs,fileCount:files.length};
 }
 async function iniciarPagoSandbox(){
  if(phase!=='presupuesto_sin_archivos')
   throw Error('UNIVERSAL_PAGO_NO_PREPARADO');
  const r=await post(fetcher,'/prueba-v2/api/ensayo-r2-checkout-universal',{
   action:'start',webOrderId,commercialOrderId});
  if(r.webOrderId!==webOrderId||r.commercialOrderId!==commercialOrderId||
     r.amountArs!==totalArs||r.fileCount!==files.length||
     r.estado!=='pendiente'||r.uploadAuthorized!==false)
   throw Error('UNIVERSAL_PAGO_CENTRAL_NO_COINCIDE');
  checkoutUrl=mpUrl(r.checkoutUrl);
  transition('esperando_pago');
  return checkoutUrl;
 }
 async function consultarPago(){
  if(!['esperando_pago','pagado_esperando_archivos','subida_parcial','revocado'].includes(phase))
   throw Error('UNIVERSAL_PAGO_FASE_INVALIDA');
  const r=await post(fetcher,'/prueba-v2/api/ensayo-r2-checkout-universal',{
   action:'status',webOrderId,commercialOrderId});
  if(r.webOrderId!==webOrderId||r.commercialOrderId!==commercialOrderId||
     r.amountArs!==totalArs||r.fileCount!==files.length)
   throw Error('UNIVERSAL_ESTADO_PAGO_AJENO');
  if(r.estado==='revocado'&&r.uploadAuthorized===false){
   transition('revocado');return 'revocado';
  }
  if(r.estado==='pagado_esperando_archivos'&&r.uploadAuthorized===true){
   transition('pagado_esperando_archivos');return 'pagado';
  }
  if(r.estado==='pendiente'&&r.uploadAuthorized===false){
   transition('esperando_pago');return 'pendiente';
  }
  throw Error('UNIVERSAL_PAGO_CONTRADICTORIO');
 }
 async function subirArchivosPagados(){
  if(!['pagado_esperando_archivos','subida_parcial'].includes(phase))
   throw Error('UNIVERSAL_SUBIDA_BLOQUEADA_SIN_PAGO');
  transition('subiendo_originales');
  try{
   const tus=plan.filter(p=>p.transport==='tus'&&!uploadComplete.has(p.fileId));
   if(tus.length){
    if(pendingTUS)throw Error('UNIVERSAL_TUS_REQUIERE_REVISION_DE_REINTENTO');
    pendingTUS=true;
    const done=await uploadTus({orderId:webOrderId,
     trabajos:tus.map(p=>({file:p.file,meta:{
      fileId:p.fileId,name:p.nombre,mode:p.config.modo,
      bytes:p.bytes,sha256:p.sha256,pages:p.config.paginas.length
     }})),fetcher,onProgress:p=>onProgress({phase:'tus',...p})});
    if(done?.ok!==true||done.savedFiles!==tus.length||
       !Array.isArray(done.fileIds)||done.fileIds.length!==tus.length||
       tus.some((p,i)=>done.fileIds[i]!==p.fileId))
     throw Error('UNIVERSAL_TUS_RECIBO_INCONGRUENTE');
    for(const item of tus)uploadComplete.add(item.fileId);
    pendingTUS=false;
    emit();
   }
   for(const [i,p] of plan.entries()){
    if(p.transport!=='r2'||uploadComplete.has(p.fileId))continue;
    const result=await uploadR2({
     file:p.file,orderId:webOrderId,fetcher,storage,
     meta:{fileId:p.fileId,name:p.nombre,mode:p.config.modo,
      pages:p.config.paginas.length,bytes:p.bytes,sha256:p.sha256},
     requireCentralStaging:true,
     onProgress:x=>onProgress({phase:'r2',index:i+1,count:files.length,...x})
    });
    if(result?.sha256Verificado!==true||result.sha256!==p.sha256||
       result.bytes!==p.bytes||result.stagedForCentral!==true)
     throw Error('UNIVERSAL_R2_SIN_RECIBO');
    uploadComplete.add(p.fileId);emit();
   }
   if(uploadComplete.size!==plan.length)throw Error('UNIVERSAL_LOTE_INCOMPLETO');
   transition('originales_recibidos_preprensa_pendiente');
   return {ok:true,webOrderId,commercialOrderId,numeroOrden,
    fileCount:files.length,productionAuthorized:false};
  }catch(e){
   lastError=String(e?.message||'UNIVERSAL_RECEPCION_PENDIENTE').slice(0,160);
   transition('subida_parcial');
   throw e;
  }
 }
 return Object.freeze({get phase(){return phase},
  get totalArs(){return totalArs},get numeroOrden(){return numeroOrden},
  get commercialOrderId(){return commercialOrderId},
  get checkoutUrl(){return checkoutUrl},
  get webOrderId(){return webOrderId},
  get lastError(){return lastError},
  get receivedCount(){return uploadComplete.size},
  preparar,iniciarPagoSandbox,consultarPago,subirArchivosPagados});
}
