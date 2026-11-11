/** Go-live preflight: no writes, no secret values, no checkout. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID;
const tokens=[process.env.SABER_CF_DEPLOY_TOKEN,process.env.SABER_CF_EDITOR_TOKEN,process.env.SABER_CF_D1_WRITE_TOKEN].filter(Boolean);
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(tokens.length,'CF_TOKEN_MISSING');
const domain='libreriasaber.com.ar';
const endpoint='https://api.cloudflare.com/client/v4';
const origin=endpoint+'/accounts/'+account;
async function api(path){
 let last=null;
 for(const token of tokens){
  try{
   const res=await fetch(endpoint+path,{headers:{Authorization:'Bearer '+token},
    signal:AbortSignal.timeout(22000)});
   const obj=await res.json().catch(()=>null);
   if(res.ok&&obj?.success===true)return obj.result;
   last='HTTP_'+res.status;
  }catch(e){last=String(e?.name||'NETWORK')}
 }
 throw Error('CF_READ_NOT_AUTHORIZED_'+path.split('/').slice(-2).join('_')+'_'+last);
}
async function remote(url){
 try{
  const res=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000)});
  return {status:res.status,url:res.url};
 }catch(e){return {status:0,error:String(e?.name||'NETWORK')}}
}
const issues=[],ok=[];
const checked=(label,pass,detail='')=>{
 const str=label+(detail?' '+detail:'');
 (pass?ok:issues).push(str);
 console.log((pass?'READY ':'BLOCKER ')+str);
};
const results=await Promise.allSettled([
 api('/accounts/'+account+'/workers/domains'),
 api('/accounts/'+account+'/pages/projects/libreriasaber'),
 api('/accounts/'+account+'/d1/database'),
 api('/zones?name='+domain),
 api('/accounts/'+account+'/workers/scripts/saber-pagos-produccion/settings'),
 api('/accounts/'+account+'/workers/scripts/saber-documentos-produccion/settings'),
 api('/accounts/'+account+'/workers/scripts/saber-webhook-produccion/settings')
]);
function value(i,tag){
 const x=results[i];
 if(x.status!=='fulfilled'){
  checked(tag,false,'CLOUDFLARE_UNREADABLE');
  return null;
 }
 return x.value;
}
const domains=value(0,'CLOUDFLARE_DOMAINS');
const pages=value(1,'PAGES_PROJECT');
const databases=value(2,'D1_DATABASES');
const zones=value(3,'ZONE');
const central=value(4,'CENTRAL_LIVE_WORKER');
const documents=value(5,'DOCUMENTS_LIVE_WORKER');
const webhook=value(6,'WEBHOOK_EDGE_WORKER');
const binds=x=>x?.bindings||[];
const has=(obj,name,type=null,expected=null)=>binds(obj).some(v=>
 v.name===name&&(!type||v.type===type)&&(!expected||v.text===expected));
const names=obj=>new Set(binds(obj).map(x=>x.name));
const isclosed=(obj,gate)=>has(obj,gate,'plain_text','NO_GO');
const workers=[['central',central,'MP_LIVE_GATE'],['documents',documents,'DOCS_MP_LIVE_GATE'],
 ['webhook',webhook,'WEBHOOK_EDGE_GATE']];
for(const [key,w,gate] of workers){
 if(!w)continue;
 checked(key.toUpperCase()+'_ISOLATED_WITH_GATE',isclosed(w,gate));
 checked(key.toUpperCase()+'_ENV_PREPARATION',has(w,'SABER_ENTORNO','plain_text','preparacion'));
}
if(central){
 checked('CENTRAL_PRODUCTION_D1_BOUND',has(central,'DB','d1'));
 checked('CENTRAL_HMAC_SECRET',has(central,'CENTRAL_BRIDGE_KEY','secret_text'));
 checked('MP_LIVE_SELLER_TOKEN',has(central,'MP_LIVE_ACCESS_TOKEN','secret_text'));
 checked('MP_LIVE_SELLER_ID',has(central,'MP_LIVE_SELLER_ID','secret_text'));
 checked('MP_LIVE_WEBHOOK_SIGNING_SECRET',has(central,'MP_LIVE_WEBHOOK_SECRET','secret_text'));
 checked('MP_LIVE_WEBHOOK_URL',names(central).has('MP_LIVE_WEBHOOK_URL'));
 checked('MP_LIVE_RETURN_URL',names(central).has('MP_LIVE_RETURN_URL'));
 checked('CENTRAL_POSTPAY_LIVE_CONFIG',has(central,'CENTRAL_LIVE_POSTPAY_GATE'));
}
if(documents){
 const n=names(documents);
 checked('DOCUMENTS_LIVE_CENTRAL_SERVICE',binds(documents).some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&x.service==='saber-pagos-produccion'));
 const needed=['DOCS_LIVE_PRICING_GATE','DOCS_LIVE_TUS_GATE','DOCS_LIVE_R2_GATE',
  'DOCS_LIVE_R2_STAGING_GATE','DOCS_LIVE_STAFF_GATE','DOCS_LIVE_PACKAGE_GATE'];
 for(const k of needed)checked(k,n.has(k));
 checked('DOCS_LIVE_SUPABASE_PROJECT',n.has('DOCS_LIVE_TUS_PROJECT_URL'));
 checked('DOCS_LIVE_SUPABASE_BUCKET',n.has('DOCS_LIVE_TUS_BUCKET'));
 checked('DOCS_LIVE_SUPABASE_SERVICE_KEY',n.has('DOCS_LIVE_TUS_SERVICE_KEY'));
 checked('DOCS_LIVE_R2_BUCKET',binds(documents).some(x=>x.name==='SABER_R2_GRANDES_LIVE'&&x.type==='r2_bucket'));
 checked('DOCS_LIVE_TURNSTILE',n.has('DOCS_LIVE_TURNSTILE_SECRET')||n.has('DOCS_TURNSTILE_SECRET'));
 checked('DOCS_LIVE_BUYER_SESSION',has(documents,'DOCS_LIVE_SESSION_KEY','secret_text'));
 checked('DOCS_LIVE_TURNSTILE_SITE',has(documents,'DOCS_LIVE_TURNSTILE_SITE_KEY','plain_text'));
 checked('DOCS_LIVE_TURNSTILE_SECRET',has(documents,'DOCS_LIVE_TURNSTILE_SECRET','secret_text'));
 checked('DOCS_LIVE_TUS_PUBLISHABLE_KEY',has(documents,'DOCS_LIVE_TUS_PUBLISHABLE_KEY','plain_text'));
 checked('DOCS_LIVE_TUS_RECEIPT_KEY',has(documents,'DOCS_LIVE_TUS_RECEIPT_KEY','secret_text'));
 checked('DOCS_LIVE_R2_RECEIPT_KEY',has(documents,'DOCS_LIVE_R2_RECEIPT_KEY','secret_text'));
}
if(webhook)checked('WEBHOOK_SERVICE_CENTRAL',binds(webhook).some(x=>x.name==='SABER_CENTRAL_LIVE'&&x.type==='service'&&x.service==='saber-pagos-produccion'));
if(domains){
 for(const [host,worker] of [['pagos.'+domain,'saber-webhook-produccion'],['pedidos.'+domain,'saber-documentos-produccion']]){
  const match=domains.filter(x=>x.hostname===host);
  checked('CUSTOM_DOMAIN_'+host,match.length===1&&match[0]?.service===worker&&match[0]?.enabled===true,
   match.length?('BOUND_'+match[0].service):'ABSENT');
 }
}
if(zones){
 checked('ACTIVE_DNS_ZONE',Array.isArray(zones)&&zones.length===1&&zones[0].status==='active');
}
if(pages){
 checked('PAGES_MAIN_DEPLOYMENT_TRACKED',pages?.production_branch==='main'||pages?.build_config?.production_branch==='main');
 checked('PAGES_LINKS_CORRECT_PROJECT',pages.name==='libreriasaber');
}
if(databases){
 const p=databases.filter(x=>x.name==='saber-pagos-produccion');
 checked('D1_PROD_UNIQUE',p.length===1);
 if(p.length===1){
  const id=p[0].uuid;
  try{
   let result=null;
   for(const token of tokens){
    const response=await fetch(origin+'/d1/database/'+id+'/query',{method:'POST',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({sql:'SELECT revision,approved_revision,approved_json FROM central_pricing_admin_head WHERE id=1'}),
     signal:AbortSignal.timeout(25000)});
    const v=await response.json().catch(()=>null);
    if(v?.success&&v.result?.[0]?.success===true){result=v.result[0]?.results?.[0];break}
   }
   const prices=JSON.parse(result?.approved_json||'null');
   checked('D1_PROD_PRICES_APPROVED',result?.revision===2&&result?.approved_revision===2&&
    prices?.prices?.plotter?.supports?.find(x=>x.id==='rec60')?.posterPerMeter===18700);
  }catch{checked('D1_PROD_PRICES_APPROVED',false,'READBACK_NOT_AVAILABLE')}
 }
}
const current=JSON.parse(await readFile('vidriera/portal-comercial.json','utf8'));
checked('PUBLIC_GATE_SAFE_WHILE_UNREADY',current.enabled===false&&current.release==='NO_GO'&&current.buyerUrl===null);
for(const host of ['https://pagos.'+domain,'https://pedidos.'+domain]){
 const r=await remote(host+'/health');
 const key=host.includes('pagos')?'PAYMENT_GATEWAY_TLS':'BUYER_DOMAIN_TLS';
 // 200/401/404/503 all indicate TLS established and response from edge; 0/525/526 fail.
 checked(key,r.status>0&&r.status<500,'HTTP_'+r.status);
}
console.log('SABER_GO_LIVE_READY_COUNT='+ok.length);
console.log('SABER_GO_LIVE_BLOCKER_COUNT='+issues.length);
console.log('SABER_GO_LIVE_SAFE_MODE='+(issues.length?'NO_GO':'INFRA_READY_REQUIRES_PAYMENT_E2E'));
console.log('AUDIT_READ_ONLY_NO_WORKER_WRITE_NO_MP_NO_PAGES_NO_MAIN');
