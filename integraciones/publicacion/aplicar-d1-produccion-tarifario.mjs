/** D1 LIVE: solo 2 tablas tarifarias; jamás carga precios, promociones ni pedidos.
 * Validación separa por ID real saber-pagos-produccion de saber-pagos-pruebas.
 */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'LIVE_PRICING_CUENTA_INVALIDA');
assert.ok(typeof token==='string'&&token.length>15,'LIVE_PRICING_TOKEN_FALTANTE');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,init={}){
 const res=await fetch(root+path,{...init,headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },signal:AbortSignal.timeout(25000)});
 const value=await res.json().catch(()=>null);
 if(!res.ok||value?.success!==true)
  throw Error('LIVE_PRICING_API_'+res.status+'_ERRORS_'+
   (value?.errors||[]).map(x=>x.code).slice(0,2).join('_'));
 return value;
}
function records(result){
 const a=result?.result;
 assert.ok(Array.isArray(a)&&a.length>0,'LIVE_PRICING_SIN_RESPUESTA');
 for(const x of a)assert.equal(x.success,true,'LIVE_PRICING_QUERY_FALLO');
 return a.flatMap(x=>x.results||[]);
}
const list=(await api('')).result;
assert.ok(Array.isArray(list),'LIVE_PRICING_LISTADO_INVALIDO');
const production=list.filter(x=>x.name==='saber-pagos-produccion');
const test=list.filter(x=>x.name==='saber-pagos-pruebas');
assert.equal(production.length,1,'LIVE_PRICING_D1_PRODUCTIVA_NO_UNICA');
assert.equal(test.length,1,'LIVE_PRICING_D1_SANDBOX_NO_UNICA');
const id=production[0].uuid;
assert.match(id||'',/^[a-f0-9-]{36}$/i,'LIVE_PRICING_UUID_INVALIDO');
assert.notEqual(id,test[0].uuid,'LIVE_PRICING_DESTINO_SANDBOX');
assert.notEqual(id,'60124ac5-1941-44ba-96e5-ea3165b65ec9','LIVE_PRICING_SANDBOX_CONOCIDO');
const query=async sql=>records(await api('/'+id+'/query',{
 method:'POST',body:JSON.stringify({sql})
}));
const core=['orders','order_items','central_work_order_numbers',
 'central_r2_universal_drafts','central_r2_universal_files',
 'central_r2_universal_order_links'];
const current=await query("SELECT name FROM sqlite_master WHERE type='table'");
const present=new Set(current.map(x=>x.name));
for(const name of core)assert.ok(present.has(name),'LIVE_PRICING_CORE_MISSING_'+name);
const before=await query('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(before[0]?.n),0,'LIVE_PRICING_EXISTEN_ORDENES_NO_MIGRAR');
const original=await readFile(new URL('./d1-produccion-tarifario-v1.sql',import.meta.url),'utf8');
const statements=original.split('\n').filter(line=>!line.trim().startsWith('--'))
 .join('\n').split(';').map(line=>line.trim()).filter(Boolean);
assert.equal(statements.length,2,'LIVE_PRICING_DDL_INESPERADO');
for(const stmt of statements){
 assert.match(stmt,/^CREATE TABLE IF NOT EXISTS central_pricing_admin_(head|history)\s*\(/i);
 assert.doesNotMatch(stmt,/\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRIGGER|ATTACH|REPLACE)\b/i);
 assert.ok(stmt.length<3000,'LIVE_PRICING_DDL_LONGITUD');
}
for(const statement of statements)await query(statement);
const after=await query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'central_pricing_admin_%'");
const names=new Set(after.map(x=>x.name));
assert.ok(names.has('central_pricing_admin_head')&&names.has('central_pricing_admin_history'));
for(const name of ['central_pricing_admin_head','central_pricing_admin_history']){
 const rows=await query('SELECT COUNT(*) AS n FROM '+name);
 assert.equal(Number(rows[0]?.n),0,'LIVE_PRICING_DATOS_NO_ESPERADOS_'+name);
}
const orders=await query('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(orders[0]?.n),0,'LIVE_PRICING_NO_MODIFICAR_ORDENES');
console.log('LIVE_D1_PRICING_SCHEMA_OK_ZERO_PRICES_ZERO_APPROVALS_ZERO_ORDERS');
console.log('LIVE_D1_PRICING_NO_SANDBOX_NO_PAYMENTS_NO_DEPLOY');
