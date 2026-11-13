import test from 'node:test';
import assert from 'node:assert/strict';
import {enviarPDFsR2PagadosLive} from './recepcion-r2-live-cliente.mjs';
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const ID='123e4567-e89b-42d3-a456-426614174000';
const SHA='a'.repeat(64);
const meta={fileId:'pdf_0',name:'Panel.pdf',mode:'bn',bytes:60*1048576,
 sha256:SHA,pages:1,transport:'r2'};
const file={name:'Panel.pdf',size:meta.bytes,slice:()=>({
 arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer})};
function mock(paid=true,metas=[meta]){
 const calls=[],storage=new Map([
  ['saber-live-pedido-v1',JSON.stringify({webOrderId:WEB,commercialOrderId:ID})],
  ['saber-live-archivos-v1',JSON.stringify({webOrderId:WEB,
   commercialOrderId:ID,metas})]
 ]);
 const fetcher=async(url,req)=>{
  calls.push({url,req});
  return Response.json({ok:true,webOrderId:WEB,commercialOrderId:ID,
   estado:paid?'pagado_esperando_archivos':'pendiente',
   uploadAuthorized:paid,productionAuthorized:false,fileCount:metas.length});
 };
 return {calls,storage:{getItem:k=>storage.get(k)||null},fetcher};
}
const verified={sha256Verificado:true,sha256:SHA,bytes:meta.bytes,
 stagedForCentral:true,contenidoPdfVerificado:false,registeredInD1:false};
test('sin pago no llama uploader y no reserva cuota',async()=>{
 const f=mock(false);let uploads=0;
 await assert.rejects(enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:f.storage,fetcher:f.fetcher,
  origin:ORIGIN,hasher:async()=>SHA,
  uploader:async()=>{uploads++}}),/PAGO_O_AVISO_NO_CONCILIADO/);
 assert.equal(f.calls.length,1);assert.equal(uploads,0);
});
test('PDF alterado o cambiado se rechaza antes de consultar Central',async()=>{
 const f=mock(true);let uploads=0;
 await assert.rejects(enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:f.storage,fetcher:f.fetcher,
  origin:ORIGIN,hasher:async()=> 'b'.repeat(64),
  uploader:async()=>{uploads++}}),/ORIGINAL_DISTINTO/);
 assert.equal(f.calls.length,0);assert.equal(uploads,0);
});
test('pago verificado enlaza multipart R2 LIVE con staging, no otro checkout',async()=>{
 const f=mock(true);const passed=[];
 const result=await enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:f.storage,fetcher:f.fetcher,
  origin:ORIGIN,hasher:async()=>SHA,
  uploader:async params=>{passed.push(params);return verified}
 });
 assert.equal(result.ok,true);
 assert.equal(result.stagedFiles,1);
 assert.equal(result.productionAuthorized,false);
 assert.equal(passed.length,1);
 assert.equal(passed[0].mode,'live');
 assert.equal(passed[0].origin,ORIGIN);
 assert.equal(passed[0].requireCentralStaging,true);
 assert.equal(passed[0].meta.sha256,SHA);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].url,'/api/pedido/live/checkout');
});
test('recibo R2 sin staging D1 nunca se confirma al comprador',async()=>{
 const f=mock(true);
 await assert.rejects(enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:f.storage,fetcher:f.fetcher,
  origin:ORIGIN,hasher:async()=>SHA,
  uploader:async()=>({...verified,stagedForCentral:false})}),
  /CENTRAL_NO_VERIFICO/);
});
test('origen de ensayo jamás habilita R2 productivo',async()=>{
 const f=mock();
 await assert.rejects(enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:f.storage,fetcher:f.fetcher,
  origin:'https://saber-documentos-pruebas.workers.dev',
  hasher:async()=>SHA,uploader:async()=>verified}),
  /COMPRADOR_NO_VERIFICABLE/);
 assert.equal(f.calls.length,0);
});

test('dos PDF R2 informan porcentaje de lote y 100% solo tras staging',async()=>{
 const m2={...meta,fileId:'pdf_1',name:'Segundo.pdf',bytes:80*1048576};
 const f2={...file,name:m2.name,size:m2.bytes};
 const f=mock(true,[meta,m2]),events=[];
 const result=await enviarPDFsR2PagadosLive({
  selectedFiles:[file,f2],storage:f.storage,fetcher:f.fetcher,
  origin:ORIGIN,hasher:async()=>SHA,onProgress:p=>events.push(p),
  uploader:async params=>{
   params.onProgress({phase:'transferencia',bytesUploaded:params.file.size/2,percent:50});
   params.onProgress({phase:'verificando-integridad',
    bytesUploaded:params.file.size,percent:100});
   return {...verified,bytes:params.meta.bytes};
  }
 });
 assert.equal(result.ok,true);
 assert.equal(result.stagedFiles,2);
 assert.equal(events.at(-1).phase,'archivo-verificado');
 assert.equal(events.at(-1).batchPercent,100);
 assert.equal(events.filter(e=>e.batchPercent===100).length,1);
 assert.deepEqual(events.filter(e=>e.phase==='transferencia').map(e=>e.batchPercent),[21,71]);
 assert.ok(events.slice(0,-1).every(e=>e.batchPercent<=99));
 assert.equal(f.calls.length,1);
});

test('transferencia YA AVISADA envía R2 antes de acreditar banco, sin habilitar producción',async()=>{
 const m=mock(false),calls=[],receipt={...verified};
 m.fetcher=async(url,req)=>{
  calls.push(url);
  assert.equal(url,'/api/pedido/live/transfer');
  assert.equal(JSON.parse(req.body).action,'status');
  return Response.json({ok:true,webOrderId:WEB,commercialOrderId:ID,
   estado:'transferencia_informada',customerNotified:true,
   paymentVerified:false,uploadAuthorized:false,productionAuthorized:false});
 };
 const result=await enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:m.storage,fetcher:m.fetcher,origin:ORIGIN,
  hasher:async()=>SHA,allowPendingBank:true,uploader:async()=>receipt
 });
 assert.equal(result.ok,true);assert.equal(result.productionAuthorized,false);
 assert.deepEqual(calls,['/api/pedido/live/transfer']);
});
test('R2 no acepta aviso bancario ausente como permiso de subida',async()=>{
 const m=mock(false);
 m.fetcher=async()=>Response.json({ok:true,webOrderId:WEB,commercialOrderId:ID,
  estado:'transferencia_pendiente',customerNotified:false,
  paymentVerified:false,uploadAuthorized:false,productionAuthorized:false});
 let uploads=0;
 await assert.rejects(enviarPDFsR2PagadosLive({
  selectedFiles:[file],storage:m.storage,fetcher:m.fetcher,origin:ORIGIN,
  hasher:async()=>SHA,allowPendingBank:true,uploader:async()=>{uploads++;return verified}
 }),/PAGO_O_AVISO_NO_CONCILIADO/);
 assert.equal(uploads,0);
});
