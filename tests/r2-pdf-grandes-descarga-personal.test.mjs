import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {iniciarR2Grande} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs';
import {descargarR2GrandePersonal} from '../integraciones/autocotizador/recepcion/r2-pdf-grandes-descarga-personal.mjs';

const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const orderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const uuid='12345678-1234-4123-8123-123456789abc';
const secret='clave-unica-de-prueba-saber-R2-SHA-personal-muy-larga-12345';
const now=()=>1793970000;
const mib=1024*1024;
const total=45*mib;
function stream({corrupt=false,short=false}={}){
 let i=0;
 return new ReadableStream({pull(controller){
  if(i>=45-(short?1:0)){controller.close();return}
  const data=new Uint8Array(mib);
  if(i===0)data.set(new TextEncoder().encode('%PDF-'));
  if(corrupt&&i===13)data[63]=17;
  controller.enqueue(data);i++;
 }});
}
function digestFactory(){
 const hasher=createHash('sha256');
 let resolve,reject;const digest=new Promise((yes,no)=>{resolve=yes;reject=no});
 const writer=new WritableStream({
  write(bytes){hasher.update(bytes)},
  close(){resolve(hasher.digest())},
  abort(err){reject(err)}
 });
 writer.digest=digest;
 return writer;
}
function fingerprint(){
 const hash=createHash('sha256');
 for(let i=0;i<45;i++){
  const data=new Uint8Array(mib);
  if(i===0)data.set(new TextEncoder().encode('%PDF-'));
  hash.update(data);
 }
 return hash.digest('hex');
}
async function ready({corrupt=false,short=false,swap=false}={}){
 const sha256=fingerprint();
 const key='r2-v1/'+orderId+'/'+uuid+'.pdf';
 let reads=0;
 const env={
  DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_RECEIPT_KEY:secret,
  SABER_R2_GRANDES:{
   createMultipartUpload:async()=>({uploadId:'upload-prueba-personal-45'}),
   get:async (requested,options)=>{
    assert.equal(requested,key);reads++;
    if(reads===2){
     assert.equal(options?.onlyIf?.etagMatches,'etag-verified-original-45');
     if(swap)return {size:total,etag:'etag-swapped-after-verify'};
    }
    return {size:total,etag:'etag-verified-original-45',body:stream({corrupt,short})};
   }
  }
 };
 const session=await iniciarR2Grande({
  bucket:env.SABER_R2_GRANDES,orderId,
  meta:{fileId:'pdf45',name:'PDF_original_45.pdf',mode:'bn',
   bytes:total,sha256,pages:11},
  secret,uuid:()=>uuid,now,subtle:webcrypto.subtle
 });
 const request=()=>new Request(origin+'/prueba-v2/api/ensayo-r2-descargar-personal',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({proof:session.proof})
 });
 return {env,request,get reads(){return reads}};
}
test('descarga de 45 MiB intactos con streaming y doble lectura verificada',async()=>{
 const f=await ready();
 const response=await descargarR2GrandePersonal(f.request(),f.env,{
  authorized:true,now,subtle:webcrypto.subtle,digestFactory
 });
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Length'),String(total));
 assert.equal(response.headers.get('Content-Type'),'application/pdf');
 assert.match(response.headers.get('Content-Disposition'),/^attachment; filename="SABER-/);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.equal(f.reads,2);
 assert.ok(response.body instanceof ReadableStream);
 // El consumidor final puede descargar por streaming, sin arrayBuffer().
 let bytes=0;
 for await(const chunk of response.body){bytes+=chunk.byteLength}
 assert.equal(bytes,total);
});
test('sin operador no consulta Storage aunque tenga proof válido',async()=>{
 const f=await ready();
 const response=await descargarR2GrandePersonal(f.request(),f.env,{
  authorized:false,now,subtle:webcrypto.subtle,digestFactory
 });
 assert.equal(response.status,403);
 assert.equal(f.reads,0);
});
test('sin bandera, objeto alterado o incompleto jamás entrega el original',async()=>{
 const f=await ready();
 let response=await descargarR2GrandePersonal(f.request(),{
  ...f.env,DOCS_R2_BIG_ENABLED:'OFF'
 },{authorized:true,now,subtle:webcrypto.subtle,digestFactory});
 assert.equal(response.status,503);assert.equal(f.reads,0);
 const altered=await ready({corrupt:true});
 response=await descargarR2GrandePersonal(altered.request(),altered.env,{
  authorized:true,now,subtle:webcrypto.subtle,digestFactory
 });
 assert.equal(response.status,422);
 assert.equal(altered.reads,1);
 const incomplete=await ready({short:true});
 response=await descargarR2GrandePersonal(incomplete.request(),incomplete.env,{
  authorized:true,now,subtle:webcrypto.subtle,digestFactory
 });
 assert.equal(response.status,422);
 assert.equal(incomplete.reads,1);
});
test('un objeto sustituido tras el SHA no se entrega aunque el tamaño coincida',async()=>{
 const f=await ready({swap:true});
 const response=await descargarR2GrandePersonal(f.request(),f.env,{
  authorized:true,now,subtle:webcrypto.subtle,digestFactory
 });
 assert.equal(response.status,409);
 assert.equal(f.reads,2);
});
test('ni acceso con Origin cruzado ni comprobante cambiado',async()=>{
 const f=await ready();
 const bad=new Request(origin+'/prueba-v2/api/ensayo-r2-descargar-personal',{
  method:'POST',headers:{Origin:'https://falso.example','Content-Type':'application/json'},
  body:JSON.stringify({proof:'no-firmado'})
 });
 assert.equal((await descargarR2GrandePersonal(bad,f.env,{authorized:true,now,
  subtle:webcrypto.subtle,digestFactory})).status,403);
 assert.equal(f.reads,0);
 const altered=new Request(origin+'/prueba-v2/api/ensayo-r2-descargar-personal',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({proof:'falsificado'})
 });
 assert.equal((await descargarR2GrandePersonal(altered,f.env,{authorized:true,now,
  subtle:webcrypto.subtle,digestFactory})).status,422);
 assert.equal(f.reads,0);
});
