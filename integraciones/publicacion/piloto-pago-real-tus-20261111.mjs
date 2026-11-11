/** LIVE pilot activation for ONE OWNER-INTENDED SMALL-PDF payment (TUS <=40 MiB).
 * No invoice or preference is created by this script. R2 stays NO_GO; main remains intact.
 * Existing paid orders must retain postpay upload and webhook if any rollback is needed.
 */
import assert from 'node:assert/strict';
const ACCOUNT=process.env.SABER_CF_ACCOUNT_ID;
const TOKEN=process.env.SABER_CF_DEPLOY_TOKEN;
const D1_TOKEN=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(ACCOUNT||'',/^[a-f0-9]{32}$/i);
assert.ok(TOKEN?.length>15&&D1_TOKEN?.length>15,'CF_CREDENTIAL_MISSING');
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const GO='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const workers={
 central:'saber-pagos-produccion',
 docs:'saber-documentos-produccion',
 webhook:'saber-webhook-produccion'
};
const keys={
 central:['CENTRAL_LIVE_DRAFT_GATE','CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_TUS_GATE','CENTRAL_LIVE_POSTPAY_GATE'],
 docs:['DOCS_LIVE_ORDER_GATE','DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_TUS_GATE'],
 webhook:['WEBHOOK_EDGE_GATE']
};
const R2=['DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_UPLOAD_GATE','DOCS_LIVE_R2_STAGING_GATE',
 'CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE'];
async function api(path,token,{method='GET',body,form}={}){
 const response=await fetch(BASE+path,{
  method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:form?{body:form}:{}),
  signal:AbortSignal.timeout(32000)});
 const obj=await response.json().catch(()=>null);
 assert.equal(response.ok,true,'CF_API_HTTP_'+response.status);
 assert.equal(obj?.success,true,'CF_API_NOT_SUCCESS_'+response.status);
 return obj.result;
}
const cfg=async key=>api('/workers/scripts/'+workers[key]+'/settings',TOKEN);
function has(settings,key,value,type='plain_text'){
 return settings.bindings?.some(x=>x.name===key&&x.type===type&&
  (value===undefined||x.text===value));
}
async function countOrders(){
 const dbs=await api('/d1/database',D1_TOKEN);
 const ids=dbs.filter(d=>d.name==='saber-pagos-produccion');
 assert.equal(ids.length,1,'PROD_D1_NOT_UNIQUE');
 const results=await api('/d1/database/'+ids[0].uuid+'/query',D1_TOKEN,{
  method:'POST',body:{sql:"SELECT COUNT(*) AS n FROM orders"}});
 assert.equal(results?.[0]?.success,true,'PROD_D1_UNREADABLE');
 return Number(results[0].results?.[0]?.n);
}
async function setKeys(which,allowed,expected){
 const prev=await cfg(which);
 for(const k of keys[which]){
  const matches=prev.bindings.filter(x=>x.name===k);
  assert.ok(matches.length<=1&&(!matches.length||matches[0].type==='plain_text'),
   'GATE_BINDING_TYPE_'+k);
  if(!allowed.includes(k))assert.ok(has(prev,k,GO)||has(prev,k,OFF),'GATE_UNEXPECTED_'+k);
 }
 const modified=allowed.filter(k=>!has(prev,k,expected));
 if(modified.length===0)return prev;
 const bindings=[
  ...prev.bindings.filter(x=>!modified.includes(x.name)).map(x=>
    x.type==='r2_bucket'?{name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:
    {name:x.name,type:'inherit'}),
  ...modified.map(name=>({name,type:'plain_text',text:expected}))
 ];
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings})],{type:'application/json'}),'settings.json');
 await api('/workers/scripts/'+workers[which]+'/settings',TOKEN,{method:'PATCH',form});
 let next;
 for(let i=0;i<9;i++){
  await new Promise(resolve=>setTimeout(resolve,900));
  next=await cfg(which);
  if(modified.every(k=>has(next,k,expected)))break;
 }
 for(const k of modified)
  assert.ok(has(next,k,expected),'GATE_PROPAGATION_FAIL_'+k);
 for(const before of prev.bindings)
  assert.ok(next.bindings.some(x=>x.name===before.name),'LOST_BINDING_'+before.name);
 return next;
}
const state=Object.fromEntries(await Promise.all(Object.keys(workers).map(async name=>[name,await cfg(name)])));
const {central,docs,webhook}=state;
const baseOnCentral=['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED',
 'CENTRAL_LIVE_PRICING_GATE','CENTRAL_LIVE_PACKAGE_GATE'];
