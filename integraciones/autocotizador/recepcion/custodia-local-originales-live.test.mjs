import test from 'node:test';
import assert from 'node:assert/strict';
import {guardarOriginalesLive,leerOriginalesLive,borrarOriginalesLive} from './custodia-local-originales-live.mjs';

const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const commercialOrderId='123e4567-e89b-42d3-a456-426614174000';
const fileId='pdf_0_'+'a'.repeat(32);
const sha256='b'.repeat(64);
const file=Object.assign(new Blob(['%PDF-1.4\n']),{name:'archivo.pdf'});
const metas=[{fileId,name:'archivo.pdf',bytes:file.size,sha256,transport:'tus',pages:1,mode:'bn'}];
function fakeIDB(){
 const data=new Map();let exists=false;
 const db={
  objectStoreNames:{contains:()=>exists},
  createObjectStore(){exists=true},
  close(){},
  transaction(_store,_mode){
   const tx={oncomplete:null,onerror:null,onabort:null,
    abort(){setTimeout(()=>this.onabort?.(),0)},
    objectStore(){
     return {
      put(record){data.set(record.key,record)},
      delete(key){data.delete(key)},
      get(key){
       const req={onsuccess:null,onerror:null,result:null};
       setTimeout(()=>{req.result=data.get(key)||null;req.onsuccess?.()},0);
       return req
      }
     };
    }
   };
   setTimeout(()=>tx.oncomplete?.(),0);
   return tx;
  }
 };
 return {data,open(){
  const req={result:db,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};
  setTimeout(()=>{if(!exists)req.onupgradeneeded?.();req.onsuccess?.()},0);
  return req
 }};
}
const opts=(factory,additional={})=>({webOrderId,commercialOrderId,metas,
 factory,storageManager:{estimate:async()=>({quota:1024*1024,usage:0})},...additional});
test('conserva PDF antes del pago y lo devuelve después de una reapertura local',async()=>{
 const factory=fakeIDB();
 const result=await guardarOriginalesLive({...opts(factory),files:[file]});
 assert.equal(result.savedFiles,1);
 const recovered=await leerOriginalesLive(opts(factory));
 assert.equal(recovered.length,1);
 assert.equal(recovered[0].size,file.size);
 assert.equal(recovered[0].name,'archivo.pdf');
 const deleted=await borrarOriginalesLive(opts(factory));
 assert.equal(deleted.ok,true);
 await assert.rejects(()=>leerOriginalesLive(opts(factory)),/ORIGINAL_LOCAL_DISTINTO_O_AUSENTE/);
});
test('sin almacenamiento local se BLOQUEA antes del checkout',async()=>{
 await assert.rejects(()=>guardarOriginalesLive({...opts(null),files:[file]}),/ALMACENAMIENTO_LOCAL_NO_DISPONIBLE/);
 const factory=fakeIDB();
 await assert.rejects(()=>guardarOriginalesLive({...opts(factory),files:[file],
  storageManager:{estimate:async()=>({quota:20,usage:15})}}),/SIN_ESPACIO_LOCAL/);
 assert.equal(factory.data.size,0,'sin espacio no escribe originales');
});
test('original distinto o referencia de otra orden no se reutiliza',async()=>{
 const factory=fakeIDB();
 await guardarOriginalesLive({...opts(factory),files:[file]});
 await assert.rejects(()=>leerOriginalesLive(opts(factory,{commercialOrderId:'123e4567-e89b-42d3-a456-426614174001'})),
  /ORIGINAL_LOCAL_DISTINTO_O_AUSENTE/);
 await assert.rejects(()=>guardarOriginalesLive({...opts(factory),files:[
  Object.assign(new Blob(['%PDF-MODIFICADO']),{name:'archivo.pdf'})]}),
  /ORIGINALES_LOCAL_ARCHIVO_NO_COINCIDE/);
});
