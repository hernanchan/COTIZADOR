import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx={Request,Response,Headers,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(src.replace('export default {','globalThis.worker = {'),ctx);
const classify=vm.runInContext('etaResourceTags',ctx);
function row(trabajos){return {manifest_json:JSON.stringify({trabajos})};}
const jobs=[
 row([{servicio:'documentos',tipoAnillado:'ninguno',modo:'bn'}]),
 row([{servicio:'documentos',tipoAnillado:'grupo',grupoAnillado:'1',modo:'color'},
  {servicio:'documentos',tipoAnillado:'grupo',grupoAnillado:'1',modo:'b/n'}]),
 row([{servicio:'ploteos',planoPorPagina:[{modo:'cad'},{modo:'poster'}]}]),
 row([{servicio:'documentos'}])
];
let saved=null,events=[],reads=0,batches=0;
const env={DEMO_ADMIN_KEY:'PANEL_ONLY',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY',
 MP_TEST_ACCESS_TOKEN:'TEST',MP_TEST_SELLER_ID:'seller',TEST_WEBHOOK_URL:'https://test.invalid/webhook',MP_WEBHOOK_SECRET:'webhook',
 DB:{prepare(sql){
  let args=[];return{
   get sql(){return sql},get args(){return args},
   bind(...v){args=v;return this},
   async first(){
    reads++;
    if(sql.includes('FROM central_eta_resources WHERE id=1'))return saved;
    throw Error('Unexpected first: '+sql);
   },
   async all(){
    reads++;
    if(sql.includes('SELECT m.manifest_json FROM orders'))return {results:jobs};
    throw Error('Unexpected all: '+sql);
   },
   async run(){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
    throw Error('Unexpected run: '+sql);
   }
  };
 },
 async batch(queries){
  batches++;
  const [a,b]=queries;assert.match(a.sql,/central_eta_resources/);
  assert.match(b.sql,/central_eta_resource_events/);
  if(a.sql.startsWith('INSERT OR IGNORE')){
   saved={print_parallel:a.args[0],binding_parallel:a.args[1],
    plotter_parallel:a.args[2],operator:a.args[3],revision:1};
  }else{
   assert.equal(a.args[4],saved.revision);
   saved={print_parallel:a.args[0],binding_parallel:a.args[1],
    plotter_parallel:a.args[2],operator:a.args[3],revision:saved.revision+1};
  }
  events.push({...saved});
  return [{meta:{changes:1}},{meta:{changes:1}}];
 }
}};
const url='https://test.invalid/admin/api/central/resource-capacity';
const get=(key)=>ctx.worker.fetch(new Request(url,{headers:key?{Authorization:'Bearer '+key}:{}}),env);
const post=(data,key='PANEL_ONLY')=>ctx.worker.fetch(new Request(url,{
 method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
 body:JSON.stringify(data)}),env);
const draft=(revision=0)=>({printParallel:2,bindingParallel:1,plotterParallel:1,
 expectedRevision:revision,operator:'Operador de turno',confirmed:true});
test('clasifica pedidos por impresiones, anillado, CAD y póster sin duplicar grupo',()=>{
 const a=classify(jobs[0].manifest_json);
 assert.equal(a.documents,true);assert.equal(a.binding,false);assert.equal(a.bn,true);assert.equal(a.color,false);
 const b=classify(jobs[1].manifest_json);
 assert.equal(b.documents,true);assert.equal(b.binding,true);assert.equal(b.bn,true);assert.equal(b.color,true);
 const c=classify(jobs[2].manifest_json);
 assert.equal(c.cad,true);assert.equal(c.poster,true);
 assert.equal(c.documents,false);
 assert.equal(classify(jobs[3].manifest_json).review,true);
 assert.equal(classify(jobs[3].manifest_json).unknownPrint,true);
 assert.equal(classify(row([{servicio:'documentos',tipoAnillado:'ninguno',modo:'color'}]).manifest_json).color,true);
 assert.equal(classify('not-json').review,true);
});
test('sin clave y flag privado no filtra la carga ni escribe D1',async()=>{
 saved=null;batches=0;reads=0;
 assert.equal((await get()).status,401);
 assert.equal((await post(draft(),'incorrecta')).status,401);
 assert.equal(reads,0);assert.equal(batches,0);
 assert.equal((await ctx.worker.fetch(new Request(url,{
  headers:{Authorization:'Bearer PANEL_ONLY'}
 }),{...env,CENTRAL_PRODUCTION_TRACKING_ENABLED:'OFF'})).status,503);
});
test('GET muestra conteo de pedidos verificados, no PDF ni datos personales',async()=>{
 saved=null;const r=await get('PANEL_ONLY');
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.settings.revision,0);
 assert.equal(body.settings.print_parallel,0);
 assert.equal(body.load.paidActive,4);
 assert.equal(body.load.documents,3);
 assert.equal(body.load.bn,2);
 assert.equal(body.load.color,1);
 assert.equal(body.load.unknownPrint,1);
 assert.equal(body.load.binding,1);
 assert.equal(body.load.cad,1);
 assert.equal(body.load.poster,1);
 assert.equal(body.load.review,1);
 assert.equal(body.load.partial,false);
 assert.doesNotMatch(JSON.stringify(body),/manifest_json|telefono|nombreOriginal|customer_phone/);
});
test('guarda capacidad en D1 con revisión; 0 significa sin calibrar',async()=>{
 saved=null;events=[];batches=0;
 const result=await post(draft());
 assert.equal(result.status,200,await result.clone().text());
 const body=await result.json();
 assert.equal(body.saved,true);assert.equal(body.paymentsEnabled,false);
 assert.equal(saved.revision,1);
 assert.equal(saved.binding_parallel,1);
 assert.equal(events.length,1);
 assert.equal((await post(draft())).status,409);
 assert.equal(events.length,1);
 assert.equal((await post({...draft(1),printParallel:31})).status,400);
 assert.equal(events.length,1);
 assert.equal((await post({...draft(1),printParallel:0})).status,200);
 assert.equal(saved.print_parallel,0);
 assert.equal(saved.revision,2);
 assert.equal(events.length,2);
});
test('panel actualizado compila; sólo la cola calibrada puede habilitar fecha con agenda',()=>{
 const html=vm.runInContext('adminHtml',ctx);
 const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
 new vm.Script(script);
 assert.match(html,/etaResourcesPanel/);
 assert.match(script,/etaResourcesLoad/);
 assert.match(script,/modo sin especificar/);
 assert.match(html,/cupo conjunto anterior/);
 assert.match(script,/expectedRevision:etaResourcesSnapshot.revision/);
 const customer=src.slice(src.indexOf('async function trackingCustomerStatus'),src.indexOf('async function centralAdminDetail'));
 assert.match(customer,/etaResourceQueueForOrder/);
 assert.match(customer,/base\.queueCalibrated=resources\.calibrated/);
 assert.match(customer,/operatingReadyAt=base\.queueCalibrated&&!base\.requiresReview&&calendar\.configured/);
 assert.doesNotMatch(customer,/etaResourceLoad/);
});