const baseOnDocs=['DOCS_MP_LIVE_GATE','DOCS_LIVE_UI_GATE',
 'DOCS_LIVE_SESSION_GATE','DOCS_LIVE_PRICING_GATE',
 'DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE'];
for(const g of baseOnCentral)assert.ok(has(central,g,GO),'CENTRAL_REQUIRED_NOT_READY_'+g);
for(const g of baseOnDocs)assert.ok(has(docs,g,GO),'DOCS_REQUIRED_NOT_READY_'+g);
for(const s of [central,docs,webhook])
 assert.ok(has(s,'SABER_ENTORNO','produccion'),'RUNTIME_NOT_PRODUCTION');
assert.ok(has(central,'CENTRAL_DB_ENV','produccion')&&
 has(docs,'CENTRAL_DB_ENV','produccion'));
for(const k of R2)assert.ok(has(k.startsWith('DOCS')?docs:central,k,OFF),'R2_NOT_CLOSED_'+k);
assert.ok(has(docs,'DOCS_LIVE_TUS_BUCKET','saber-tus-produccion'));
for(const k of ['DOCS_LIVE_TUS_SERVICE_KEY','DOCS_LIVE_TUS_RECEIPT_KEY',
 'DOCS_LIVE_SESSION_KEY','DOCS_LIVE_STAFF_SECRET','DOCS_LIVE_TURNSTILE_SECRET'])
 assert.ok(has(docs,k,undefined,'secret_text'),'MISSING_SECRET_'+k);
assert.ok(has(docs,'DOCS_LIVE_TUS_PUBLISHABLE_KEY',undefined));
assert.ok(has(docs,'DOCS_LIVE_TUS_PROJECT_URL','https://sqjamuqiolwizzzzwxjy.storage.supabase.co/'));
assert.ok(docs.bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&
 x.type==='r2_bucket'&&x.bucket_name==='saber-documentos-produccion-privado'));
assert.ok(docs.bindings.some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&
 x.service==='saber-pagos-produccion'));
assert.ok(central.bindings.some(x=>x.name==='DB'&&x.type==='d1'));
assert.ok(webhook.bindings.some(x=>x.name==='SABER_CENTRAL_LIVE'&&
 x.type==='service'&&x.service==='saber-pagos-produccion'));
