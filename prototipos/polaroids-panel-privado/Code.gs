/**
 * LIBRERÍA SABER — PANEL PRIVADO DE PEDIDOS POLAROIDS
 * Proyecto Apps Script INDEPENDIENTE de la recepción pública.
 * Implementar solo con acceso "Solo yo" / propietario, nunca "Cualquiera".
 *
 * Propiedades de este proyecto:
 * PANEL_OWNER_EMAIL = cuenta Google que administra las fotos
 * RECEIPT_FOLDER_ID = ID de carpeta "POLAROIDS - LIBRERIA SABER"
 *
 * Sin API pública de fotos. Toda operación comprueba cuenta, Drive privado,
 * integridad del pedido y transición de seña/producción.
 */
const PRIVATE_PRICE_PER_A4=3000;
const PRIVATE_DEPOSIT_PER_A4=1500;
const PRIVATE_MAX_ORDERS=100;
const PRIVATE_ORDER_PREFIX='PEDIDO_';
const PRIVATE_REFERENCE=/^POL-[A-F0-9]{24}$/;

function ownerContext_(){
 const prop=PropertiesService.getScriptProperties();
 const owner=String(prop.getProperty('PANEL_OWNER_EMAIL')||'').trim().toLowerCase();
 const folderId=String(prop.getProperty('RECEIPT_FOLDER_ID')||'').trim();
 const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 // Never substitute effective user: a public webapp running as owner might
 // have an owner effective account on behalf of an anonymous visitor.
 if(!owner||!active||owner!==active||!folderId)
  throw new Error('Acceso privado: iniciá sesión con la cuenta propietaria autorizada.');
 const folder=DriveApp.getFolderById(folderId);
 if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
  throw new Error('La carpeta principal de Polaroids debe ser privada.');
 return {prop,folder};
}
function doGet(){
 try{
  ownerContext_();
  return HtmlService.createHtmlOutputFromFile('Panel')
   .setTitle('Librería Saber · Pedidos Polaroids');
 }catch(_){
  return HtmlService.createHtmlOutput('Acceso privado no disponible. Abrí el panel desde la cuenta autorizada.');
 }
}
function states_(){
 return {
  pendiente_sena:'Pendiente de seña',
  sena_confirmada:'Seña confirmada',
  preparado:'Listo para entregar',
  entregado:'Entregado',
  anulado:'Anulado'
 };
}
function transitionMap_(){
 return {
  pendiente_sena:['sena_confirmada','anulado'],
  sena_confirmada:['pendiente_sena','preparado','anulado'],
  preparado:['sena_confirmada','entregado','anulado'],
  entregado:[],
  anulado:[]
 };
}
function validRef_(ref){
 if(typeof ref!=='string'||!PRIVATE_REFERENCE.test(ref))
  throw new Error('Referencia de pedido inválida.');
 return ref;
}
function validatedFileSet_(folder,ref){
 if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
  throw new Error('La carpeta del pedido dejó de ser privada.');
 const files=folder.getFiles(),orig=new Set(),cuts=new Set(),pdfs=[];
 let jsonFile=null,invalidReason='';
 while(files.hasNext()){
  const f=files.next(),name=f.getName();
  let m=/^FOTO_([1-9]\d{0,1})\.(jpg|png)$/i.exec(name);
  if(m){const idx=Number(m[1]);if(orig.has(idx))invalidReason='Originales duplicados';orig.add(idx);continue;}
  m=/^RECORTE_([1-9]\d{0,1})_300DPI\.jpg$/i.exec(name);
  if(m){const idx=Number(m[1]);if(cuts.has(idx))invalidReason='Recortes duplicados';cuts.add(idx);continue;}
  if(name==='encuadres.json'){if(jsonFile)invalidReason='Metadatos duplicados';jsonFile=f;continue;}
  if(/^POLAROIDS_A4_(?:[1-6]_FOTOS_IMPRIMIR|HOJA_\d\d_DE_\d\d)\.pdf$/i.test(name))
   pdfs.push({name,url:f.getUrl()});
 }
 const count=orig.size, sheets=count>0&&count<=60?Math.ceil(count/6):0;
 const exactly=Array.from({length:count},(_,i)=>i+1).every(i=>orig.has(i)&&cuts.has(i));
 if(cuts.size!==count||!exactly)invalidReason=invalidReason||'Originales o recortes incompletos';
 let metaValid=false;
 if(jsonFile){
  try{
   if(Number(jsonFile.getSize())>128000)throw new Error('Metadatos demasiado largos');
   const meta=JSON.parse(jsonFile.getBlob().getDataAsString('UTF-8'));
   metaValid=meta.reference===ref&&meta.sheets===sheets&&
    meta.photosCount===count&&Array.isArray(meta.photos)&&meta.photos.length===count;
  }catch(_){metaValid=false;}
 }
 if(!metaValid)invalidReason=invalidReason||'Metadatos incompletos';
 if(sheets<1||sheets>10)invalidReason=invalidReason||'Cantidad de fotos incorrecta';
 if(pdfs.length!==sheets)invalidReason=invalidReason||'Faltan hojas PDF';
 for(let i=0;i<sheets;i++){
  const expected=sheets===1?'POLAROIDS_A4_'+count+'_FOTOS_IMPRIMIR.pdf':
   'POLAROIDS_A4_HOJA_'+String(i+1).padStart(2,'0')+
   '_DE_'+String(sheets).padStart(2,'0')+'.pdf';
  if(!pdfs.some(p=>p.name===expected))invalidReason=invalidReason||'PDF de hoja '+(i+1)+' ausente';
 }
 pdfs.sort((a,b)=>a.name.localeCompare(b.name));
 return {complete:!invalidReason,reason:invalidReason,photos:count,sheets,
  originals:orig.size,crops:cuts.size,hasJson:!!jsonFile,pdfs};
}
function orderContext_(root,ref){
 const folders=root.getFoldersByName(PRIVATE_ORDER_PREFIX+ref);
 if(!folders.hasNext())throw new Error('No se encontró la carpeta privada del pedido.');
 const folder=folders.next();
 if(folders.hasNext())throw new Error('Hay carpetas duplicadas con la misma referencia.');
 return {folder,files:validatedFileSet_(folder,ref)};
}
function currentStatus_(prop,ref,complete){
 if(!complete)return'incompleto';
 const raw=prop.getProperty('PRIVATE_ADMIN_'+ref);
 if(!raw)return'pendiente_sena';
 let status;
 try{status=JSON.parse(raw).status}catch(_){throw new Error('Estado privado de pedido inválido.');}
 if(!Object.prototype.hasOwnProperty.call(states_(),status))
  throw new Error('Estado guardado no reconocido.');
 return status;
}
function listarPedidosPrivados(){
 const {prop,folder}=ownerContext_(),it=folder.getFolders(),results=[];
 let truncated=false;
 while(it.hasNext()){
  const f=it.next(),name=f.getName(),ref=name.slice(PRIVATE_ORDER_PREFIX.length);
  if(!name.startsWith(PRIVATE_ORDER_PREFIX)||!PRIVATE_REFERENCE.test(ref))continue;
  if(results.length>=PRIVATE_MAX_ORDERS){truncated=true;break;}
  try{
   const files=validatedFileSet_(f,ref),status=currentStatus_(prop,ref,files.complete);
   const canPrint=files.complete&&
    ['sena_confirmada','preparado','entregado'].includes(status);
   results.push({
    reference:ref,created:f.getDateCreated().getTime(),
    status,statusText:states_()[status]||'Recepción incompleta',
    reason:files.reason,photos:files.photos,sheets:files.sheets,
    originals:files.originals,crops:files.crops,hasJson:files.hasJson,
    pdfCount:files.pdfs.length,
    price:files.sheets*PRIVATE_PRICE_PER_A4,
    deposit:files.sheets*PRIVATE_DEPOSIT_PER_A4,
    canPrint,
    pdfs:canPrint?files.pdfs:[] // Never expose file URLs before seña.
   });
  }catch(_){
   results.push({reference:ref,created:f.getDateCreated().getTime(),
    status:'incompleto',statusText:'Revisar carpeta',reason:'No se pudo validar este pedido.',
    photos:0,sheets:0,originals:0,crops:0,pdfCount:0,
    price:0,deposit:0,canPrint:false,pdfs:[]});
  }
 }
 results.sort((a,b)=>b.created-a.created);
 return {orders:results,truncated};
}
function cambiarEstadoPedidoPrivado(ref,next){
 validRef_(ref);
 if(!Object.prototype.hasOwnProperty.call(states_(),next))
  throw new Error('Estado de pedido desconocido.');
 const {prop,folder}=ownerContext_();
 const lock=LockService.getScriptLock();
 lock.waitLock(12000);
 try{
  const {files}=orderContext_(folder,ref);
  if(!files.complete)throw new Error('No se puede confirmar la seña sin todos los archivos y PDF.');
  const status=currentStatus_(prop,ref,true);
  if(!transitionMap_()[status].includes(next))
   throw new Error('Transición no permitida: '+status+' → '+next);
  prop.setProperty('PRIVATE_ADMIN_'+ref,JSON.stringify({
   status:next,updatedAt:Date.now(),updatedBy:String(Session.getActiveUser().getEmail())
  }));
  return {ok:true,reference:ref,status:next,statusText:states_()[next]};
 }finally{lock.releaseLock();}
}
