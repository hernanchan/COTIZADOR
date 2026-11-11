/** Provisiona inspección R2 LIVE con subclave no expuesta.
 * Conecta la clave de estación existente (derivación por dominio) con Central;
 * no habilita cobros R2, upload público ni pedidos nuevos.
 */
import assert from 'node:assert/strict';
import {derivarClaveInspeccionR2Live}
 from '../autocotizador/recepcion/clave-inspeccion-r2-live.mjs';
const ACCOUNT=process.env.SABER_CF_ACCOUNT_ID;
const TOKEN=process.env.SABER_CF_DEPLOY_TOKEN;
const OWNER=process.env.DEMO_ADMIN_KEY;
assert.match(ACCOUNT||'',/^[a-f0-9]{32}$/i);
assert.ok(TOKEN?.length>20,'CF_DEPLOY_TOKEN_ABSENT');
const INSPECTION_KEY=derivarClaveInspeccionR2Live(OWNER);
const G='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const URL='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/';
const central='saber-pagos-produccion',docs='saber-documentos-produccion';
async function cf(worker,suffix='/settings',method='GET',body){
 const r=await fetch(URL+worker+suffix,{method,
  headers:{Authorization:'Bearer '+TOKEN,...(body instanceof FormData?{}:body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(30000)});
 const j=await r.json().catch(()=>null);
 assert.ok(r.ok&&j?.success===true,'CF_'+worker+'_'+method+'_HTTP_'+r.status);
 return j.result;
}
const gate=(s,n,v)=>s.bindings.some(b=>b.name===n&&b.type==='plain_text'&&b.text===v);
const has=(s,n,t)=>s.bindings.some(b=>b.name===n&&(t?b.type===t:true));
const [c,d]=await Promise.all([cf(central),cf(docs)]);
assert.ok(gate(c,'SABER_ENTORNO','produccion')&&gate(c,'CENTRAL_DB_ENV','produccion')&&
 gate(c,'MP_LIVE_GATE',G)&&gate(c,'CENTRAL_LIVE_POSTPAY_GATE',G),'CENTRAL_CORE_NOT_READY');
assert.ok(gate(d,'SABER_ENTORNO','produccion')&&gate(d,'DOCS_LIVE_R2_GATE',G)&&
 gate(d,'DOCS_LIVE_R2_UPLOAD_GATE',G)&&gate(d,'DOCS_LIVE_R2_STAGING_GATE',G),'DOCS_R2_RECEIVER_NOT_READY');
for(const n of ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
 'CENTRAL_LIVE_R2_STAGING_GATE'])
 assert.ok(gate(c,n,OFF),'R2_PAYMENT_GATES_MUST_REMAIN_CLOSED_'+n);
assert.ok(has(c,'DEMO_ADMIN_KEY','secret_text')&&has(c,'CENTRAL_BRIDGE_KEY','secret_text')&&
 has(c,'DB','d1'),'CENTRAL_AUTH_OR_D1_MISSING');
const keyName='CENTRAL_LIVE_R2_INSPECTION_KEY';
const gateName='CENTRAL_LIVE_R2_INSPECTION_GATE';
assert.ok(!has(c,keyName),'DO_NOT_REPLACE_EXISTING_INSPECTION_KEY');
assert.ok(!has(c,gateName)||gate(c,gateName,OFF),'INSPECTION_GATE_UNEXPECTED');
const originalNames=new Set(c.bindings.map(b=>b.name));
await cf(central,'/secrets','PUT',{name:keyName,text:INSPECTION_KEY,type:'secret_text'});
let postSecret=await cf(central);
assert.ok(has(postSecret,keyName,'secret_text'),'INSPECTION_SECRET_INSTALL_FAILED');
for(const name of originalNames)assert.ok(has(postSecret,name),'ORIGINAL_BINDING_LOST_'+name);
console.log('LIVE_R2_INSPECTION_SECRET_STORED_CLOUDFLARE_NO_VALUE_PRINTED');
const patch=async value=>{
 const prior=await cf(central);
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings:[
  ...prior.bindings.filter(b=>b.name!==gateName).map(b=>(
   b.type==='r2_bucket'?{name:b.name,type:'r2_bucket',bucket_name:b.bucket_name}:
   {name:b.name,type:'inherit'})),
  {name:gateName,type:'plain_text',text:value}
 ]})],{type:'application/json'}),'settings.json');
 await cf(central,'/settings','PATCH',form);
 for(let i=0;i<10;i++){
  const s=await cf(central);
  if(gate(s,gateName,value)){
   for(const name of originalNames)assert.ok(has(s,name),'BINDING_LOST_'+name);
   assert.ok(has(s,keyName,'secret_text'));
   return s;
  }
  await new Promise(resolve=>setTimeout(resolve,700));
 }
 throw Error('INSPECTION_GATE_NOT_PROPAGATED');
};
try{
 const updated=await patch(G);
 for(const n of ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
  'CENTRAL_LIVE_R2_STAGING_GATE'])
  assert.ok(gate(updated,n,OFF),'R2_PAYMENT_GATE_CHANGED_'+n);
 assert.ok(gate(updated,'MP_LIVE_GATE',G)&&has(updated,'DB','d1'));
 console.log('LIVE_R2_INSPECTION_GATE_READY=GO');
 console.log('LIVE_R2_PAYMENT_RECEIVING_CENTRAL_GATES=NO_GO');
 console.log('NO_CUSTOMER_PAYMENT_NO_ORDER_NO_FILE_WRITTEN');
}catch(e){
 console.log('LIVE_R2_INSPECTION_ROLLBACK_INITIATED');
 try{await patch(OFF);console.log('LIVE_R2_INSPECTION_ROLLBACK_OK')}
 catch{console.log('LIVE_R2_INSPECTION_ROLLBACK_REQUIRES_REVIEW')}
 throw e;
}
