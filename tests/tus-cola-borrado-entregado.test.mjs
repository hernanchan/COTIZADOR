import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const s=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,
 console,AbortSignal,fetch:()=>{throw Error('No external network')}});
vm.runInContext(s.replace('export default {','globalThis.worker = {'),ctx);
const queue=vm.runInContext('centralQueueDeliveryCleanup',ctx);
const order='b69f8ef5-63eb-4728-a967-584c63f39c41';
const web='WEB-ENSAYO-'+'A'.repeat(32);
let writes=0,queries=0,pending=null,delivered=true,verified=true;
const DB={prepare(sql){
 const st={
  bind(...args){this.params=args;return this},
  async run(){
   if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
   if(sql.startsWith('INSERT INTO central_tus_purge_audit'))return {meta:{changes:1}};
   if(sql.startsWith('INSERT OR IGNORE INTO central_tus_purge_queue')){
    assert.deepEqual(this.params,[order,web,3,'Mostrador']);
    writes++;
    if(!pending)pending='pending';
    return {meta:{changes:1}};
   }
   throw Error('Unexpected write '+sql)
  },
  async first(){
   queries++;
   if(sql.startsWith('SELECT m.web_order_id')){
    assert.match(sql,/p\.state='entregado'/);
    assert.match(sql,/r\.state='verified'/);
    assert.deepEqual(this.params,[order,3]);
    return delivered&&verified?{web_order_id:web,file_count:2}:null;
   }
   if(sql.startsWith('SELECT state FROM central_tus_purge_queue'))
    return pending?{state:pending}:null;
   throw Error('Unexpected read '+sql)
  }
 };return st
}};
test('Compuerta apagada: marcar entregado NO encola ni borra archivos',async()=>{
 writes=0;queries=0;pending=null;
 const r=await queue({DB},order,3,'Mostrador');
 assert.equal(r.state,'desactivado');
 assert.equal(r.filesDeleted,0);
 assert.equal(writes,0);
 assert.equal(queries,0);
});
test('Solo encola TUS entregado con pago verificado; idempotente',async()=>{
 pending=null;writes=0;queries=0;delivered=true;verified=true;
 const env={DB,CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_TUS_PURGE_CANARY_ORDER:web};
 const a=await queue(env,order,3,'Mostrador');
 assert.equal(a.state,'pending');
 assert.equal(a.filesDeleted,0);
 const b=await queue(env,order,3,'Mostrador');
 assert.equal(b.state,'pending');
 assert.equal(pending,'pending');
 assert.ok(queries>=2);
});
test('Bloquea pago sin verificar o trabajo que aún no está entregado',async()=>{
 pending=null;writes=0;
 const env={DB,CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_TUS_PURGE_CANARY_ORDER:web};
 delivered=false;
 let r=await queue(env,order,3,'Mostrador');
 assert.equal(r.state,'no_elegible');
 verified=false;delivered=true;
 r=await queue(env,order,3,'Mostrador');
 assert.equal(r.state,'no_elegible');
 assert.equal(writes,0);
 verified=true;
});
test('El cambio a ENTREGADO mantiene la cola a resguardo y nunca llama Storage',()=>{
 const fn=s.slice(s.indexOf('async function centralUpdateProduction('),
 s.indexOf('async function ensurePreparationEstimates('));
 assert.match(fn,/if\(d\.to==='entregado'\)/);
 assert.match(fn,/centralQueueDeliveryCleanup/);
 assert.doesNotMatch(fn,/storage\.supabase\.co|DELETE|remove\(/);
});

test('Ni otra orden ni una canaria sin configurar pueden ingresar a la cola',async()=>{
 pending=null;writes=0;queries=0;delivered=true;verified=true;
 const unset=await queue({DB,CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY'},order,3,'Mostrador');
 assert.equal(unset.state,'no_elegible');
 const wrong=await queue({DB,CENTRAL_TUS_PURGE_QUEUE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_TUS_PURGE_CANARY_ORDER:'WEB-ENSAYO-'+'B'.repeat(32)},order,3,'Mostrador');
 assert.equal(wrong.state,'no_elegible');
 assert.equal(writes,0);
});
