/** Monitor LIVE sólo GET y SELECT: sin pedidos, pagos, subidas ni datos personales. */
import assert from 'node:assert/strict';
const web='https://libreriasaber.com.ar',buyer='https://pedidos.libreriasaber.com.ar';
const account=process.env.CF_ACCOUNT,token=process.env.CF_DEPLOY,dbToken=process.env.CF_DB;
assert.match(account||'',/^[0-9a-f]{32}$/i);
assert.ok(token?.length>20&&dbToken?.length>20);
const GO='GO_COMERCIAL_CONFIRMADO';
async function get(url){
 return fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},
  signal:AbortSignal.timeout(15000)});
}
async function publicHtml(path){
 const url=web+path;
 const res=await fetch(url,{redirect:'follow',headers:{'Cache-Control':'no-cache'},
  signal:AbortSignal.timeout(15000)});
 assert.equal(new URL(res.url).origin,web,'UNEXPECTED_PUBLIC_HTML_REDIRECT');
 return res;
}
async function cf(path,secret=token,options={}){
 const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{
  ...options,headers:{Authorization:'Bearer '+secret,...options.headers},
  signal:AbortSignal.timeout(25000)});
 const v=await res.json().catch(()=>null);
 assert.ok(res.ok&&v?.success===true,'CF_READ_'+res.status+'_'+path.split('/').at(-1));
 return v.result;
}
const home=await get(web+'/?monitor='+Date.now());
assert.equal(home.status,200,'WEB_HOME');
assert.match(await home.text(),/Librería Saber/);
for(const path of ['/ofertas.html','/cotizar.html']){
 const r=await publicHtml(path);assert.equal(r.status,200,'PUBLIC_PAGE_'+path);
 const html=await r.text();
 assert.match(html,/Librería Saber/);
 if(path==='/cotizar.html')assert.match(html,/portal-comercial\.json/);
}
const portal=await get(web+'/portal-comercial.json');
assert.equal(portal.status,200);
assert.deepEqual(await portal.json(),{
 schema:'saber-portal-comercial-v1',enabled:true,release:GO,
 buyerUrl:buyer+'/cotizar'
});
const photosRes=await get(web+'/fotos-productos.json');
assert.equal(photosRes.status,200);
const photos=await photosRes.json();
assert.equal(photos.schema,'saber-fotos-productos-local-v1');
const assets=Object.values(photos.images);
assert.ok(assets.length>=3);
for(const asset of assets){
 assert.match(asset,/^assets\/productos\/[a-f0-9]{16}\.(jpg|png|webp)$/);
 const img=await get(web+'/'+asset);
 assert.equal(img.status,200,'PRODUCT_PHOTO_'+asset);
 assert.match(img.headers.get('content-type')||'',/^image\//);
 await img.body?.cancel();
}
console.log('SABER_MONITOR_WEB_HOME_PORTAL_AND_PHOTOS_OK_'+assets.length);
for(const path of ['/cotizar','/pedido/continuar','/pedido/estado']){
 const res=await get(buyer+path);
 assert.equal(res.status,200,'BUYER_PAGE_'+path);
 const html=await res.text();
 assert.match(html,/Librería Saber|Retomá tu pedido|Pedido/i);
 if(path==='/cotizar')assert.match(html,/saberIngresoLive|seccion-archivos/);
 if(path==='/pedido/continuar')assert.match(html,/saberRenovarPedido|Continuar|Retomar/);
}
const staff=await get(buyer+'/personal/api/live-r2-inspection-original');
assert.equal(staff.status,401,'STAFF_UNAUTHENTICATED_ACCESS');
const iframe=await get(buyer+'/cotizar/archivos');
assert.equal(iframe.status,503,'UNAUTHENTICATED_QUOTE_IFRAME');
console.log('SABER_MONITOR_BUYER_RECOVERY_TRACKING_STAFF_PROTECTED');
const [mp,docs]=await Promise.all([
 cf('/workers/scripts/saber-pagos-produccion/settings'),
 cf('/workers/scripts/saber-documentos-produccion/settings')
]);
const b=(o,n)=>o.bindings.find(x=>x.name===n);
const requireGate=(o,n,value=GO)=>
 assert.equal(b(o,n)?.text,value,'GATE_NOT_ENABLED_'+n);
for(const o of [mp,docs]){
 requireGate(o,'SABER_ENTORNO','produccion');
 requireGate(o,'CENTRAL_DB_ENV','produccion');
}
for(const name of ['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED',
 'CENTRAL_LIVE_ORDER_GATE','CENTRAL_LIVE_PRICING_GATE',
 'CENTRAL_LIVE_POSTPAY_GATE','CENTRAL_LIVE_R2_GATE',
 'CENTRAL_LIVE_R2_QUOTA_GATE','CENTRAL_LIVE_R2_STAGING_GATE',
 'CENTRAL_LIVE_R2_INSPECTION_GATE'])requireGate(mp,name);
for(const name of ['DOCS_LIVE_UI_GATE','DOCS_MP_LIVE_GATE',
 'DOCS_LIVE_RECEPCION_GATE','DOCS_LIVE_SESSION_GATE',
 'DOCS_LIVE_ORDER_GATE','DOCS_LIVE_PRICING_GATE',
 'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_STAGING_GATE',
 'DOCS_LIVE_R2_UPLOAD_GATE','DOCS_LIVE_STAFF_GATE',
 'DOCS_LIVE_PACKAGE_GATE'])requireGate(docs,name);
assert.equal(b(docs,'SABER_R2_GRANDES_LIVE')?.type,'r2_bucket');
assert.equal(b(docs,'SABER_R2_GRANDES_LIVE')?.bucket_name,
 'saber-documentos-produccion-privado');
assert.equal(b(docs,'SABER_CENTRAL')?.type,'service');
assert.equal(b(docs,'SABER_CENTRAL')?.service,'saber-pagos-produccion');
assert.equal(b(mp,'MP_LIVE_ACCESS_TOKEN')?.type,'secret_text');
console.log('SABER_MONITOR_MP_R2_40_TO_200_MIB_GATES_OK');
const dbs=await cf('/d1/database',dbToken);
const db=dbs.find(x=>x.name==='saber-pagos-produccion');
assert.ok(db?.uuid);
const sql=[
 'SELECT COUNT(DISTINCT o.id) AS pedidos_24h,',
 "COALESCE(SUM(CASE WHEN f.transport='r2' THEN 1 ELSE 0 END),0) AS pdfs_r2,",
 "COALESCE(SUM(CASE WHEN f.transport='tus' THEN 1 ELSE 0 END),0) AS pdfs_tus,",
 'COALESCE(SUM(CASE WHEN o.payment_id IS NOT NULL AND',
 "f.received=0 AND o.created_at < datetime('now','-2 hours')",
 'THEN 1 ELSE 0 END),0) AS pdfs_pagados_pendientes_2h',
 'FROM orders o',
 'LEFT JOIN central_r2_universal_order_links l ON l.commercial_order_id=o.id',
 'LEFT JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id',
 "WHERE o.created_at>=datetime('now','-24 hours')"
].join(' ');
const qs=await cf('/d1/database/'+db.uuid+'/query',dbToken,{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({sql})
});
assert.equal(qs.length,1);assert.equal(qs[0].success,true);
const summary=qs[0].results?.[0]||{};
for(const key of ['pedidos_24h','pdfs_r2','pdfs_tus','pdfs_pagados_pendientes_2h'])
 assert.ok(Number.isSafeInteger(summary[key])&&summary[key]>=0,'D1_AGG_'+key);
console.log('SABER_MONITOR_D1_ANON_SUMMARY='+JSON.stringify(summary));
if(summary.pdfs_pagados_pendientes_2h>0)
 console.log('SABER_MONITOR_ALERTA_PAGOS_CONFIRMADOS_CON_PDF_PENDIENTES');
console.log('SABER_MONITOR_OK_NO_COBROS_NO_ORDENES_NO_SUBIDAS_NO_PII');
