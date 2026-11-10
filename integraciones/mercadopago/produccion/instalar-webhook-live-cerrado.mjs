/**
 * Instala SOLO la clave secreta de webhook Mercado Pago LIVE en la Central.
 * No modifica la aplicación de Mercado Pago, DNS, rutas, DB, checkout o gates.
 * El titular entrega el secreto vía GitHub Environment (nunca en Git/chat).
 */
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_DEPLOY_TOKEN;
const secret=process.env.SABER_MP_LIVE_WEBHOOK_SECRET;
const origin=account&&'https://api.cloudflare.com/client/v4/accounts/'+account;
const central=origin+'/workers/scripts/saber-pagos-produccion';
const gateway=origin+'/workers/scripts/saber-webhook-produccion';
const fail=reason=>{throw Error(reason)};
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)
 fail('CF_ACCOUNT_OR_TOKEN_MISSING');
if(typeof secret!=='string'||secret.length<32||secret.length>512||
 secret.trim()!==secret||/[\r\n]/.test(secret)||secret.startsWith('APP_USR-')||
 secret.startsWith('TEST-'))
 fail('WEBHOOK_LIVE_SECRET_INVALID_OR_NOT_PROVIDED');
async function cf(url,init={}){
 const result=await fetch(url,{
  ...init,signal:AbortSignal.timeout(25000),
  headers:{Authorization:'Bearer '+token,...init.headers}
 });
 const doc=await result.json().catch(()=>null);
 if(!result.ok||doc?.success!==true)fail('CLOUDFLARE_HTTP_'+result.status);
 return doc.result;
}
const [before,edge,subdomain,edgeSubdomain,domains]=await Promise.all([
 cf(central+'/settings'),cf(gateway+'/settings'),
 cf(central+'/subdomain'),cf(gateway+'/subdomain'),
 cf(origin+'/workers/domains')
]);
const bindings=before?.bindings,edgeBindings=edge?.bindings;
if(!Array.isArray(bindings)||!Array.isArray(edgeBindings))fail('WORKERS_MISSING');
const has=(array,name,type,content)=>array.some(x=>x.name===name&&x.type===type&&
 (content===undefined||x.text===content));
if(!has(bindings,'MP_LIVE_GATE','plain_text','NO_GO')||
 !has(bindings,'SABER_ENTORNO','plain_text','preparacion')||
 !has(bindings,'CENTRAL_DB_ENV','plain_text','produccion')||
 !has(bindings,'CENTRAL_BRIDGE_KEY','secret_text')||
 !has(bindings,'MP_LIVE_ACCESS_TOKEN','secret_text')||
 !has(bindings,'MP_LIVE_SELLER_ID','secret_text')||
 !has(bindings,'DB','d1'))
 fail('CENTRAL_NOT_READY_OR_NOT_CLOSED');
if(has(bindings,'MP_LIVE_WEBHOOK_SECRET','secret_text')||
 bindings.some(x=>x.name==='MP_LIVE_WEBHOOK_SECRET'))
 fail('WEBHOOK_SECRET_ALREADY_EXISTS_DO_NOT_OVERWRITE');
if(!has(edgeBindings,'WEBHOOK_EDGE_GATE','plain_text','NO_GO')||
 !has(edgeBindings,'SABER_ENTORNO','plain_text','preparacion')||
 !edgeBindings.some(x=>x.name==='SABER_CENTRAL_LIVE'&&x.type==='service'&&
 x.service==='saber-pagos-produccion')||
 edgeBindings.some(x=>['d1','r2_bucket','secret_text'].includes(x.type)))
 fail('WEBHOOK_GATEWAY_NOT_CLOSED');
if(subdomain?.enabled!==false||subdomain?.previews_enabled!==false||
 edgeSubdomain?.enabled!==false||edgeSubdomain?.previews_enabled!==false)
 fail('WORKERS_SUBDOMAIN_NOT_DISABLED');
if(!Array.isArray(domains)||domains.filter(x=>x.hostname==='pagos.libreriasaber.com.ar'&&
 x.service==='saber-webhook-produccion'&&x.enabled===true).length!==1)
 fail('WEBHOOK_LIVE_DOMAIN_NOT_EXPECTED');
console.log('WEBHOOK_LIVE_PREFLIGHT_CENTRAL_ISOLATED_AND_GATEWAY_NO_GO');
await cf(central+'/secrets',{method:'PUT',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({name:'MP_LIVE_WEBHOOK_SECRET',type:'secret_text',text:secret})
});
const after=await cf(central+'/settings');
if(!has(after?.bindings||[],'MP_LIVE_WEBHOOK_SECRET','secret_text')||
 !has(after?.bindings||[],'MP_LIVE_GATE','plain_text','NO_GO')||
 !has(after?.bindings||[],'SABER_ENTORNO','plain_text','preparacion')||
 !has(after?.bindings||[],'MP_LIVE_ACCESS_TOKEN','secret_text')||
 !has(after?.bindings||[],'MP_LIVE_SELLER_ID','secret_text')||
 !has(after?.bindings||[],'CENTRAL_BRIDGE_KEY','secret_text'))
 fail('WEBHOOK_LIVE_INSTALL_POSTCHECK_FAILED_REVIEW_REQUIRED');
const edgeAfter=await cf(gateway+'/settings');
if(!has(edgeAfter?.bindings||[],'WEBHOOK_EDGE_GATE','plain_text','NO_GO')||
 !has(edgeAfter?.bindings||[],'SABER_ENTORNO','plain_text','preparacion'))
 fail('WEBHOOK_LIVE_EDGE_POSTCHECK_FAILED_REVIEW_REQUIRED');
console.log('WEBHOOK_LIVE_SECRET_INSTALLED_CENTRAL_ONLY');
console.log('WEBHOOK_LIVE_MP_GATE_NO_GO_PUBLIC_GATE_NO_GO');
console.log('WEBHOOK_LIVE_NO_PAYMENT_CREATED_NO_TEST_ORDERS_NO_PUBLIC_STORE_CHANGE');
