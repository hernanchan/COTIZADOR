/** Diagnóstico de publicación — solo GET de Cloudflare y SELECT de D1.
 * No realiza pagos, crea pedidos, modifica agendas ni mueve la compuerta pública.
 * El informe público no contiene pedidos, importes, claves ni identificadores de clientes.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const WEB='https://libreriasaber.com.ar';
const BUYER='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const checks={};
const evidence={};
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_DEPLOY_TOKEN;
const d1Token=process.env.SABER_CF_D1_WRITE_TOKEN;

async function check(name,fn){
 try{await fn();checks[name]='OK';}
 catch(e){checks[name]='FALLO: '+String(e?.code||e?.message||'SIN_DETALLE').slice(0,90).replace(/[^\w .:_-]/g,'_');}
}
async function fetchSafe(url,options={}){
 return fetch(url,{redirect:'manual',...options,signal:AbortSignal.timeout(20000)});
}
async function cloudflare(path,key=token,options={}){
 const r=await fetchSafe('https://api.cloudflare.com/client/v4/accounts/'+account+path,{
  ...options,headers:{Authorization:'Bearer '+key,...options.headers}});
 const data=await r.json().catch(()=>null);
 assert.ok(r.ok&&data?.success===true,'CF_API_'+r.status);
 return data.result;
}
const binding=(s,k)=>(s.bindings||[]).find(x=>x.name===k);
const gates=(settings,names)=>names.every(n=>binding(settings,n)?.text===GO);

await check('web_publica_y_bloqueo_comercial',async()=>{
 const p=await fetchSafe(WEB+'/portal-comercial.json');
 assert.equal(p.status,200,'PORTAL_CONFIG');
 const j=await p.json();
 assert.deepEqual(j,{schema:'saber-portal-comercial-v1',enabled:false,release:'NO_GO',buyerUrl:null},'GATE_PUBLICO_INESPERADO');
 const home=await fetchSafe(WEB);
 assert.equal(home.status,200,'HOME_OFF');
 const html=await home.text();
 assert.match(html,/Librería Saber/);
 const cot=await fetchSafe(WEB+'/cotizar.html');
 assert.ok([200,301,302,307,308].includes(cot.status),'COTIZADOR_WEB_OFF');
});

await check('central_personal_privada',async()=>{
 for(const p of ['/personal/central','/personal/api/live-calendar','/personal/api/live-forecast','/personal/api/live-board']){
  const r=await fetchSafe(BUYER+p);
  assert.equal(r.status,401,'STAFF_NOT_PRIVATE_'+p);
  assert.match(r.headers.get('www-authenticate')||'',/basic/i,'STAFF_AUTH_HEADER_'+p);
 }
});

await check('comprador_y_recepcion_protegida',async()=>{
 const page=await fetchSafe(BUYER+'/cotizar');
 assert.equal(page.status,200,'BUYER_OFF');
 assert.match(await page.text(),/Librería Saber|saberIngresoLive|seccion-archivos/);
 const iframe=await fetchSafe(BUYER+'/cotizar/archivos');
 assert.equal(iframe.status,503,'QUOTE_PRIVATE_EXPECTED_503');
});

await check('cloudflare_compuertas_MP_y_R2',async()=>{
 assert.match(account||'',/^[a-f0-9]{32}$/i,'CF_ACCOUNT_MISSING');
 assert.ok(token&&token.length>20,'CF_TOKEN_MISSING');
 const [mp,docs]=await Promise.all([
  cloudflare('/workers/scripts/saber-pagos-produccion/settings'),
  cloudflare('/workers/scripts/saber-documentos-produccion/settings')
 ]);
 for(const s of [mp,docs]){
  assert.equal(binding(s,'SABER_ENTORNO')?.text,'produccion','WORKER_ENV');
  assert.equal(binding(s,'CENTRAL_DB_ENV')?.text,'produccion','WORKER_D1');
 }
 assert.ok(gates(mp,['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED',
  'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_PRICING_GATE','CENTRAL_LIVE_POSTPAY_GATE',
  'CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE',
  'CENTRAL_LIVE_R2_INSPECTION_GATE','CENTRAL_LIVE_TUS_GATE',
  'CENTRAL_LIVE_TRANSFER_GATE','CENTRAL_LIVE_TRANSFER_APPROVAL_GATE']),'MP_GATES');
 assert.ok(gates(docs,['DOCS_LIVE_UI_GATE','DOCS_MP_LIVE_GATE','DOCS_LIVE_RECEPCION_GATE',
  'DOCS_LIVE_SESSION_GATE','DOCS_LIVE_ORDER_GATE','DOCS_LIVE_PRICING_GATE',
  'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_STAGING_GATE','DOCS_LIVE_R2_UPLOAD_GATE',
  'DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE','DOCS_LIVE_TUS_GATE',
  'DOCS_LIVE_TRANSFER_GATE']),'DOCS_GATES');
 assert.equal(binding(mp,'MP_LIVE_ACCESS_TOKEN')?.type,'secret_text','MP_TOKEN');
 assert.equal(binding(docs,'SABER_R2_GRANDES_LIVE')?.type,'r2_bucket','R2_BUCKET');
 assert.equal(binding(docs,'SABER_R2_GRANDES_LIVE')?.bucket_name,'saber-documentos-produccion-privado','R2_TARGET');
 assert.equal(binding(docs,'SABER_CENTRAL')?.service,'saber-pagos-produccion','CENTRAL_SERVICE');
 evidence.compueras_live='habilitadas_en_ambos_workers';
});

await check('d1_consistencia_pagos_y_archivos',async()=>{
 assert.match(account||'',/^[a-f0-9]{32}$/i,'CF_ACCOUNT_MISSING');
 assert.ok(d1Token&&d1Token.length>20,'D1_TOKEN_MISSING');
 const dbs=await cloudflare('/d1/database',d1Token);
 const db=dbs.find(x=>x.name==='saber-pagos-produccion');
 assert.ok(db?.uuid,'D1_NOT_FOUND');
 const sql=[
  'SELECT',
  "(SELECT COUNT(*) FROM orders o WHERE o.status='paid' AND o.paid_at IS NOT NULL AND EXISTS",
  "(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified')) AS pagados_verificados,",
  "(SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.transport='r2' AND f.received=1) AS r2_recibidos,",
  "(SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.transport='tus' AND f.received=1) AS tus_recibidos"
 ].join(' ');
 const res=await cloudflare('/d1/database/'+db.uuid+'/query',d1Token,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql})});
 assert.ok(res.length===1&&res[0].success===true,'D1_QUERY_FAILED');
 const row=res[0].results?.[0]||{};
 for(const k of ['pagados_verificados','r2_recibidos','tus_recibidos'])
  assert.ok(Number.isSafeInteger(row[k])&&row[k]>=0,'D1_AGG_INVALID');
 evidence.existen_pagos_verificados=row.pagados_verificados>0;
 evidence.existen_archivos_r2_recibidos=row.r2_recibidos>0;
 evidence.existen_archivos_tus_recibidos=row.tus_recibidos>0;
});
const allOK=Object.values(checks).every(x=>x==='OK');
const result={
 esquema:'saber-preflight-sin-ordenes-v1',
 fecha:new Date().toISOString(),
 rama:'integracion/tus-pedido-privado-20261101',
 sitio_publico:'NO_GO_conservado',
 verificaciones:checks,
 evidencia_anonima:evidence,
 infraestructura_apta_para_evaluar_apertura:allOK,
 pedido_real_integral_cobro_recepcion_central:'NO_CERTIFICADO_POR_ESTE_DIAGNOSTICO',
 acciones:'SOLO_LECTURA;NINGUN_PEDIDO;NINGUN_COBRO;NINGUNA_PUBLICACION'
};
await mkdir('docs',{recursive:true});
await writeFile('docs/DIAGNOSTICO-PREPUBLICACION-LIVE-ULTIMO.json',JSON.stringify(result,null,2)+'\n');
console.log('SABER_PREFLIGHT_READ_ONLY='+JSON.stringify({allOK,checks,evidence}));
if(!allOK)process.exitCode=1;
