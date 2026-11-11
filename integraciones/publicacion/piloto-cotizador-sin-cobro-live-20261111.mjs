/** Safe quote-only canary on real buyer domain. All order/payment/write gates remain closed. */
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,deploy=process.env.SABER_CF_DEPLOY_TOKEN;
const d1=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(deploy?.length>15&&d1?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
async function api(path,token,{method='GET',payload,form}={}){
 const r=await fetch(root+path,{method,headers:{
  Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})
 },...(payload?{body:JSON.stringify(payload)}:form?{body:form}:{}),
 signal:AbortSignal.timeout(30000)});
 const v=await r.json().catch(()=>null);
 assert.equal(r.ok,true,'CANARY_CF_HTTP_'+r.status);
 assert.equal(v?.success,true,'CANARY_CF_ERROR_'+r.status);
 return v.result;
}
async function status(worker){return api('/workers/scripts/'+worker+'/settings',deploy)}
const centralName='saber-pagos-produccion',docsName='saber-documentos-produccion';
const [c,s,w,list]=await Promise.all([
 status(centralName),status(docsName),status('saber-webhook-produccion'),
 api('/d1/database',d1)
]);
const has=(settings,name,val,type='plain_text')=>settings.bindings?.some(b=>b.name===name&&b.type===type&&b.text===val);
for(const [name,v] of [[centralName,c],[docsName,s]]){
 assert.ok(has(v,'SABER_ENTORNO','produccion')&&has(v,'CENTRAL_DB_ENV','produccion'),
  'WORKER_NOT_IN_PRODUCTION_'+name);
}
const targets=[
 [centralName,c,['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED','CENTRAL_LIVE_PRICING_GATE']],
 [docsName,s,['DOCS_MP_LIVE_GATE','DOCS_LIVE_UI_GATE','DOCS_LIVE_SESSION_GATE','DOCS_LIVE_PRICING_GATE']]
];
const stayClosed=[
 [c,['CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_TUS_GATE','CENTRAL_LIVE_R2_GATE',
  'CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE','CENTRAL_LIVE_POSTPAY_GATE']],
 [s,['DOCS_LIVE_ORDER_GATE','DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_TUS_GATE',
  'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_UPLOAD_GATE','DOCS_LIVE_R2_STAGING_GATE',
  'DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE']]
];
for(const [settings,names] of stayClosed)
 for(const name of names)assert.ok(has(settings,name,'NO_GO'),'CANARY_UNSAFE_GATE_'+name);
assert.ok(has(w,'WEBHOOK_EDGE_GATE','NO_GO'));
for(const [name,settings,keys] of targets)
 for(const key of keys){
  const found=settings.bindings.filter(b=>b.name===key);
  assert.ok(found.length<=1&&(!found.length||found[0].type==='plain_text'&&
   ['NO_GO','GO_COMERCIAL_CONFIRMADO'].includes(found[0].text)),
   'UNEXPECTED_GO_SETTING_'+key);
}
for(const k of ['DOCS_LIVE_TURNSTILE_SITE_KEY','DOCS_LIVE_TUS_BUCKET',
 'DOCS_LIVE_TUS_PROJECT_URL','DOCS_LIVE_TUS_PUBLISHABLE_KEY'])
 assert.ok(s.bindings.some(x=>x.name===k&&x.type==='plain_text'), 'DOC_CONFIG_MISSING_'+k);
for(const k of ['DOCS_LIVE_TURNSTILE_SECRET','DOCS_LIVE_SESSION_KEY',
 'DOCS_LIVE_TUS_SERVICE_KEY','DOCS_LIVE_R2_RECEIPT_KEY'])
 assert.ok(s.bindings.some(x=>x.name===k&&x.type==='secret_text'),'DOC_SECRET_MISSING_'+k);
