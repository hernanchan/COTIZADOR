/**
 * One-time MP Sandbox checkout preflight for order 030. Strictly no real charges:
 * Central health must report paymentsEnabled=false; checkout token belongs
 * to a test_user seller, verified by the server. Does not post a card yet.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_DEPLOY_TOKEN;
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;
assert.ok(account&&token&&pass?.length>10);
const cf='https://api.cloudflare.com/client/v4/accounts/'+account;
const auth={'Authorization':'Bearer '+token};
async function cloud(path,opts={}){
 const r=await fetch(cf+path,{...opts,headers:{...auth,...opts.headers},signal:AbortSignal.timeout(35000)});
 const v=await r.json();assert.equal(v.success,true,'Cloudflare query failure: '+JSON.stringify(v.errors));
 return v.result;
}
const settings=await cloud('/workers/scripts/saber-pagos-pruebas/settings');
const db=settings.bindings.find(x=>x.name==='DB'&&['d1','d1_database'].includes(x.type));
assert.ok(db,'No D1 binding');
const databaseId=db.id||db.database_id;
assert.ok(/^[a-f0-9-]{36}$/i.test(databaseId),'Missing D1 database id');
const query=await cloud('/d1/database/'+databaseId+'/query',{method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({sql:'SELECT w.number,l.web_order_id,l.commercial_order_id,o.amount_ars,o.status FROM central_work_order_numbers w JOIN central_r2_universal_order_links l ON l.commercial_order_id=w.commercial_order_id JOIN orders o ON o.id=l.commercial_order_id WHERE w.number=30 LIMIT 1'})});
const row=query?.[0]?.results?.[0];
assert.ok(row,'No se encontró la orden de ensayo 030 en Central Sandbox');
assert.equal(row.amount_ars,1000);
assert.equal(String(row.number),'30');
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const health=await fetch(central+'/health',{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
assert.equal(health.ok,true);assert.equal(health.paymentsEnabled,false);
console.log('ORDEN_030_EN_CENTRAL amount=1000 status='+row.status+' realPayments=false');
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const headers={'Authorization':'Basic '+Buffer.from('operador:'+pass).toString('base64'),
 'Content-Type':'application/json','Origin':origin};
async function checkout(action){
 const response=await fetch(origin+'/prueba-v2/api/ensayo-r2-checkout-universal',{method:'POST',headers,
 body:JSON.stringify({action,webOrderId:row.web_order_id,commercialOrderId:row.commercial_order_id}),
 signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>({}));
 console.log('MP_SANDBOX_'+action.toUpperCase()+'_HTTP='+response.status+' state='+(data.estado||'none')+' reason='+(data.error||'ok'));
 assert.equal(response.status,200,'Sandbox endpoint: '+String(data.error||'error'));
 assert.equal(data.amountArs,1000);
 return data;
}
const state=await checkout('status');
if(state.estado==='pagado_esperando_archivos'){
 console.log('ORDEN_030_YA_PAGADA_MP_D1_VERIFICADO');process.exit(0);
}
assert.equal(state.estado,'pendiente');
assert.equal(state.uploadAuthorized,false);
const started=await checkout('start');
assert.equal(started.estado,'pendiente');assert.equal(started.uploadAuthorized,false);
const u=new URL(started.checkoutUrl);
assert.equal(u.protocol,'https:');
assert.match(u.hostname,/(^|\.)mercadopago\.com(\.ar)?$/);
console.log('MP_TEST_CHECKOUT_HOST='+u.host+' path='+u.pathname);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1200,height:900},locale:'es-AR'});
 const page=await context.newPage();
 let response;
 try{response=await page.goto(started.checkoutUrl,{waitUntil:'domcontentloaded',timeout:65000});}
 catch(e){console.log('MP_BROWSER_NAVIGATION_BLOCKER='+String(e.message||e).slice(0,180));throw e}
 await page.waitForTimeout(3500);
 console.log('MP_BROWSER_HTTP='+response?.status()+' urlhost='+new URL(page.url()).hostname);
 console.log('MP_BROWSER_PAGE_TITLE='+JSON.stringify((await page.title()).slice(0,160)));
 console.log('MP_BROWSER_TEXT='+JSON.stringify((await page.locator('body').innerText().catch(()=>'' )).replace(/\s+/g,' ').slice(0,1700)));
 for(const [index,fr] of page.frames().entries()){
  const fields=await fr.locator('input').evaluateAll(els=>els.slice(0,25).map(x=>({
   type:x.type,name:x.name,placeholder:x.placeholder,autocomplete:x.autocomplete,aria:x.getAttribute('aria-label')
  }))).catch(()=>[]);
  const buttons=await fr.locator('button').evaluateAll(els=>els.slice(0,12).map(x=>(x.textContent||'').trim().slice(0,60))).catch(()=>[]);
  console.log('MP_FRAME_'+index+' host='+(()=>{try{return new URL(fr.url()).hostname}catch{return 'none'}})()+
    ' fields='+JSON.stringify(fields)+' buttons='+JSON.stringify(buttons));
 }
 await context.close();
}finally{await browser.close()}
console.log('MP_CHECKOUT_INSPECCIONADO_SIN_PAGO_NI_DATOS_REALES');
