/** Stage separated package authorization gate for commercial handoff; stay NO_GO. */
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/saber-pagos-produccion/settings';
async function settings(form){
 const r=await fetch(root,{method:form?'PATCH':'GET',
  headers:{Authorization:'Bearer '+token},...(form?{body:form}:{}),
  signal:AbortSignal.timeout(25000)});
 const v=await r.json();
 assert.equal(r.ok,true,'PROD_CENTRAL_HTTP_'+r.status);
 assert.equal(v?.success,true);return v.result;
}
const s=await settings();
const has=(a,n,v)=>a.bindings.some(x=>x.name===n&&x.type==='plain_text'&&x.text===v);
assert.ok(has(s,'SABER_ENTORNO','produccion'));
assert.ok(has(s,'CENTRAL_DB_ENV','produccion'));
assert.ok(has(s,'CENTRAL_LIVE_ORDER_GATE','NO_GO'));
assert.ok(has(s,'CENTRAL_LIVE_POSTPAY_GATE','NO_GO'));
const key='CENTRAL_LIVE_PACKAGE_GATE';
const old=s.bindings.find(x=>x.name===key);
assert.ok(!old||(old.type==='plain_text'&&old.text==='NO_GO'),'PACKAGE_GATE_UNEXPECTED_VALUE');
if(!old){
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings:[
  ...s.bindings.map(x=>({name:x.name,type:'inherit'})),
  {name:key,type:'plain_text',text:'NO_GO'}
 ]})],{type:'application/json'}),'settings.json');
 await settings(form);
}
let after;
for(let i=0;i<6;i++){
 await new Promise(resolve=>setTimeout(resolve,1000));
 after=await settings();if(has(after,key,'NO_GO'))break;
}
assert.ok(has(after,key,'NO_GO'),'LIVE_PACKAGE_NO_GO_NOT_PERSISTED');
assert.ok(has(after,'CENTRAL_LIVE_ORDER_GATE','NO_GO'));
assert.ok(has(after,'CENTRAL_LIVE_POSTPAY_GATE','NO_GO'));
for(const oldBind of s.bindings)
 assert.ok(after.bindings.some(b=>b.name===oldBind.name),'CENTRAL_BINDING_LOST_'+oldBind.name);
console.log('CENTRAL_LIVE_PACKAGE_ROUTE_STAGE_NO_GO');
console.log('CENTRAL_NO_ORDER_NO_POSTPAY_NO_PDFS_PUBLIC');
