/** Auditoría posterior a la promoción manual: solo GET metadata, jamás modifica Worker. */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales privadas de auditoría no disponibles.');
const docs='saber-documentos-pruebas',central='saber-pagos-pruebas';
const expected='787457b6-7439-4d22-859b-2af85e37b417';
const previous='6afab339';
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function get(name,resource){
 const res=await fetch(root+name+resource,{method:'GET',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error(name+': lectura '+resource+' HTTP '+res.status);
 const data=await res.json();
 if(data?.success!==true||!data.result)throw Error(name+': metadatos '+resource+' no confirmados');
 return data.result;
}
const result=await get(docs,'/deployments');
const deployments=Array.isArray(result)?result:result.deployments;
if(!Array.isArray(deployments)||!deployments.length)throw Error('No se encontró el despliegue documental.');
const current=deployments[0];
const target=current.versions?.find(v=>v.version_id===expected&&v.percentage===100);
if(!target)throw Error('La versión documental 787457b6 NO está activa al 100%; sin cambios.');
const settings=await get(docs,'/settings');
if(!Array.isArray(settings.bindings))throw Error('No se pudieron consultar bindings documentales.');
const b=settings.bindings;
for(const key of ['CENTRAL_BRIDGE_KEY','SABER_CENTRAL','DOCS_RELAY_KEY',
 'DOCS_SCRIPT_URL','DOCS_ALLOWED_ORIGIN','DOCS_TURNSTILE_SECRET','DOCS_TURNSTILE_SITE_KEY']){
 if(!b.some(x=>x.name===key))throw Error('Falta vinculacion documental '+key);
}
if(!b.some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&x.service===central))
 throw Error('SABER_CENTRAL no apunta a Worker de pruebas previsto.');
console.log('DOCUMENTOS_ACTIVO_100: '+expected.slice(0,8)+', previo '+previous+'; 7 bindings críticos presentes.');
const currentCentral=await get(central,'/deployments');
const centralList=Array.isArray(currentCentral)?currentCentral:currentCentral.deployments;
if(!Array.isArray(centralList)||!centralList[0]?.versions?.length)
 throw Error('No se puede auditar la versión activa de Central.');
console.log('CENTRAL_AUDITADA: '+centralList[0].versions.map(v=>String(v.version_id).slice(0,8)).join(',')+
 '; sin despliegue ni cambios D1.');
console.log('POST_PROMOTION_AUDIT_OK: lectura de metadatos, ningún pago o web pública modificados.');
