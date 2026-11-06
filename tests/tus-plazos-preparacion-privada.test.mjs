import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const proxy=readFileSync(new URL('../integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs',import.meta.url),'utf8');
const page=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
const scope={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal,
 fetch:()=>{throw Error('No external network')}};
scope.globalThis=scope;vm.createContext(scope);
vm.runInContext(src.replace('export default {','globalThis.worker = {'),scope);
const admin=vm.runInContext('adminHtml',scope),script=admin.slice(admin.indexOf('<script>')+8,admin.indexOf('</script>'));
const id='b69f8ef5-63eb-4728-a967-584c63f39c41';
let paid=true,stage='pendiente',estimate=null,events=[],writes=0;
const db={
 prepare(sql){
  let args=[];const q={
   get sql(){return sql},get args(){return args},
   bind(...a){args=a;return this},
   async run(){
    writes++;
    if(sql.startsWith('CREATE '))return {meta:{changes:0}};
    if(sql.startsWith('INSERT OR IGNORE INTO central_preparation_estimates')){
     if(!estimate)estimate={ready_at:null,version:0,operator:null,reason:'',updated_at:null};
     return {meta:{changes:1}};
    }
    throw Error('Unexpected D1 write: '+sql);
   },
   async first(){
    if(sql.includes("SELECT o.id,COALESCE(s.state,'pendiente') AS stage FROM orders o"))
     return paid?{id,stage}:null;
    if(sql.includes('FROM central_preparation_estimates WHERE order_id=?'))
     return estimate&&args[0]===id?{...estimate}:null;
    throw Error('Unexpected D1 SELECT: '+sql);
   }
  };return q;
 },
 async batch(qs){
  const [a,b]=qs;
  assert.match(a.sql,/UPDATE central_preparation_estimates SET/);
  assert.match(b.sql,/INSERT INTO central_preparation_estimate_events/);
  const [ready,operator,reason,order,version]=a.args;
  if(!paid||order!==id||!estimate||estimate.version!==version)
   return [{meta:{changes:0}},{meta:{changes:0}}];
  const old=estimate.ready_at;
  estimate={ready_at:ready,operator,reason,version:version+1,updated_at:'2026-11-04 20:00:00'};
  events.push({order_id:id,version:version+1,previous_at:old,ready_at:ready,operator,reason});
  return [{meta:{changes:1}},{meta:{changes:1}}];
 }
};
const env={DB:db,DEMO_ADMIN_KEY:'PANEL_TEST_ONLY',MP_TEST_ACCESS_TOKEN:'FAKE',
 MP_TEST_SELLER_ID:'test',MP_WEBHOOK_SECRET:'FAKE',
 TEST_WEBHOOK_URL:'https://test.invalid/webhook',
 CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY'};
const later=hours=>new Date(Date.now()+hours*3600000).toISOString();
async function post(data,token='PANEL_TEST_ONLY',environment=env){
 const response=await scope.worker.fetch(new Request('https://test.invalid/admin/api/central/preparation-estimate',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(data)
 }),environment);
 return {status:response.status,data:await response.json()};
}
const payload=(ready_at,expected_version=0,reason='')=>({
 order_id:id,ready_at,operator:'Mostrador',reason,expected_version,confirmed:true
});
function reset(){paid=true;stage='pendiente';estimate=null;events=[];writes=0}

