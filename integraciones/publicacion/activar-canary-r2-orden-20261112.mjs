/**
 * Activa la excepción R2 exclusivamente para un número de orden ya creado en D1.
 * No cobra, sube PDF ni crea pedidos. Los tres gates generales quedan NO_GO.
 * El permiso caduca automáticamente a las 24 horas.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync('docs/ACTIVAR-R2-ORDEN-UNICA.trigger','utf8');
const vars=Object.fromEntries(file.split(/\r?\n/).filter(s=>/^[A-Z_]+=/.test(s))
 .map(s=>{const at=s.indexOf('=');return [s.slice(0,at),s.slice(at+1)]}));
if(vars.ACTION!=='ACTIVAR'){
 assert.equal(vars.ACTION,'OFF');assert.equal(vars.ORDER_NUMBER,'NONE');
 console.log('SABER_R2_SINGLE_ORDER_SWITCH_OFF_NO_CLOUDFLARE_CHANGE');
 process.exit(0);
}
assert.match(vars.ORDER_NUMBER||'',/^[0-9]{3,6}$/);
assert.equal(process.env.GITHUB_REF_NAME,'integracion/tus-pedido-privado-20261101');
const num=Number(vars.ORDER_NUMBER);
assert.ok(Number.isSafeInteger(num)&&num>0);
const account=process.env.CF_ACCOUNT,deploy=process.env.CF_DEPLOY,dbtoken=process.env.CF_D1_TOKEN;
assert.match(account||'',/^[0-9a-f]{32}$/i);
assert.ok(deploy?.length>20&&dbtoken?.length>20);
const origin='https://api.cloudflare.com/client/v4/accounts/'+account;
async function api(path,token,options={}){
 const response=await fetch(origin+path,{...options,headers:{
  Authorization:'Bearer '+token,...(options.headers||{})
 },signal:AbortSignal.timeout(26000)});
 const json=await response.json().catch(()=>null);
 assert.ok(response.ok&&json?.success===true,'CF_OPERATION_REJECTED_'+path.split('/').at(-1)+'_'+response.status);
 return json.result;
}
const dbs=await api('/d1/database',dbtoken);
const databases=dbs.filter(x=>x.name==='saber-pagos-produccion');
assert.equal(databases.length,1);
const sql=[
 'SELECT l.web_order_id AS web_order_id,o.status AS status,',
 'o.amount_ars AS amount_ars,o.created_at AS created_at,',
 'o.preference_id AS preference_id,o.payment_id AS payment_id,',
 'COUNT(*) AS file_count,',
 "SUM(CASE WHEN f.transport='r2' THEN 1 ELSE 0 END) AS r2_count,",
 'MAX(f.bytes) AS bytes,',
 'SUM(CASE WHEN f.received=0 THEN 1 ELSE 0 END) AS pending_files',
 'FROM central_work_order_numbers n',
 'JOIN central_r2_universal_order_links l ON l.commercial_order_id=n.commercial_order_id',
 'JOIN orders o ON o.id=l.commercial_order_id',
 'JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id',
 'WHERE n.number=?',
 'GROUP BY l.web_order_id,o.status,o.amount_ars,o.created_at,o.preference_id,o.payment_id'
].join(' ');
const result=await api('/d1/database/'+databases[0].uuid+'/query',dbtoken,{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({sql,params:[num]})});
assert.equal(result.length,1);assert.equal(result[0].success,true);
const orders=result[0].results||[];
assert.equal(orders.length,1,'NO_EXISTE_EXACTAMENTE_UNA_ORDEN');
const order=orders[0];
assert.match(order.web_order_id||'',/^WEB-ENSAYO-[A-F0-9]{32}$/);
assert.equal(order.status,'awaiting_payment','ORDEN_NO_PENDIENTE');
assert.equal(order.preference_id,null,'PREFERENCIA_MP_EXISTENTE');
assert.equal(order.payment_id,null,'PAGO_ANTERIOR_EXISTENTE');
assert.equal(order.file_count,1);assert.equal(order.r2_count,1);
assert.equal(order.pending_files,1);
assert.ok(Number.isSafeInteger(order.bytes)&&order.bytes>40*1048576&&order.bytes<=200*1048576);
assert.ok(Number.isSafeInteger(order.amount_ars)&&order.amount_ars>0);
const current=Date.now(),created=Date.parse(String(order.created_at||'').replace(' ','T')+'Z');
assert.ok(Number.isFinite(created)&&created<=current+30000&&current-created<20*3600*1000,
 'PRESUPUESTO_VENCIDO_VOLVER_A_COTIZAR');
const worker='saber-pagos-produccion';
async function settings(){return await api('/workers/scripts/'+worker+'/settings',deploy)}
const previous=await settings(),bindings=previous.bindings||[];
const get=name=>bindings.find(b=>b.name===name);
const GO='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const closed=['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE'];
for(const n of closed)assert.equal(get(n)?.text,OFF,'R2_GENERAL_GATE_ABIERTO');
for(const n of ['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED','CENTRAL_LIVE_POSTPAY_GATE',
 'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_PRICING_GATE'])
 assert.equal(get(n)?.text,GO,'CORE_LIVE_NO_GO_'+n);
assert.ok(!get('CENTRAL_R2_CANARY_MODE')||get('CENTRAL_R2_CANARY_MODE').text==='NO_GO',
 'CANARY_ANTERIOR_AUN_ACTIVO');
const keys=['CENTRAL_R2_CANARY_MODE','CENTRAL_R2_CANARY_ORDER_ID','CENTRAL_R2_CANARY_EXPIRES_AT'];
const mode='SOLO_PEDIDO_R2_CONTROLADO';
const expires=new Date(current+24*3600*1000).toISOString().replace('.000Z','Z');
function patchBindings(modeValue,orderId,expiresAt){
 const remaining=bindings.filter(x=>!keys.includes(x.name)).map(x=>
  x.type==='r2_bucket'?{name:x.name,type:'r2_bucket',bucket_name:x.bucket_name}:
  {name:x.name,type:'inherit'});
 return [...remaining,
  {name:keys[0],type:'plain_text',text:modeValue},
  {name:keys[1],type:'plain_text',text:orderId},
  {name:keys[2],type:'plain_text',text:expiresAt}];
}
async function patch(modeValue,orderId,expiresAt){
 const data=new FormData();
 data.append('settings',new Blob([JSON.stringify({
  bindings:patchBindings(modeValue,orderId,expiresAt)
 })],{type:'application/json'}),'settings.json');
 return api('/workers/scripts/'+worker+'/settings',deploy,{method:'PATCH',body:data});
}
let attempted=false;
try{
 attempted=true;
 await patch(mode,order.web_order_id,expires);
 let after;
 for(let i=0;i<6;i++){
  after=await settings();
  if(keys.every((k,j)=>after.bindings.some(b=>b.name===k&&b.type==='plain_text'&&
   b.text===[mode,order.web_order_id,expires][j])))break;
  await new Promise(r=>setTimeout(r,650));
 }
 assert.ok(keys.every((k,j)=>after.bindings.some(b=>b.name===k&&b.text===
  [mode,order.web_order_id,expires][j])),'CANARY_NOT_EFFECTIVE');
 for(const gate of closed)assert.ok(after.bindings.some(b=>b.name===gate&&b.text===OFF),
   'GENERAL_R2_GATE_OPENED');
 const oldNames=bindings.map(b=>b.name).filter(k=>!keys.includes(k)).sort();
 const afterNames=after.bindings.map(b=>b.name).filter(k=>!keys.includes(k)).sort();
 assert.deepEqual(afterNames,oldNames,'OTHER_BINDINGS_CHANGED');
 console.log('SABER_R2_CANARY_ORDER_NUMBER='+vars.ORDER_NUMBER);
 console.log('SABER_R2_CANARY_BYTES='+order.bytes);
 console.log('SABER_R2_CANARY_EXPIRES='+expires);
 console.log('SABER_R2_CANARY_ONE_ORDER_ONLY_ACTIVE_GENERAL_R2_NO_GO');
 console.log('SABER_NO_NEW_ORDER_NO_MP_PAYMENT_NO_R2_UPLOAD');
}catch(e){
 if(attempted){
  console.log('SABER_R2_CANARY_ROLLBACK_REQUESTED');
  try{
   await patch('NO_GO','NONE','1970-01-01T00:00:00Z');
   const after=await settings();
   assert.ok(after.bindings.some(b=>b.name==='CENTRAL_R2_CANARY_MODE'&&b.text==='NO_GO'));
   console.log('SABER_R2_CANARY_ROLLBACK_VERIFIED');
  }catch{console.log('SABER_R2_CANARY_ROLLBACK_UNCONFIRMED_CHECK_OPERATOR')}
 }
 throw e;
}
