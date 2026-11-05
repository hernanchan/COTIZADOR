import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx={Request,Response,URL,URLSearchParams,Headers,TextEncoder,crypto:webcrypto,console,AbortSignal};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const decide=vm.runInContext('etaResourceQueueDecision',ctx);
const json=(items)=>JSON.stringify({trabajos:items});
const order=(items)=>json(items);
const docs=(anillado='ninguno')=>({servicio:'documentos',tipoAnillado:anillado});
const plot=(...modes)=>({servicio:'ploteos',planoPorPagina:modes.map(modo=>({modo}))});
const row=(...items)=>({manifest_json:json(items)});
const capacity=(print_parallel=2,binding_parallel=1,plotter_parallel=2)=>({
 print_parallel,binding_parallel,plotter_parallel,revision:1
});
test('cola de ploteos no bloquea impresiones y viceversa',()=>{
 const d=decide(order([docs()]),[row(plot('cad')),row(plot('poster'))],capacity());
 assert.equal(d.calibrated,true);assert.equal(d.requiresReview,false);
 assert.equal(d.status,'available');
 const p=decide(order([plot('poster')]),[row(docs()),row(docs())],capacity());
 assert.equal(p.calibrated,true);assert.equal(p.requiresReview,false);
});
test('CAD y póster del mismo pedido cuentan como UNA ocupación del plotter',()=>{
 const current=order([plot('cad','poster')]);
 const one=decide(current,[row(plot('cad','poster'))],capacity(2,1,2));
 assert.equal(one.status,'available');
 const two=decide(current,[row(plot('cad','poster')),row(plot('cad'))],capacity(2,1,2));
 assert.equal(two.status,'saturated');
 assert.equal(two.requiresReview,true);
});
test('un pedido documentos más anillado debe tener ambos recursos libres',()=>{
 const current=order([docs('grupo'),docs('grupo')]);
 const free=decide(current,[row(docs()),row(plot('cad'))],capacity(2,1,1));
 assert.equal(free.status,'available');
 const busy=decide(current,[row(docs('individual'))],capacity(2,1,1));
 assert.equal(busy.status,'saturated');
 assert.equal(busy.requiresReview,true);
 const bindingUnknown=decide(current,[],capacity(2,0,2));
 assert.equal(bindingUnknown.status,'unconfigured');
 assert.equal(bindingUnknown.calibrated,false);
 const printUnknown=decide(order([docs()]),[],capacity(0,3,2));
 assert.equal(printUnknown.status,'unconfigured');
});
test('las instrucciones incompletas y la cola truncada NO generan fechas',()=>{
 assert.equal(decide(order([{servicio:'documentos'}]),[],capacity()).status,'incomplete');
 assert.equal(decide(order([docs()]),[row({servicio:'documentos'})],capacity()).status,'unknown_queue');
 assert.equal(decide(order([docs()]),[],capacity(),true).status,'unknown_queue');
 assert.equal(decide(order([{servicio:'otro'}]),[],capacity()).status,'incomplete');
});
test('la consulta D1 excluye pendientes posteriores salvo trabajos ya preparando',async()=>{
 let actualSQL='',args=[];
 const original='2030-06-05 12:00:00',id='abffb7df-463e-4b01-9831-4f6bd8916a9a';
 const env={DB:{prepare(sql){
  if(sql.startsWith('SELECT m.manifest_json FROM orders o')){actualSQL=sql;return {
   bind(...a){args=a;return this},async all(){return {results:[row(docs())]}}};
  }
  if(sql.includes('FROM central_eta_resources WHERE id=1'))return {
   async first(){return capacity(2,1,1)}};
  if(sql.startsWith('CREATE '))return {async run(){return {meta:{changes:0}}}};
  throw Error('Unexpected SQL '+sql);
 }}};
 const check=vm.runInContext('etaResourceQueueForOrder',ctx);
 const result=await check(env,{id,paid_at:original,manifest_json:order([docs()])});
 assert.equal(result.status,'available');
 assert.match(actualSQL,/o\.id<>/);
 assert.match(actualSQL,/p\.state='verified'/);
 assert.match(actualSQL,/en_preparacion/);
 assert.match(actualSQL,/pendiente/);
 assert.match(actualSQL,/LIMIT 501/);
 assert.deepEqual(args,[id,original,original,id]);
});
test('no se inventan minutos por orden o recurso; fecha solo con agenda',()=>{
 const calculate=vm.runInContext('etaForQueue',ctx);
 assert.equal(calculate({base_minutes:180,parallel_orders:4},0).minutes,180);
 assert.equal(calculate({base_minutes:180,parallel_orders:4},14).minutes,180);
 assert.match(source,/resources=await etaResourceQueueForOrder\(env,x\)/);
 assert.match(source,/base\.requiresReview=resources\.requiresReview/);
 assert.match(source,/base\.queueCalibrated=resources\.calibrated/);
 assert.match(source,/operatingReadyAt=base\.queueCalibrated&&!base\.requiresReview&&calendar\.configured/);
 assert.match(source,/if\(manual\.ready_at\)estimate=\{type:"manual"/);
 const customer=vm.runInContext('clientTrackingHtml',ctx);
 assert.doesNotMatch(customer,/DEMO_ADMIN_KEY|manifest_json|telefonoContacto|CENTRAL_BRIDGE_KEY/);
 const script=customer.slice(customer.indexOf('<script>')+8,customer.indexOf('</script>'));
 new vm.Script(script);
 assert.match(script,/resourceStatus/);
});
