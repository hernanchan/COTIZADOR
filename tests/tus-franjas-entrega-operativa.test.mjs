import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const proxy=readFileSync(new URL('../integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs',import.meta.url),'utf8');
const portal=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
const ctx={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(src.replace('export default {','globalThis.worker = {'),ctx);
const plan=vm.runInContext('deliveryPlanForCustomer',ctx);
let saved=null,history=[],writes=0;
const env={DEMO_ADMIN_KEY:'PANEL_TEST',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY',
 MP_TEST_ACCESS_TOKEN:'FAKE',MP_TEST_SELLER_ID:'seller',TEST_WEBHOOK_URL:'https://test.invalid/webhook',MP_WEBHOOK_SECRET:'test',
 DB:{prepare(sql){
  let args=[];return {
   get sql(){return sql},get args(){return args},
   bind(...a){args=a;return this},
   async run(){writes++;if(sql.startsWith('CREATE '))return {meta:{changes:0}};throw Error(sql)},
   async first(){if(sql.includes('FROM central_delivery_plan WHERE id=1'))return saved;throw Error(sql)}
  };
 },async batch(stmts){
  const [a,b]=stmts;
  assert.match(a.sql,/central_delivery_plan/);
  assert.match(b.sql,/central_delivery_plan_events/);
  if(a.sql.startsWith('INSERT OR IGNORE')){
   if(saved)return [{meta:{changes:0}},{meta:{changes:0}}];
   saved={mode:a.args[0],operator:a.args[1],revision:1};
  }else{
   if(!saved||saved.revision!==a.args[2])return [{meta:{changes:0}},{meta:{changes:0}}];
   saved={mode:a.args[0],operator:a.args[1],revision:saved.revision+1};
  }
  history.push({...saved});
  return [{meta:{changes:1}},{meta:{changes:1}}];
 }}};
const url='https://test.invalid/admin/api/central/delivery-plan';
const get=(key='PANEL_TEST')=>ctx.worker.fetch(new Request(url,{headers:{Authorization:'Bearer '+key}}),env);
const post=(payload,key='PANEL_TEST')=>ctx.worker.fetch(new Request(url,{
 method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
 body:JSON.stringify(payload)}),env);
const body=(mode,expectedRevision)=>({mode,expectedRevision,operator:'Mostrador',confirmed:true});

test('la franja comercial no se consulta ni cambia sin clave o flag privado',async()=>{
 saved=null;history=[];writes=0;
 assert.equal((await get('incorrecta')).status,401);
 assert.equal((await post(body('hoy',0),'incorrecta')).status,401);
 assert.equal((await ctx.worker.fetch(new Request(url,{headers:{Authorization:'Bearer PANEL_TEST'}}),
  {...env,CENTRAL_PRODUCTION_TRACKING_ENABLED:'OFF'})).status,503);
 assert.equal(writes,0);assert.equal(history.length,0);
});

test('la Central puede elegir hoy, tarde, siguiente atención o confirmar: versión auditada',async()=>{
 saved=null;history=[];
 const original=await (await get()).json();
 assert.equal(original.settings.mode,'por_confirmar');
 assert.equal(original.settings.revision,0);
 const first=await post(body('hoy',0));
 assert.equal(first.status,200,await first.clone().text());
 assert.equal((await first.json()).settings.mode,'hoy');
 assert.equal(history.length,1);
 assert.equal((await post(body('hoy_tarde',0))).status,409);
 assert.equal((await post(body('inventado',1))).status,400);
 assert.equal((await post({...body('hoy_tarde',1),confirmed:false})).status,400);
 assert.equal((await post(body('hoy',1))).status,409);
 for(const mode of ['hoy_tarde','proximo_dia','por_confirmar']){
  assert.equal((await post(body(mode,saved.revision))).status,200);
 }
 assert.deepEqual(history.map(x=>x.mode),['hoy','hoy_tarde','proximo_dia','por_confirmar']);
 assert.equal(history[3].revision,4);
 assert.equal((await (await get()).json()).paymentsEnabled,false);
});

test('hoy no se promete al día siguiente, después de cerrar o los fines de semana',()=>{
 const jueves='2026-11-05 12:00:00';
 const tarde=Date.parse('2026-11-05T18:00:00Z');
 assert.equal(plan('hoy',jueves,'pendiente',tarde),'hoy');
 assert.equal(plan('hoy_tarde',jueves,'pendiente',tarde),'hoy_tarde');
 assert.equal(plan('hoy',jueves,'pendiente',Date.parse('2026-11-05T23:15:00Z')),'por_confirmar');
 assert.equal(plan('hoy',jueves,'pendiente',Date.parse('2026-11-06T14:00:00Z')),'por_confirmar');
 assert.equal(plan('hoy_tarde',jueves,'pendiente',Date.parse('2026-11-07T13:00:00Z')),'por_confirmar');
 assert.equal(plan('proximo_dia',jueves,'pendiente',tarde),'proximo_dia');
 assert.equal(plan('hoy',jueves,'en_preparacion',tarde),'hoy');
 assert.equal(plan('hoy',null,'pendiente',tarde),'por_confirmar');
});

test('confirmación, seguimiento y Central usan la franja sin inventar tiempos',()=>{
 const admin=vm.runInContext('adminHtml',ctx);
 const tracking=vm.runInContext('clientTrackingHtml',ctx);
 const adminScript=admin.slice(admin.indexOf('<script>')+8,admin.indexOf('</script>'));
 const clientScript=tracking.slice(tracking.indexOf('<script>')+8,tracking.indexOf('</script>'));
 new vm.Script(adminScript);new vm.Script(clientScript);
 assert.match(admin,/id="deliveryPlanPanel"/);
 assert.match(admin,/id="deliveryPlanMode"/);
 assert.match(adminScript,/\/admin\/api\/central\/delivery-plan/);
 assert.match(adminScript,/Definir hora de entrega/);
 assert.match(tracking,/Seguí este pedido/);
 assert.match(clientScript,/d\.deliveryPlan/);
 assert.match(clientScript,/fecha y hora más precisas/);
 assert.match(proxy,/result\.estado==='pagado'&&/);
 assert.match(proxy,/deliveryPlan=result\.deliveryPlan/);
 assert.match(portal,/result\.deliveryPlan/);
 const customer=src.slice(src.indexOf('async function trackingCustomerStatus'),
  src.indexOf('async function centralAdminDetail'));
 assert.match(customer,/manual\.ready_at/);
 assert.match(customer,/deliveryPlanForCustomer/);
 assert.doesNotMatch(customer,/etaForQueue|etaOperatingFinish|etaResourceQueueForOrder/);
 assert.doesNotMatch(tracking,/customer_phone|bank_reference|DEMO_ADMIN_KEY/);
});


test('seguimiento muestra previsión al pagar y al iniciar, luego fecha y hora precisas',()=>{
 const html=vm.runInContext('clientTrackingHtml',ctx);
 const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
 const start=script.indexOf('function render(d){');
 const end=script.indexOf('let busy=false;');
 assert.ok(start>0&&end>start);
 const els=Object.fromEntries(['order','stage','steps','eta'].map(k=>[k,{
  textContent:'',children:[],replaceChildren(){this.children=[]},
  append(child){this.children.push(child)}
 }]));
 const doc={getElementById:id=>els[id],createElement:()=>({textContent:'',className:''})};
 const run=vm.runInNewContext(
  'const el=id=>document.getElementById(id);const labels=["Pedido recibido","Pago confirmado","En preparación","Listo para retirar","Entregado"];'+
  script.slice(start,end)+';render',
  {document:doc,Intl,Date}
 );
 run({payment:'pagado',stage:'pendiente',phase:'Pago confirmado',deliveryPlan:'hoy',estimate:null});
 assert.match(els.eta.textContent,/durante el día de hoy/);
 run({payment:'pagado',stage:'en_preparacion',phase:'En preparación',
  deliveryPlan:'hoy',estimate:null});
 assert.match(els.eta.textContent,/previsión general es durante el día de hoy/);
 assert.match(els.eta.textContent,/hora más precisas/);
 run({payment:'pagado',stage:'en_preparacion',phase:'En preparación',
  deliveryPlan:'hoy',estimate:{type:'manual',readyAt:'2026-11-11T17:00:00.000Z'}});
 assert.match(els.eta.textContent,/14:00/);
 assert.doesNotMatch(els.eta.textContent,/en breve/i);
});
