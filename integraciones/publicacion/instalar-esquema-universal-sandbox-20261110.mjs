/** Only missing universal order schema in D1 Sandbox, no writes to orders. */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,data){
 const r=await fetch(root+path,{method:data?'POST':'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(25000)});
 const x=await r.json().catch(()=>null);
 assert.equal(x?.success,true,'D1_API_'+r.status);
 return x.result;
}
const dblist=await api('');
const found=dblist.filter(x=>x.name==='saber-pagos-pruebas');
const prod=dblist.filter(x=>x.name==='saber-pagos-produccion');
assert.equal(found.length,1);assert.equal(prod.length,1);
const id=found[0].uuid;
assert.notEqual(id,prod[0].uuid);assert.equal(id,'60124ac5-1941-44ba-96e5-ea3165b65ec9');
async function sql(statement){
 const x=await api('/'+id+'/query',{sql:statement});
 assert.ok(Array.isArray(x)&&x[0]?.success===true,'D1_SANDBOX_SQL_FAILED');
 return x[0];
}
const countsBefore=await sql('SELECT COUNT(*) AS n FROM orders');
const baseline=Number(countsBefore.results?.[0]?.n);
assert.ok(Number.isSafeInteger(baseline));
const source=await readFile(new URL('./d1-produccion-core-v1.sql',import.meta.url),'utf8');
const clean=source.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const wanted=['central_r2_universal_drafts','central_r2_universal_files','central_r2_universal_order_links'];
const statements=clean.split(';').map(x=>x.trim()).filter(x=>/^CREATE TABLE IF NOT EXISTS central_r2_universal_/.test(x));
assert.equal(statements.length,3);
for(let i=0;i<3;i++){
 assert.ok(statements[i].startsWith('CREATE TABLE IF NOT EXISTS '+wanted[i]+' ('));
 assert.doesNotMatch(statements[i],/\b(DROP|DELETE|UPDATE|INSERT|ALTER|REPLACE|ATTACH)\b/i);
 await sql(statements[i]);
}
const schema=await sql("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'central_r2_universal_%'");
const names=new Set(schema.results?.map(x=>x.name)||[]);
for(const n of wanted)assert.ok(names.has(n),'MISSING_'+n);
for(const name of wanted){
 const p=await sql('SELECT COUNT(*) AS n FROM '+name);
 assert.equal(Number(p.results?.[0]?.n),0,'UNIVERSAL_TABLE_NOT_EMPTY_'+name);
}
const countsAfter=await sql('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(countsAfter.results?.[0]?.n),baseline,'ORDERS_CHANGED');
console.log('SABER_SANDBOX_UNIVERSAL_TABLES_CREATED_OR_PRESENT=3');
console.log('SABER_SANDBOX_UNIVERSAL_DRAFTS_FILES_LINKS_ZERO_ROWS');
console.log('SABER_SANDBOX_EXISTING_ORDERS_UNCHANGED='+baseline);
console.log('SABER_NO_PRODUCTION_WRITE_NO_PAYMENTS_NO_PUBLIC_DEPLOY');