test('la nueva interfaz de Central compila y mantiene el tablero, pago y archivos',()=>{
 new vm.Script(script);
 assert.match(script,/function renderPreparationEstimate\(orderId,track,estimate\)/);
 assert.match(script,/function preparationTimeLocal\(utc\)/);
 assert.match(script,/America\/Argentina\/Cordoba/);
 assert.match(script,/\/admin\/api\/central\/preparation-estimate/);
 assert.match(script,/expected_version:estimate\.version/);
 assert.match(script,/preparationTimeLocal\(order\.estimated_ready_at\)/);
 assert.match(script,/Solo se informa al cliente tras pago verificado/);
 assert.match(script,/Descargar ZIP/);
 assert.match(src,/e\.ready_at AS estimated_ready_at/);
 assert.match(src,/state='verified'/);
 assert.doesNotMatch(script,/service_role/);
});
test('sin clave y con flag apagado no registra plazos',async()=>{
 reset();
 assert.equal((await post(payload(later(2)),'NO')).status,401);
 assert.equal((await post(payload(later(2)),'PANEL_TEST_ONLY',
  {...env,CENTRAL_PRODUCTION_TRACKING_ENABLED:'OFF'})).status,503);
 assert.equal(writes,0);
});
test('no permite plazos para transferencias pendientes ni pedidos finalizados',async()=>{
 reset();paid=false;
 assert.equal((await post(payload(later(2)))).status,409);
 assert.equal(estimate,null);
 paid=true;stage='entregado';
 assert.equal((await post(payload(later(2)))).status,409);
 assert.equal(estimate,null);
});
test('rechaza fechas inventadas, vencidas, enormes y falta de confirmación',async()=>{
 reset();
 for(const bad of ['mañana','2026-01-01T00:00:00.000Z',later(24*60),'',
  '2026-11-30T18:00:00-03:00']){
  assert.equal((await post(payload(bad))).status,422,bad);
 }
 assert.equal((await post({...payload(later(2)),confirmed:false})).status,400);
 assert.equal(estimate,null);
});
test('crea horario provisional en D1 y guarda responsable, versión e historial',async()=>{
 reset();
 const eta=later(4),saved=await post(payload(eta));
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal(saved.data.estimate.ready_at,eta);
 assert.equal(saved.data.estimate.source,'operador');
 assert.equal(saved.data.estimate.provisional,true);
 assert.equal(saved.data.productionAuthorized,false);
 assert.equal(saved.data.paymentsEnabled,false);
 assert.equal(estimate.version,1);
 assert.equal(events.length,1);
 assert.equal(events[0].operator,'Mostrador');
 assert.equal((await post(payload(later(3),0))).status,409,'versión obsoleta');
 assert.equal(estimate.version,1);
});
test('postergar o retirar requiere motivo y conserva auditoría',async()=>{
 reset();
 const a=later(2),b=later(5);
 assert.equal((await post(payload(a))).status,200);
 assert.equal((await post(payload(b,1))).status,422);
 assert.equal((await post(payload(b,1,'Cola de trabajos'))).status,200);
 assert.equal(events[1].reason,'Cola de trabajos');
 assert.equal(events[1].previous_at,a);
 assert.equal((await post(payload(null,2))).status,422);
 assert.equal((await post(payload(null,2,'Cliente avisado'))).status,200);
 assert.equal(estimate.ready_at,null);
 assert.equal(estimate.version,3);
 assert.equal(events.length,3);
});
test('nunca inventa un plazo por carga ni lo filtra a pagos pendientes',()=>{
 const checkout=src.slice(src.indexOf('async function centralClientSandboxPayment('),src.indexOf('async function documentSandboxEligibility('));
 const status=checkout.slice(checkout.indexOf('if(p.action==="status")'),checkout.indexOf('if(typeof dispatch!=="function"',checkout.indexOf('if(p.action==="status")')));
 assert.match(status,/estado==="pagado"/);
 assert.match(status,/preparationEstimateDetail\(env,belongs\.id\)/);
 assert.match(status,/preparacionEstimada/);
 assert.ok(status.includes('!["listo","entregado"].includes'));
 assert.match(proxy,/result.estado==='pagado'&&result.preparacionEstimada/);
 assert.match(proxy,/new Date\(parsed\).toISOString\(\)===eta.readyAt/);
 assert.match(page,/Preparación estimada \(provisional\)/);
 assert.match(page,/plazo a confirmar después del pago/);
 assert.doesNotMatch(status,/Math\.ceil\(.*pages|pages.*por.*minuto/);
});
