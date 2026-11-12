/**
 * Habilitación GENERAL de recepción R2 comercial (40-200 MiB)
 * - No emite órdenes ni genera preferencias de MP, transferencias o cargos.
 * - Abre los tres gates de Central únicamente si el backend de documentos,
 *   tablas D1, bucket privado, permisos del personal y servicio MP están listos.
 * - Nunca abre el storage antes del pago: cada reserva/gate/stage valida D1 pago.
 * - Retrocede todos los gates centrales a NO_GO si falla la verificación.
 * - La web principal queda separada de este despliegue.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const txt=readFileSync('docs/R2-COMERCIAL-GENERAL.trigger','utf8').trim();
if(txt==='ACTION=OFF'){
 console.log('R2_GENERAL_SWITCH_OFF_NO_CLOUDFLARE_WRITE');process.exit(0);
}
assert.equal(txt,'ACTION=ACTIVAR_R2_GENERAL');
assert.equal(process.env.GITHUB_REF_NAME,'integracion/tus-pedido-privado-20261101');
const account=process.env.CF_ACCOUNT,token=process.env.CF_DEPLOY,dbToken=process.env.CF_DB;
assert.match(account||'',/^[0-9a-f]{32}$/i);
assert.ok(token?.length>20&&dbToken?.length>20);
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const ON='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const central='saber-pagos-produccion',docs='saber-documentos-produccion';
const names=['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE'];
const getBinding=(s,n)=>s.bindings.find(x=>x.name===n);
async function cf(path,auth,opt={}){
 const r=await fetch(root+path,{...opt,headers:{
  Authorization:'Bearer '+auth,...(opt.headers||{})
 },signal:AbortSignal.timeout(25000)});
 const data=await r.json().catch(()=>null);
 assert.ok(r.ok&&data?.success,'CF_API_'+r.status+'_'+path.split('/').slice(-2).join('_'));
 return data.result;
}
const settings=async w=>cf('/workers/scripts/'+w+'/settings',token);
const bCentral=await settings(central),bDocs=await settings(docs);
function eq(obj,name,val){assert.equal(getBinding(obj,name)?.text,val,'GATE_'+name)}
for(const s of [bCentral,bDocs]){eq(s,'SABER_ENTORNO','produccion');eq(s,'CENTRAL_DB_ENV','produccion')}
for(const name of ['MP_LIVE_GATE','CENTRAL_LIVE_ORDER_GATE',
 'CENTRAL_LIVE_PRICING_GATE','CENTRAL_LIVE_POSTPAY_GATE',
 'CENTRAL_LIVE_BRIDGE_ENABLED','CENTRAL_LIVE_R2_INSPECTION_GATE'])
 eq(bCentral,name,ON);
for(const name of ['DOCS_MP_LIVE_GATE','DOCS_LIVE_RECEPCION_GATE',
 'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_UPLOAD_GATE',
 'DOCS_LIVE_R2_STAGING_GATE','DOCS_LIVE_STAFF_GATE',
 'DOCS_LIVE_SESSION_GATE','DOCS_LIVE_PACKAGE_GATE'])
 eq(bDocs,name,ON);
assert.equal(getBinding(bDocs,'SABER_R2_GRANDES_LIVE')?.type,'r2_bucket');
assert.equal(getBinding(bDocs,'SABER_R2_GRANDES_LIVE')?.bucket_name,'saber-documentos-produccion-privado');
assert.equal(getBinding(bDocs,'SABER_CENTRAL')?.type,'service');
assert.equal(getBinding(bDocs,'SABER_CENTRAL')?.service,central);
assert.equal(getBinding(bDocs,'DOCS_LIVE_R2_RECEIPT_KEY')?.type,'secret_text');
assert.equal(getBinding(bCentral,'CENTRAL_BRIDGE_KEY')?.type,'secret_text');
assert.equal(getBinding(bCentral,'MP_LIVE_ACCESS_TOKEN')?.type,'secret_text');
assert.ok(names.every(name=>[ON,OFF].includes(getBinding(bCentral,name)?.text)));
assert.ok(names.every(name=>getBinding(bCentral,name)?.text===OFF)||
 names.every(name=>getBinding(bCentral,name)?.text===ON),
 'NO_PARTIAL_CENTRAL_R2_GATE_STATE');
const databases=await cf('/d1/database',dbToken);
const db=databases.find(x=>x.name==='saber-pagos-produccion');
assert.ok(db?.uuid,'R2_D1_PRODUCCION_NO_EXISTE');
const sql="SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+
 "'central_r2_large_reservations','central_r2_large_pending',"+
 "'central_r2_universal_files','central_r2_universal_order_links',"+
 "'orders','payment_reviews','central_work_order_numbers')";
const q=await cf('/d1/database/'+db.uuid+'/query',dbToken,{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify({sql})});
const tables=new Set(q?.[0]?.results?.map(x=>x.name));
assert.equal(tables.size,7,'R2_D1_TABLAS_INCOMPLETAS');
const usageSql="SELECT COALESCE(SUM(bytes),0) AS total FROM central_r2_large_reservations WHERE state='reserved'";
const use=await cf('/d1/database/'+db.uuid+'/query',dbToken,{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:usageSql})});
const reserved=use?.[0]?.results?.[0]?.total;
assert.ok(Number.isSafeInteger(reserved)&&reserved>=0&&reserved<2*1024*1048576,
 'R2_CUOTA_GLOBAL_AGOTADA');
console.log('R2_LIVE_DEPENDENCIES_DB_BUCKET_MP_HMAC_STAFF_OK');
console.log('R2_LIVE_RESERVED_BYTES='+reserved);
const current=names.map(name=>getBinding(bCentral,name).text);
if(current.every(x=>x===ON)){
 console.log('R2_LIVE_GENERAL_ALREADY_ON_NO_WRITE');process.exit(0);
}
const beforeNames=bCentral.bindings.map(x=>x.name).sort().join('|');
function valueBindings(value){
 const keep=bCentral.bindings.filter(x=>!names.includes(x.name)).map(x=>
  x.type==='r2_bucket'?
   {name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:
   {name:x.name,type:'inherit'});
 return [...keep,...names.map(name=>({name,type:'plain_text',text:value}))];
}
async function patch(value){
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify({bindings:valueBindings(value)})],{
  type:'application/json'}),'settings.json');
 await cf('/workers/scripts/'+central+'/settings',token,{method:'PATCH',body:form});
 for(let i=0;i<10;i++){
  const s=await settings(central);
  if(names.every(name=>getBinding(s,name)?.text===value))return s;
  await new Promise(resolve=>setTimeout(resolve,700));
 }
 throw Error('R2_GATE_PROPAGATION_FAILED');
}
let attempted=false;
try{
 attempted=true;
 const after=await patch(ON);
 assert.equal(after.bindings.map(x=>x.name).sort().join('|'),beforeNames,
  'R2_SOME_OTHER_BINDING_WAS_REMOVED');
 for(const name of ['MP_LIVE_GATE','CENTRAL_LIVE_ORDER_GATE',
  'CENTRAL_LIVE_POSTPAY_GATE','CENTRAL_LIVE_BRIDGE_ENABLED'])
  eq(after,name,ON);
 // Public endpoints cannot be used as a bypass: anonymous staff must be denied.
 const unauth=await fetch('https://pedidos.libreriasaber.com.ar/personal/api/live-r2-inspection-original',{
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([401,403,404].includes(unauth.status),
  'R2_ORIGINAL_ANONYMOUS_ACCESS_NOT_DENIED_'+unauth.status);
 const buyer=await fetch('https://pedidos.libreriasaber.com.ar/pedido/estado',{
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(buyer.status,200,'R2_POSTPAY_BUYER_PAGE_UNAVAILABLE');
 console.log('R2_LIVE_GENERAL_CENTRAL_3_GATES_GO_VERIFIED');
 console.log('R2_LIVE_ANONYMOUS_STAFF_FORBIDDEN_POSTPAY_PAGE_200');
 console.log('R2_LIVE_MAX_200_MIB_QUOTA_2_GIB_PAYMENT_D1_REQUIRED');
 console.log('R2_LIVE_NO_PAYMENT_NO_NEW_ORDER_NO_PUBLIC_MAIN_CHANGE');
}catch(error){
 if(attempted){
  console.log('R2_LIVE_FAILED_ROLLING_BACK_TO_NO_GO');
  try{
   await patch(OFF);
   console.log('R2_LIVE_ROLLBACK_TO_NO_GO_CONFIRMED');
  }catch{console.log('R2_LIVE_ROLLBACK_UNCONFIRMED_URGENT_MANUAL_CHECK')}
 }
 throw error;
}
