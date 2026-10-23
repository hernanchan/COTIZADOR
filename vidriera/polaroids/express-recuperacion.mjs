/** Recuperación local temporal de recortes optimizados Polaroids Express.
 * Sólo IndexedDB del dispositivo; NUNCA originales, claves ni PDF imprimible.
 * La copia se elimina al confirmar, descartar o abrir después de dos horas.
 */
const DB_NAME='SABER_POLAROIDS_EXPRESS_RECUPERACION_V1';
const STORE='pendientes';
const KEY='un-envio';
const TTL_MS=2*60*60*1000;
const REF=/^POL-[A-F0-9]{24}$/;
const B64=/^[A-Za-z0-9+/]+={0,2}$/;
const MAX_DATA=17*1024*1024;
export function validarExpressGuardado({referencia,hojas},savedAt,now=Date.now()){
 if(!REF.test(referencia||'')||!Array.isArray(hojas)||
    !hojas.length||hojas.length>4||
    !Number.isSafeInteger(savedAt)||savedAt>now+60000||
    savedAt<now-TTL_MS)throw Error('Envío local inválido o vencido.');
 let count=0,bytes=0;
 for(let h=0;h<hojas.length;h++){
  const page=hojas[h];
  if(!Array.isArray(page)||!page.length||page.length>6||
     (h<hojas.length-1&&page.length!==6))
   throw Error('Cantidad de fotos local inválida.');
  for(const jpeg of page){
   if(typeof jpeg!=='string'||jpeg.length<110||jpeg.length>610000||
      jpeg.length%4!==0||!B64.test(jpeg))
    throw Error('Un recorte optimizado no es válido.');
   count++;bytes+=jpeg.length;
  }
 }
 if(count>24||bytes>MAX_DATA)throw Error('Envío local demasiado grande.');
 return Object.freeze({referencia,hojas,fotos:count,hojasA4:hojas.length,
  guardadoEn:savedAt,caducaEn:savedAt+TTL_MS});
}
async function transaction(mode,action,dbApi=globalThis.indexedDB){
 if(!dbApi?.open)throw Error('El navegador no permite recuperar envíos locales.');
 const db=await new Promise((resolve,reject)=>{
  const request=dbApi.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))
   request.result.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('No se pudo abrir el almacenamiento.'));
 });
 return new Promise((resolve,reject)=>{
  let result=null,settled=false;
  const tx=db.transaction(STORE,mode);
  const request=action(tx.objectStore(STORE));
  request.onsuccess=()=>{result=request.result};
  request.onerror=()=>{if(!settled){settled=true;db.close();reject(request.error||Error('Error al guardar fotos.'))}};
  tx.oncomplete=()=>{if(!settled){settled=true;db.close();resolve(result)}};
  tx.onerror=()=>{if(!settled){settled=true;db.close();reject(tx.error||Error('Error al confirmar almacenamiento.'))}};
 });
}
const defaultStorage={
 get:()=>transaction('readonly',store=>store.get(KEY)),
 put:data=>transaction('readwrite',store=>store.put(data,KEY)),
 remove:()=>transaction('readwrite',store=>store.delete(KEY))
};
export async function leerBorradorExpress({storage=defaultStorage,now=()=>Date.now()}={}){
 const data=await storage.get();
 if(!data)return null;
 try{
  if(data.version!==1||data.key!==KEY||!Number.isSafeInteger(data.guardadoEn))
   throw Error('Registro local inválido.');
  return validarExpressGuardado({referencia:data.referencia,hojas:data.hojas},
   data.guardadoEn,now());
 }catch(_){await storage.remove();return null}
}
export async function guardarBorradorExpress({referencia,hojas},{
 storage=defaultStorage,now=()=>Date.now()
}={}){
 const timestamp=now();
 const validado=validarExpressGuardado({referencia,hojas},timestamp,timestamp);
 const previous=await leerBorradorExpress({storage,now});
 if(previous&&previous.referencia!==referencia)
  throw Error('Hay otro envío Express pendiente. Recuperalo o descartalo primero.');
 await storage.put({key:KEY,version:1,guardadoEn:timestamp,referencia,hojas});
 return validado;
}
export async function borrarBorradorExpress({storage=defaultStorage}={}){
 await storage.remove();
 return true;
}
