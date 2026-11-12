/** Diagnóstico sin secretos ni escrituras: si faltan gates o alias, no habilitar. */
import assert from 'node:assert/strict';
const account=process.env.CF_ACCOUNT,token=process.env.CF_DEPLOY,dbToken=process.env.CF_DB;
assert.match(account||'',/^[0-9a-f]{32}$/i);
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function get(path,auth=token,option={}){
 const resp=await fetch(base+path,{...option,headers:{
  Authorization:'Bearer '+auth,...option.headers},signal:AbortSignal.timeout(23000)});
 const data=await resp.json().catch(()=>null);
 assert.ok(resp.ok&&data?.success===true,'CLOUDFLARE_READ_REJECTED_'+resp.status);
 return data.result;
}
const [central,docs]=await Promise.all([
 get('/workers/scripts/saber-pagos-produccion/settings'),
 get('/workers/scripts/saber-documentos-produccion/settings')
]);
for(const [name,o] of [['central',central],['docs',docs]]){
 const keys=name==='central'?[
 'CENTRAL_LIVE_TRANSFER_GATE','CENTRAL_LIVE_TRANSFER_APPROVAL_GATE',
 'CENTRAL_LIVE_TRANSFER_ALIAS','CENTRAL_LIVE_TUS_GATE','CENTRAL_LIVE_R2_GATE',
 'CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE',
 'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_POSTPAY_GATE','MP_LIVE_GATE'
 ]:[
 'DOCS_LIVE_TRANSFER_GATE','DOCS_LIVE_TUS_GATE','DOCS_LIVE_ORDER_GATE',
 'DOCS_LIVE_UI_GATE','DOCS_MP_LIVE_GATE','DOCS_LIVE_RECEPCION_GATE'
 ];
 const info=keys.map(k=>{
  const binding=o.bindings.find(x=>x.name===k);
  return {key:k,configured:!!binding,enabled:binding?.text==='GO_COMERCIAL_CONFIRMADO',
   type:binding?.type||null,
   ...(k==='CENTRAL_LIVE_TRANSFER_ALIAS'?
    {validFormat:typeof binding?.text==='string'&&
     /^[A-Za-z0-9._-]{6,50}$/.test(binding.text)}:{})};
 });
 console.log('SABER_TRANSFER_'+name.toUpperCase()+'_GATES='+JSON.stringify(info));
}
const docsKey=k=>docs.bindings.find(x=>x.name===k);
console.log('SABER_TRANSFER_DOCS_BRIDGE_PREFLIGHT='+JSON.stringify({
 liveUrlConfigured:!!docsKey('CENTRAL_LIVE_URL'),
 liveUrlExact:docsKey('CENTRAL_LIVE_URL')?.text===
  'https://pagos.libreriasaber.com.ar/internal/central/live/checkout',
 bridgeHmacSecret:docsKey('CENTRAL_BRIDGE_KEY')?.type==='secret_text',
 centralServiceValid:docsKey('SABER_CENTRAL')?.type==='service'&&
  docsKey('SABER_CENTRAL')?.service==='saber-pagos-produccion'
}));
const dbs=await get('/d1/database',dbToken);
const db=dbs.find(x=>x.name==='saber-pagos-produccion');
assert.ok(db?.uuid);
const sql="SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+
 "'central_live_transfer_requests','central_live_bank_accreditations',"+
 "'central_r2_universal_order_links','orders','payment_reviews')";
const q=await get('/d1/database/'+db.uuid+'/query',dbToken,{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({sql})
});
assert.equal(q[0].success,true);
const names=q[0].results.map(x=>x.name);
console.log('SABER_TRANSFER_TABLES_PRESENT='+JSON.stringify(names));
console.log('SABER_TRANSFER_DIAGNOSTIC_READ_ONLY_NO_ALIAS_VALUE_NO_PAYMENT_NO_PII');
