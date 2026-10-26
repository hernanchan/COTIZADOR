/** Auditoría GET de compuertas remotas. NO descargar valores secretos ni cambiar flags. */
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales de lectura no disponibles');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
for(const service of ['saber-pagos-pruebas','saber-documentos-pruebas']){
 const response=await fetch(root+service+'/settings',{
  method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok){console.log('REMOTE_FLAGS_GET',JSON.stringify({service,http:response.status}));continue;}
 const data=await response.json();
 if(data?.success!==true||!Array.isArray(data?.result?.bindings))
  throw Error('Sin bindings verificables para '+service);
 const b=data.result.bindings;
 const presence=name=>b.some(x=>x.name===name);
 const enabled=name=>b.some(x=>x.name===name&&x.type==='plain_text'&&x.text==='PRIVATE_TEST_ONLY');
 const out={service,configured:{},testFlags:{}};
 if(service==='saber-pagos-pruebas'){
  out.configured.DB=presence('DB');
  out.configured.CENTRAL_BRIDGE_KEY=presence('CENTRAL_BRIDGE_KEY');
  out.testFlags.CENTRAL_PREPARE_ENABLED=enabled('CENTRAL_PREPARE_ENABLED');
 }else{
  for(const name of ['SABER_CENTRAL','DOCS_CENTRAL_ADMIN_KEY','DOCS_V2_PRIVATE_UI_SECRET','DOCS_SCRIPT_URL','DOCS_RELAY_KEY','CENTRAL_BRIDGE_KEY'])
   out.configured[name]=presence(name);
  for(const name of ['DOCS_V2_PRIVATE_UI_ENABLED','DOCS_V2_RECEIPT_LINK_ENABLED','DOCS_EXTENDED_RECEIVER_ENABLED','DOCS_CENTRAL_SYNC_ENABLED','DOCS_ORDER_PREPARE_ENABLED'])
   out.testFlags[name]=enabled(name);
 }
 console.log('REMOTE_FLAGS_GET',JSON.stringify(out));
}
console.log('AUDIT_READ_ONLY_NO_PAYMENTS_NO_WRITES');
