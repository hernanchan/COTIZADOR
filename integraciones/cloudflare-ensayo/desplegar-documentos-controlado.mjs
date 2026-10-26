/** Activación estrictamente documental de prueba, reversible.
 * Lee despliegue previo y bindings, activa sólo una versión ya preparada.
 * Rollback automático si falla confirmación. No toca Worker central, D1 ni DNS.
 */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
const name='saber-documentos-pruebas';
const candidate='787457b6-7439-4d22-859b-2af85e37b417';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token||token.length<20||
 process.env.GITHUB_REF!=='refs/heads/polaroids/express-pdf-unico-20261023'||
 process.env.SABER_DEPLOY_APPROVED!=='DOCUMENTOS_TEST_ONLY')
 throw Error('Despliegue cerrado: entorno de pruebas o autorización no coinciden.');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name;
async function api(path,method='GET',payload){
 let res;
 try{res=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token,
   Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{})},
   ...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(25000)});}
 catch{throw Error('Fallo de red al consultar Cloudflare ('+method+' '+path+').');}
 if(!res.ok)throw Error('Cloudflare no autorizó '+method+' '+path+' (HTTP '+res.status+').');
 const data=await res.json().catch(()=>null);
 if(data?.success!==true||!data.result)throw Error('Cloudflare no confirmó '+method+' '+path+'.');
 return data.result;
}
function primary(deployment){
 if(!deployment||!Array.isArray(deployment.versions)||deployment.versions.length!==1||
 deployment.versions[0].percentage!==100||!uuid.test(deployment.versions[0].version_id))
  throw Error('Despliegue actual con pesos inesperados: no continuar.');
 return deployment.versions[0].version_id;
}
const state=await api('/deployments');
const deployments=Array.isArray(state)?state:state.deployments;
if(!Array.isArray(deployments)||deployments.length===0)throw Error('No se pudo consultar historial.');
const before=deployments[0],previous=primary(before);
if(previous===candidate){console.log('DOCUMENTOS_TEST_DEPLOY_ALREADY_ACTIVE; sin cambios.');process.exit(0)}
const candidateData=await api('/versions/'+candidate);
const bindings=candidateData.resources?.bindings||candidateData.bindings;
const names=Array.isArray(bindings)?bindings.map(x=>x.name):[];
for(const key of ['SABER_CENTRAL','CENTRAL_BRIDGE_KEY','DOCS_SCRIPT_URL','DOCS_RELAY_KEY','DOCS_ALLOWED_ORIGIN','DOCS_TURNSTILE_SITE_KEY','DOCS_TURNSTILE_SECRET']){
 if(!names.includes(key))throw Error('Falta vinculación esencial en versión inactiva: '+key);
}
const service=bindings.find(b=>b.name==='SABER_CENTRAL');
if(service.type!=='service'||service.service!=='saber-pagos-pruebas')throw Error('Worker central incorrecto.');
// En el entorno de Documentos se mantienen las banderas existentes.
// Sin DOCS_CENTRAL_PROBE_ENABLED ni portal V2 habilitados por este script.
const now=await api('/deployments');
const last=Array.isArray(now)?now:now.deployments;
if(primary(last?.[0])!==previous)throw Error('Cambio concurrente en Worker: no desplegar.');
async function deploy(version,label){
 return api('/deployments','POST',{strategy:'percentage',
  versions:[{version_id:version,percentage:100}],
  annotations:{'workers/message':label}});
}
let attempted=false;
try{
 attempted=true;
 await deploy(candidate,'Saber: despliegue cerrado de Documentos de PRUEBA, sin activar recepción ni cobros');
 const updated=await api('/deployments');
 const list=Array.isArray(updated)?updated:updated.deployments;
 if(primary(list?.[0])!==candidate)throw Error('La versión activada no coincide con la esperada.');
 const settings=await api('/settings');
 const live=settings.bindings;
 if(!Array.isArray(live)||!live.some(b=>b.name==='SABER_CENTRAL'&&b.type==='service'&&b.service==='saber-pagos-pruebas')||
    !live.some(b=>b.name==='CENTRAL_BRIDGE_KEY')||
    !live.some(b=>b.name==='DOCS_SCRIPT_URL')||
    !live.some(b=>b.name==='DOCS_RELAY_KEY'))
  throw Error('Bindings de la versión activa no confirmados.');
 console.log('DOCUMENTOS_TEST_DEPLOY_OK; version='+candidate+'; vínculos conservados.');
 console.log('VERSIÓN_ANTERIOR='+previous+' (para rollback).');
 console.log('Sin modificación de Central, D1, Polaroids, DNS o sitio público. No se activaron cobros.');
}catch(e){
 if(attempted){
  try{
   await deploy(previous,'Rollback automático del Worker DOCUMENTOS pruebas por error de validación');
   const check=await api('/deployments');
   const list=Array.isArray(check)?check:check.deployments;
   if(primary(list?.[0])!==previous)throw Error('Rollback no confirmado.');
   console.log('DOCUMENTOS_TEST_ROLLBACK_OK: versión anterior restablecida.');
  }catch{
   throw Error('ALERTA: despliegue no verificado Y rollback no confirmado: revisar Cloudflare antes de continuar.');
  }
 }
 throw Error('Despliegue documental revertido por seguridad: '+e.message);
}
