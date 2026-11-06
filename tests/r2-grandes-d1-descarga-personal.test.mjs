import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {lookupR2PendienteCentral} from '../integraciones/mercadopago/pruebas/r2-grandes-central-pendientes.mjs';
import {consultarR2PendienteCentral,validarLookupR2Pendiente}
 from '../integraciones/autocotizador/recepcion/r2-grandes-lookup-central.mjs';
import {descargarR2PendientePorD1Personal}
 from '../integraciones/autocotizador/recepcion/r2-pdf-descarga-d1-personal.mjs';
const ORIGIN='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const UUID='12345678-1234-4123-8123-123456789abc';
const ID='DOC-'+UUID, KEY='r2-v1/'+ORDER+'/'+UUID+'.pdf';
const MIB=1024*1024,BYTES=45*MIB;
const SECRET='saber-central-falsa-para-tests-r2-2026-11-06-MAS-DE-32-CARACTERES';
const ETAG='etag-verified-original-45';
const sha=(()=>{
 const h=createHash('sha256');
 for(let i=0;i<45;i++){
  const part=new Uint8Array(MIB);
  if(i===0)part.set(new TextEncoder().encode('%PDF-'));
  h.update(part);
 }
 return h.digest('hex');
})();
const entry={ok:true,found:true,schema:'saber-central-r2-pending-lookup-v1',
 webOrderId:ORDER,receiptId:ID,fileId:'P45',objectKey:KEY,
 sha256:sha,etag:ETAG,bytes:BYTES,pagesDeclared:37,name:'original_45.pdf',
 status:'awaiting_pdf_analysis',contenidoPdfVerificado:false,
 registeredInD1:false,paymentAuthorized:false,listoParaProducir:false};
const row={receipt_id:ID,web_order_id:ORDER,file_id:'P45',
 object_key:KEY,sha256:sha,etag:ETAG,bytes:BYTES,name:'original_45.pdf',
 pages_claimed:37,status:'awaiting_pdf_analysis'};
