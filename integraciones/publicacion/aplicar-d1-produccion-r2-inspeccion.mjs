/** Exclusivamente migración de esquema para auditoría de inspección R2.
 * No modifica pedidos, tarifas, cobranzas, archivos ni gates.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'R2_INSPECCION_ACCOUNT');
assert.ok(typeof token==='string'&&token.length>=16,'R2_INSPECCION_TOKEN');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,init={}){
 const res=await fetch(base+path,{...init,headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },signal:AbortSignal.timeout(25000)});
 const json=await res.json().catch(()=>null);
 if(!res.ok||json?.success!==true)throw Error('R2_INSPECCION_CF_'+res.status);
 return json;
}
function records(body){
 assert.ok(Array.isArray(body?.result)&&body.result.length>0,'R2_INSPECCION_RESULTADO');
 for(const b of body.result)assert.equal(b.success,true,'R2_INSPECCION_QUERY');
 return body.result.flatMap(r=>r.results||[]);
}
const list=(await api('')).result;
assert.ok(Array.isArray(list),'R2_INSPECCION_D1_LISTA');
const prod=list.filter(x=>x.name==='saber-pagos-produccion');
const test=list.filter(x=>x.name==='saber-pagos-pruebas');
assert.equal(prod.length,1,'R2_INSPECCION_PROD_UNICA');
assert.equal(test.length,1,'R2_INSPECCION_SANDBOX_UNICA');
const id=prod[0].uuid;
assert.match(id||'',/^[a-f0-9-]{36}$/i,'R2_INSPECCION_PROD_UUID');
assert.notEqual(id,test[0].uuid,'R2_INSPECCION_MISMA_D1');
const query=async sql=>records(await api('/'+id+'/query',{
 method:'POST',body:JSON.stringify({sql})
}));
const tables=new Set((await query(
 "SELECT name FROM sqlite_master WHERE type='table'")).map(x=>x.name));
for(const name of ['orders','payment_reviews','central_r2_universal_files',
 'central_r2_universal_order_links','central_r2_large_pending',
 'central_r2_large_reservations'])
 assert.ok(tables.has(name),'R2_INSPECCION_FALTA_'+name);
assert.equal(Number((await query('SELECT COUNT(*) AS n FROM orders'))[0]?.n),0,
 'R2_INSPECCION_PROD_CONTIENE_ORDENES');
const ddl=(await readFile(new URL('./d1-produccion-r2-inspeccion-v1.sql',import.meta.url),'utf8'))
 .split('\n').filter(x=>!x.trim().startsWith('--')).join('\n').trim();
assert.match(ddl,/^CREATE TABLE IF NOT EXISTS central_r2_live_inspections\s*\(/);
assert.equal((ddl.match(/;/g)||[]).length,1,'R2_INSPECCION_UN_SOLO_DDL');
assert.doesNotMatch(ddl,/^\s*(?:INSERT|UPDATE|DELETE|DROP|ALTER|ATTACH|TRIGGER|REPLACE)\b/im);
if(tables.has('central_r2_live_inspections')){
 assert.equal(Number((await query('SELECT COUNT(*) AS n FROM central_r2_live_inspections'))[0]?.n),0,
 'R2_INSPECCION_CON_DATOS');
}
await query(ddl.slice(0,-1));
const count=await query('SELECT COUNT(*) AS n FROM central_r2_live_inspections');
assert.equal(Number(count[0]?.n),0,'R2_INSPECCION_D1_NO_VACIA');
const cols=await query('PRAGMA table_info(central_r2_live_inspections)');
for(const key of ['web_order_id','file_id','commercial_order_id','receipt_id',
 'quote_hash','sha256','bytes','report_hash','operator','measured_json'])
 assert.ok(cols.some(c=>c.name===key),'R2_INSPECCION_COLUMNA_'+key);
const fk=await query('PRAGMA foreign_key_list(central_r2_live_inspections)');
assert.ok(fk.some(x=>x.table==='central_r2_universal_files'),'R2_INSPECCION_FK_ARCHIVO');
assert.ok(fk.some(x=>x.table==='orders'),'R2_INSPECCION_FK_ORDEN');
console.log('R2_INSPECCION_ESQUEMA_PRODUCCION_OK_CERO_DATOS');
console.log('R2_NO_GO_NINGUN_CAMBIO_EN_MAIN_MP_ORDENES_O_ARCHIVOS');
