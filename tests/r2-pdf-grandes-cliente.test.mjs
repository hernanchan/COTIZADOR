import test from 'node:test';
import assert from 'node:assert/strict';
import {enviarArchivoR2Grande} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-cliente.mjs';
const size=200*1024*1024,orderId='WEB-R2-ENSAYO-123456';
const meta={fileId:'GRANDE_200',bytes:size,name:'ejemplo-200.pdf',
 sha256:'c'.repeat(64),mode:'bn',pages:250};
const file={name:meta.name,size,
 slice:(start,end,type)=>({size:end-start,start,end,type})};
function fakeStorage(){
 const memory=new Map();
 return {getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),
  removeItem:k=>memory.delete(k),get length(){return memory.size}};
}
function response(v,status=200){return {ok:status===200,status,json:async()=>v}}
function mock({failOnceAt=0,failVerifyOnce=false}={}){
 const calls={starts:0,parts:[],completes:0,verifies:0};
 let failed=false;
 const fetcher=async(url,options)=>{
  if(url.endsWith('/iniciar')){
   calls.starts++;
   assert.equal(options.method,'POST');
   assert.equal(JSON.parse(options.body).meta.sha256,meta.sha256);
   return response({ok:true,session:{fileId:meta.fileId,bytes:size,
    proof:'p'.repeat(80),partBytes:8*1024*1024,parts:25,
    expiresAt:Math.floor(Date.now()/1000)+3600,
    paymentAuthorized:false,checkoutEnabled:false}});
  }
  if(url.includes('/parte?n=')){
   const n=Number(url.split('=')[1]);calls.parts.push(n);
   assert.equal(options.credentials,'same-origin');
   assert.equal(options.body.size,8*1024*1024);
   assert.equal(options.body.start,(n-1)*8*1024*1024);
   if(n===failOnceAt&&!failed){failed=true;return response({error:'corte simulado'},503)}
   return response({ok:true,partNumber:n,etag:'etag-'+n});
  }
  if(url.endsWith('/verificar')){
   calls.verifies++;
   if(failVerifyOnce&&calls.verifies===1)
    return response({ok:false,error:'verificacion interrumpida'},503);
   return response({ok:true,result:{bytes:size,storageReady:true,
    sha256:meta.sha256,sha256Verificado:true,contenidoPdfVerificado:false,
    registeredInD1:false,paymentAuthorized:false}});
  }
  if(url.endsWith('/completar')){
   calls.completes++;
   const req=JSON.parse(options.body);
   assert.equal(req.uploadedParts.length,25);
   assert.equal(req.uploadedParts[0].partNumber,1);
   assert.equal(req.uploadedParts[24].partNumber,25);
   return response({ok:true,result:{bytes:size,storageReady:true,
    sha256Verificado:false,paymentAuthorized:false}});
  }
  throw Error('Ruta inesperada: '+url);
 };
 return {fetcher,calls};
}
test('cliente R2 200 MiB: envía 25 partes sin convertir todo a ArrayBuffer',async()=>{
 const {fetcher,calls}=mock(),storage=fakeStorage(),events=[];
 const result=await enviarArchivoR2Grande({file,orderId,meta,fetcher,storage,
  onProgress:event=>events.push(event)});
 assert.equal(calls.starts,1);
 assert.equal(calls.parts.length,25);
 assert.equal(new Set(calls.parts).size,25);
 assert.equal(calls.completes,1);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.sha256Verificado,true);
 assert.equal(calls.verifies,1);
 assert.equal(events.at(-1).percent,100);
 assert.equal(storage.length,0);
});
test('cliente reanuda desde partes confirmadas sin reiniciar carga',async()=>{
 const {fetcher,calls}=mock({failOnceAt:2}),storage=fakeStorage();
 await assert.rejects(enviarArchivoR2Grande({file,orderId,meta,fetcher,storage,
  concurrency:1,retries:0}),/corte simulado/);
 assert.equal(calls.starts,1);
 assert.equal(calls.parts.includes(1),true);
 assert.equal(storage.length,1);
 await enviarArchivoR2Grande({file,orderId,meta,fetcher,storage,concurrency:1,retries:0});
 assert.equal(calls.starts,1);
 assert.equal(calls.parts.filter(n=>n===1).length,1);
 assert.equal(calls.completes,1);
 assert.equal(calls.verifies,1);
 assert.equal(storage.length,0);
});
test('si falla la verificación no vuelve a completar multipart ya cerrado',async()=>{
 const {fetcher,calls}=mock({failVerifyOnce:true}),storage=fakeStorage();
 await assert.rejects(enviarArchivoR2Grande({file,orderId,meta,fetcher,storage}),/verificacion interrumpida/);
 assert.equal(calls.completes,1);
 assert.equal(storage.length,1);
 const result=await enviarArchivoR2Grande({file,orderId,meta,fetcher,storage});
 assert.equal(result.sha256Verificado,true);
 assert.equal(calls.starts,1);
 assert.equal(calls.completes,1);
 assert.equal(calls.verifies,2);
 assert.equal(storage.length,0);
});
test('el cliente rechaza un archivo fuera del máximo de pruebas',async()=>{
 const {fetcher,calls}=mock();
 await assert.rejects(enviarArchivoR2Grande({
  file:{...file,size:300*1024*1024},
  meta:{...meta,bytes:300*1024*1024},orderId,fetcher
 }),/R2_ARCHIVO_NO_ADMITIDO/);
 assert.equal(calls.starts,0);
});
