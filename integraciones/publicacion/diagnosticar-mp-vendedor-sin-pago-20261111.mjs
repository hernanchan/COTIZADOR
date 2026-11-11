/** One-time, zero-charge diagnostic of MP LIVE /users/me inside production Worker.
 * Ephemeral access secret created and deleted in this same invocation.
 * Never calls checkout/create-payment, never prints secrets or seller IDs.
 */
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);
assert.ok(token?.length>15,'CF_DEPLOY_TOKEN_ABSENT');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/saber-documentos-produccion';
const diagnostic='https://pedidos.libreriasaber.com.ar/api/pedido/live/diagnostico-mp';
const name='DOCS_LIVE_MP_DIAG_TOKEN';
async function cf(method,path,body){
 const r=await fetch(root+path,{method,
  headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(25000)});
 const data=await r.json().catch(()=>null);
 return {ok:r.ok&&data?.success,status:r.status,data:data?.result};
}
const before=await cf('GET','/settings');
assert.ok(before.ok,'DIAG_CF_SETTINGS_UNREADABLE');
const settings=before.data;
assert.ok(settings.bindings.some(x=>x.name==='SABER_ENTORNO'&&x.text==='produccion'));
assert.ok(settings.bindings.some(x=>x.name==='DOCS_MP_LIVE_GATE'&&x.text==='GO_COMERCIAL_CONFIRMADO'));
assert.ok(settings.bindings.some(x=>x.name==='DOCS_LIVE_TUS_GATE'&&x.text==='GO_COMERCIAL_CONFIRMADO'));
assert.ok(settings.bindings.some(x=>x.name==='DOCS_LIVE_STAFF_SECRET'&&x.type==='secret_text'));
assert.ok(settings.bindings.some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'&&x.bucket_name==='saber-documentos-produccion-privado'));
assert.ok(!settings.bindings.some(x=>x.name===name),'DIAG_SECRET_ALREADY_EXISTS_ABORT');
const pre=await fetch(diagnostic,{method:'POST',signal:AbortSignal.timeout(15000)});
assert.equal(pre.status,404,'DIAG_ROUTE_NOT_DEFAULT_CLOSED');
const secret=randomBytes(32).toString('hex');
let installed=false,deleted=false,observed=false;
try{
 const put=await cf('PUT','/secrets',{name,type:'secret_text',text:secret});
 if(!put.ok){console.log('MP_READONLY_PROBE_SECRET_INSTALL_HTTP='+put.status);throw Error('PROBE_SECRET_INSTALL_FAILED')}
 installed=true;
 console.log('MP_READONLY_PROBE_TEMPORARY_SECRET_INSTALLED=true');
 for(let i=0;i<12;i++){
  await new Promise(resolve=>setTimeout(resolve,1100));
  const res=await fetch(diagnostic,{
   method:'POST',headers:{'X-Saber-Mp-Diag':secret,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(20000)});
  const result=await res.json().catch(()=>null);
  if(res.status===404)continue;
  const code=typeof result?.code==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(result.code)?
   result.code:'MP_PROBE_RESPONSE_UNRECOGNIZED';
  console.log('MP_READONLY_PROBE_STATUS='+res.status);
  console.log('MP_READONLY_PROBE_CODE='+code);
  observed=true;
  break;
 }
 if(!observed)console.log('MP_READONLY_PROBE_NOT_REACHABLE_WITH_TOKEN=true');
}finally{
 if(installed){
  const drop=await cf('DELETE','/secrets/'+name);
  deleted=drop.ok;
  console.log('MP_READONLY_PROBE_TEMPORARY_SECRET_REMOVED='+deleted);
  if(!deleted)process.exitCode=1;
 }
}
for(let i=0;i<10;i++){
 await new Promise(resolve=>setTimeout(resolve,900));
 const x=await cf('GET','/settings');
 if(x.ok&&!x.data.bindings.some(b=>b.name===name)){
  const b=x.data.bindings;
  assert.ok(b.some(v=>v.name==='SABER_R2_GRANDES_LIVE'&&v.type==='r2_bucket'&&v.bucket_name==='saber-documentos-produccion-privado'),'R2_BINDING_DROPPED_AFTER_DIAG');
  assert.ok(b.some(v=>v.name==='DOCS_LIVE_STAFF_SECRET'&&v.type==='secret_text'),'STAFF_SECRET_DROPPED_AFTER_DIAG');
  console.log('MP_READONLY_PROBE_CONFIG_CLEANUP_OK=true');
  break;
 }
 if(i===9)throw Error('PROBE_CONFIG_CLEANUP_UNVERIFIED');
}
const after=await fetch(diagnostic,{method:'POST',signal:AbortSignal.timeout(15000)});
assert.equal(after.status,404,'PROBE_ROUTE_NOT_RELOCKED');
console.log('MP_READONLY_PROBE_ROUTE_CLOSED_AGAIN=true');
console.log('MP_READONLY_PROBE_NO_ORDERS_NO_PREFERENCES_NO_CHARGES=true');
