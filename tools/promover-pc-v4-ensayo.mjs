/**
 * Promocion estricta del build V4 YA PREPARADO en Cloudflare.
 * No compila ni cambia bindings ni publica ningun otro Worker.
 */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_DEPLOY_TOKEN;
if(!account||!token)throw Error('CREDENTIALS_MISSING');
const name='saber-ampliaciones-ensayo-20261120';
const candidate='904e185d-73af-4480-837e-0c2474819504';
const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/'+name;
const headers={Authorization:'Bearer '+token};
const assert=(v,m)=>{if(!v)throw Error(m)};
async function api(p,opt={}){
 const res=await fetch(url+p,{...opt,headers:{...headers,...(opt.headers||{})}});
 let data;try{data=await res.json()}catch{throw Error('API_INVALID_JSON '+p+' '+res.status)}
 assert(res.ok&&data.success===true,'API_ERROR '+p+' '+res.status+' '+JSON.stringify((data.errors||[]).map(x=>x.code)));
 return data.result;
}
const settings=await api('/settings');
const allowed=new Set(['ENSAYO_PASSWORD','SABER_ENTORNO','ENSAYO_VERSION','DOCS_ALLOWED_ORIGIN']);
const bindings=settings.bindings||[];
assert(bindings.length===4,'Se esperaban cuatro bindings en el ensayo');
for(const binding of bindings)assert(allowed.has(binding.name)&&['plain_text','secret_text'].includes(binding.type),'Binding desconocido: '+binding.name);
for(const expected of allowed)assert(bindings.some(b=>b.name===expected),'Binding obligatorio ausente '+expected);
const previous=await api('/deployments');
const vs=previous.deployments?.[0]?.versions;
assert(Array.isArray(vs)&&vs.length===1&&Number(vs[0].percentage)===100,'Deployment previo ambiguo');
const old=vs[0].version_id;
assert(/^[0-9a-f-]{36}$/i.test(old),'Rollback version invalida');
const ver=await api('/versions/'+candidate);
assert(ver.id===candidate,'No se encontro la version V4 preparada');
if(old===candidate){console.log('ENSAYO_V4_YA_ACTIVO');process.exit(0)}
console.log('ENSAYO_V4_STAGED_VERIFICADO');
let deployed=false;
try{
 await api('/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:candidate,percentage:100}],annotations:{'workers/message':'Saber V4 PC - solo entorno de ensayo privado'}})});
 deployed=true;
 const active=await api('/deployments');
 assert(active.deployments?.[0]?.versions?.length===1&&active.deployments[0].versions[0].version_id===candidate&&Number(active.deployments[0].versions[0].percentage)===100,'Version activa no coincide');
 const base='https://'+name+'.libreriasaber.workers.dev';
 for(const p of ['/interfaz-pc','/interfaz-pc.js','/interfaz-pc.css','/prueba-carga-unica']){
  const response=await fetch(base+p,{redirect:'manual'});
  assert(response.status===401,'Acceso privado no esperado '+p+' HTTP '+response.status);
 }
 console.log('ENSAYO_V4_ACTIVO_VERIFICADO '+candidate);
 console.log('PRODUCCION_NO_TOCADA');
}catch(e){
 console.error('ENSAYO_NO_VERIFICADO '+e.message);
 if(deployed){
  try{
   await api('/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:old,percentage:100}],annotations:{'workers/message':'Retroceso automatico ensayo PC V4'}})});
   console.log('ENSAYO_ROLLBACK_OK '+old);
  }catch(err){console.error('ROLLBACK_MANUAL_REQUERIDO '+err.message)}
 }
 throw e;
}
