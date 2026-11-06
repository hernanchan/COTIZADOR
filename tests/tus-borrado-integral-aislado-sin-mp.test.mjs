import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {planDeBorradoEntregado,recibirLimpiezaEntregadaInterna,eliminarYConfirmarObjetos}
 from '../integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const context=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,
 console,AbortSignal,fetch:()=>{throw Error('LA PRUEBA AISLADA NO ACCEDE A INTERNET')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
const queued=vm.runInContext('centralQueueDeliveryCleanup',context);
const processQueue=vm.runInContext('centralProcessTUSPurgeQueue',context);
const receiveAck=vm.runInContext('centralTUSPurgeComplete',context);
const order='b69f8ef5-63eb-4728-a967-584c63f39c41';
const webOrder='WEB-ENSAYO-'+'A'.repeat(32);
const protectedWeb='WEB-ENSAYO-'+'B'.repeat(32);
const fileId='PDF01',receipt='DOC-a69f8ef5-63eb-4728-a967-584c63f39c41';
const originalPath='v2/'+webOrder+'/'+receipt.slice(4)+'.pdf';
const historicalPath='v2/'+protectedWeb+'/'+receipt.slice(4)+'.pdf';
const key='ISOLATED_HMAC_KEY_32_CHARS_'+('Z'.repeat(36));
const storageKey='ISOLATED_SUPABASE_ROLE_KEY_'+('P'.repeat(40));
const flags={CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_TUS_PURGE_EXECUTE_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_TUS_PURGE_CANARY_ORDER:webOrder,
 CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:key,
 DEMO_ADMIN_KEY:'ISOLATED_DEMO_ADMIN_PASSWORD_123',MP_WEBHOOK_SECRET:'ISOLATED_MP_WEBHOOK_SECRET_456'};
const docsFlags={DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_PURGE_CANARY_ORDER:webOrder,DOCS_TUS_SUPABASE_SERVICE_KEY:storageKey,
 CENTRAL_BRIDGE_KEY:key};
async function sign(path,payload){
 const ts=String(Math.floor(Date.now()/1000)),id=webcrypto.randomUUID();
 const raw=JSON.stringify(payload),k=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(key),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await webcrypto.subtle.sign('HMAC',k,
  new TextEncoder().encode(ts+'\n'+id+'\n'+raw))).toString('hex');
 return new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev'+path,{
  method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':ts,
   'x-saber-request-id':id,'x-saber-signature':sig},body:raw});
}
function scenario({paid=true,delivered=true,canary=webOrder,storageFailure=false}={}){
 const state={paid,verified:paid,delivered,productionVersion:3,
  queue:null,audit:[],events:[],storage:new Set([originalPath,historicalPath]),
  calls:[],storageFailure,network:0};
 const manifest={schema:'saber-central-documentos-d1-v1',webOrderId:webOrder,
  trabajos:[{reciboPrivado:receipt,fileId,sha256:'a'.repeat(64),bytes:4552}]};
 const rows={original:{id:order,amount_ars:100,deposit_ars:100},
  manifest:{web_order_id:webOrder,commercial_order_id:order,manifest_json:JSON.stringify(manifest),
   file_count:1,amount_ars:100}};
 const db={prepare(sql){
  const statement={args:[],bind(...args){this.args=args;return this},
   async run(){
    const args=this.args;
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
    if(sql.startsWith('INSERT OR IGNORE INTO central_tus_purge_queue')){
     if(!state.queue){state.queue={order_id:order,web_order_id:webOrder,production_version:args[2],state:'pending',
      attempts:0};return {meta:{changes:1}}}
     return {meta:{changes:0}};
    }
    if(sql.startsWith('UPDATE central_tus_purge_queue SET state=\'processing\'')){
     if(!state.queue||!['pending','error'].includes(state.queue.state))return {meta:{changes:0}};
     state.queue.state='processing';state.queue.attempts++;return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE central_tus_purge_queue SET state=\'completed\'')){
     if(state.queue?.state!=='processing')return {meta:{changes:0}};
     state.queue.state='completed';return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE central_tus_purge_queue SET state=\'error\'')){
     if(state.queue?.state!=='processing')return {meta:{changes:0}};
     state.queue.state='error';return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO central_tus_purge_audit')){
     const phase=sql.match(/'([a-z]+)'/g)?.at(-1)?.replace(/'/g,'')||'unknown';
     state.audit.push({phase,args});return {meta:{changes:1}};
    }
    throw Error('SQL escritura no simulada: '+sql.slice(0,110))
   },
   async first(){
    const args=this.args;
    if(sql.startsWith('SELECT m.web_order_id,m.file_count,m.created_at AS manifest_created_at FROM central_document_manifests')){
     return state.paid&&state.verified&&state.delivered&&args[1]===state.productionVersion?
      {web_order_id:webOrder,file_count:1}:null;
    }
    if(sql.startsWith('SELECT state FROM central_tus_purge_queue')){
     return state.queue?{state:state.queue.state}:null;
    }
    if(sql.startsWith('SELECT m.web_order_id,m.commercial_order_id,m.manifest_json')){
     return state.paid&&state.verified&&state.delivered?
      {...rows.manifest,...rows.original,paid_at:'2026-11-06 12:00:00',
       payment_status:'paid',production_state:'entregado',
       production_version:state.productionVersion,delivered_at:'2026-11-06 12:20:00'}:null;
    }
    if(sql.startsWith('SELECT q.order_id,q.state,m.file_count')){
     return state.paid&&state.verified&&state.delivered&&state.queue&&
      args[1]===state.productionVersion?
      {order_id:order,state:state.queue.state,file_count:1}:null;
    }
    throw Error('SQL lectura no simulada: '+sql.slice(0,110))
   },
   async all(){
    if(sql.startsWith('SELECT q.order_id,q.web_order_id,q.production_version,m.created_at AS manifest_created_at FROM central_tus_purge_queue q'))
     return {results:state.queue&&['pending','error'].includes(state.queue.state)?[{
      order_id:order,web_order_id:webOrder,production_version:state.productionVersion}]:[]};
    if(sql.startsWith('SELECT r.receipt_id,r.file_id,r.sha256 FROM central_document_receipts'))
     return {results:[{receipt_id:receipt,file_id:fileId,sha256:'a'.repeat(64)}]};
    throw Error('SQL listado no simulado: '+sql.slice(0,110))
   }};
   return statement;
 }};
 async function storage(url,options){
  const method=options.method;
  state.calls.push({method,url});
  const suffix='/saber-tus-lab/';
  const raw=decodeURIComponent(new URL(url).pathname.split(suffix)[1]||'');
  if(method==='HEAD'){
   if(state.storage.has(raw))return new Response(null,{status:200,
    headers:{'Content-Length':'4552'}});
   return new Response(null,{status:400});
  }
  if(method==='GET'&&url.includes('/object/info/')){
   return Response.json({statusCode:'404',code:'NoSuchKey',
    error:'not_found',message:'Object not found'},{status:400});
  }
  if(method==='DELETE'){
   if(state.storageFailure)return Response.json({error:'Storage unavailable'},{status:503});
   const names=JSON.parse(options.body).prefixes;
   assert.deepEqual(names,[originalPath]);
   names.forEach(name=>state.storage.delete(name));
   return Response.json(names.map(name=>({name})));
  }
  throw Error('Acceso a Storage inesperado '+method);
 }
 const centralEnv={...flags,DB:db};
 const documentEnv={...docsFlags};
 // Los servicios son REALES (funciones de la aplicación), pero transportes, D1
 // y Storage son todos SIMULADOS en memoria. No hay red ni pago verdadero.
 centralEnv.SABER_DOCUMENTOS={fetch:async request=>{
  state.network++;
  return recibirLimpiezaEntregadaInterna(request,documentEnv,{
   central:async (_env,web)=>{
    state.lastStage='plan';try{
    const response=await vm.runInContext('centralTUSDeliveryPurgePlan',context)(
     await sign('/internal/central/tus-purge-plan',{
      schema:'saber-central-tus-purge-plan-v1',webOrderId:web}),centralEnv);
    if(response.status!==200){state.lastError='plan HTTP '+response.status+' '+await response.text();throw Error(state.lastError)}
    try{return planDeBorradoEntregado(await response.json(),web)}catch(error){state.lastError='parse plan: '+String(error);throw error}
    }catch(error){state.lastError=String(error);throw error}
   },
   remove:async(plan,e)=>{state.lastStage='storage';try{return await eliminarYConfirmarObjetos(plan,e,{fetcher:storage})}catch(error){state.lastError=String(error);throw error}},
   ack:async (_env,p)=>{
    const r=await receiveAck(await sign('/internal/central/tus-purge-complete',{
     schema:'saber-central-tus-purge-complete-v1',
     webOrderId:p.webOrderId,productionVersion:p.version,deletedCount:p.count
    }),centralEnv);
    if(!r.ok){state.lastError='ack denied '+r.status+' '+await r.text();throw Error(state.lastError)}
    return r.json();
   }
  });
 }};
 return {state,env:centralEnv};
}
test('Pago y Entregado verdaderos en D1 SIMULADO: encola, HMAC, borra, certifica y audita',async()=>{
 const {state,env}=scenario();
 const first=await queued(env,order,3,'Ensayo');
 assert.equal(first.state,'pending');
 const result=await processQueue(env,{orderId:order,limit:1});
 assert.equal(result.processed,1,JSON.stringify({lastStage:state.lastStage,lastError:state.lastError,queue:state.queue,events:state.audit.map(x=>x.phase),calls:state.calls.map(x=>x.method)}));
 assert.equal(result.errors,0);
 assert.equal(state.queue.state,'completed');
 assert.deepEqual(state.audit.map(x=>x.phase),['queued','attempt','completed']);
 assert.equal(state.storage.has(originalPath),false);
 assert.equal(state.storage.has(historicalPath),true);
 assert.equal(state.calls.filter(x=>x.method==='DELETE').length,1);
 assert.ok(state.calls.some(x=>x.method==='GET'&&x.url.includes('/object/info/')));
 const repeat=await processQueue(env,{orderId:order,limit:1});
 assert.equal(repeat.processed,0);
 assert.equal(state.calls.filter(x=>x.method==='DELETE').length,1);
});
test('Sin pago verificado, no encola ni accede a Storage',async()=>{
 const {state,env}=scenario({paid:false});
 assert.equal((await queued(env,order,3,'Ensayo')).state,'no_elegible');
 assert.equal(state.queue,null);
 assert.equal(state.calls.length,0);
});
test('Sin Entregado, no encola ni accede a Storage',async()=>{
 const {state,env}=scenario({delivered:false});
 assert.equal((await queued(env,order,3,'Ensayo')).state,'no_elegible');
 assert.equal(state.calls.length,0);
});
test('Si falla Storage, deja error auditable y conserva bytes para reintento',async()=>{
 const {state,env}=scenario({storageFailure:true});
 assert.equal((await queued(env,order,3,'Ensayo')).state,'pending');
 const r=await processQueue(env,{orderId:order,limit:1});
 assert.equal(r.processed,0);
 assert.equal(r.errors,1);
 assert.equal(state.queue.state,'error');
 assert.deepEqual(state.audit.map(x=>x.phase),['queued','attempt','error']);
 assert.equal(state.storage.has(originalPath),true);
 assert.equal(state.storage.has(historicalPath),true);
 state.storageFailure=false;
 const next=await processQueue(env,{orderId:order,limit:1});
 assert.equal(next.processed,1,JSON.stringify({lastStage:state.lastStage,lastError:state.lastError,queue:state.queue,calls:state.calls.map(x=>x.method)}));
 assert.equal(state.queue.state,'completed');
 assert.equal(state.storage.has(originalPath),false);
 assert.equal(state.storage.has(historicalPath),true);
 assert.deepEqual(state.audit.map(x=>x.phase),['queued','attempt','error','attempt','completed']);
});
test('Compuertas OFF impiden proceso de borrado hasta en una orden pagada y entregada',async()=>{
 const {state,env}=scenario();
 await queued(env,order,3,'Ensayo');
 env.CENTRAL_TUS_PURGE_EXECUTE_ENABLED='OFF';
 assert.equal((await processQueue(env,{orderId:order})).enabled,false);
 assert.equal(state.storage.size,2);
 env.CENTRAL_TUS_PURGE_EXECUTE_ENABLED='PRIVATE_TEST_ONLY';
 env.DOCS_TUS_PURGE_ENABLED='OFF';
 env.SABER_DOCUMENTOS={fetch:()=>{throw Error('No deben enviarse solicitudes')}};
 env.CENTRAL_TUS_PURGE_CANARY_ORDER=protectedWeb;
 const r=await processQueue(env,{orderId:order});
 assert.equal(r.processed,0);
 assert.equal(state.storage.size,2);
});
