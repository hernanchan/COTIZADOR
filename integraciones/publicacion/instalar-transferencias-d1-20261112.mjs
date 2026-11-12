/** Prepara las tablas de transferencia LIVE SIN habilitar cobros.
 * Esquema idéntico a ensureLiveBankTables en transferencias-live-central.mjs.
 * Único efecto: DDL CREATE TABLE/INDEX IF NOT EXISTS en D1 producción.
 */
import assert from 'node:assert/strict';
const account=process.env.CF_ACCOUNT,apiToken=process.env.CF_DB,
 deployToken=process.env.CF_DEPLOY;
assert.match(account||'',/^[0-9a-f]{32}$/i);
assert.ok(apiToken?.length>20&&deployToken?.length>20);
assert.equal(process.env.GITHUB_REF_NAME,'integracion/tus-pedido-privado-20261101');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
async function api(path,token,options={}){
 const r=await fetch(root+path,{...options,headers:{
  Authorization:'Bearer '+token,...options.headers
 },signal:AbortSignal.timeout(26000)});
 const v=await r.json().catch(()=>null);
 assert.ok(r.ok&&v?.success===true,
  'CF_SQL_OR_SETTINGS_ERROR_'+path.split('/').at(-1)+'_'+r.status);
 return v.result;
}
const settings=await api('/workers/scripts/saber-pagos-produccion/settings',deployToken);
const binding=n=>settings.bindings.find(x=>x.name===n);
const GO='GO_COMERCIAL_CONFIRMADO';
assert.equal(binding('SABER_ENTORNO')?.text,'produccion');
assert.equal(binding('CENTRAL_DB_ENV')?.text,'produccion');
assert.equal(binding('MP_LIVE_GATE')?.text,GO);
assert.equal(binding('CENTRAL_LIVE_R2_GATE')?.text,GO);
assert.notEqual(binding('CENTRAL_LIVE_TRANSFER_GATE')?.text,GO,
 'LIVE_TRANSFER_ENABLED_BEFORE_BANK_TABLE_SETUP');
assert.notEqual(binding('CENTRAL_LIVE_TRANSFER_APPROVAL_GATE')?.text,GO,
 'LIVE_TRANSFER_APPROVAL_ENABLED_BEFORE_SETUP');
const dbs=await api('/d1/database',apiToken);
const db=dbs.find(x=>x.name==='saber-pagos-produccion');
assert.ok(db?.uuid,'PRODUCTION_DATABASE_NOT_FOUND');
async function query(sql){
 const data=await api('/d1/database/'+db.uuid+'/query',apiToken,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({sql})
 });
 assert.equal(data.length,1);
 assert.equal(data[0].success,true,'D1_QUERY_FAILED');
 return data[0].results||[];
}
const schema=[
 "CREATE TABLE IF NOT EXISTS central_live_transfer_requests "+
 "(order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "amount_ars INTEGER NOT NULL CHECK(amount_ars>0),"+
 "state TEXT NOT NULL CHECK(state='awaiting_bank_verification'),"+
 "created_at TEXT NOT NULL DEFAULT (datetime('now')))",
 "CREATE TABLE IF NOT EXISTS central_live_bank_accreditations "+
 "(order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "amount_ars INTEGER NOT NULL CHECK(amount_ars>0),"+
 "operator TEXT NOT NULL,bank_reference TEXT NOT NULL UNIQUE,"+
 "recorded_at TEXT NOT NULL DEFAULT(datetime('now')))",
 "CREATE UNIQUE INDEX IF NOT EXISTS idx_live_bank_ref_normalized "+
 "ON central_live_bank_accreditations(REPLACE(bank_reference,' ','-'))"
];
for(const stmt of schema)await query(stmt);
const tables=await query(
 "SELECT type,name FROM sqlite_master WHERE name IN ("+
 "'central_live_transfer_requests','central_live_bank_accreditations',"+
 "'idx_live_bank_ref_normalized')"
);
assert.equal(tables.length,3,'BANK_TABLES_OR_UNIQUE_INDEX_MISSING');
const found=new Map(tables.map(t=>[t.name,t.type]));
assert.equal(found.get('central_live_transfer_requests'),'table');
assert.equal(found.get('central_live_bank_accreditations'),'table');
assert.equal(found.get('idx_live_bank_ref_normalized'),'index');
const col1=await query("PRAGMA table_info('central_live_transfer_requests')");
const col2=await query("PRAGMA table_info('central_live_bank_accreditations')");
for(const k of ['order_id','amount_ars','state','created_at'])
 assert.ok(col1.some(x=>x.name===k),'REQUEST_COLUMN_MISSING_'+k);
for(const k of ['order_id','amount_ars','operator','bank_reference','recorded_at'])
 assert.ok(col2.some(x=>x.name===k),'ACCREDITATION_COLUMN_MISSING_'+k);
const after=await api('/workers/scripts/saber-pagos-produccion/settings',deployToken);
assert.notEqual(after.bindings.find(x=>x.name==='CENTRAL_LIVE_TRANSFER_GATE')?.text,GO);
assert.notEqual(after.bindings.find(x=>x.name==='CENTRAL_LIVE_TRANSFER_APPROVAL_GATE')?.text,GO);
for(const k of ['MP_LIVE_GATE','CENTRAL_LIVE_R2_GATE',
 'CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE'])
 assert.equal(after.bindings.find(x=>x.name===k)?.text,GO);
console.log('SABER_TRANSFER_PRODUCTION_D1_TABLES_2_AND_UNIQUE_INDEX_INSTALLED');
console.log('SABER_TRANSFER_LIVE_GATES_REMAIN_OFF_UNTIL_VALID_BANK_ALIAS');
console.log('SABER_TRANSFER_MP_R2_GATES_STILL_GO_NO_NEW_ORDERS_NO_PAYMENTS_NO_PII');
