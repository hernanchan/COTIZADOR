import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {planDeBorradoEntregado,eliminarYConfirmarObjetos,recibirLimpiezaEntregadaInterna}
 from '../integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs';
const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const otherOrder='WEB-ENSAYO-'+'B'.repeat(32);
const receipt='DOC-a69f8ef5-63eb-4728-a967-584c63f39c41';
const planBody=()=>({ok:true,schema:'saber-central-tus-purge-plan-v1',webOrderId,
 commercialOrderId:'b69f8ef5-63eb-4728-a967-584c63f39c41',
 productionState:'entregado',productionVersion:3,paymentVerified:true,
 deletionExecuted:false,retentionDays:0,files:[{receiptId:receipt,fileId:'PDF01',sha256:'a'.repeat(64),bytes:4552}]});
const plan=()=>planDeBorradoEntregado(planBody(),webOrderId);
const env={DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',DOCS_TUS_PURGE_CANARY_ORDER:webOrderId,DOCS_TUS_SUPABASE_SERVICE_KEY:'X'.repeat(48),
 CENTRAL_BRIDGE_KEY:'Y'.repeat(48)};
function fakeStorage(initial=[]){
 const remaining=new Set(initial),calls=[],size=new Map(initial.map(x=>[x,4552]));
 return {remaining,calls,fetcher:async(url,options)=>{
   const method=options.method;
   const path=method==='HEAD'?decodeURIComponent(new URL(url).pathname.split('/saber-tus-lab/')[1]):null;
   calls.push({method,path,url});
   if(method==='HEAD')return new Response(null,{status:remaining.has(path)?200:404,
     headers:remaining.has(path)?{'Content-Length':String(size.get(path))}:{}});
   if(method==='DELETE'){
    const body=JSON.parse(options.body);
    for(const p of body.prefixes)remaining.delete(p);
    return new Response(JSON.stringify(body.prefixes.map(name=>({name}))),{status:200});
   }
   throw Error('Unexpected Storage method '+method);
 }};
}
const signed=async(body={schema:'saber-docs-tus-purge-delivered-v1',webOrderId},changeSig=false)=>{
 const ts=String(Math.floor(Date.now()/1000)),id=webcrypto.randomUUID(),raw=JSON.stringify(body);
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await webcrypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+raw))).toString('hex');
 return new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/internal/tus-purge-delivered',{
  method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':ts,
   'x-saber-request-id':id,'x-saber-signature':changeSig?'0'.repeat(64):sig},body:raw
 });
};
test('Solo elimina originales de la orden validada: nunca toca la otra orden',async()=>{
 const p=plan(),another='v2/'+otherOrder+'/'+receipt.slice(4)+'.pdf';
 const fake=fakeStorage([p.paths[0],another]);
 const result=await eliminarYConfirmarObjetos(p,env,{fetcher:fake.fetcher});
 assert.deepEqual(result,{verifiedAbsent:true,deletedCount:1});
 assert.ok(!fake.remaining.has(p.paths[0]));
 assert.ok(fake.remaining.has(another));
 assert.equal(fake.calls.filter(c=>c.method==='DELETE').length,1);
 assert.ok(fake.calls.filter(c=>c.method==='HEAD').length>=2);
});
test('Segundo intento después del borrado no llama DELETE de nuevo',async()=>{
 const p=plan(),fake=fakeStorage();
 const result=await eliminarYConfirmarObjetos(p,env,{fetcher:fake.fetcher});
 assert.equal(result.verifiedAbsent,true);
 assert.equal(fake.calls.filter(c=>c.method==='DELETE').length,0);
});
test('Si Storage no eliminó el archivo, no se confirma la Central',async()=>{
 const p=plan(),fake=fakeStorage([p.paths[0]]);
 let acknowledged=0;
 const fetcher=async(url,options)=>{
  if(options.method==='DELETE')return new Response('[]',{status:200});
  return fake.fetcher(url,options);
 };
 await assert.rejects(()=>eliminarYConfirmarObjetos(p,env,{fetcher}),/sigue presente/);
 const result=await recibirLimpiezaEntregadaInterna(await signed(),env,{
  central:async()=>p,
  remove:async()=>{throw Error('archivo no eliminado')},
  ack:async()=>{acknowledged++}
 });
 assert.equal(result.status,503);
 assert.equal(acknowledged,0);
});
test('Recepción interna exige flags y HMAC; no consulta D1 si falta autorización',async()=>{
 let lookups=0;
 const closed=await recibirLimpiezaEntregadaInterna(await signed(),{
  ...env,DOCS_TUS_PURGE_ENABLED:'OFF'},{
   central:async()=>{lookups++;return plan()}
  });
 assert.equal(closed.status,503);
 const bad=await recibirLimpiezaEntregadaInterna(await signed(undefined,true),env,{
  central:async()=>{lookups++;return plan()}
 });
 assert.equal(bad.status,401);
 assert.equal(lookups,0);
});
test('Entrega autorizada y verificación completa confirman la Central exactamente una vez',async()=>{
 let lookups=0,removals=0,acks=0;
 const res=await recibirLimpiezaEntregadaInterna(await signed(),env,{
  central:async()=>{lookups++;return plan()},
  remove:async()=>{removals++;return {verifiedAbsent:true,deletedCount:1}},
  ack:async()=>{acks++;return {ok:true,state:'completed'}}
 });
 assert.equal(res.status,200);
 assert.equal((await res.json()).deletedCount,1);
 assert.equal(lookups,1);assert.equal(removals,1);assert.equal(acks,1);
});

test('Prohibir cualquier DELETE y consulta Central si la orden no es la canaria autorizada',async()=>{
 const p=plan(),fake=fakeStorage([p.paths[0]]);
 await assert.rejects(()=>eliminarYConfirmarObjetos(p,{
  ...env,DOCS_TUS_PURGE_CANARY_ORDER:otherOrder
 },{fetcher:fake.fetcher}),/no habilitada|inseguro/);
 assert.equal(fake.calls.length,0);
 let centralLookups=0;
 const res=await recibirLimpiezaEntregadaInterna(await signed(),{
  ...env,DOCS_TUS_PURGE_CANARY_ORDER:otherOrder},{
  central:async()=>{centralLookups++;return p}
 });
 assert.equal(res.status,403);
 assert.equal(centralLookups,0);
});
