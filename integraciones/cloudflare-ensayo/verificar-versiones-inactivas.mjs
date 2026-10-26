/** Verifica versiones HMAC cargadas (sin modificar despliegues). */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales ausentes.');
const versions=[
 ['saber-pagos-pruebas','e98a1920-7ef3-4c7e-b980-67800145d466',['CENTRAL_BRIDGE_KEY','DB','CENTRAL_BRIDGE_ENABLED']],
 ['saber-documentos-pruebas','787457b6-7439-4d22-859b-2af85e37b417',['CENTRAL_BRIDGE_KEY','SABER_CENTRAL','DOCS_RELAY_KEY']]
];
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function safeGet(url){
 const res=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('GET fallido HTTP '+res.status);
 const data=await res.json();
 if(data?.success!==true||!data.result)throw Error('Respuesta no confirmada.');
 return data.result;
}
for(const [name,id,required] of versions){
 const base=root+name;
 const version=await safeGet(base+'/versions/'+id);
 const bindings=version.resources?.bindings||version.bindings;
 if(!Array.isArray(bindings))throw Error(name+': no se puede certificar bindings heredados.');
 for(const b of required)if(!bindings.some(x=>x.name===b))
  throw Error(name+': versión nueva sin '+b);
 const deployment=await safeGet(base+'/deployments');
 const list=Array.isArray(deployment)?deployment:deployment.deployments;
 if(!Array.isArray(list)||list.length===0)throw Error(name+': despliegue actual indeterminado.');
 const current=list[0];
 const refs=JSON.stringify(current).match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)||[];
 if(refs.includes(id))throw Error(name+': la versión nueva aparece en el despliegue más reciente; verificar manualmente.');
 console.log(name+': versión accesible con '+bindings.length+
  ' bindings; versión HMAC nueva NO presente en deployment más reciente.');
}
console.log('STAGED_VERSIONS_VERIFIED_NOT_DEPLOYED');
