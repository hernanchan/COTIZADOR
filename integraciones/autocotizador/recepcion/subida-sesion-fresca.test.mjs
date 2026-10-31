/** Flujo real del cliente V2 con respuestas de receptor simuladas.
 * Ahorra 1 consulta únicamente si GAS firmó newSession:true.
 * Reanudaciones, receptores anteriores y pérdidas de ACK mantienen status.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID,webcrypto} from 'node:crypto';
import {subirYVincularPdfCotizadorV2,fileIdParaReferencia} from './subir-vincular-pdf-v2-privado.mjs';
import {verificarVinculoCotizadorV2} from './verificar-vinculo-cotizador-v2.mjs';

const ORIGIN='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const bytes=Buffer.from('%PDF-1.7\nvalid test file\n%%EOF\n');
const sha256=createHash('sha256').update(bytes).digest('hex');
const orderId='WEB-ENSAYO-CLIENTE-PRIVATE';
const uploadId='DOC-'+randomUUID();
const token='TEST_RECEIPT_BEARER_TOKEN_0123456789';
const name='archivo.pdf';
const localRef=randomUUID();
const archivo={
 name,size:bytes.length,
 arrayBuffer:async()=>Uint8Array.from(bytes).buffer
};
const referencia={schema:'saber-pdf-local-pendiente-v1',localRef,sha256,
 bytes:bytes.length,paginas:1,nombre:name,estado:'PENDIENTE_DE_ENVIO',
 recibido:false,verificadoServidor:false};
function setup({newSession,prior=null,ackLost=false,alreadyAccepted=false,onTiming=null}={}){
 const calls=[],progress=[],sessions=[],timings=[];
 let lost=ackLost;
 const fetcher=async (url,{body})=>{
  assert.equal(new URL(url).origin,ORIGIN);
  const q=JSON.parse(body);calls.push(q.op||'link');
  if(q.op==='start')return Response.json({ok:true,uploadId,token,orderId,
   paymentAuthorized:false,...(newSession===undefined?{}:{newSession})});
  if(q.op==='status')return Response.json({ok:true,uploadId,
   acceptedParts:alreadyAccepted||(!lost&&ackLost)?[0]:[]});
  if(q.op==='part'){
   assert.equal(q.uploadId,uploadId);
   assert.equal(q.index,0);
   assert.equal(q.sha256,sha256);
   assert.equal(Buffer.from(q.dataBase64,'base64').toString(),bytes.toString());
   if(lost){lost=false;return Response.json({ok:false,error:'ACK perdido'}, {status:502});}
   return Response.json({ok:true,accepted:true,index:0});
  }
  if(q.op==='finish')return Response.json({ok:true,received:true,sha256,
   bytes:bytes.length,receiptId:uploadId});
  if(new URL(url).pathname==='/api/ensayo-vincular-pdf-v2')
   return Response.json({ok:true,schema:'saber-v2-pdf-conciliado-privado-v1',
    localRef,orderId,receiptId:uploadId,sha256,pages:1,
    estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
    reciboGoogleVerificado:true,precioRecalculado:false,
    paymentAuthorized:false,listoParaProducir:false});
  throw Error('Operación desconocida');
 };
 const run=()=>subirYVincularPdfCotizadorV2({
  archivo,referencia,orderId,modo:'bn',turnstileToken:'TOKEN_TURNSTILE_SIMULADO',
  origin:ORIGIN,fetcher,subtle:webcrypto.subtle,
  onProgress:p=>progress.push(p),onSession:s=>sessions.push(s),
  onRequestTiming:t=>{timings.push(t);if(onTiming)onTiming(t);},
  sesionPrevia:prior
 });
 return {run,calls,progress,sessions,timings};
}
test('sesión HMAC realmente nueva: no se pide multiStatus, sí se transfiere y verifica completo',async()=>{
 const t=setup({newSession:true});
 const v=await t.run();
 assert.deepEqual(t.calls,['start','part','finish','link']);
 assert.equal(v.receiptId,uploadId);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(t.sessions.length,1);
 assert.ok(t.progress.some(p=>p.phase==='estado'&&p.completed===0));
 assert.ok(t.progress.some(p=>p.phase==='confirmado'));
});
test('Apps Script viejo sin marca newSession conserva status y compatibilidad',async()=>{
 const t=setup();
 await t.run();
 assert.deepEqual(t.calls,['start','status','part','finish','link']);
});
test('sesión idempotente newSession:false: no se reenvían bloques existentes',async()=>{
 const t=setup({newSession:false,alreadyAccepted:true});
 await t.run();
 assert.deepEqual(t.calls,['start','status','finish','link']);
 assert.ok(t.progress.some(p=>p.phase==='estado'&&p.completed===1));
});
test('reanudación en la misma pestaña exige consulta estado aun si se saltó al crearla',async()=>{
 const prior={uploadId,token,orderId,localRef,sha256,modo:'bn',
  opcionesKey:'null'};
 const t=setup({prior,alreadyAccepted:true,newSession:true});
 await t.run();
 assert.deepEqual(t.calls,['status','finish','link']);
});
test('si Google recibió el bloque pero se perdió ACK, cliente consulta status antes de continuar',async()=>{
 const t=setup({newSession:true,ackLost:true});
 const v=await t.run();
 assert.deepEqual(t.calls,['start','part','status','finish','link']);
 assert.equal(v.pages,1);
 assert.ok(t.progress.some(p=>p.phase==='recuperado'));
});

test('la sesión recién creada por una TANDA omite status UNA vez, nunca en un reintento',async()=>{
 const prior={uploadId,token,orderId,localRef,sha256,modo:'bn',
  opcionesKey:'null',batchFresh:true};
 const first=setup({prior});
 await first.run();
 assert.deepEqual(first.calls,['part','finish','link']);
 assert.equal(first.sessions[0].batchFresh,undefined,
  'onSession borra batchFresh antes de enviar un bloque');
 const retry=setup({prior:first.sessions[0],alreadyAccepted:true});
 await retry.run();
 assert.deepEqual(retry.calls,['status','finish','link'],
  'reanudación consulta siempre Drive y no repite partes aceptadas');
});

test('dos PDF con el MISMO SHA pero distintas referencias conservan recibos diferentes y no se cruzan',()=>{
 const first={...referencia,localRef:randomUUID()};
 const second={...referencia,localRef:randomUUID()};
 const id1=fileIdParaReferencia(first);
 const id2=fileIdParaReferencia(second);
 assert.notEqual(id1,id2);
 assert.match(id1,/^pdf-[a-f0-9]{16}-[a-f0-9]{32}$/);
 assert.equal(fileIdParaReferencia(first),id1);
 const mk=(ref,id)=>({ok:true,status:'verified',verified:true,
  storageVerified:true,pageVerification:'server',paymentAuthorized:false,
  receiptId:'DOC-'+randomUUID(),orderId,fileId:id,
  name:id+'__'+name,mode:'bn',bytes:ref.bytes,sha256,pages:1});
 const rec1=mk(first,id1),rec2=mk(second,id2);
 assert.equal(verificarVinculoCotizadorV2({
  referencia:first,recibo:rec1,sessionId:rec1.receiptId,
  expectedOrderId:orderId,expectedMode:'bn'
 }).fileId,id1);
 assert.equal(verificarVinculoCotizadorV2({
  referencia:second,recibo:rec2,sessionId:rec2.receiptId,
  expectedOrderId:orderId,expectedMode:'bn'
 }).fileId,id2);
 assert.throws(()=>verificarVinculoCotizadorV2({
  referencia:second,recibo:rec1,sessionId:rec1.receiptId,
  expectedOrderId:orderId,expectedMode:'bn'
 }),/PDF de Google no coincide/);
 const legacyId='pdf-'+sha256.slice(0,24),old=mk(first,legacyId);
 assert.equal(verificarVinculoCotizadorV2({
  referencia:first,recibo:old,sessionId:old.receiptId,
  expectedOrderId:orderId,expectedMode:'bn'
 }).fileId,legacyId,'El recibo de antes de la migración sigue siendo aceptado');
});

test('medición privada informa sólo tipo y duración de RPC sin interferir con el flujo',async()=>{
 const t=setup({newSession:true});
 const result=await t.run();
 assert.equal(result.receiptId,uploadId);
 assert.deepEqual(t.timings.map(e=>e.fase),['start','part','finish','vinculo']);
 for(const e of t.timings){
  assert.deepEqual(Object.keys(e).sort(),['duracionMs','fase']);
  assert.ok(Number.isSafeInteger(e.duracionMs)&&e.duracionMs>=0);
  assert.doesNotMatch(JSON.stringify(e),new RegExp(token));
  assert.doesNotMatch(JSON.stringify(e),/archivo\.pdf|dataBase64|uploadId/);
 }
});
test('si la instrumentación arroja error, no interrumpe el envío y se mantiene el recibo',async()=>{
 const t=setup({newSession:true,onTiming:()=>{throw Error('Diagnóstico fallido');}});
 const result=await t.run();
 assert.equal(result.receiptId,uploadId);
 assert.deepEqual(t.calls,['start','part','finish','link']);
});
test('un ACK perdido se recupera, y también se mide el status extraordinario',async()=>{
 const t=setup({newSession:true,ackLost:true});
 await t.run();
 assert.deepEqual(t.timings.map(e=>e.fase),['start','part','status','finish','vinculo']);
});
