import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {planDeBorradoEntregado,eliminarYConfirmarObjetos,recibirLimpiezaEntregadaInterna}
 from '../integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:globalThis.crypto,
 console,AbortSignal,fetch:()=>{throw Error('Sin acceso a red en la prueba')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const eligible=vm.runInContext('centralPurgeCanaryAllowed',ctx);
const queue=vm.runInContext('centralQueueDeliveryCleanup',ctx);
const web='WEB-ENSAYO-'+'A'.repeat(32);
const old='2026-11-06 23:59:59';
const newDate='2026-11-07 00:00:00';
const newEnv={CENTRAL_TUS_PURGE_SCOPE:'NEW_ORDERS_ONLY',
 CENTRAL_TUS_PURGE_CANARY_ORDER:'WEB-ENSAYO-'+'B'.repeat(32)};
test('nuevo modo autoriza solo pedidos a partir de fecha de corte, sin confiar en canaria vieja',()=>{
 assert.equal(eligible(newEnv,web,old),false);
 assert.equal(eligible(newEnv,web,newDate),true);
 assert.equal(eligible(newEnv,web,'2026-11-08 12:34:56'),true);
 assert.equal(eligible(newEnv,web,null),false);
 assert.equal(eligible(newEnv,web,'mal formato'),false);
 assert.equal(eligible({...newEnv,CENTRAL_TUS_PURGE_SCOPE:undefined},web,newDate),false);
});
test('la Central no encola pedidos históricos aunque estén pagados y entregados',async()=>{
 let created=old,writes=0;
 const env={...newEnv,CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',DB:{
  prepare(sql){
   return {bind(){return this},async run(){
     if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
     writes++;return {meta:{changes:1}};
    },async first(){
     if(sql.includes('FROM central_document_manifests m'))
      return {web_order_id:web,file_count:1,manifest_created_at:created};
     if(sql.includes('FROM central_tus_purge_queue'))
      return {state:'pending'};
     throw Error('SELECT inesperado: '+sql);
    }}
  }}
 };
 assert.equal((await queue(env,'b69f8ef5-63eb-4728-a967-584c63f39c41',3,'Ensayo')).state,'no_elegible');
 assert.equal(writes,0);
 created=newDate;
 assert.equal((await queue(env,'b69f8ef5-63eb-4728-a967-584c63f39c41',3,'Ensayo')).state,'pending');
 assert.ok(writes>0);
});
test('segunda barrera en Documentos impide DELETE de pedido anterior al corte',async()=>{
 const payload={ok:true,schema:'saber-central-tus-purge-plan-v1',webOrderId:web,
  commercialOrderId:'b69f8ef5-63eb-4728-a967-584c63f39c41',
  productionState:'entregado',productionVersion:3,paymentVerified:true,
  deletionExecuted:false,retentionDays:0,manifestCreatedAt:old,
  files:[{receiptId:'DOC-a69f8ef5-63eb-4728-a967-584c63f39c41',
   fileId:'PDF01',sha256:'a'.repeat(64),bytes:4552}]};
 const plan=planDeBorradoEntregado(payload,web);
 const env={DOCS_TUS_PURGE_SCOPE:'NEW_ORDERS_ONLY',
  DOCS_TUS_PURGE_CANARY_ORDER:web,DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_SUPABASE_SERVICE_KEY:'X'.repeat(48)};
 let fetches=0;
 await assert.rejects(eliminarYConfirmarObjetos(plan,env,{fetcher:async()=>{
  fetches++;return new Response(null,{status:200});
 }}),/no habilitada|inseguro/);
 assert.equal(fetches,0);
 payload.manifestCreatedAt=newDate;
 const newest=planDeBorradoEntregado(payload,web);
 const mock=async (_url,options)=>{
  fetches++;
  assert.equal(options.method,'HEAD');
  return new Response(null,{status:404});
 };
 const result=await eliminarYConfirmarObjetos(newest,env,{fetcher:mock});
 assert.equal(result.verifiedAbsent,true);
 assert.equal(fetches,2);
});
test('ruta HMAC de Documentos rechaza plan histórico antes de usar Storage o acuse',async()=>{
 const payload={ok:true,schema:'saber-central-tus-purge-plan-v1',webOrderId:web,
  commercialOrderId:'b69f8ef5-63eb-4728-a967-584c63f39c41',
  productionState:'entregado',productionVersion:3,paymentVerified:true,
  deletionExecuted:false,retentionDays:0,manifestCreatedAt:old,
  files:[{receiptId:'DOC-a69f8ef5-63eb-4728-a967-584c63f39c41',
   fileId:'PDF01',sha256:'a'.repeat(64),bytes:4552}]};
 let remove=0,ack=0;
 const res=await recibirLimpiezaEntregadaInterna(
  new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/internal/tus-purge-delivered',{method:'POST'}),
  {DOCS_TUS_PURGE_SCOPE:'NEW_ORDERS_ONLY',DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY'},{
   verify:async()=>({webOrderId:web}),
   central:async()=>planDeBorradoEntregado(payload,web),
   remove:async()=>{remove++;return {verifiedAbsent:true,deletedCount:1}},
   ack:async()=>{ack++}
  });
 assert.equal(res.status,503);
 assert.equal(remove,0);assert.equal(ack,0);
});
