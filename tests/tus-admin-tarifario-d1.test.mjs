import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,
 console,AbortSignal,fetch:()=>{throw Error('Red externa no disponible')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const adminHtml=vm.runInContext('adminHtml',ctx);
const script=adminHtml.slice(adminHtml.indexOf('<script>')+8,adminHtml.indexOf('</script>'));
const route=vm.runInContext('priceAdminHandle',ctx);
const id='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const head={revision:0,approved_revision:0,draft_json:null,approved_json:null,updated_at:'2026-11-03'};
const history=[];
const DB={
 prepare(sql){
  const x={sql,args:[],
   bind(...a){this.args=a;return this},
   async run(){return {meta:{changes:1}}},
   async first(){
    if(sql.includes('SELECT revision,approved_revision,draft_json,approved_json'))return {...head};
    if(sql.includes('SELECT payload_json FROM central_pricing_admin_history'))
     return history.find(h=>h.revision===this.args[0])||null;
    return null;
   },
   async all(){
    if(sql.includes('FROM central_pricing_admin_history'))return {results:[...history].reverse().slice(0,15)};
    return {results:[]};
   }
  };return x;
 },
 async batch(queries){
  const result=[];
  for(const st of queries){
   if(st.sql.includes('UPDATE central_pricing_admin_head SET draft_json=?')){
    if(head.revision!==st.args[1]){result.push({meta:{changes:0}});continue}
    head.draft_json=st.args[0];head.revision++;result.push({meta:{changes:1}});
   }else if(st.sql.includes('SET approved_json=draft_json')){
    if(head.revision!==st.args[0]||!head.draft_json){result.push({meta:{changes:0}});continue}
    head.approved_json=head.draft_json;head.draft_json=null;head.revision++;
    head.approved_revision=head.revision;result.push({meta:{changes:1}});
   }else if(st.sql.includes('INSERT INTO central_pricing_admin_history')){
    if(head.revision!==st.args[4]){result.push({meta:{changes:0}});continue}
    const [action,operator,payload_json,changed_count,revision]=st.args;
    assert.ok(!history.some(h=>h.revision===revision),'Revisión única');
    history.push({revision,action,operator,payload_json,changed_count,created_at:'2026-11-03'});
    result.push({meta:{changes:1}});
   }else throw Error('SQL inesperada');
  }
  return result;
 }
};
const env={DB,DEMO_ADMIN_KEY:'test-admin',PRICE_ADMIN_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY'};
function call(path,{key=env.DEMO_ADMIN_KEY,method='GET',body,settings=env}={}){
 return route(new Request(id+path,{method,headers:{Authorization:'Bearer '+key,
  ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})}),settings,path);
}
test('panel privado: UI sin publicación comercial, campos agrupados y JS sintáctico',()=>{
 new vm.Script(script);
 assert.match(adminHtml,/id="priceGroup"/);
 assert.match(adminHtml,/id="priceSearch"/);
 assert.match(adminHtml,/id="priceSave"/);
 assert.match(adminHtml,/id="priceApprove"/);
 assert.match(adminHtml,/id="priceHistory"/);
 assert.match(adminHtml,/21\/08\/2026/);
 assert.match(adminHtml,/NO cambia los precios de la web pública/);
 assert.ok(vm.runInContext('PRICE_ADMIN_FIELDS.length',ctx)>310);
 assert.equal(vm.runInContext('priceAdminAt(PRICE_ADMIN_BASELINE,"prices.bnA4.scales.0.simple")',ctx),100);
 assert.equal(vm.runInContext('PRICE_ADMIN_BASELINE.promotions.weekly.length',ctx),7);
 assert.ok(vm.runInContext('PRICE_ADMIN_FIELDS.filter(x=>x.category==="Promos semanales").length',ctx)>=10);
 assert.match(adminHtml,/option value="Promos semanales"/);
});
test('la administración de precios tiene página propia con mismas autorizaciones de API',async()=>{
 const worker=vm.runInContext('worker',ctx);
 const response=await worker.fetch(new Request(id+'/admin/precios'),{},{});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/id="priceAdminFieldset"/);
 assert.match(html,/id="privateAccess"/);
 assert.match(html,/body\.price-only/);
 assert.match(html,/location\.pathname==='\/admin\/precios'/);
 assert.match(html,/id="priceSave"/);
 assert.match(html,/id="priceApprove"/);
 assert.match(html,/noindex,nofollow/);
});
test('ningún tarifario se expone ni se modifica sin autorización y flag privado',async()=>{
 assert.equal((await call('/admin/api/pricing',{key:'incorrecta'})).status,401);
 assert.equal((await call('/admin/api/pricing',{settings:{...env,PRICE_ADMIN_PRIVATE_ENABLED:'OFF'}})).status,503);
 assert.equal((await call('/admin/api/pricing/draft',{key:'incorrecta',method:'POST',
  body:{operator:'Responsable',expectedRevision:0,changes:[{path:'prices.bnA4.scales.0.simple',value:101}]}})).status,401);
});
test('D1: cargar, modificar precios y cupón, aprobar solo privado y restaurar',async()=>{
 const first=await call('/admin/api/pricing');
 assert.equal(first.status,200);
 const data=await first.json();
 assert.equal(data.revision,0);
 assert.equal(data.publicPricingConnected,false);
 assert.equal(data.paymentsEnabled,false);
 const old=data.fields.find(x=>x.path==='prices.bnA4.scales.0.simple');
 assert.equal(old.value,100);
 const draft=await call('/admin/api/pricing/draft',{method:'POST',body:{
  operator:'Mostrador principal',expectedRevision:0,
  changes:[{path:'prices.bnA4.scales.0.simple',value:105},
   {path:'promotions.codes.3.active',value:false}]
 }});
 assert.equal(draft.status,200);
 const saved=await draft.json();
 assert.equal(saved.revision,1);
 assert.equal(saved.publicPricingConnected,false);
 const next=(await (await call('/admin/api/pricing')).json());
 assert.equal(next.draftPresent,true);
 assert.equal(next.fields.find(x=>x.path==='prices.bnA4.scales.0.simple').value,105);
 assert.equal(next.history[0].action,'draft');
 assert.equal((await call('/admin/api/pricing/draft',{method:'POST',body:{
  operator:'Mostrador',expectedRevision:0,changes:[{path:'prices.bnA4.scales.0.simple',value:110}]
 }})).status,409,'Versiones obsoletas no pisan cambios');
 const confirm=await call('/admin/api/pricing/approve',{method:'POST',
  body:{operator:'Mostrador principal',expectedRevision:1,confirmed:true}});
 assert.equal(confirm.status,200);
 assert.equal((await confirm.json()).approvedPrivateOnly,true);
 const after=(await (await call('/admin/api/pricing')).json());
 assert.equal(after.draftPresent,false);
 assert.equal(after.approvedRevision,2);
 assert.equal(after.fields.find(x=>x.path==='prices.bnA4.scales.0.simple').value,105);
 const restored=await call('/admin/api/pricing/restore',{method:'POST',body:{
  operator:'Mostrador principal',expectedRevision:2,restoreRevision:1
 }});
 assert.equal(restored.status,200);
 assert.equal((await (await call('/admin/api/pricing')).json()).draftPresent,true);
});
test('rechaza inyección de configuración, precios negativos y promociones incoherentes',async()=>{
 const revision=head.revision;
 for(const entry of [{path:'prices.schema',value:'falso'},
   {path:'prices.bnA4.scales.0.simple',value:-1},
   {path:'promotions.codes.0.percent',value:89},
   {path:'promotions.codes.3.active',value:'sí'}]){
  const answer=await call('/admin/api/pricing/draft',{method:'POST',body:{
   operator:'Mostrador',expectedRevision:revision,changes:[entry]
  }});
  assert.equal(answer.status,422);
 }
 assert.equal(head.revision,revision);
});
