/** Migración D1 exclusiva: una tabla de recibos TUS sin datos.
 * Nunca importa PDFs, pedidos ni credenciales. Requiere token D1 Write.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'LIVE_TUS_CUENTA_INVALIDA');
assert.ok(typeof token==='string'&&token.length>15,'LIVE_TUS_TOKEN_FALTANTE');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,init={}){
 const res=await fetch(base+path,{...init,headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },signal:AbortSignal.timeout(25000)});
 const value=await res.json().catch(()=>null);
 if(!res.ok||value?.success!==true)
  throw Error('LIVE_TUS_D1_API_'+res.status);
 return value;
}
function records(res){
 const x=res?.result;
 assert.ok(Array.isArray(x)&&x.length>0,'LIVE_TUS_D1_RESULTADO');
 for(const row of x)assert.equal(row.success,true,'LIVE_TUS_D1_SQL_ERROR');
 return x.flatMap(i=>i.results||[]);
}
const list=(await api('')).result;
assert.ok(Array.isArray(list),'LIVE_TUS_LISTADO_INVALIDO');
const prod=list.filter(x=>x.name==='saber-pagos-produccion');
const sandbox=list.filter(x=>x.name==='saber-pagos-pruebas');
assert.equal(prod.length,1,'LIVE_TUS_PROD_NO_UNICA');
assert.equal(sandbox.length,1,'LIVE_TUS_SANDBOX_NO_UNICA');
const id=prod[0].uuid;
assert.match(id||'',/^[a-f0-9-]{36}$/i,'LIVE_TUS_UUID');
assert.notEqual(id,sandbox[0].uuid,'LIVE_TUS_NO_SANDBOX');
assert.notEqual(id,'60124ac5-1941-44ba-96e5-ea3165b65ec9','LIVE_TUS_SANDBOX_CONOCIDO');
const query=async sql=>records(await api('/'+id+'/query',{
 method:'POST',body:JSON.stringify({sql})
}));
const tables=await query("SELECT name FROM sqlite_master WHERE type='table'");
const names=new Set(tables.map(x=>x.name));
for(const name of ['orders','order_items','payment_reviews',
 'central_r2_universal_files','central_r2_universal_drafts',
 'central_r2_universal_order_links','central_pricing_admin_head'])
 assert.ok(names.has(name),'LIVE_TUS_TABLA_PREVIA_FALTANTE_'+name);
const orders=await query('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(orders[0]?.n),0,'LIVE_TUS_NO_MIGRAR_CON_ORDENES');
const fileRows=await query('SELECT COUNT(*) AS n FROM central_r2_universal_files');
assert.equal(Number(fileRows[0]?.n),0,'LIVE_TUS_ARCHIVOS_PREVIOS');
const ddl=(await readFile(new URL('./d1-produccion-tus-recibos-v1.sql',import.meta.url),'utf8'))
 .split('\n').filter(x=>!x.trim().startsWith('--')).join('\n').trim();
assert.equal((ddl.match(/;/g)||[]).length,1,'LIVE_TUS_DDL_UNICO');
assert.match(ddl,/^CREATE TABLE IF NOT EXISTS central_r2_universal_tus_receipts\s*\(/);
assert.doesNotMatch(ddl,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|ATTACH|TRIGGER|REPLACE)\b/i);
if(names.has('central_r2_universal_tus_receipts')){
 const count=await query('SELECT COUNT(*) AS n FROM central_r2_universal_tus_receipts');
 assert.equal(Number(count[0]?.n),0,'LIVE_TUS_TABLA_CON_DATOS');
}
await query(ddl.slice(0,-1));
const after=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='central_r2_universal_tus_receipts'");
assert.equal(after.length,1,'LIVE_TUS_TABLA_NO_VERIFICADA');
const count=await query('SELECT COUNT(*) AS n FROM central_r2_universal_tus_receipts');
assert.equal(Number(count[0]?.n),0,'LIVE_TUS_RECIBOS_NO_CERO');
const cols=await query('PRAGMA table_info(central_r2_universal_tus_receipts)');
for(const name of ['web_order_id','file_id','receipt_id','object_name',
 'sha256','bytes','page_count'])
 assert.ok(cols.some(x=>x.name===name),'LIVE_TUS_COLUMNA_'+name);
const fk=await query('PRAGMA foreign_key_list(central_r2_universal_tus_receipts)');
assert.ok(fk.some(x=>x.table==='central_r2_universal_files'),'LIVE_TUS_SIN_FK');
console.log('LIVE_TUS_RECEIPTS_D1_SCHEMA_VERIFIED_ZERO_DATA');
console.log('LIVE_TUS_NO_SANDBOX_NO_MP_NO_UPLOAD_NO_PUBLIC_DEPLOY');
