/**
 * Preflight de corte público: solo GET/SELECT, ninguna orden o cobro.
 * Verifica dos Workers producción y 3 compuertas R2 comercial.
 */
import assert from 'node:assert/strict';
const root='https://api.cloudflare.com/client/v4/accounts/'+process.env.CF_ACCOUNT;
assert.match(process.env.CF_ACCOUNT||'',/^[0-9a-f]{32}$/i);
assert.ok(process.env.CF_DEPLOY?.length>20);
const GO='GO_COMERCIAL_CONFIRMADO';
async function cf(path,token=process.env.CF_DEPLOY,opts={}){
 const res=await fetch(root+path,{
  ...opts,headers:{Authorization:'Bearer '+token,...(opts.headers||{})},
  signal:AbortSignal.timeout(25000)});
 const data=await res.json().catch(()=>null);
 assert.ok(res.ok&&data?.success===true,
  'CLOUDFLARE_READ_FAILED_'+res.status+'_'+path.split('/').at(-1));
 return data.result;
}
const [payments,docs]=await Promise.all(['saber-pagos-produccion','saber-documentos-produccion']
 .map(x=>cf('/workers/scripts/'+x+'/settings')));
const find=(x,k)=>x.bindings.find(y=>y.name===k);
function gate(x,k,val=GO){
 assert.equal(find(x,k)?.text,val,
  'PRODUCTION_GATE_CLOSED_'+k);
}
for(const s of [payments,docs]){
 gate(s,'SABER_ENTORNO','produccion');
 gate(s,'CENTRAL_DB_ENV','produccion');
}
for(const k of ['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED','CENTRAL_LIVE_ORDER_GATE',
 'CENTRAL_LIVE_PRICING_GATE','CENTRAL_LIVE_POSTPAY_GATE',
 'CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
 'CENTRAL_LIVE_R2_STAGING_GATE','CENTRAL_LIVE_R2_INSPECTION_GATE'])gate(payments,k);
for(const k of ['DOCS_LIVE_UI_GATE','DOCS_MP_LIVE_GATE','DOCS_LIVE_RECEPCION_GATE',
 'DOCS_LIVE_SESSION_GATE','DOCS_LIVE_ORDER_GATE','DOCS_LIVE_PRICING_GATE',
 'DOCS_LIVE_R2_GATE','DOCS_LIVE_R2_STAGING_GATE','DOCS_LIVE_R2_UPLOAD_GATE',
 'DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE'])gate(docs,k);
assert.equal(find(docs,'SABER_R2_GRANDES_LIVE')?.type,'r2_bucket');
assert.equal(find(docs,'SABER_R2_GRANDES_LIVE')?.bucket_name,
 'saber-documentos-produccion-privado');
assert.equal(find(docs,'SABER_CENTRAL')?.type,'service');
assert.equal(find(docs,'SABER_CENTRAL')?.service,'saber-pagos-produccion');
assert.equal(find(payments,'CENTRAL_BRIDGE_KEY')?.type,'secret_text');
assert.equal(find(payments,'MP_LIVE_ACCESS_TOKEN')?.type,'secret_text');
assert.equal(find(docs,'DOCS_LIVE_SESSION_KEY')?.type,'secret_text');
const official=await fetch('https://pedidos.libreriasaber.com.ar/cotizar',
 {redirect:'manual',signal:AbortSignal.timeout(15000)});
assert.equal(official.status,200,'BUYER_LIVE_ROUTE_UNAVAILABLE');
const response=await official.text();
assert.match(response,/Librer[ií]a Saber/i);
const quote=await fetch('https://pedidos.libreriasaber.com.ar/cotizar/archivos',
 {redirect:'manual',signal:AbortSignal.timeout(15000)});
// El iframe comprador exige cookie Turnstile. Sin ella debe rechazar.
assert.equal(quote.status,503,'ANONYMOUS_PRIVATE_BUYER_IFRAME_MUST_FAIL_CLOSED');
const qbody=await quote.text();
assert.match(qbody,/LIVE_COTIZADOR_CERRADO/);
const board=await fetch('https://pedidos.libreriasaber.com.ar/personal/api/live-r2-inspection-original',
 {redirect:'manual',signal:AbortSignal.timeout(15000)});
assert.equal(board.status,401,'STAFF_R2_MUST_REJECT_ANONYMOUS');
console.log('SABER_PUBLIC_RELEASE_BACKEND_R2_40_TO_200_MIB_READY');
console.log('SABER_PUBLIC_RELEASE_MP_REAL_CREDENTIAL_PRESENT_NO_PAYMENT_CREATED');
console.log('SABER_PUBLIC_RELEASE_STAFF_AUTH_401_CONFIRMED');
console.log('SABER_PUBLIC_RELEASE_PRIVATE_STORAGE_CONFIRMADO');
console.log('SABER_PUBLIC_RELEASE_NO_ORDER_NO_PAYMENT_NO_DATABASE_WRITE');