function refStream({corrupt=false,short=false}={}){
 let idx=0;return new ReadableStream({pull(c){
  if(idx >= (short?44:45)){c.close();return}
  const x=new Uint8Array(MIB);
  if(idx===0)x.set(new TextEncoder().encode('%PDF-'));
  if(idx===11&&corrupt)x[17]=1;
  c.enqueue(x);idx++;
 }});
}
function digestFactory(){
 const hash=createHash('sha256');let resolve;
 const digest=new Promise(r=>resolve=r);
 const stream=new WritableStream({write:chunk=>{hash.update(chunk)},
  close:()=>resolve(hash.digest())});
 stream.digest=digest;return stream;
}
function makeReq(orderId=ORDER,receiptId=ID,origin=ORIGIN){
 return new Request(ORIGIN+'/prueba-v2/api/ensayo-r2-descargar-d1-personal',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({orderId,receiptId})});
}
test('lookup D1 sin prueba temporal: lee SOLO registro pendiente y no escribe ni crea tablas',async()=>{
 const calls=[];
 const env={CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DB:{prepare(sql){
   calls.push(sql);
   if(sql.includes('sqlite_master'))return {first:async()=>({name:'central_r2_large_pending'})};
   return {bind:(...args)=>({
    first:async()=>args[0]===ID&&args[1]===ORDER?row:null
   })};
  }}};
 const res=await lookupR2PendienteCentral(new Request('https://central.example/'),env,{
  readSigned:async()=>({payload:{schema:'saber-central-r2-pending-lookup-v1',
   webOrderId:ORDER,receiptId:ID}})});
 assert.equal(res.status,200);
 const d=await res.json();
 assert.deepEqual(d,entry);
 assert.equal(calls.length,2);
 assert.equal(calls.every(s=>s.startsWith('SELECT ')),true);
});
test('el lookup rechaza orden ajena, recibo de otra orden, firma ausente y flag OFF',async()=>{
 const env={CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DB:{prepare(sql){
   if(sql.includes('sqlite_master'))return {first:async()=>({name:'central_r2_large_pending'})};
   return {bind:()=>({first:async()=>null})};
  }}};
 const call=payload=>lookupR2PendienteCentral(new Request('https://central.example/'),env,{
  readSigned:async()=>({payload})});
 assert.equal((await call({schema:'saber-central-r2-pending-lookup-v1',
  webOrderId:'WEB-OTRA-12345',receiptId:ID})).status,404);
 assert.equal((await call({schema:'no-autorizado',webOrderId:ORDER,receiptId:ID})).status,422);
 assert.equal((await lookupR2PendienteCentral(new Request('https://central.example/'),env,{
  readSigned:async()=>({error:'Firma incorrecta',status:401})})).status,401);
 env.CENTRAL_R2_STAGING_ENABLED='false';
 assert.equal((await call({schema:'saber-central-r2-pending-lookup-v1',
  webOrderId:ORDER,receiptId:ID})).status,503);
});
test('consulta entre Workers firma HMAC, no permite URL de destino desconocida',async()=>{
 let calls=0;
 const env={DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const service={fetch:async r=>{
  calls++;assert.equal(new URL(r.url).pathname,'/internal/central/r2-pending-lookup');
  const raw=await r.text(),id=r.headers.get('x-saber-request-id'),
    ts=r.headers.get('x-saber-ts');
  assert.equal(r.headers.get('x-saber-signature'),
   createHmac('sha256',SECRET).update(ts+'\n'+id+'\n'+raw).digest('hex'));
  assert.deepEqual(JSON.parse(raw),{schema:'saber-central-r2-pending-lookup-v1',
   webOrderId:ORDER,receiptId:ID});
  return Response.json(entry);
 }};
 const found=await consultarR2PendienteCentral(env,{orderId:ORDER,receiptId:ID},{service});
 assert.equal(found.sha256,sha);
 assert.equal(found.contenidoPdfVerificado,false);
 assert.equal(calls,1);
 await assert.rejects(consultarR2PendienteCentral({
  ...env,CENTRAL_TEST_URL:'https://evil.example/internal/central/stage'
 },{orderId:ORDER,receiptId:ID},{service}),/DESTINO_INVALIDO/);
 assert.equal(calls,1);
});
test('el registro D1 no se acepta si falsea orden, bytes, ETag o estado',()=>{
 for(const altered of [
  {...entry,webOrderId:'WEB-OTRA-12345'},
  {...entry,objectKey:'r2-v1/WEB-OTRA-12345/'+UUID+'.pdf'},
  {...entry,bytes:300*MIB},
  {...entry,etag:'x'},
  {...entry,status:'paid'},
  {...entry,registeredInD1:true}
 ]){
  assert.throws(()=>validarLookupR2Pendiente(altered,{orderId:ORDER,receiptId:ID}),/R2_LOOKUP_/);
 }
});
test('descarga a operario con referencia D1 vencidos los 2h: 45 MiB íntegros en stream',async()=>{
 let reads=0;
 const bucket={get:async(key,opts)=>{
  reads++;assert.equal(key,KEY);
  if(reads===2)assert.equal(opts?.onlyIf?.etagMatches,ETAG);
  return {size:BYTES,etag:ETAG,body:refStream()};
 }};
 const env={DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',SABER_R2_GRANDES:bucket};
 const response=await descargarR2PendientePorD1Personal(makeReq(),env,{
  authorized:true,digestFactory,lookup:async()=>validarLookupR2Pendiente(
   entry,{orderId:ORDER,receiptId:ID})});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Length'),String(BYTES));
 assert.match(response.headers.get('Content-Disposition'),/DOC-12345678/);
 assert.equal(reads,2);
 let downloaded=0;for await(const chunk of response.body)downloaded+=chunk.byteLength;
 assert.equal(downloaded,BYTES);
});
test('personal bloqueado, origen ajeno, SHA cambiado y ETag sustituido',async()=>{
 let reads=0;
 const makeBucket=(opts={})=>({get:async()=>{
  reads++;
  return {size:BYTES,etag:opts.swapped&&reads===2?'etag-changed-after-hash':ETAG,
   body:refStream({corrupt:opts.corrupt})};
 }});
 const args=async(authorized,bucket,req=makeReq())=>
  descargarR2PendientePorD1Personal(req,{
   DOCS_R2_BIG_ENABLED:'PRIVATE_TEST_ONLY',
   DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',SABER_R2_GRANDES:bucket
  },{authorized,digestFactory,lookup:async()=>validarLookupR2Pendiente(
   entry,{orderId:ORDER,receiptId:ID})});
 assert.equal((await args(false,makeBucket())).status,403);assert.equal(reads,0);
 assert.equal((await args(true,makeBucket(),makeReq(ORDER,ID,'https://evil.example'))).status,403);
 assert.equal(reads,0);
 assert.equal((await args(true,makeBucket({corrupt:true}))).status,422);
 assert.equal(reads,1);
 reads=0;
 assert.equal((await args(true,makeBucket({swapped:true}))).status,409);
 assert.equal(reads,2);
});