console.log('CANARY_R2_BINDINGS='+JSON.stringify(s.bindings.filter(x=>x.name.includes('R2')).map(x=>({name:x.name,type:x.type,bucket_name:x.bucket_name||null}))));
assert.ok(s.bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'));
assert.ok(c.bindings.some(x=>x.name==='DB'&&x.type==='d1'));
const prod=list.filter(x=>x.name==='saber-pagos-produccion');
assert.equal(prod.length,1);
const q=await api('/d1/database/'+prod[0].uuid+'/query',d1,{
 method:'POST',payload:{sql:"SELECT COUNT(*) AS n FROM orders"}
});
assert.equal(q?.[0]?.success,true);
assert.equal(Number(q[0]?.results?.[0]?.n),0,'PRODUCTION_ORDERS_ALREADY_EXIST');
console.log('CANARY_PRODUCTION_ORDERS_ZERO_NO_EXISTING_PAYMENTS');
async function patch(worker,settings,keys,value){
 const b=settings.bindings;
 const update=new FormData();
 update.append('settings',new Blob([JSON.stringify({bindings:[
  ...b.filter(item=>!keys.includes(item.name)).map(x=>x.type==='r2_bucket'?{name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:{name:x.name,type:'inherit'}),
  ...keys.map(name=>({name,type:'plain_text',text:value}))
 ]})],{type:'application/json'}),'settings.json');
 await api('/workers/scripts/'+worker+'/settings',deploy,{method:'PATCH',form:update});
 let after=null;
 for(let i=0;i<8;i++){
  await new Promise(resolve=>setTimeout(resolve,1200));
  after=await status(worker);
  if(keys.every(key=>has(after,key,value)))break;
 }
 for(const key of keys)assert.ok(has(after,key,value),'CANARY_SETTING_NOT_SAVED_'+key);
 for(const old of b)assert.ok(after.bindings.some(x=>x.name===old.name),
  'CANARY_LOST_EXISTING_BINDING_'+old.name);
 if(worker==='saber-documentos-produccion')assert.ok(after.bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'&&x.bucket_name==='saber-documentos-produccion-privado'),'CANARY_R2_BINDING_DROPPED');
 return after;
}
const changed=[];
try{
 for(const [worker,before,keys] of targets){
  const pending=keys.filter(key=>!has(before,key,'GO_COMERCIAL_CONFIRMADO'));
  if(pending.length){
   await patch(worker,before,pending,'GO_COMERCIAL_CONFIRMADO');
   changed.push({worker,keys:pending});
  }
 }
 const [cc,ss,ww]=await Promise.all([status(centralName),status(docsName),
  status('saber-webhook-produccion')]);
 for(const [settings,names] of [[cc,stayClosed[0][1]],[ss,stayClosed[1][1]]])
  for(const key of names)assert.ok(has(settings,key,'NO_GO'),'CANARY_WRITE_GATE_OPEN_'+key);
 assert.ok(has(ww,'WEBHOOK_EDGE_GATE','NO_GO'));
 const buyer='https://pedidos.libreriasaber.com.ar';
 const response=await fetch(buyer+'/cotizar',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 const html=await response.text();
 assert.equal(response.status,200,'CANARY_UI_HTTP_'+response.status);
 assert.ok(html.includes('cf-turnstile')&&html.includes('saber_pedido_live')&&
  html.includes('Cotizá tus impresiones'),'CANARY_LOGIN_SCREEN_MISSING');
 const blocked=await fetch(buyer+'/api/pedido/live/orden',{method:'POST',
  headers:{Origin:buyer,'Content-Type':'application/json'},
  body:'{}',redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([401,403,503].includes(blocked.status),'CANARY_ORDERS_NOT_CLOSED_'+blocked.status);
 const checkout=await fetch(buyer+'/api/pedido/live/checkout',{method:'POST',
  headers:{Origin:buyer,'Content-Type':'application/json'},body:'{}',
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([401,403,503].includes(checkout.status),'CANARY_CHARGES_NOT_CLOSED_'+checkout.status);
 const r2=await fetch(buyer+'/api/pedido/live/r2/iniciar',{method:'POST',
  headers:{Origin:buyer,'Content-Type':'application/json'},body:'{}',
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([401,403,503].includes(r2.status),'CANARY_R2_NOT_CLOSED_'+r2.status);
 console.log('CANARY_QUOTE_LOGIN_PUBLIC_HTTPS_200_TURNSTILE_READY');
 console.log('CANARY_ORDERS_HTTP_'+blocked.status);
 console.log('CANARY_PAYMENT_HTTP_'+checkout.status);
 console.log('CANARY_R2_HTTP_'+r2.status);
 console.log('CANARY_NO_PUBLIC_MAIN_SWITCH_NO_REAL_PAYMENT_NO_ORDER_NO_FILE_UPLOAD');
}catch(e){
 console.log('CANARY_FAIL_CLOSED_ROLLBACK_START');
 for(const [worker,_,keys] of [...targets].reverse()){
  try{
   const now=await status(worker);
   const live=keys.filter(key=>has(now,key,'GO_COMERCIAL_CONFIRMADO'));
   if(live.length)await patch(worker,now,live,'NO_GO');
   console.log('CANARY_ROLLBACK_OK_'+worker);
  }catch{console.log('CANARY_ROLLBACK_MANUAL_REQUIRED_'+worker)}
 }
 throw e;
}
