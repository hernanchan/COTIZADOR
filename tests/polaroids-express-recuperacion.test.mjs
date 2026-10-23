import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {guardarBorradorExpress,leerBorradorExpress,
 borrarBorradorExpress,validarExpressGuardado}
 from '../vidriera/polaroids/express-recuperacion.mjs';
const jpeg=Uint8Array.from(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const image=Buffer.from(jpeg).toString('base64');
const hojas=n=>Array.from({length:Math.ceil(n/6)},(_,h)=>
 Array.from({length:Math.min(6,n-h*6)},()=>image));
const reference='POL-'+'A'.repeat(24);
let value,removed=0;
const storage={
 async get(){return value||null},
 async put(x){value=structuredClone(x)},
 async remove(){value=null;removed++}
};
const t=1760000000000;
test('guarda solamente recortes base64, referencia y vencimiento de dos horas',async()=>{
 const saved=await guardarBorradorExpress({referencia:reference,hojas:hojas(24)},
  {storage,now:()=>t});
 assert.equal(saved.fotos,24);
 assert.equal(saved.hojasA4,4);
 assert.equal(saved.caducaEn,t+2*60*60*1000);
 assert.equal(value.version,1);
 assert.equal(value.referencia,reference);
 assert.equal(Object.keys(value).sort().join(','),
  'guardadoEn,hojas,key,referencia,version');
 assert.equal(JSON.stringify(value).includes('original'),false);
 assert.equal(JSON.stringify(value).includes('uploadKey'),false);
 assert.equal(JSON.stringify(value).includes('pdfBytes'),false);
 const afterReload=await leerBorradorExpress({storage,now:()=>t+60000});
 assert.equal(afterReload.referencia,reference);
 assert.equal(afterReload.fotos,24);
 assert.equal(afterReload.hojas[3].length,6);
});
test('rechaza reemplazar un pedido pendiente por otro y limpia tras el pago',async()=>{
 await assert.rejects(guardarBorradorExpress({
  referencia:'POL-'+'B'.repeat(24),hojas:hojas(6)
 },{storage,now:()=>t+120000}),/otro envío/i);
 assert.equal((await leerBorradorExpress({storage,now:()=>t+1000})).referencia,reference);
 await borrarBorradorExpress({storage});
 assert.equal(await leerBorradorExpress({storage,now:()=>t+1000}),null);
 assert.equal(removed,1);
});
test('borra borrador vencido o manipulado sin enviar fotos',async()=>{
 await guardarBorradorExpress({referencia:reference,hojas:hojas(12)},{storage,now:()=>t});
 assert.equal(await leerBorradorExpress({storage,now:()=>t+2*60*60*1000+1}),null);
 assert.equal(removed,2);
 await storage.put({key:'un-envio',version:1,guardadoEn:t,
  referencia:reference,hojas:[[Buffer.alloc(200).toString('base64')]]});
 assert.equal(await leerBorradorExpress({storage,now:()=>t+1000})?.fotos,1);
 await storage.put({key:'un-envio',version:1,guardadoEn:t,
  referencia:reference,hojas:[['not base64']]});
 assert.equal(await leerBorradorExpress({storage,now:()=>t+1000}),null);
 assert.equal(removed,3);
});
test('rechaza más de cuatro hojas, foto mal formateada y archivo gigante',()=>{
 assert.throws(()=>validarExpressGuardado({referencia:reference,hojas:hojas(25)},t,t));
 assert.throws(()=>validarExpressGuardado({referencia:reference,hojas:[[image],Array(6).fill(image)]},t,t));
 assert.throws(()=>validarExpressGuardado({referencia:reference,hojas:[['xxx']]},t,t));
 assert.throws(()=>validarExpressGuardado({referencia:'POL-X',hojas:hojas(6)},t,t));
});
test('API nativa IndexedDB guarda y recupera después de abrir un nuevo controlador',async()=>{
 const data=new Map();
 const fakeDB={
  objectStoreNames:{contains:()=>true},
  createObjectStore:()=>{},
  close:()=>{},
  transaction:()=>{
   let completed=false;
   const tx={oncomplete:null,onerror:null,error:null,
    objectStore:()=>({
     get:key=>command('get',key),
     put:(v,key)=>command('put',key,v),
     delete:key=>command('delete',key)
    })};
   function command(mode,key,v){
    const req={result:null,onerror:null,onsuccess:null,error:null};
    queueMicrotask(()=>{
     try{
      if(mode==='get')req.result=data.get(key)||null;
      else if(mode==='put'){data.set(key,v);req.result=key;}
      else{data.delete(key);req.result=undefined;}
      req.onsuccess?.();
      if(!completed){completed=true;queueMicrotask(()=>tx.oncomplete?.())}
     }catch(error){tx.error=error;tx.onerror?.();}
    });
    return req;
   }
   return tx;
  }
 };
 const fakeIndexedDB={open:()=>{
  const request={result:fakeDB,onupgradeneeded:null,onsuccess:null,onerror:null};
  queueMicrotask(()=>request.onsuccess?.());return request;
 }};
 const old=globalThis.indexedDB;
 globalThis.indexedDB=fakeIndexedDB;
 try{
  const ref='POL-'+'C'.repeat(24);
  await guardarBorradorExpress({referencia:ref,hojas:hojas(6)});
  const recovered=await leerBorradorExpress();
  assert.equal(recovered.referencia,ref);
  assert.equal(recovered.fotos,6);
  await borrarBorradorExpress();
  assert.equal(await leerBorradorExpress(),null);
 }finally{globalThis.indexedDB=old}
});
