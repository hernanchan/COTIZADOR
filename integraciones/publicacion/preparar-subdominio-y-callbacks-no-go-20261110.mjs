/** Add production buyer hostname and MP callback URLs only while every gate is NO_GO.
 * No payments, no Pages/main change, no production order, no storage writes.
 */
import assert from 'node:assert/strict';
import {resolveAny} from 'node:dns/promises';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
const editor=process.env.SABER_CF_EDITOR_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/i);assert.ok(token?.length>15);
const credentials=[token,editor].filter(x=>typeof x==='string'&&x.length>15);
const root='https://api.cloudflare.com/client/v4';
const acct=root+'/accounts/'+account;
async function cf(url,{method='GET',body,raw=false}={}){
 let last='NO_HTTP',reason='';
 for(let i=0;i<credentials.length;i++){
  const h={Authorization:'Bearer '+credentials[i]};
  if(body&&!raw)h['Content-Type']='application/json';
  const res=await fetch(url,{method,headers:h,...(body?{body:raw?body:JSON.stringify(body)}:{}),
   signal:AbortSignal.timeout(45000)});
  const v=await res.json().catch(()=>null);
  if(res.ok&&v?.success===true)return v.result;
  last='HTTP_'+res.status;reason=(v?.errors||[]).map(x=>x.code).join(',');
  // Check the other credential only if this one lacks permission; avoid
  // retrying mutations on ambiguous 5xx errors.
  if(![401,403].includes(res.status))break;
 }
 console.log('CF_SETUP_UNAUTHORIZED_'+last+'_ERROR_CODES_'+reason);
 throw Error('CF_SETUP_NOT_APPROVED_'+last);
}
async function bindings(name){return await cf(acct+'/workers/scripts/'+name+'/settings')}
function gate(w,name,value='NO_GO'){return w?.bindings?.some(b=>b.name===name&&b.type==='plain_text'&&b.text===value)}
const central='saber-pagos-produccion',docs='saber-documentos-produccion',edge='saber-webhook-produccion';
const [c,d,e,zoneList,domainList]=await Promise.all([
 bindings(central),bindings(docs),bindings(edge),
 cf(root+'/zones?name=libreriasaber.com.ar'),cf(acct+'/workers/domains')
]);
assert.ok(gate(c,'MP_LIVE_GATE')&&gate(c,'SABER_ENTORNO','preparacion'));
assert.ok(gate(d,'DOCS_MP_LIVE_GATE')&&gate(d,'SABER_ENTORNO','preparacion'));
assert.ok(gate(e,'WEBHOOK_EDGE_GATE')&&gate(e,'SABER_ENTORNO','preparacion'));
assert.ok(d.bindings.some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&x.service===central));
const zone=zoneList.filter(z=>z.name==='libreriasaber.com.ar'&&z.status==='active');
assert.equal(zone.length,1,'ZONE_NOT_UNIQUE_OR_NOT_ACTIVE');
const priceBinding=c.bindings.find(x=>x.name==='DB'&&x.type==='d1');
assert.ok(priceBinding,'CENTRAL_D1_MISSING');
const buyerHost='pedidos.libreriasaber.com.ar',payHost='pagos.libreriasaber.com.ar';
const payDomain=domainList.filter(x=>x.hostname===payHost);
assert.equal(payDomain.length,1,'LIVE_WEBHOOK_DOMAIN_NOT_READY');
assert.equal(payDomain[0].service,edge,'LIVE_WEBHOOK_WRONG_SERVICE');
const buyer=domainList.filter(x=>x.hostname===buyerHost);
assert.ok(buyer.length<=1,'BUYER_HOST_MULTIPLE');
if(buyer.length)assert.ok(buyer[0].service===docs&&buyer[0].enabled===true,'BUYER_DOMAIN_FOREIGN');
if(!buyer.length){
 // Los tokens no tienen DNS Read (403). Verificar resolución pública y
 // dejar que Workers Custom Domains rechace un conflicto DNS existente.
 let records=[];
 try{records=await resolveAny(buyerHost)}
 catch(e){if(!['ENOTFOUND','ENODATA'].includes(e?.code))throw e;}
 assert.equal(records.length,0,'PUBLIC_DNS_BUYER_ALREADY_EXISTS_SKIP_CHANGE');
 console.log('PROD_BUYER_NO_PUBLIC_DNS_RESOLUTION_WORKER_API_CONFLICT_SAFE');
 const data={hostname:buyerHost,service:docs,enabled:true,previews_enabled:false,
  zone_id:zone[0].id,zone_name:'libreriasaber.com.ar'};
 const result=await cf(acct+'/workers/domains',{method:'PUT',body:data});
 assert.equal(result.hostname,buyerHost);
 assert.equal(result.service,docs);
 console.log('PROD_BUYER_DOMAIN_ATTACHED_GATE_NO_GO');
}else console.log('PROD_BUYER_DOMAIN_ALREADY_CORRECT');
const afterDomain=await cf(acct+'/workers/domains');
assert.equal(afterDomain.filter(x=>x.hostname===buyerHost&&x.service===docs&&x.enabled===true).length,1);
console.log('PROD_BUYER_DOMAIN_BOUND_TO_PROTECTED_DOCUMENTS_WORKER');
const variables={
 MP_LIVE_WEBHOOK_URL:'https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live',
 MP_LIVE_RETURN_URL:'https://pedidos.libreriasaber.com.ar/pedido/estado',
 CENTRAL_LIVE_POSTPAY_GATE:'NO_GO',
};
const liveC=await bindings(central);
assert.ok(gate(liveC,'MP_LIVE_GATE')&&gate(liveC,'SABER_ENTORNO','preparacion'));
for(const [name,value] of Object.entries(variables)){
 const current=liveC.bindings.filter(x=>x.name===name);
 assert.ok(current.length<=1,'DUPLICATE_CONFIG_'+name);
 if(current.length)assert.equal(current[0].text,value,'CONFIG_CONFLICT_'+name);
}
const newVars=Object.entries(variables).filter(([name])=>!liveC.bindings.some(x=>x.name===name));
if(newVars.length){
 const payload={bindings:[
  ...liveC.bindings.map(x=>({name:x.name,type:'inherit'})),
  ...newVars.map(([name,value])=>({name,type:'plain_text',text:value}))
 ]};
 const form=new FormData();
 form.append('settings',new Blob([JSON.stringify(payload)],{type:'application/json'}),'settings.json');
 await cf(acct+'/workers/scripts/'+central+'/settings',{method:'PATCH',body:form,raw:true});
 console.log('PROD_CENTRAL_MP_CALLBACKS_STAGED_NO_GO_COUNT='+newVars.length);
}
const final=await bindings(central);
for(const [name,value] of Object.entries(variables))assert.ok(gate(final,name,value),'CONFIG_NOT_PRESERVED_'+name);
assert.ok(gate(final,'MP_LIVE_GATE')&&gate(final,'SABER_ENTORNO','preparacion'));
for(const name of liveC.bindings.map(x=>x.name))assert.ok(final.bindings.some(x=>x.name===name),'LOST_BINDING_'+name);
const newDocs=await bindings(docs);
assert.ok(gate(newDocs,'DOCS_MP_LIVE_GATE')&&gate(newDocs,'SABER_ENTORNO','preparacion'));
console.log('PROD_CENTRAL_LIVE_CALLBACK_URLS_CONFIGURED_AND_VERIFIED');
console.log('PROD_DOCUMENTS_GATE_NO_GO_CENTRAL_NO_GO_WEBHOOK_GATE_NO_GO');
console.log('NO_MAIN_NO_PAGES_NO_PAYMENTS_NO_R2_TUS_UPLOAD_NO_D1_WRITES');
