import test from 'node:test';
import assert from 'node:assert/strict';
import {atenderPurgaArchivoLive} from './purga-archivo-live-documentos.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',web='WEB-ENSAYO-'+'B'.repeat(32);
const receipt='123e4567-e89b-42d3-a456-426614174004';
const base={schema:'saber-docs-live-purge-file-v1',webOrderId:web,
 commercialOrderId:'123e4567-e89b-42d3-a456-426614174000',
 fileId:'pdf_0',receiptId:'DOC-'+receipt,sha256:'a'.repeat(64),productionVersion:4};
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_PURGE_GATE:GO,
 DOCS_LIVE_TUS_GATE:GO,DOCS_LIVE_R2_GATE:GO,CENTRAL_BRIDGE_KEY:'x'.repeat(40)};
const req=new Request('https://pedidos.libreriasaber.com.ar/internal/live/purge-file',{method:'POST'});
const r2={...base,transport:'r2',bytes:41*1048576,etag:'etag12345678',
 objectKey:'r2-v1/'+web+'/'+receipt+'.pdf'};
const tus={...base,transport:'tus',bytes:12345,etag:null,
 objectKey:'v2/'+web+'/'+receipt+'.pdf'};
test('purga LIVE rechaza peticiones si el gate está apagado',async()=>{
 let called=0;
 const res=await atenderPurgaArchivoLive(req,{...env,DOCS_LIVE_PURGE_GATE:'NO_GO'},{
  verifyRequest:async()=>{called++;return r2},
  removeR2:async()=>{called++}});
 assert.equal(res.status,503);assert.equal(called,0);
});
test('purga LIVE rechaza payload que intenta sustituir ruta o archivo',async()=>{
 for(const data of [{...r2,objectKey:'r2-v1/'+web+'/otro.pdf'},
  {...r2,sha256:'invalid'}, {...tus,bytes:41*1048576}]){
  const res=await atenderPurgaArchivoLive(req,env,{verifyRequest:async()=>data,
   removeR2:async()=>{throw Error('UNEXPECTED_DELETE')},
   removeTUS:async()=>{throw Error('UNEXPECTED_DELETE')}});
  assert.equal(res.status,422);
 }
});
test('R2 y TUS devuelven prueba de ausencia sólo después de eliminación',async()=>{
 for(const p of [r2,tus]){
  let called=0;
  const res=await atenderPurgaArchivoLive(req,env,{verifyRequest:async()=>p,
   removeR2:async()=>{called++},removeTUS:async()=>{called++}});
  assert.equal(res.status,200);
  assert.equal((await res.json()).verifiedAbsent,true);
  assert.equal(called,1);
 }
});
test('Storage no disponible conserva pendiente para reintento',async()=>{
 const res=await atenderPurgaArchivoLive(req,env,{verifyRequest:async()=>r2,
  removeR2:async()=>{throw Error('STORAGE_DOWN')}});
 assert.equal(res.status,409);
 assert.equal((await res.json()).ok,false);
});
