import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx={Request,Response,Headers,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const records=[];let reads=0;
const env={DEMO_ADMIN_KEY:'PRIVADO',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY',
 MP_TEST_ACCESS_TOKEN:'TEST',MP_TEST_SELLER_ID:'seller',TEST_WEBHOOK_URL:'https://test.invalid/webhook',MP_WEBHOOK_SECRET:'webhook',
 DB:{prepare(sql){
  let args=[];return {
   bind(...v){args=v;return this},
   async run(){
    if(sql.startsWith('CREATE '))return {meta:{changes:0}};
    if(sql.startsWith('INSERT INTO central_eta_productivity_samples')){
     records.push({resource:args[0],quantity:args[1],duration_seconds:args[2],
      operator:args[3],created_at:'2026-11-05 09:00:00'});
     return {meta:{changes:1}};
    }
    throw Error('SQL inesperado: '+sql);
   },
   async all(){
    reads++;
    assert.match(sql,/FROM central_eta_productivity_samples/);
    return {results:[...records].reverse().slice(0,40).map(({operator,...r})=>r)};
   }
  };
 }}};
const url='https://test.invalid/admin/api/central/productivity-samples';
const get=(secret)=>ctx.worker.fetch(new Request(url,{headers:secret?{Authorization:'Bearer '+secret}:{}}),env);
const post=(payload,secret='PRIVADO')=>ctx.worker.fetch(new Request(url,{
 method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
 body:JSON.stringify(payload)}),env);
const data={resource:'docs_bn',quantity:120,durationSeconds:750,operator:'Operador',confirmed:true};
test('medición protegida por clave y bandera de ensayo',async()=>{
 reads=0;
 assert.equal((await get()).status,401);
 assert.equal((await post(data,'NO')).status,401);
 assert.equal(reads,0);
 const disabled=await ctx.worker.fetch(new Request(url,{headers:{Authorization:'Bearer PRIVADO'}}),
  {...env,CENTRAL_PRODUCTION_TRACKING_ENABLED:'OFF'});
 assert.equal(disabled.status,503);
});
test('solo acepta cantidades y segundos medidos, sin identificadores de cliente',async()=>{
 for(const invalid of [
  {...data,quantity:0},{...data,durationSeconds:0},{...data,durationSeconds:28801},
  {...data,quantity:1.5},{...data,resource:'otro'},{...data,confirmed:false},
  {...data,filename:'cliente.pdf'}, {...data,operator:'a'}
 ])assert.equal((await post(invalid)).status,400);
 assert.equal(records.length,0);
 assert.equal((await post(data)).status,200);
 assert.equal((await post({...data,resource:'cad',quantity:245})).status,200);
 assert.equal(records.length,2);
 const response=await get('PRIVADO');
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.equal(payload.etaApplied,false);
 assert.equal(payload.samples.length,2);
 assert.equal(payload.countLast40.docs_bn,1);
 assert.equal(payload.countLast40.cad,1);
 assert.doesNotMatch(JSON.stringify(payload),/operator|filename|telefono|cliente\.pdf/);
});
test('UI sólo registra después de confirmar, nunca aplica mediciones a la ETA',()=>{
 const html=vm.runInContext('adminHtml',ctx);
 const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
 new vm.Script(script);
 assert.match(html,/etaSamplesPanel/);
 assert.match(html,/etaCalendarWeekdayDraft/);
 assert.match(script,/confirm\("¿Registrar esta medición realizada/);
 assert.match(script,/confirmed:true/);
 assert.match(script,/sin guardar/);
 const customer=source.slice(source.indexOf('async function trackingCustomerStatus'),
  source.indexOf('async function centralAdminDetail'));
 assert.doesNotMatch(customer,/etaSamplesApi|central_eta_productivity_samples/);
 assert.match(source,/central_eta_productivity_samples/);
});
