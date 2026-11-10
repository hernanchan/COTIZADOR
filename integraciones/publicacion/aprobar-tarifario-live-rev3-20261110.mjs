/** One-time, explicitly owner-approved promotion of Sandbox D1 pricing revision 3.
 * Does not deploy, set gates, modify main, charge, or create commercial orders.
 * Production keeps its own revision numbers (draft 1, approved 2).
 */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'LIVE_PRICING_ACCOUNT');
assert.ok(typeof token==='string'&&token.length>15,'LIVE_PRICING_TOKEN_MISSING');
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,method='GET',data){
 const response=await fetch(endpoint+path,{method,headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>null);
 assert.equal(response.ok,true,'D1_HTTP_'+response.status);
 assert.equal(result?.success,true,'D1_API_FAILED_'+(result?.errors||[]).map(e=>e.code).slice(0,2).join('_'));
 return result.result;
}
const list=await api('');
assert.ok(Array.isArray(list));
function id(name){
 const rows=list.filter(x=>x.name===name);
 assert.equal(rows.length,1,'D1_NOT_UNIQUE_'+name);
 assert.match(rows[0].uuid||'',/^[0-9a-f-]{36}$/i);
 return rows[0].uuid;
}
const sandboxId=id('saber-pagos-pruebas');
const liveId=id('saber-pagos-produccion');
assert.notEqual(sandboxId,liveId,'D1_SEPARATION_BROKEN');
assert.notEqual(liveId,'60124ac5-1941-44ba-96e5-ea3165b65ec9','D1_LAB_ID');
async function query(database,sql,params=[]){
 const result=await api('/'+database+'/query','POST',{sql,params});
 assert.ok(Array.isArray(result)&&result[0]?.success===true,'D1_QUERY_FAILED');
 return result[0];
}
async function head(database){
 const data=await query(database,
  'SELECT revision,approved_revision,draft_json,approved_json FROM central_pricing_admin_head WHERE id=1');
 return data.results?.[0]||null;
}
const src=await head(sandboxId);
assert.equal(src?.approved_revision,3,'D1_SANDBOX_SOURCE_MUST_BE_REV3');
assert.ok(typeof src.approved_json==='string'&&src.approved_json.length>7000,'D1_SANDBOX_NO_PRICES');
const snapshot=JSON.parse(src.approved_json);
assert.deepEqual(Object.keys(snapshot).sort(),['prices','promotions']);
assert.equal(snapshot.prices?.schema,'saber-web-prices-v1');
assert.equal(snapshot.prices?.plotter?.supports?.find(x=>x.id==='rec60')?.posterPerMeter,18700);
assert.ok(Array.isArray(snapshot.promotions?.codes)&&snapshot.promotions.codes.length===5);
assert.ok(Array.isArray(snapshot.promotions?.weekly)&&snapshot.promotions.weekly.length===7);
assert.equal(snapshot.promotions.one_code_at_a_time,true);

// Confirm every price, category, material, range and identity against the reviewed branch
// (ignore generated metadata only). No auto-update based on unverified price data.
const branchPrices=JSON.parse(await readFile('precios-web.json','utf8'));
function normalize(x){
 if(Array.isArray(x))return x.map(normalize);
 if(x&&typeof x==='object')return Object.fromEntries(
  Object.entries(x).filter(([k])=>!['generatedAt','source','priceVersion','note'].includes(k))
   .map(([k,v])=>[k,normalize(v)]));
 return x;
}
assert.deepEqual(normalize(snapshot.prices),normalize(branchPrices),
 'D1_SANDBOX_REV3_DIFFERS_FROM_BRANCH');
const payload=JSON.stringify(snapshot);
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
const sha=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
console.log('SABER_PRICING_APPROVED_SOURCE_SANDBOX_REV=3');
console.log('SABER_PRICING_SOURCE_SHA256='+sha);
const counts=await query(liveId,'SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(counts.results?.[0]?.n),0,'LIVE_HAS_ORDERS_UNEXPECTED');
const histories=await query(liveId,
 'SELECT revision,action,operator,payload_json FROM central_pricing_admin_history ORDER BY revision');
const previous=histories.results||[];
const actor='Titular Saber - aprobacion expresa 2026-11-10';
function historyMatches(row,revision,action){
 return row?.revision===revision&&row?.action===action&&row?.operator===actor&&
  row?.payload_json===payload;
}
let current=await head(liveId);
if(current?.approved_json){
 assert.equal(current.approved_json,payload,'LIVE_ALREADY_APPROVED_DIFFERENT_VERSION');
 assert.equal(current.approved_revision,2,'LIVE_EXISTING_REVISION_UNEXPECTED');
 assert.equal(current.revision,2,'LIVE_EXISTING_HEAD_UNEXPECTED');
 console.log('SABER_LIVE_PRICING_ALREADY_APPROVED_REV2_IDENTICAL');
}else{
 assert.ok(current===null||
  (current.revision===0&&current.approved_revision===0&&!current.draft_json)||
  (current.revision===1&&current.approved_revision===0&&current.draft_json===payload),
  'LIVE_HEAD_UNEXPECTED_NO_WRITE');
 assert.ok(previous.every(x=>historyMatches(x,1,'draft')||
   historyMatches(x,2,'approve')),'LIVE_HISTORY_UNEXPECTED_NO_WRITE');
 if(current===null){
  const write=await query(liveId,
   'INSERT INTO central_pricing_admin_head(id,revision,approved_revision,draft_json,approved_json) VALUES(1,1,0,?,NULL)',
   [payload]);
  assert.equal(write.meta?.changes,1,'LIVE_INSERT_DRAFT_FAILED');
 }else if(current.revision===0){
  const write=await query(liveId,
   'UPDATE central_pricing_admin_head SET revision=1,draft_json=?,updated_at=datetime(\'now\') WHERE id=1 AND revision=0 AND approved_json IS NULL AND draft_json IS NULL',
   [payload]);
  assert.equal(write.meta?.changes,1,'LIVE_UPDATE_DRAFT_FAILED');
 }
 current=await head(liveId);
 assert.equal(current?.revision,1,'LIVE_DRAFT_REVISION_MISMATCH');
 assert.equal(current.draft_json,payload,'LIVE_DRAFT_MISMATCH');
 if(!previous.some(x=>x.revision===1)){
  const audit=await query(liveId,
   "INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) VALUES(1,'draft',?,?,0)",
   [actor,payload]);
  assert.equal(audit.meta?.changes,1,'LIVE_DRAFT_AUDIT_MISSING');
 }
 const update=await query(liveId,
  "UPDATE central_pricing_admin_head SET approved_json=draft_json,draft_json=NULL,approved_revision=2,revision=2,updated_at=datetime('now') WHERE id=1 AND revision=1 AND approved_json IS NULL AND draft_json=?",
  [payload]);
 assert.equal(update.meta?.changes,1,'LIVE_APPROVE_FAILED');
 console.log('SABER_LIVE_PRICING_WRITTEN_OWNER_APPROVED');
}
const historyAfter=await query(liveId,
 'SELECT revision,action,operator,payload_json FROM central_pricing_admin_history ORDER BY revision');
if(!historyAfter.results?.some(x=>x.revision===2)){
 const audit=await query(liveId,
  "INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) VALUES(2,'approve',?,?,0)",
  [actor,payload]);
 assert.equal(audit.meta?.changes,1,'LIVE_APPROVAL_AUDIT_MISSING');
}
current=await head(liveId);
assert.equal(current?.revision,2);
assert.equal(current.approved_revision,2);
assert.equal(current.draft_json,null);
assert.equal(current.approved_json,payload,'LIVE_READBACK_MISMATCH');
const records=(await query(liveId,
 'SELECT revision,action,operator,payload_json FROM central_pricing_admin_history ORDER BY revision')).results||[];
assert.equal(records.length,2,'LIVE_AUDIT_COUNT');
assert.ok(historyMatches(records[0],1,'draft')&&historyMatches(records[1],2,'approve'),
 'LIVE_AUDIT_CONTENT_MISMATCH');
const orders=await query(liveId,'SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(orders.results?.[0]?.n),0,'LIVE_ORDERS_CHANGED');
console.log('SABER_LIVE_PRICING_APPROVED_REV=2_FROM_SANDBOX_REV=3');
console.log('SABER_LIVE_PRICING_POST_WRITE_READBACK_OK');
console.log('SABER_LIVE_PAYMENTS_NOT_ENABLED_NO_DEPLOY_NO_MAIN_CHANGE');
