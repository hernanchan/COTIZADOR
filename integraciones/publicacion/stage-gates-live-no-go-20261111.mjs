/** Final stage: register explicit NO_GO for each commercial gate on isolated LIVE Workers.
 * Fail closed. Does not publish, charge, flip any gate to GO or mutate customer data.
 */
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15,'CF_TOKEN_MISSING');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function api(path,method='GET',body){
 const res=await fetch(root+path,{
  method,headers:{Authorization:'Bearer '+token},...(body?{body}:{}),
  signal:AbortSignal.timeout(45000)});
 const obj=await res.json().catch(()=>null);
 assert.equal(res.ok,true,'CF_WORKER_HTTP_'+res.status);
 assert.equal(obj?.success,true,'CF_WORKER_API_'+res.status);
 return obj.result;
}
const gateMap={
 'saber-documentos-produccion':[
  'DOCS_LIVE_PRICING_GATE','DOCS_LIVE_ORDER_GATE','DOCS_LIVE_UI_GATE',
  'DOCS_LIVE_SESSION_GATE','DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_TUS_GATE',
  'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_UPLOAD_GATE','DOCS_LIVE_R2_STAGING_GATE',
  'DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE'
 ],
 'saber-pagos-produccion':[
  'CENTRAL_LIVE_PRICING_GATE','CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_TUS_GATE',
  'CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE',
  'CENTRAL_LIVE_POSTPAY_GATE'
 ]
};
function matches(bindings,name,value='NO_GO'){
 return bindings.some(x=>x.name===name&&x.type==='plain_text'&&x.text===value);
}
const workers=Object.keys(gateMap);
for(const name of workers){
 const s=await api(name+'/settings');
 const b=s.bindings;
 assert.ok(Array.isArray(b),'SETTINGS_BINDINGS_MISSING');
 assert.ok(matches(b,'SABER_ENTORNO','preparacion'));
 assert.ok(matches(b,'CENTRAL_DB_ENV','produccion'));
 assert.ok(matches(b,name==='saber-pagos-produccion'?'MP_LIVE_GATE':'DOCS_MP_LIVE_GATE'));
 const required=name==='saber-pagos-produccion'?
  ['DB','MP_LIVE_ACCESS_TOKEN','MP_LIVE_WEBHOOK_SECRET','CENTRAL_BRIDGE_KEY']:
  ['SABER_CENTRAL','SABER_R2_GRANDES_LIVE','DOCS_LIVE_TUS_SERVICE_KEY',
   'DOCS_LIVE_TURNSTILE_SECRET','DOCS_LIVE_TUS_RECEIPT_KEY',
   'DOCS_LIVE_R2_RECEIPT_KEY','DOCS_LIVE_SESSION_KEY'];
 for(const req of required)assert.ok(b.some(x=>x.name===req),'MISSING_PRECONDITION_'+req);
 const missing=gateMap[name].filter(k=>!b.some(x=>x.name===k));
 for(const gate of gateMap[name])if(!missing.includes(gate))
  assert.ok(matches(b,gate),'GATE_UNEXPECTED_EXISTING_VALUE_'+gate);
 if(missing.length){
  const form=new FormData();
  form.append('settings',new Blob([JSON.stringify({bindings:[
   ...b.map(x=>({name:x.name,type:'inherit'})),
   ...missing.map(name=>({name,type:'plain_text',text:'NO_GO'}))
  ]})],{type:'application/json'}),'settings.json');
  await api(name+'/settings','PATCH',form);
  console.log('SABER_'+name.toUpperCase().replaceAll('-','_')+'_NO_GO_GATES_INSTALLED='+missing.length);
 }
 const after=await api(name+'/settings');
 for(const old of b)assert.ok(after.bindings.some(x=>x.name===old.name),'BINDING_LOST_'+old.name);
 for(const gate of gateMap[name])assert.ok(matches(after.bindings,gate),'NO_GO_GATE_NOT_INSTALLED_'+gate);
 assert.ok(matches(after.bindings,'SABER_ENTORNO','preparacion'));
 assert.ok(matches(after.bindings,name==='saber-pagos-produccion'?'MP_LIVE_GATE':'DOCS_MP_LIVE_GATE'));
 const sub=await api(name+'/subdomain');
 assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);
 console.log('SABER_'+name.toUpperCase().replaceAll('-','_')+'_READY_TO_CONTROL_GATES='+gateMap[name].length);
}
const edge=await api('saber-webhook-produccion/settings');
assert.ok(matches(edge.bindings,'WEBHOOK_EDGE_GATE'));
assert.ok(matches(edge.bindings,'SABER_ENTORNO','preparacion'));
console.log('SABER_ALL_LIVE_COMMERCIAL_GATES_EXPLICITLY_NO_GO');
console.log('SABER_NO_ORDERS_NO_MP_CHARGES_NO_MAIN_OR_PAGES_CHANGES');
