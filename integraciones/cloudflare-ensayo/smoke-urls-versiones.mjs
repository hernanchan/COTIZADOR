/** Diagnóstico por URL de versión inactiva: solo GET, no D1 ni cobros.
 * Endpoint /health de la Central y ruta inexistente de Documentos.
 * El esquema Workers Versions mantiene intacto el despliegue en servicio.
 */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales privadas no configuradas.');
const versions=[
 {name:'saber-pagos-pruebas',id:'e98a1920-7ef3-4c7e-b980-67800145d466',path:'/health'},
 {name:'saber-documentos-pruebas',id:'787457b6-7439-4d22-859b-2af85e37b417',path:'/api/ensayo-probar-puente-central'}
];
for(const item of versions){
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/workers/'+item.name+'/versions/'+item.id;
 const res=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error'});
 if(!res.ok){console.log(item.name+': URL de versión no disponible en API (HTTP '+res.status+'); sin invocar versión.');continue;}
 const data=await res.json();
 if(data?.success!==true||!data.result){console.log(item.name+': API no confirmó versión.');continue;}
 const urls=Array.isArray(data.result.urls)?data.result.urls:[];
 const valid=urls.filter(u=>{try{const v=new URL(u);return v.protocol==='https:'&&v.hostname.endsWith('.workers.dev')&&
  v.username===''&&v.password===''&&v.port===''&&v.pathname==='/'&&v.search===''&&v.hash==='';}catch{return false;}});
 if(valid.length!==1){console.log(item.name+': URL no utilizable; entradas API='+urls.length+', HTTPS workers.dev seguros='+valid.length+'; comprobación pospuesta.');continue;}
 const target=new URL(valid[0]);target.pathname=item.path;
 // GET sólo: nunca puede invocar endpoints de escritura que requieren POST.
 const reply=await fetch(target,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const body=(await reply.text()).slice(0,2000);
 if(item.name==='saber-pagos-pruebas'){
  let obj;try{obj=JSON.parse(body)}catch{throw Error('Central: respuesta Health no JSON.');}
  if(reply.status!==200||obj.ok!==true||obj.environment!=='test'||obj.paymentsEnabled!==false)
   throw Error('Central: salud de versión no confirmó entorno seguro.');
  console.log('Central HMAC inactiva: /health 200, environment=test, paymentsEnabled=false.');
 }else{
  // Ruta de diagnóstico GET debe fallar cerrada. No se envía autorización ni datos.
  if(reply.status>=200&&reply.status<300)throw Error('Documentos: el diagnóstico respondió a GET sin autenticar.');
  console.log('Documentos HMAC inactiva: acceso GET sin autorización denegado (HTTP '+reply.status+').');
 }
}
console.log('INSPECCION_URL_VERSIONES_COMPLETADA; no se activaron versiones ni pagos.');
