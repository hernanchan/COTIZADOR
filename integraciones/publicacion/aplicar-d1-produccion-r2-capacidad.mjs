/** Migración LIVE R2, solo tablas de cuota/recepción.
 * No despliega Worker ni habilita R2. D1 Write exclusivamente producción.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_D1_WRITE_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i,'LIVE_R2_CUENTA_INVALIDA');
assert.ok(typeof token==='string'&&token.length>15,'LIVE_R2_TOKEN_FALTANTE');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(path,init={}){
 const r=await fetch(base+path,{...init,headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },signal:AbortSignal.timeout(25000)});
 const x=await r.json().catch(()=>null);
 if(!r.ok||x?.success!==true)throw Error('LIVE_R2_D1_API_'+r.status);
 return x;
}
function rows(x){
 assert.ok(Array.isArray(x?.result)&&x.result.length>0,'LIVE_R2_D1_QUERY_VACIA');
 for(const statement of x.result)assert.equal(statement.success,true,'LIVE_R2_D1_SQL_ERROR');
 return x.result.flatMap(y=>y.results||[]);
}
const all=(await api('')).result;
assert.ok(Array.isArray(all),'LIVE_R2_LISTADO_INVALIDO');
const live=all.filter(x=>x.name==='saber-pagos-produccion');
const lab=all.filter(x=>x.name==='saber-pagos-pruebas');
assert.equal(live.length,1,'LIVE_R2_D1_PROD_NO_UNICA');
assert.equal(lab.length,1,'LIVE_R2_D1_LAB_NO_UNICA');
const id=live[0].uuid;
assert.match(id||'',/^[a-f0-9-]{36}$/i,'LIVE_R2_DB_ID_INVALIDO');
assert.notEqual(id,lab[0].uuid,'LIVE_R2_NO_LAB');
assert.notEqual(id,'60124ac5-1941-44ba-96e5-ea3165b65ec9','LIVE_R2_LAB_CONOCIDA');
const query=async sql=>rows(await api('/'+id+'/query',{
 method:'POST',body:JSON.stringify({sql})
}));
const present=new Set((await query("SELECT name FROM sqlite_master WHERE type='table'"))
 .map(x=>x.name));
for(const name of ['orders','order_items','payment_reviews',
 'central_r2_universal_order_links','central_r2_universal_files',
 'central_pricing_admin_head'])
 assert.ok(present.has(name),'LIVE_R2_CORE_FALTANTE_'+name);
const orders=await query('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(orders[0]?.n),0,'LIVE_R2_ORDEN_EXISTENTE_NO_MIGRAR');
const source=await readFile(new URL('./d1-produccion-r2-capacidad-v1.sql',import.meta.url),'utf8');
const cleaned=source.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
const statements=cleaned.split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(statements.length,2,'LIVE_R2_DDL_CANTIDAD');
const names=['central_r2_large_reservations','central_r2_large_pending'];
for(let i=0;i<statements.length;i++){
 assert.ok(statements[i].startsWith('CREATE TABLE IF NOT EXISTS '+names[i]+' ('),
  'LIVE_R2_DDL_TABLA_INCORRECTA');
 assert.doesNotMatch(statements[i],/^\s*(?:DROP|ALTER|DELETE|UPDATE|INSERT|REPLACE|ATTACH|TRIGGER)\b/im);
 assert.ok(statements[i].length<3000);
 if(present.has(names[i])){
  const count=await query('SELECT COUNT(*) AS n FROM '+names[i]);
  assert.equal(Number(count[0]?.n),0,'LIVE_R2_TABLA_NO_VACIA_'+names[i]);
 }
}
for(const statement of statements)await query(statement);
for(const name of names){
 const count=await query('SELECT COUNT(*) AS n FROM '+name);
 assert.equal(Number(count[0]?.n),0,'LIVE_R2_TABLA_CON_DATOS_'+name);
}
const finalOrders=await query('SELECT COUNT(*) AS n FROM orders');
assert.equal(Number(finalOrders[0]?.n),0,'LIVE_R2_ORDEN_CAMBIO');
console.log('LIVE_R2_QUOTA_PENDING_D1_SCHEMA_OK_ZERO_DATA');
console.log('LIVE_R2_NO_UPLOAD_NO_PAYMENT_NO_DEPLOY_NO_SANDBOX');
