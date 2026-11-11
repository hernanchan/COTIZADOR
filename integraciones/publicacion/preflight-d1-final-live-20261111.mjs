/** Last preflight: production D1 schema + zero paid orders + production pricing. Read-only. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);
assert.ok(token?.length>15);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function call(path,{sql,params}={}){
 const res=await fetch(root+path,{method:sql?'POST':'GET',
 headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 ...(sql?{body:JSON.stringify({sql,params:params||[]})}:{}),signal:AbortSignal.timeout(25000)});
 const data=await res.json().catch(()=>null);
 assert.equal(res.ok,true,'D1_HTTP_'+res.status);
 assert.equal(data?.success,true,'D1_API_'+res.status);
 return data.result;
}
const databases=await call('');
const live=databases.filter(d=>d.name==='saber-pagos-produccion');
const sandbox=databases.filter(d=>d.name==='saber-pagos-pruebas');
assert.equal(live.length,1);assert.equal(sandbox.length,1);
assert.notEqual(live[0].uuid,sandbox[0].uuid);
async function query(sql,params=[]){
 const result=await call('/'+live[0].uuid+'/query',{sql,params});
 assert.ok(Array.isArray(result)&&result[0]?.success===true);
 return result[0].results||[];
}
const main=await readFile(new URL('./d1-produccion-core-v1.sql',import.meta.url),'utf8');
const extras=await Promise.all(['./d1-produccion-r2-capacidad-v1.sql',
 './d1-produccion-r2-inspeccion-v1.sql','./d1-produccion-tus-recibos-v1.sql',
 './d1-produccion-tarifario-v1.sql'].map(x=>readFile(new URL(x,import.meta.url),'utf8')));
const ddl=[main,...extras];
const expected=new Set(ddl.flatMap(src=>[...src.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z_0-9]*)\s*\(/ig)].map(m=>m[1])));
assert.ok(expected.size>=17);
const actual=new Set((await query("SELECT name FROM sqlite_master WHERE type='table'")).map(x=>x.name));
const missing=[...expected].filter(name=>!actual.has(name));
console.log('LIVE_D1_EXPECTED_TABLES='+expected.size);
console.log('LIVE_D1_MISSING_TABLES_COUNT='+missing.length);
if(missing.length)console.log('LIVE_D1_MISSING_TABLES='+missing.join(','));
const prices=await query('SELECT revision,approved_revision,approved_json FROM central_pricing_admin_head WHERE id=1');
assert.equal(prices.length,1);
const snapshot=JSON.parse(prices[0].approved_json||'null');
assert.equal(prices[0].revision,2);
assert.equal(prices[0].approved_revision,2);
assert.equal(snapshot?.prices?.plotter?.supports?.find(x=>x.id==='rec60')?.posterPerMeter,18700);
console.log('LIVE_D1_APPROVED_PRICES_REVISION=2');
const counts=await query("SELECT status,COUNT(*) AS n FROM orders GROUP BY status");
const totals=Object.fromEntries(counts.map(x=>[x.status,Number(x.n)]));
console.log('LIVE_D1_ORDERS_TOTAL='+Object.values(totals).reduce((x,y)=>x+y,0));
console.log('LIVE_D1_PAID_ORDER_COUNT='+Number(totals.paid||0));
const duplicated=await query("SELECT COUNT(*) AS n FROM (SELECT web_order_id FROM central_r2_universal_order_links GROUP BY web_order_id HAVING COUNT(*)>1)");
assert.equal(Number(duplicated[0]?.n),0,'DUPLICATE_LINK');
console.log('LIVE_D1_DUPLICATE_UNIVERSAL_ORDER_LINKS=0');
const indexes=await query("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'");
console.log('LIVE_D1_NAMED_INDEX_COUNT='+indexes.length);
assert.equal(missing.length,0,'LIVE_PRODUCTION_SCHEMA_INCOMPLETE');
console.log('LIVE_D1_ORDERING_PRICING_TUS_R2_AND_QUOTA_READY_READONLY');
console.log('NO_PAYMENTS_NO_D1_WRITES_NO_PUBLIC_SWITCH');
