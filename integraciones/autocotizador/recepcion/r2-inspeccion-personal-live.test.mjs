import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {inspeccionR2PersonalLive} from './r2-inspeccion-personal-live.mjs';
const G='GO_COMERCIAL_CONFIRMADO',WEB='WEB-ENSAYO-'+'A'.repeat(32);
const SHA='a'.repeat(64),FILE='pdf_0';
const KEY='r2-v1/'+WEB+'/123e4567-e89b-42d3-a456-426614174000.pdf';
const BASE='https://pedidos.libreriasaber.com.ar';
const query='?webOrderId='+WEB+'&fileId='+FILE;
const valid={schema:'saber-r2-staff-inspection-source-v1',ok:true,
 webOrderId:WEB,fileId:FILE,objectKey:KEY,sha256:SHA,bytes:60*1048576,
 paginasDeclaradas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'poster'}],
 inspected:false,productionAuthorized:false};
function env(){
 const calls=[];
 return {calls,worker:{
  SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  DOCS_MP_LIVE_GATE:G,DOCS_LIVE_RECEPCION_GATE:G,DOCS_LIVE_STAFF_GATE:G,
  DOCS_LIVE_R2_GATE:G,DOCS_LIVE_R2_STAGING_GATE:G,DOCS_LIVE_PACKAGE_GATE:G,
  CENTRAL_BRIDGE_KEY:'staff-bridge-only-secret-12345678901234567890',
  SABER_CENTRAL:{async fetch(r){
   calls.push({type:'central',path:new URL(r.url).pathname});
   return Response.json(new URL(r.url).pathname.endsWith('staff-board')?
    {ok:true,orders:[],source:'production-d1-verified-payments-only',productionAuthorized:false}:
    new URL(r.url).pathname.endsWith('confirm')?
    {ok:true,inspected:true,webOrderId:WEB,fileId:FILE,
     saved:true,productionAuthorized:false,prepressApproved:false}:valid);
  }},
  SABER_R2_GRANDES_LIVE:{
   async head(k){calls.push({type:'head',key:k});return {size:valid.bytes}},
   async get(k){calls.push({type:'get',key:k});
    return {size:valid.bytes,body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array([37,80,68,70,45]));controller.close()}})}
   }
  }
 }};
}
test('solo personal: sin autorización no consulta R2 ni Central',async()=>{
 const e=env();
 const req=new Request(BASE+'/personal/api/live-r2-inspection-source'+query);
 assert.equal((await inspeccionR2PersonalLive(req,e.worker,{authorized:false})).status,401);
 assert.equal(e.calls.length,0);
});
test('si R2 LIVE está cerrado no se accede a archivos ni a D1',async()=>{
 const e=env();e.worker.DOCS_LIVE_R2_GATE='NO_GO';
 const req=new Request(BASE+'/personal/api/live-r2-inspection-original'+query);
 assert.equal((await inspeccionR2PersonalLive(req,e.worker,{authorized:true})).status,503);
 assert.equal(e.calls.length,0);
});
test('lista de pedidos LIVE autenticada sólo por puente firmado',async()=>{
 const e=env();
 const r=await inspeccionR2PersonalLive(new Request(BASE+'/personal/api/live-r2-board'),e.worker,{authorized:true});
 assert.equal(r.status,200);
 const d=await r.json();assert.deepEqual(d.orders,[]);
 assert.equal(e.calls[0].path,'/internal/central/live/r2-staff-board');
});
test('ficha del R2 no revela objeto ni URL del bucket',async()=>{
 const e=env();
 const r=await inspeccionR2PersonalLive(new Request(BASE+'/personal/api/live-r2-inspection-source'+query),
 e.worker,{authorized:true});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.sha256,SHA);
 assert.equal(JSON.stringify(d).includes(KEY),false);
 assert.deepEqual(e.calls.map(x=>x.type),['central']);
});
test('descarga R2 es streaming y exige identidad de orden verificada en Central',async()=>{
 const e=env();
 const r=await inspeccionR2PersonalLive(new Request(BASE+'/personal/api/live-r2-inspection-original'+query),
 e.worker,{authorized:true});
 assert.equal(r.status,200);
 assert.equal(r.headers.get('content-type'),'application/pdf');
 assert.deepEqual(e.calls.map(x=>x.type),['central','head','get']);
 assert.equal(e.calls[1].key,KEY);
});
test('inspección manual sólo con origen browser y cuenta operator',async()=>{
 const e=env();
 const input={webOrderId:WEB,fileId:FILE,confirmed:true,operator:'Preprensa',
  measuredDimensions:[{numero:1,anchoCm:59.4,altoCm:84.1}]};
 const url=BASE+'/personal/api/live-r2-inspection-confirm';
 const bad=new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(input)});
 assert.equal((await inspeccionR2PersonalLive(bad,e.worker,{authorized:true})).status,403);
 assert.equal(e.calls.length,0);
 const okay=new Request(url,{method:'POST',headers:{Origin:BASE,
  'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result=await inspeccionR2PersonalLive(okay,e.worker,{authorized:true});
 assert.equal(result.status,200);
 assert.equal((await result.json()).productionAuthorized,false);
 assert.equal(e.calls[0].path,'/internal/central/live/r2-inspection-confirm');
});
