/** Make staff ZIP console require Basic auth in production. No payment/order/upload gates changed. */
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const apiRoot='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function cf(path,form){
 const res=await fetch(apiRoot+path,{method:form?'PATCH':'GET',
  headers:{Authorization:'Bearer '+token},...(form?{body:form}:{}),
  signal:AbortSignal.timeout(30000)});
 const data=await res.json().catch(()=>null);
 assert.ok(res.ok&&data?.success,'CLOUDFLARE_HTTP_'+res.status);
 return data.result;
}
const cName='saber-pagos-produccion',dName='saber-documentos-produccion';
const has=(s,n,v)=>s.bindings.some(x=>x.name===n&&x.type==='plain_text'&&x.text===v);
const requiredClosed=[
 [cName,'MP_LIVE_GATE','CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_POSTPAY_GATE'],
 [dName,'DOCS_MP_LIVE_GATE','DOCS_LIVE_ORDER_GATE','DOCS_LIVE_RECEPCION_GATE']
];
const before=Object.fromEntries(await Promise.all([cName,dName].map(async n=>[n,await cf(n+'/settings')])));
for(const [name,charge,order,transfer] of requiredClosed){
 const s=before[name];
 assert.ok(has(s,'SABER_ENTORNO','produccion'));
 assert.ok(has(s,'CENTRAL_DB_ENV','produccion'));
 assert.ok(has(s,order,'NO_GO')&&has(s,transfer,'NO_GO'),'RECEIVING_OR_ORDER_GATE_OPEN');
 assert.ok(has(s,charge,'GO_COMERCIAL_CONFIRMADO'),'QUOTING_PILOT_NOT_READY');
}
assert.ok(before[dName].bindings.some(x=>x.name==='DOCS_LIVE_STAFF_SECRET'&&x.type==='secret_text'));
assert.ok(before[dName].bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'));
const targets=[
 [cName,['CENTRAL_LIVE_PACKAGE_GATE']],
 [dName,['DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE']]
];
async function patch(worker,updates,value){
 const old=await cf(worker+'/settings');
 const form=new FormData();
 const bindings=[
  ...old.bindings.filter(x=>!updates.includes(x.name)).map(x=>x.type==='r2_bucket'?
    {name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:{name:x.name,type:'inherit'}),
  ...updates.map(name=>({name,type:'plain_text',text:value}))
 ];
 form.append('settings',new Blob([JSON.stringify({bindings})],{type:'application/json'}),'settings.json');
 await cf(worker+'/settings',form);
 let s=null;
 for(let i=0;i<10;i++){
  await new Promise(resolve=>setTimeout(resolve,800));
  s=await cf(worker+'/settings');
  if(updates.every(x=>has(s,x,value)))break;
 }
 assert.ok(updates.every(x=>has(s,x,value)),'STAFF_GATE_PROPAGATION_FAILED_'+worker);
 for(const x of old.bindings)assert.ok(s.bindings.some(y=>y.name===x.name),'BINDING_LOST_'+x.name);
 if(worker===dName)assert.ok(s.bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'));
 return s;
}
try {
 for(const [worker,keys] of targets)await patch(worker,keys,'GO_COMERCIAL_CONFIRMADO');
 const [c,d]=await Promise.all([cf(cName+'/settings'),cf(dName+'/settings')]);
 for(const [settings,order,transfer] of [[c,'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_POSTPAY_GATE'],
   [d,'DOCS_LIVE_ORDER_GATE','DOCS_LIVE_RECEPCION_GATE']]){
  assert.ok(has(settings,order,'NO_GO')&&has(settings,transfer,'NO_GO'),'ORDERS_OR_UPLOAD_ENABLED');
 }
 const url='https://pedidos.libreriasaber.com.ar/personal/paquete';
 const r=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.equal(r.status,401,'STAFF_UNAUTHENTICATED_PAGE_SHOULD_BE_401');
 assert.ok((r.headers.get('WWW-Authenticate')||'').startsWith('Basic '),'STAFF_BASIC_MISSING');
 const res=await fetch('https://pedidos.libreriasaber.com.ar/personal/api/live-paquete',{
   method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
   redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.equal(res.status,401,'STAFF_UNAUTHENTICATED_API_SHOULD_BE_401');
 console.log('STAFF_LIVE_CONSOLE_HTTP_401_UNAUTHENTICATED');
 console.log('STAFF_LIVE_PACKAGE_API_HTTP_401_UNAUTHENTICATED');
 console.log('STAFF_LIVE_D1_PACKAGE_GATE_ENABLED_ONLY_FOR_AUTHENTICATED_OPERATOR');
 console.log('STAFF_LIVE_ORDER_PAYMENT_UPLOAD_GATES_NO_GO');
 console.log('STAFF_LIVE_NO_ORDER_NO_MP_NO_MAIN_PUBLIC_CHANGE');
} catch(e){
 console.log('STAFF_LIVE_UNEXPECTED_RESTORING_CLOSED_GATES');
 for(const [worker,keys] of [...targets].reverse()){
  try{await patch(worker,keys,'NO_GO');console.log('STAFF_ROLLBACK_SUCCESS_'+worker)}
  catch{console.log('STAFF_ROLLBACK_MANUAL_REQUIRED_'+worker)}
 }
 throw e;
}
