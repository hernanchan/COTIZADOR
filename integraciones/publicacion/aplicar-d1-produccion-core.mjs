/**
 * Solo esquema D1 del núcleo LIVE. No despliega Workers ni toca pedidos/pagos.
 * Requiere SABER_CF_ACCOUNT_ID y SABER_CF_D1_WRITE_TOKEN en entorno privado de CI.
 * Sin fallback a tokens de pruebas. Fail closed; DDL reintentable, sin DML.
 */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'CUENTA_CLOUDFLARE_NO_CONFIGURADA');
assert.ok(token&&token.length>15,'FALTA_TOKEN_D1_WRITE');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function api(path,init={}){
 const r=await fetch(root+path,{...init,headers,signal:AbortSignal.timeout(25000)});
 const body=await r.json().catch(()=>null);
 if(!r.ok||body?.success!==true){
  const codes=(body?.errors||[]).map(x=>x.code).slice(0,3);
  throw Error('D1_HTTP_'+r.status+' CODES_'+codes.join(','));
 }
 return body;
}
function records(body){
 const result=body?.result;
 assert.ok(Array.isArray(result)&&result.length>0,'D1_SIN_RESULTADOS');
 for(const item of result)assert.equal(item.success,true,'D1_CONSULTA_NO_CONFIRMADA');
 return result.flatMap(item=>item.results||[]);
}
const list=(await api('')).result;
assert.ok(Array.isArray(list),'D1_LISTADO_INCORRECTO');
const production=list.filter(x=>x.name==='saber-pagos-produccion');
const sandbox=list.filter(x=>x.name==='saber-pagos-pruebas');
assert.equal(production.length,1,'D1_PRODUCCION_NO_UNICA');
assert.equal(sandbox.length,1,'D1_PRUEBAS_NO_UNICA');
const target=production[0].uuid;
assert.match(target||'',/^[a-f0-9-]{36}$/i);
assert.notEqual(target,sandbox[0].uuid,'D1_PRODUCCION_ES_SANDBOX');
assert.notEqual(target,'60124ac5-1941-44ba-96e5-ea3165b65ec9','D1_ID_SANDBOX_CONOCIDO');
const query=async sql=>records(await api('/'+target+'/query',{
 method:'POST',body:JSON.stringify({sql})
}));
const before=await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
assert.ok(before.every(x=>typeof x.name==='string'),'D1_ESQUEMA_EXTRAÑO');
console.log('LIVE_D1_PREEXISTING_TABLES='+before.length);
if(before.some(x=>x.name==='orders')){
 const existing=await query('SELECT COUNT(*) AS n FROM orders');
 assert.equal(Number(existing[0]?.n),0,'D1_PRODUCCION_YA_TIENE_PEDIDOS: no migrar');
}
const raw=await readFile(new URL('./d1-produccion-core-v1.sql',import.meta.url),'utf8');
const sql=raw.split('\n').filter(s=>!s.trim().startsWith('--')).join('\n');
const statements=sql.split(';').map(x=>x.trim()).filter(Boolean);
assert.ok(statements.length>=12&&statements.length<=25,'MIGRACION_CANTIDAD_INESPERADA');
for(const statement of statements){
 assert.match(statement,/^CREATE (TABLE|INDEX) IF NOT EXISTS [a-z0-9_]+/i,'DDL_NO_APROBADO');
 assert.doesNotMatch(statement,/^(DROP|ALTER|DELETE|INSERT|UPDATE|REPLACE|ATTACH|DETACH|TRIGGER)\b/i,'DDL_POTENCIALMENTE_DESTRUCTIVO');
 assert.ok(statement.length<3000,'DDL_EXCESIVO');
}
const existingTables=new Set(before.map(x=>x.name));
const required=['orders','order_items','payment_reviews','central_work_order_numbers',
 'central_order_contacts','central_r2_universal_drafts','central_r2_universal_files',
 'central_r2_universal_order_links','central_document_manifests',
 'live_checkout_locks','live_checkout_attempts'];
for(const table of required){
 assert.ok(statements.some(x=>x.startsWith('CREATE TABLE IF NOT EXISTS '+table+' ')),
  'DDL_REQUERIDO_AUSENTE_'+table);
}
console.log('LIVE_D1_SCHEMA_STATEMENTS='+statements.length);
// Solo DDL explícito. Si se interrumpe, volver a ejecutar es seguro.
for(const [index,statement] of statements.entries()){
 await query(statement);
 console.log('LIVE_D1_DDL_OK_'+String(index+1).padStart(2,'0'));
}
const after=await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
const afterNames=new Set(after.map(x=>x.name));
for(const name of required)assert.ok(afterNames.has(name),'D1_TABLA_FALTANTE_'+name);
for(const name of ['orders','order_items','central_r2_universal_drafts',
 'central_r2_universal_files','central_r2_universal_order_links','payment_reviews',
 'live_checkout_attempts']){
 const rows=await query('SELECT COUNT(*) AS n FROM '+name);
 assert.equal(Number(rows[0]?.n),0,'D1_FILAS_DE_NEGOCIO_INESPERADAS_'+name);
}
const cols=await query('PRAGMA table_info(orders)');
for(const name of ['id','amount_ars','deposit_ars','status','preference_id','payment_id','paid_at'])
 assert.ok(cols.some(x=>x.name===name),'D1_ORDER_COLUMNA_FALTANTE_'+name);
console.log('LIVE_D1_SCHEMA_VERIFIED_TABLES='+required.length);
console.log('LIVE_D1_ZERO_ORDERS_ZERO_PAYMENT_ZERO_FILES');
console.log('LIVE_D1_SEPARATE_CONFIRMED_NO_SANDBOX_DATA_NO_MP_NO_WORKER_NO_PUBLICATION');