for(const [name,gs] of Object.entries(keys)){
 for(const k of gs)assert.ok(!state[name].bindings.some(x=>x.name===k)||
  has(state[name],k,OFF)||has(state[name],k,GO),'PILOT_GATE_UNKNOWN_'+k);
}
const n=await countOrders();
assert.equal(n,0,'PILOT_LIVE_D1_HAS_PREEXISTING_ORDERS');
console.log('PILOT_SABER_D1_EMPTY=true');
console.log('PILOT_TUS_BOUNDED_PDF_MAX_MIB=40');
console.log('PILOT_R2_LARGE_PDF_GATE_NO_GO=true');
console.log('PILOT_CHARGES_NOT_STARTED_BY_AUTOMATION=true');
try{
 // Set Central first: no customer order can be created until Documents switches on.
 await setKeys('central',keys.central,GO);
 // Webhook must be open before any buyer can be redirected to MP.
 await setKeys('webhook',keys.webhook,GO);
 await setKeys('docs',keys.docs,GO);
 const [c,d,w]=await Promise.all([cfg('central'),cfg('docs'),cfg('webhook')]);
 for(const [name,s] of [['central',c],['docs',d],['webhook',w]]){
  for(const key of keys[name])assert.ok(has(s,key,GO),'PILOT_NOT_ENABLED_'+key);
 }
 for(const key of R2)assert.ok(has(key.startsWith('DOCS')?d:c,key,OFF),'R2_ACCIDENTALLY_OPEN_'+key);
 for(const k of ['DOCS_LIVE_STAFF_SECRET','DOCS_LIVE_TUS_SERVICE_KEY','DOCS_LIVE_SESSION_KEY'])
  assert.ok(has(d,k,undefined,'secret_text'),'PILOT_SECRET_MISSING_'+k);
 const origin='https://pedidos.libreriasaber.com.ar';
 async function check(path,method='GET',headers={},body){
  const res=await fetch(origin+path,{method,headers,
   ...(body?{body}:{}),redirect:'manual',signal:AbortSignal.timeout(20000)});
  return {status:res.status,auth:res.headers.get('WWW-Authenticate')||''};
 }
 const ui=await check('/cotizar');
 assert.equal(ui.status,200,'PILOT_UI_UNAVAILABLE');
 const staff=await check('/personal/paquete');
 assert.equal(staff.status,401,'PILOT_STAFF_OPEN');
 const order=await check('/api/pedido/live/orden','POST',{
  Origin:origin,'Content-Type':'application/json'},'{}');
 assert.equal(order.status,503,'PILOT_ORDER_UNAUTHENTICATED_503_REQUIRED');
 const pay=await check('/api/pedido/live/checkout','POST',{
  Origin:origin,'Content-Type':'application/json'},'{}');
 assert.equal(pay.status,401,'PILOT_CHECKOUT_UNAUTHENTICATED_401_REQUIRED');
 const tus=await check('/api/pedido/live/tus/iniciar','POST',{
  Origin:origin,'Content-Type':'application/json'},'{}');
 assert.ok([401,503].includes(tus.status),'PILOT_TUS_UNAUTHENTICATED_DENIED');
 const large=await check('/api/pedido/live/r2/iniciar','POST',{
  Origin:origin,'Content-Type':'application/json'},'{}');
 assert.ok([401,503].includes(large.status),'PILOT_R2_GATE_DENIED');
 const url='https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live?type=payment&data.id=123456';
 const web=await fetch(url,{method:'POST',
  headers:{'Content-Type':'application/json','x-signature':'ts=1,v1=invalid','x-request-id':'invalid'},
  body:'{"type":"payment","data":{"id":"123456"}}',
  redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.ok([401,403].includes(web.status),'PILOT_UNAUTHENTICATED_WEBHOOK_NOT_DENIED_'+web.status);
 console.log('PILOT_BUYER_GET_HTTP='+ui.status);
 console.log('PILOT_STAFF_HTTP='+staff.status);
 console.log('PILOT_ORDER_WITHOUT_SESSION_HTTP='+order.status);
 console.log('PILOT_CHECKOUT_WITHOUT_SESSION_HTTP='+pay.status);
 console.log('PILOT_TUS_WITHOUT_SESSION_HTTP='+tus.status);
 console.log('PILOT_R2_DISABLED_HTTP='+large.status);
 console.log('PILOT_UNSIGNED_WEBHOOK_HTTP='+web.status);
 console.log('PILOT_ONE_REAL_PAYMENT_OWNER_ONLY_NEXT_ACTION');
 console.log('PILOT_NO_MAIN_NO_PAGES_DEPLOY_NO_REAL_MP_PAYMENT_YET');
}catch(e){
 console.log('PILOT_UNEXPECTED_ERROR_CLOSING_NEW_ORDERS_FIRST');
 try{
  // Disable new orders/checkouts. Keep active postpayment reception if any
  // customer unexpectedly created or paid an order during staging.
  const now=await cfg('docs');
  const toClose=keys.docs.filter(x=>x==='DOCS_LIVE_ORDER_GATE');
  if(now.bindings.some(x=>x.name==='DOCS_LIVE_ORDER_GATE'))
   await setKeys('docs',toClose,OFF);
 }catch{console.log('PILOT_MANUAL_CLOSE_DOCS_ORDER_GATE')}
 let current=999999;
 try{current=await countOrders()}catch{console.log('PILOT_D1_COUNT_UNREADABLE_KEEP_POSTPAY_ON')}
 if(current===0){
  // Nobody paid or even created an order: restore original safe mode completely.
  for(const [name,gs] of [['docs',keys.docs],['webhook',keys.webhook],['central',keys.central]]){
   try{
    const settings=await cfg(name);
    const real=gs.filter(k=>settings.bindings.some(x=>x.name===k&&x.text===GO));
    if(real.length){
     const form=new FormData();
     form.append('settings',new Blob([JSON.stringify({bindings:[
      ...settings.bindings.filter(x=>!real.includes(x.name)).map(x=>
       x.type==='r2_bucket'?{name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:
        {name:x.name,type:'inherit'}),
      ...real.map(key=>({name:key,type:'plain_text',text:OFF}))
     ]})],{type:'application/json'}),'settings.json');
     await api('/workers/scripts/'+workers[name]+'/settings',TOKEN,{method:'PATCH',form});
    }
    console.log('PILOT_ROLLBACK_NO_GO='+name);
   }catch{console.log('PILOT_ROLLBACK_MANUAL_REQUIRED='+name)}
  }
 }else{
  console.log('PILOT_LIVE_ORDER_PRESENT_KEEP_TUS_POSTPAY_WEBHOOK_ENABLED');
 }
 throw e;
}
