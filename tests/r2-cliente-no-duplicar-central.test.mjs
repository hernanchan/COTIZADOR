import test from 'node:test';
import assert from 'node:assert/strict';
import {enviarArchivoR2Grande}
 from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-cliente.mjs';
import {R2_BIG_LIMITS}
 from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs';

const bytes=41*1024*1024,sha256='a'.repeat(64);
const orderId='WEB-ENSAYO-'+'A'.repeat(32);
const meta={fileId:'planoA1',name:'Plano A1 41 MiB.pdf',mode:'bn',
 bytes,sha256,pages:1};
const file={size:bytes,slice:(start,end)=>({size:end-start})};
function fixture(){
 const memory=new Map(),calls={start:0,part:0,complete:0,verify:0};
 const storage={
  getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>{memory.set(k,v)},
  removeItem:k=>{memory.delete(k)}
 };
 let central=false;
 const partBytes=R2_BIG_LIMITS.partBytes;
 const session={
  fileId:meta.fileId,bytes,partBytes,parts:Math.ceil(bytes/partBytes),
  proof:'p'.repeat(80),expiresAt:Math.floor(Date.now()/1000)+3600,
  paymentAuthorized:false,checkoutEnabled:false
 };
 const fetcher=async(route)=>{
  if(route.endsWith('/iniciar')){
   calls.start++;return Response.json({ok:true,session});
  }
  if(route.includes('/parte?n=')){
   calls.part++;const n=Number(route.split('?n=')[1]);
   return Response.json({ok:true,partNumber:n,etag:'etag-'+n});
  }
  if(route.endsWith('/completar')){
   calls.complete++;return Response.json({ok:true,result:{
    storageReady:true,sha256Verificado:false,paymentAuthorized:false,bytes}});
  }
  if(route.endsWith('/verificar')){
   calls.verify++;return Response.json({ok:true,result:{
    sha256Verificado:true,contenidoPdfVerificado:false,
    paymentAuthorized:false,registeredInD1:false,
    bytes,sha256,stagedForCentral:central}});
  }
  throw Error('Ruta inesperada: '+route);
 };
 const send=(requireCentralStaging=true)=>enviarArchivoR2Grande({
  file,orderId,meta,fetcher,storage,concurrency:2,
  requireCentralStaging
 });
 return {calls,memory,send,session,setCentral:v=>{central=v}};
}

test('Central pendiente conserva el multipart completo y reintenta sólo verificar',async()=>{
 const f=fixture();
 await assert.rejects(f.send(),/R2_CENTRAL_PENDIENTE/);
 assert.equal(f.calls.start,1);
 assert.equal(f.calls.part,f.session.parts);
 assert.equal(f.calls.complete,1);
 assert.equal(f.calls.verify,1);
 assert.equal(f.memory.size,1);
 f.setCentral(true);
 const confirmed=await f.send();
 assert.equal(confirmed.stagedForCentral,true);
 assert.equal(f.calls.start,1);
 assert.equal(f.calls.part,f.session.parts);
 assert.equal(f.calls.complete,1);
 assert.equal(f.calls.verify,2);
 assert.equal(f.memory.size,0);
});

test('sin exigencia de staging, conserva compatibilidad de ensayo R2 anterior',async()=>{
 const f=fixture();
 const result=await f.send(false);
 assert.equal(result.sha256Verificado,true);
 assert.equal(result.stagedForCentral,false);
 assert.equal(f.calls.start,1);
 assert.equal(f.calls.complete,1);
 assert.equal(f.memory.size,0);
});
