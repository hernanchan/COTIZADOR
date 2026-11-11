/** Stage non-secret Supabase Live TUS variables and fresh session/receipt secrets.
 * Never activate payments, session, TUS, R2, UI or production gates.
 */
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const worker='saber-documentos-produccion';
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
async function api(path,{method='GET',body,form}={}){
 const resp=await fetch(root+path,{method,headers:{
  Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:form?{body:form}:{}),
 signal:AbortSignal.timeout(45000)});
 const d=await resp.json().catch(()=>null);
 assert.equal(resp.ok,true,'SUPA_LIVE_CF_HTTP_'+resp.status);
 assert.equal(d?.success,true,'SUPA_LIVE_CF_DENIED_'+resp.status);
 return d.result;
}
const settings=await api('/settings');
assert.ok(Array.isArray(settings.bindings));
const check=(obj,n,v)=>obj.bindings.some(x=>x.name===n&&x.type==='plain_text'&&x.text===v);
assert.ok(check(settings,'SABER_ENTORNO','preparacion'));
assert.ok(check(settings,'DOCS_MP_LIVE_GATE','NO_GO'));
assert.ok(check(settings,'CENTRAL_DB_ENV','produccion'));
assert.ok(settings.bindings.some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&x.service==='saber-pagos-produccion'));
const sub=await api('/subdomain');
assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);
const variables={
 DOCS_LIVE_TUS_PROJECT_URL:'https://sqjamuqiolwizzzzwxjy.storage.supabase.co/',
 DOCS_LIVE_TUS_BUCKET:'saber-tus-produccion',
 DOCS_LIVE_TUS_PUBLISHABLE_KEY:'sb_publishable_EnfIz2fce5aTl5-Ufqej2w_-cJtVbZw'
};
for(const [name,value] of Object.entries(variables)){
 const existing=settings.bindings.filter(x=>x.name===name);
 assert.ok(existing.length<=1,'BINDING_COLLISION');
 if(existing.length)assert.ok(existing[0].type==='plain_text'&&existing[0].text===value,
  'EXISTING_SUPABASE_CONFIG_DIFFERS_NO_OVERWRITE');
}
const missing=Object.entries(variables).filter(([name])=>
 !settings.bindings.some(x=>x.name===name));
if(missing.length){
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings:[
  ...settings.bindings.map(x=>({name:x.name,type:'inherit'})),
  ...missing.map(([name,value])=>({name,type:'plain_text',text:value}))
 ]})],{type:'application/json'}),'settings.json');
 await api('/settings',{method:'PATCH',form});
}
for(const [name,value] of Object.entries(variables)){
 const after=await api('/settings');
 assert.ok(check(after,name,value),'SUPABASE_LIVE_CONFIGURATION_NOT_SAVED_'+name);
}
const secrets=['DOCS_LIVE_TUS_RECEIPT_KEY','DOCS_LIVE_SESSION_KEY'];
for(const name of secrets){
 const current=await api('/settings');
 if(!current.bindings.some(x=>x.name===name)){
  const key=randomBytes(48).toString('hex');
  await api('/secrets',{method:'PUT',body:{name,text:key,type:'secret_text'}});
  console.log('NEW_PRODUCTION_SECRET_INSTALLED_'+name);
 }
 const confirm=await api('/settings');
 assert.ok(confirm.bindings.some(x=>x.name===name&&x.type==='secret_text'),
  'PRODUCTION_SECRET_UNVERIFIED_'+name);
 assert.ok(check(confirm,'DOCS_MP_LIVE_GATE','NO_GO'));
}
const after=await api('/settings');
for(const x of settings.bindings)
 assert.ok(after.bindings.some(a=>a.name===x.name),'PRESERVED_BINDING_LOST_'+x.name);
assert.ok(check(after,'SABER_ENTORNO','preparacion'));
assert.ok(check(after,'DOCS_MP_LIVE_GATE','NO_GO'));
assert.ok(after.bindings.some(x=>x.name==='DOCS_LIVE_TUS_PUBLISHABLE_KEY'));
console.log('SUPABASE_PRODUCTION_BUCKET_PRIVATE_PROJECT_CONFIGURATION_STAGED');
console.log('SUPABASE_LIVE_SERVICE_KEY_NOT_INSTALLED_REQUIRES_OWNER_SECURE_SECRET');
console.log('SUPABASE_LIVE_SESSIONS_AND_UPLOADS_STILL_OFF_NO_PAYMENT_NO_UPLOAD_NO_MAIN_CHANGE');
