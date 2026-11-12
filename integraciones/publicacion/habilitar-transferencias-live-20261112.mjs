/** Habilita transferencia LIVE con alias ya establecido para Librería Saber.
 * Precondiciones: tablas bancarias D1, MP/TUS/R2 GO, Staff autenticado.
 * Dos fases: central primero, comprador último. Si falla, rollback a OFF.
 * No acredita pagos, no crea órdenes ni preferencias de Mercado Pago.
 */
import assert from 'node:assert/strict';
const account=process.env.CF_ACCOUNT,token=process.env.CF_DEPLOY,dbToken=process.env.CF_DB;
assert.match(account||'',/^[0-9a-f]{32}$/i);
assert.ok(token?.length>20&&dbToken?.length>20);
assert.equal(process.env.GITHUB_REF_NAME,'integracion/tus-pedido-privado-20261101');
const BASE='https://api.cloudflare.com/client/v4/accounts/'+account;
const GO='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const ALIAS='libreriasaber.mp';
assert.match(ALIAS,/^[A-Za-z0-9._-]{6,50}$/);
const centralWorker='saber-pagos-produccion',docsWorker='saber-documentos-produccion';
async function cf(path,auth=token,options={}){
 const res=await fetch(BASE+path,{...options,headers:{
  Authorization:'Bearer '+auth,...options.headers
 },signal:AbortSignal.timeout(30000)});
 const response=await res.json().catch(()=>null);
 assert.ok(res.ok&&response?.success===true,
  'CF_PATCH_OR_READ_FAILED_'+path.split('/').at(-1)+'_'+res.status);
 return response.result;
}
async function settings(worker){
 const result=await cf('/workers/scripts/'+worker+'/settings');
 assert.ok(Array.isArray(result.bindings));
 return result;
}
const beforeCentral=await settings(centralWorker),beforeDocs=await settings(docsWorker);
const binding=(arr,n)=>arr.find(x=>x.name===n);
const requireGate=(s,k,v=GO)=>assert.equal(binding(s.bindings,k)?.text,v,
 'REQUIRED_PRODUCTION_GATE_'+k);
for(const s of [beforeCentral,beforeDocs]){
 requireGate(s,'SABER_ENTORNO','produccion');
 requireGate(s,'CENTRAL_DB_ENV','produccion');
}
for(const k of ['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED',
 'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_POSTPAY_GATE',
 'CENTRAL_LIVE_TUS_GATE','CENTRAL_LIVE_R2_GATE',
 'CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE'])
 requireGate(beforeCentral,k);
for(const k of ['DOCS_MP_LIVE_GATE','DOCS_LIVE_UI_GATE',
 'DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_ORDER_GATE',
 'DOCS_LIVE_TUS_GATE','DOCS_LIVE_R2_GATE',
 'DOCS_LIVE_R2_UPLOAD_GATE','DOCS_LIVE_R2_STAGING_GATE'])
 requireGate(beforeDocs,k);
assert.equal(binding(beforeCentral.bindings,'CENTRAL_LIVE_TRANSFER_ALIAS')?.text||ALIAS,ALIAS,
 'ALIAS_PRODUCCION_CONFLICTO');
const transferKeys=['CENTRAL_LIVE_TRANSFER_GATE','CENTRAL_LIVE_TRANSFER_APPROVAL_GATE'];
for(const k of transferKeys){
 const v=binding(beforeCentral.bindings,k)?.text;
 assert.ok(v===undefined||v===OFF||v===GO,'GATE_TRANSFERENCIA_INVALIDA_'+k);
}
const bd=binding(beforeDocs.bindings,'DOCS_LIVE_TRANSFER_GATE')?.text;
assert.ok(bd===undefined||bd===OFF||bd===GO);
const databases=await cf('/d1/database',dbToken);
const db=databases.find(d=>d.name==='saber-pagos-produccion');
assert.ok(db?.uuid,'D1_PRODUCTION_MISSING');
const sql="SELECT name,type FROM sqlite_master WHERE name IN ("+
 "'central_live_transfer_requests','central_live_bank_accreditations',"+
 "'idx_live_bank_ref_normalized')";
const rs=await cf('/d1/database/'+db.uuid+'/query',dbToken,{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({sql})
});
assert.equal(rs[0].success,true);
const found=new Map(rs[0].results.map(r=>[r.name,r.type]));
assert.equal(found.get('central_live_transfer_requests'),'table');
assert.equal(found.get('central_live_bank_accreditations'),'table');
assert.equal(found.get('idx_live_bank_ref_normalized'),'index');
console.log('SABER_TRANSFER_BANK_SCHEMA_STAFF_REVIEW_PRECONDITIONS_OK');
const centralPatch=['CENTRAL_LIVE_TRANSFER_GATE',
 'CENTRAL_LIVE_TRANSFER_APPROVAL_GATE','CENTRAL_LIVE_TRANSFER_ALIAS'];
