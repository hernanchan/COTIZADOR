/**
 * Custodia LOCAL de originales entre la cotización y el retorno de Mercado Pago.
 * IndexedDB conserva los File originales al cambiar de dominio/página.
 * NO se envían blobs a R2/Supabase antes de acreditar el pago.
 * Si no se puede guardar y leer cada original, el checkout queda bloqueado.
 * Los originales se eliminan una vez confirmada recepción, o se reintentan
 * automáticamente sin volver a seleccionarlos.
 */
const NAME='saber-live-originales-privados-v1',TABLE='originales',TTL=24*60*60*1000;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const MAX=200*1048576;
function okParams({webOrderId,commercialOrderId,metas}){
 return WEB.test(webOrderId||'')&&UUID.test(commercialOrderId||'')&&
  Array.isArray(metas)&&metas.length>=1&&metas.length<=10&&
  new Set(metas.map(m=>m.fileId)).size===metas.length&&
  metas.every(m=>FILE.test(m.fileId||'')&&typeof m.name==='string'&&
   m.name.length<=120&&/\.pdf$/i.test(m.name)&&SHA.test(m.sha256||'')&&
   Number.isSafeInteger(m.bytes)&&m.bytes>=5&&m.bytes<=MAX);
}
const originalKey=(web,id)=>web+'|'+id;
function openDB(factory){
 if(!factory||typeof factory.open!=='function')
  return Promise.reject(Error('ALMACENAMIENTO_LOCAL_NO_DISPONIBLE'));
 return new Promise((resolve,reject)=>{
  const req=factory.open(NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(TABLE))db.createObjectStore(TABLE,{keyPath:'key'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('NO_SE_PUDO_ABRIR_ALMACENAMIENTO_LOCAL'));
  req.onblocked=()=>reject(Error('ALMACENAMIENTO_LOCAL_BLOQUEADO'));
 });
}
function transaction(db,mode,work){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,mode);
  const store=tx.objectStore(TABLE);
  let result;
  try{result=work(store)}catch(e){tx.abort();reject(e);return}
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(Error('ALMACENAMIENTO_LOCAL_SIN_ESPACIO_O_CANCELADO'));
  tx.onerror=()=>reject(Error('ALMACENAMIENTO_LOCAL_ERROR_DE_ESCRITURA'));
 });
}
function getRecord(db,key){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,'readonly');
  const req=tx.objectStore(TABLE).get(key);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(Error('NO_SE_PUDO_RECUPERAR_ORIGINAL'));
 });
}
function checkRecord(r,m,webOrderId,commercialOrderId){
 if(!r||r.webOrderId!==webOrderId||r.commercialOrderId!==commercialOrderId||
  r.fileId!==m.fileId||r.name!==m.name||r.bytes!==m.bytes||
  r.sha256!==m.sha256||r.file?.size!==m.bytes||
  typeof r.file?.slice!=='function')throw Error('ORIGINAL_LOCAL_DISTINTO_O_AUSENTE');
}
export async function guardarOriginalesLive({
 files,metas,webOrderId,commercialOrderId,
 factory=typeof indexedDB==='undefined'?null:indexedDB,
 storageManager=typeof navigator==='undefined'?null:navigator.storage,
 onProgress=()=>{}
}={}){
 if(!okParams({metas,webOrderId,commercialOrderId})||
  !Array.isArray(files)||files.length!==metas.length)
  throw Error('ORIGINALES_LOCAL_IDENTIDAD_INVALIDA');
 let total=0;
 for(let i=0;i<files.length;i++){
  const file=files[i],m=metas[i];
  if(!file||typeof file.slice!=='function'||file.name!==m.name||file.size!==m.bytes)
   throw Error('ORIGINALES_LOCAL_ARCHIVO_NO_COINCIDE');
  total+=file.size;
 }
 if(typeof storageManager?.estimate==='function'){
  const info=await storageManager.estimate().catch(()=>null);
  if(Number.isFinite(info?.quota)&&Number.isFinite(info?.usage)&&
     info.quota-info.usage<total*1.05)
   throw Error('SIN_ESPACIO_LOCAL_PARA_CONSERVAR_ARCHIVOS');
 }
 const db=await openDB(factory);
 try{
  const now=Date.now();
  const records=files.map((file,i)=>({
   key:originalKey(webOrderId,metas[i].fileId),webOrderId,commercialOrderId,
   fileId:metas[i].fileId,name:metas[i].name,bytes:metas[i].bytes,
   sha256:metas[i].sha256,file,savedAt:now
  }));
  onProgress({phase:'guardando',total:files.length});
  await transaction(db,'readwrite',store=>{
   for(const r of records)store.put(r);
  });
  // La operación no queda habilitada hasta comprobar que los originales
  // puedan recuperarse después de un redirect de dominio.
  for(let i=0;i<metas.length;i++){
   const got=await getRecord(db,records[i].key);
   checkRecord(got,metas[i],webOrderId,commercialOrderId);
  }
  onProgress({phase:'guardado',total:files.length});
  return {ok:true,savedFiles:files.length,totalBytes:total};
 }finally{db.close()}
}
export async function leerOriginalesLive({
 webOrderId,commercialOrderId,metas,
 factory=typeof indexedDB==='undefined'?null:indexedDB
}={}){
 if(!okParams({webOrderId,commercialOrderId,metas}))
  throw Error('ORIGINALES_LOCAL_PEDIDO_INVALIDO');
 const db=await openDB(factory);
 try{
  const files=[];
  for(const m of metas){
   const r=await getRecord(db,originalKey(webOrderId,m.fileId));
   checkRecord(r,m,webOrderId,commercialOrderId);
   files.push(r.file);
  }
  return files;
 }finally{db.close()}
}
export async function borrarOriginalesLive({
 webOrderId,commercialOrderId,metas,
 factory=typeof indexedDB==='undefined'?null:indexedDB
}={}){
 if(!okParams({webOrderId,commercialOrderId,metas}))
  throw Error('ORIGINALES_LOCAL_PEDIDO_INVALIDO');
 const db=await openDB(factory);
 try{
  // Solo borra el pedido confirmado, nunca otro archivo del dispositivo.
  for(const m of metas){
   const r=await getRecord(db,originalKey(webOrderId,m.fileId));
   if(r&&r.commercialOrderId!==commercialOrderId)
    throw Error('ORIGINALES_LOCAL_PEDIDO_DISTINTO');
  }
  await transaction(db,'readwrite',store=>{
   for(const m of metas)store.delete(originalKey(webOrderId,m.fileId));
  });
  return {ok:true};
 }finally{db.close()}
}
