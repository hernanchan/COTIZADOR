/** Validación de despliegues reales únicamente GET. */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)throw Error('Credenciales no disponibles.');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
const checks=[
 {name:'saber-pagos-pruebas',id:'e98a1920-7ef3-4c7e-b980-67800145d466',required:['DB','CENTRAL_BRIDGE_KEY','CENTRAL_BRIDGE_ENABLED'],d1:true},
 {name:'saber-documentos-pruebas',id:'787457b6-7439-4d22-859b-2af85e37b417',required:['SABER_CENTRAL','CENTRAL_BRIDGE_KEY','DOCS_SCRIPT_URL','DOCS_RELAY_KEY'],d1:false}
];
async function get(url){
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Cloudflare HTTP '+r.status);
 const j=await r.json();if(j?.success!==true||!j.result)throw Error('Cloudflare no confirmó metadatos.');
 return j.result;
}
for(const c of checks){
 const deployments=await get(base+c.name+'/deployments');
 const list=Array.isArray(deployments)?deployments:deployments.deployments;
 if(!Array.isArray(list)||!list.length)throw Error(c.name+': despliegues no disponibles.');
 const active=list[0].versions||[];
 if(active.length!==1||active[0].version_id!==c.id||active[0].percentage!==100)throw Error(c.name+': versión activa no coincide.');
 const settings=await get(base+c.name+'/settings');
 const b=settings.bindings;
 if(!Array.isArray(b))throw Error(c.name+': bindings inaccesibles.');
 for(const key of c.required)if(!b.some(x=>x.name===key))throw Error(c.name+': falta '+key);
 if(c.d1&&!b.some(x=>x.name==='DB'&&x.type==='d1'))throw Error('Central: D1 no presente.');
 if(!c.d1&&!b.some(x=>x.name==='SABER_CENTRAL'&&x.type==='service'&&x.service==='saber-pagos-pruebas'))throw Error('Documentos: Service Binding incorrecto.');
 console.log(c.name+': ACTIVE_100='+c.id.slice(0,8)+'; bindings esenciales confirmados.');
}
const r=await fetch('https://saber-pagos-pruebas.libreriasaber.workers.dev/health',{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
const j=await r.json().catch(()=>null);
if(r.status!==200||j?.ok!==true||j?.environment!=='test'||j?.paymentsEnabled!==false)throw Error('Central /health no confirmó entorno de pruebas y pagos desactivados.');
console.log('CENTRAL_HEALTH_OK: entorno de prueba, paymentsEnabled=false.');
console.log('BOTH_WORKERS_PROMOTED_OK; solo GET; sin escrituras en D1 ni activación de cobros.');