const docsPatch=['DOCS_LIVE_TRANSFER_GATE'];
function preserved(before,changed){
 return before.bindings.filter(x=>!changed.includes(x.name)).map(x=>
  x.type==='r2_bucket'?
   {name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:
   {name:x.name,type:'inherit'});
}
function centralBindings(transferGate){
 return [
  ...preserved(beforeCentral,centralPatch),
  ...transferKeys.map(name=>({name,type:'plain_text',text:transferGate})),
  {name:'CENTRAL_LIVE_TRANSFER_ALIAS',type:'plain_text',text:ALIAS}
 ];
}
function docsBindings(transferGate){
 return [...preserved(beforeDocs,docsPatch),
  {name:'DOCS_LIVE_TRANSFER_GATE',type:'plain_text',text:transferGate}];
}
async function patch(worker,bindings){
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings})],{
  type:'application/json'}),'settings.json');
 return cf('/workers/scripts/'+worker+'/settings',token,{method:'PATCH',body:form});
}
async function verify(worker,gateNames,state,old){
 let data;
 for(let i=0;i<8;i++){
  data=await settings(worker);
  if(gateNames.every(k=>binding(data.bindings,k)?.text===state))break;
  await new Promise(r=>setTimeout(r,650));
 }
 assert.ok(gateNames.every(k=>binding(data.bindings,k)?.text===state),
  'CLOUDFLARE_TRANSFER_STATE_NOT_APPLIED_'+worker);
 const beforeNames=old.bindings.map(x=>x.name);
 const afterNames=data.bindings.map(x=>x.name);
 for(const name of beforeNames)
  assert.ok(afterNames.includes(name),'DROPPED_EXISTING_BINDING_'+name);
 const otherNames=new Set(worker===centralWorker?centralPatch:docsPatch);
 for(const oldBinding of old.bindings.filter(x=>!otherNames.has(x.name))){
  const afterBinding=binding(data.bindings,oldBinding.name);
  assert.ok(afterBinding,'BINDING_REMOVED');
  if(oldBinding.type==='plain_text')assert.equal(afterBinding.text,oldBinding.text,
   'CHANGED_UNRELATED_SETTING_'+oldBinding.name);
  else assert.equal(afterBinding.type,oldBinding.type,'CHANGED_UNRELATED_BINDING_TYPE');
 }
 return data;
}
let centralTouched=false,docsTouched=false;
try{
 // Fase 1: guardar alias, ambas compuertas centrales OFF, no ofrecer transferencia.
 centralTouched=true;
 await patch(centralWorker,centralBindings(OFF));
 await verify(centralWorker,transferKeys,OFF,beforeCentral);
 // Fase 2: autorización de transferencia y acreditación manual en Central.
 await patch(centralWorker,centralBindings(GO));
 const c=await verify(centralWorker,transferKeys,GO,beforeCentral);
 assert.equal(binding(c.bindings,'CENTRAL_LIVE_TRANSFER_ALIAS')?.text,ALIAS);
 // Fase 3: sólo ahora aparece la opción de transferencia a compradores.
 docsTouched=true;
 await patch(docsWorker,docsBindings(GO));
 await verify(docsWorker,docsPatch,GO,beforeDocs);
 const unauth=await fetch('https://pagos.libreriasaber.com.ar/admin/api/central/live-transfers/pending',
  {redirect:'manual',signal:AbortSignal.timeout(15000)});
 // La Central es sólo service binding: su URL pública DEBE ser 404.
 assert.equal(unauth.status,404,'CENTRAL_BANK_MUST_NOT_HAVE_PUBLIC_ROUTE');
 const staffUnauth=await fetch('https://pedidos.libreriasaber.com.ar/personal/api/live-transferencias-pendientes',{
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(staffUnauth.status,401,'STAFF_BANK_PENDING_MUST_REQUIRE_LOGIN');
 let buyerStatus=0;
 // Cloudflare puede tardar en propagar cambios de bindings entre isolates.
 // No interpretar el 503 de una versión anterior como problema comercial.
 for(let attempt=1;attempt<=20;attempt++){
  const r=await fetch('https://pedidos.libreriasaber.com.ar/api/pedido/live/transfer',{
   redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)
  });
  buyerStatus=r.status;
  if(buyerStatus===401)break;
  console.log('SABER_TRANSFER_BINDING_PROPAGATION_WAIT_'+attempt+'_'+buyerStatus);
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 assert.equal(buyerStatus,401,'BUYER_TRANSFER_MUST_REQUIRE_VALID_ORDER_SESSION');
 console.log('SABER_TRANSFER_LIVE_CENTRAL_AND_DOCS_GO_VERIFIED');
 console.log('SABER_TRANSFER_BANK_APPROVAL_REQUIRES_STAFF_AUTH_401_VERIFIED');
 console.log('SABER_TRANSFER_CUSTOMER_POST_REQUIRES_SESSION_401_VERIFIED');
 console.log('SABER_TRANSFER_MP_TUS_R2_ALL_GO_NO_NEW_CHARGE_NO_NEW_ORDER');
}catch(e){
 if(docsTouched){
  console.log('SABER_TRANSFER_DOCS_ROLLBACK_OFF');
  try{await patch(docsWorker,docsBindings(OFF));
   await verify(docsWorker,docsPatch,OFF,beforeDocs);
   console.log('SABER_TRANSFER_DOCS_ROLLBACK_VERIFIED');
  }catch{console.log('SABER_TRANSFER_DOCS_ROLLBACK_FAILED_INSPECT_MANUALLY')}
 }
 if(centralTouched){
  console.log('SABER_TRANSFER_CENTRAL_ROLLBACK_OFF');
  try{await patch(centralWorker,centralBindings(OFF));
   await verify(centralWorker,transferKeys,OFF,beforeCentral);
   console.log('SABER_TRANSFER_CENTRAL_ROLLBACK_VERIFIED');
  }catch{console.log('SABER_TRANSFER_CENTRAL_ROLLBACK_FAILED_INSPECT_MANUALLY')}
 }
 throw e;
}
