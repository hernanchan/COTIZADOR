/** Stage live runtime identity only; ALL payment and file gates remain NO_GO. */
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
const specs=[
 ['saber-pagos-produccion','MP_LIVE_GATE',['CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_TUS_GATE','CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_POSTPAY_GATE']],
 ['saber-documentos-produccion','DOCS_MP_LIVE_GATE',['DOCS_LIVE_UI_GATE','DOCS_LIVE_SESSION_GATE','DOCS_LIVE_PRICING_GATE','DOCS_LIVE_ORDER_GATE','DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_TUS_GATE','DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_UPLOAD_GATE']],
 ['saber-webhook-produccion','WEBHOOK_EDGE_GATE',[]]
];
async function cf(path,{method='GET',body}={}){
 const res=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token},
  ...(body?{body}:{}),signal:AbortSignal.timeout(45000)});
 const data=await res.json().catch(()=>null);
 assert.equal(res.ok,true,'CF_STAGE_RUNTIME_HTTP_'+res.status);
 assert.equal(data?.success,true,'CF_STAGE_RUNTIME_API_FAIL_'+res.status);
 return data.result;
}
function contains(s,name,value){
 return s.bindings?.some(x=>x.name===name&&x.type==='plain_text'&&x.text===value);
}
for(const [worker,chargeGate,closed] of specs){
 const before=await cf(worker+'/settings');
 assert.ok(Array.isArray(before.bindings));
 assert.ok(contains(before,'CENTRAL_DB_ENV','produccion'));
 assert.ok(contains(before,chargeGate,'NO_GO'),'CHARGES_COULD_BE_LIVE_'+worker);
 assert.ok(contains(before,'SABER_ENTORNO','preparacion')||
  contains(before,'SABER_ENTORNO','produccion'),'RUNTIME_UNEXPECTED_'+worker);
 for(const name of closed)assert.ok(contains(before,name,'NO_GO'),'GATE_NOT_CLOSED_'+name);
 const sub=await cf(worker+'/subdomain');
 assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);
 if(!contains(before,'SABER_ENTORNO','produccion')){
  const form=new FormData();
  form.append('settings',new Blob([JSON.stringify({bindings:[
   ...before.bindings.filter(x=>x.name!=='SABER_ENTORNO').map(x=>({name:x.name,type:'inherit'})),
   {name:'SABER_ENTORNO',type:'plain_text',text:'produccion'}
  ]})],{type:'application/json'}),'settings.json');
  await cf(worker+'/settings',{method:'PATCH',body:form});
  console.log('LIVE_RUNTIME_STAGED='+worker);
 }
 const after=await cf(worker+'/settings');
 for(const old of before.bindings)
  assert.ok(after.bindings.some(x=>x.name===old.name),'MISSING_BINDING_'+old.name);
 assert.ok(contains(after,'SABER_ENTORNO','produccion'));
 assert.ok(contains(after,'CENTRAL_DB_ENV','produccion'));
 assert.ok(contains(after,chargeGate,'NO_GO'));
 for(const name of closed)assert.ok(contains(after,name,'NO_GO'),'GATE_CHANGED_'+name);
 const afterSub=await cf(worker+'/subdomain');
 assert.equal(afterSub.enabled,false);assert.equal(afterSub.previews_enabled,false);
 console.log('LIVE_RUNTIME_PRODUCTION_WITH_CHARGES_OFF='+worker);
}
const responses=[];
for(const [url,allowed] of [
 ['https://pedidos.libreriasaber.com.ar/cotizar',[404,503]],
 ['https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live',[404,503]]
]){
 const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.ok(allowed.includes(res.status),'UNEXPECTED_OPEN_ENDPOINT_'+url+'_'+res.status);
 responses.push(res.status);
}
console.log('LIVE_RUNTIME_CLOSED_EXTERNAL_SMOKE_HTTP='+responses.join(','));
console.log('LIVE_RUNTIME_3_WORKERS_ACTIVE_NO_GO_NO_ORDERS_NO_MP_NO_PUBLIC_PORTAL');
