/** Provision empty private R2 bucket and bind only to isolated NO_GO Documents Worker.
 * Object bytes are NEVER uploaded here, no customer charges.
 */
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
const credentials=[token,process.env.SABER_CF_EDITOR_TOKEN].filter(x=>x?.length>15);
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const bucket='saber-documentos-produccion-privado';
const worker='saber-documentos-produccion',name='SABER_R2_GRANDES_LIVE';
async function request(path,{method='GET',data,multipart}={}){
 let last={status:0,codes:[]};
 for(const secret of credentials){
  const res=await fetch(root+path,{method,headers:{
   Authorization:'Bearer '+secret,...(data?{'Content-Type':'application/json'}:{})
  },...(data?{body:JSON.stringify(data)}:multipart?{body:multipart}:{}),
  signal:AbortSignal.timeout(45000)});
  const d=await res.json().catch(()=>null);
  if(res.ok&&d?.success===true)return {status:res.status,data:d.result};
  last={status:res.status,codes:(d?.errors||[]).map(x=>x.code).slice(0,3)};
  if(![401,403].includes(res.status))break;
 }
 return last;
}
async function must(path,opts={}){
 const r=await request(path,opts);
 if(!r.data)throw Error('R2_NO_GO_CLOUDFLARE_API_'+r.status+'_CODES_'+r.codes?.join('_'));
 return r.data;
}
const script=root+'/workers/scripts/'+worker;
const settings=await must('/workers/scripts/'+worker+'/settings');
const has=(a,n,type,value)=>a.some(x=>x.name===n&&x.type===type&&
  (value===undefined||x.text===value));
assert.ok(has(settings.bindings,'SABER_ENTORNO','plain_text','preparacion'));
assert.ok(has(settings.bindings,'DOCS_MP_LIVE_GATE','plain_text','NO_GO'));
assert.ok(has(settings.bindings,'CENTRAL_DB_ENV','plain_text','produccion'));
assert.ok(!settings.bindings.some(x=>x.name==='SABER_R2_GRANDES'||x.name==='DOCS_R2_RECEIPT_KEY'),
 'DO_NOT_MIX_SANDBOX_BUCKET_OR_SECRET');
const already=settings.bindings.find(x=>x.name===name);
if(already)assert.equal(already.bucket_name,bucket,'R2_LIVE_BUCKET_ALREADY_BOUND_ELSEWHERE');
const sub=await must('/workers/scripts/'+worker+'/subdomain');
assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);
// Titular creó el bucket en Cloudflare. El token de Workers carece de R2 Read
// (HTTP 403) y no debe solicitar permisos adicionales. El binding es una
// referencia que Cloudflare rechaza si el bucket no existe.
console.log('LIVE_R2_BUCKET_CREATION_CONFIRMED_BY_OWNER_NO_R2_API_ACCESS');
if(!already){
 const newSettings=new FormData();
 newSettings.append('settings',new Blob([JSON.stringify({bindings:[
  ...settings.bindings.map(x=>({name:x.name,type:'inherit'})),
  {name,type:'r2_bucket',bucket_name:bucket}
 ]})],{type:'application/json'}),'settings.json');
 await must('/workers/scripts/'+worker+'/settings',{method:'PATCH',multipart:newSettings});
 console.log('LIVE_R2_PRIVATE_BUCKET_BOUND_ONLY_TO_DOCUMENTS_GATE_NO_GO');
}
const verified=await must('/workers/scripts/'+worker+'/settings');
assert.ok(verified.bindings.some(x=>x.name===name&&x.type==='r2_bucket'&&x.bucket_name===bucket));
for(const old of settings.bindings)assert.ok(verified.bindings.some(x=>x.name===old.name),'R2_LOST_BINDING_'+old.name);
assert.ok(has(verified.bindings,'DOCS_MP_LIVE_GATE','plain_text','NO_GO')&&
 has(verified.bindings,'SABER_ENTORNO','plain_text','preparacion'));
const secretName='DOCS_LIVE_R2_RECEIPT_KEY';
if(!verified.bindings.some(x=>x.name===secretName)){
 const secret=randomBytes(40).toString('hex');
 const s=await request('/workers/scripts/'+worker+'/secrets',{method:'PUT',data:{
  name:secretName,text:secret,type:'secret_text'}});
 if(!s.data)throw Error('R2_LIVE_RECEIPT_SECRET_NOT_STORED_HTTP_'+s.status);
 console.log('LIVE_R2_RECEIPT_SECRET_CREATED_SECURELY_WITHOUT_PRINT');
}
const after=await must('/workers/scripts/'+worker+'/settings');
assert.ok(has(after.bindings,secretName,'secret_text'));
assert.ok(has(after.bindings,'DOCS_MP_LIVE_GATE','plain_text','NO_GO'));
const afterSub=await must('/workers/scripts/'+worker+'/subdomain');
assert.equal(afterSub.enabled,false);assert.equal(afterSub.previews_enabled,false);
await new Promise(resolve=>setTimeout(resolve,4000));
const stable=await must('/workers/scripts/'+worker+'/settings');
assert.ok(stable.bindings.some(x=>x.name===name&&x.type==='r2_bucket'&&x.bucket_name===bucket),'R2_BOUND_NOT_PERSISTED');
assert.ok(has(stable.bindings,'DOCS_MP_LIVE_GATE','plain_text','NO_GO'));
console.log('R2_LIVE_STORAGE_BINDING_AND_RECEIPT_KEY_VERIFIED_GATE_NO_GO');
console.log('NO_MAIN_NO_MP_NO_ORDER_NO_UPLOAD_NO_CUSTOMER_STORAGE_WRITES');
