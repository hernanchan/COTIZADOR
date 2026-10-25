/** Barrera automática previa a publicar: solo GET, sin secretos ni despliegue. */
import {readFile} from 'node:fs/promises';
const ID='saber-cloudflare-predeployment-v1';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('No se pudo autenticar el control privado (sin cambios).');
const specs=[
 {name:'saber-pagos-pruebas',source:'integraciones/mercadopago/pruebas/worker.js',
  preserved:['/health','/internal/central/stage','/admin/api/orders','/checkout/'],
  newRoutes:['/internal/central/bridge-probe'],
  bindings:['CENTRAL_BRIDGE_KEY','DB','CENTRAL_BRIDGE_ENABLED']},
 {name:'saber-documentos-pruebas',source:'integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',
  preserved:['/prueba-google','/api/ensayo-carga-unica'],
  newRoutes:['/api/ensayo-probar-puente-central','/api/ensayo-preparar-documentos-v2','/prueba-v2/'],
  bindings:['SABER_CENTRAL','CENTRAL_BRIDGE_KEY','DOCS_SCRIPT_URL','DOCS_RELAY_KEY','DOCS_ALLOWED_ORIGIN','DOCS_TURNSTILE_SITE_KEY','DOCS_TURNSTILE_SECRET']}
];
async function get(url,accept){
 const response=await fetch(url,{method:'GET',
  headers:{Authorization:'Bearer '+token,Accept:accept},
  redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Consulta remota rechazada: HTTP '+response.status);
 return response;
}
for(const spec of specs){
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+spec.name;
 const response=await get(url,'application/javascript');
 const remote=await response.text();
 if(remote.length<100||remote.length>10_000_000)
  throw Error(spec.name+': código desplegado no validable.');
 const local=await readFile(spec.source,'utf8');
 const settings=await (await get(url+'/settings','application/json')).json();
 if(settings?.success!==true||!Array.isArray(settings?.result?.bindings))
  throw Error(spec.name+': vinculaciones no disponibles.');
 const bindings=settings.result.bindings;
 const names=new Set(bindings.map(x=>x.name));
 const missing=spec.bindings.filter(name=>!names.has(name));
 const lost=spec.preserved.filter(path=>remote.includes(path)&&!local.includes(path));
 const missingNew=spec.newRoutes.filter(path=>!local.includes(path));
 const service=spec.name==='saber-documentos-pruebas'?
  bindings.find(x=>x.name==='SABER_CENTRAL'&&x.type==='service'):null;
 const d1=spec.name==='saber-pagos-pruebas'?
  bindings.find(x=>x.name==='DB'&&x.type==='d1'):null;
 // No comparar configuración con la del repositorio como si guardase secretos.
 // Este control SOLO constata nombres, tipos y rutas, no igualdad de valores.
 if(missing.length||lost.length||missingNew.length||
   (spec.name==='saber-documentos-pruebas'&&!service)||
   (spec.name==='saber-pagos-pruebas'&&!d1))
  throw Error(spec.name+': bloqueo preventivo; faltan '+missing.length+
   ' bindings, '+lost.length+' rutas antiguas, '+missingNew.length+
   ' rutas nuevas o una vinculación de servicio/D1.');
 console.log(ID+': '+spec.name+
  ' rutas antiguas preservadas='+spec.preserved.length+
  '; rutas nuevas presentes='+spec.newRoutes.length+
  '; bindings esenciales presentes='+spec.bindings.length+
  '; remoto y local comparados SIN despliegue.');
}
console.log('PREDEPLOY_STRUCTURE_OK: es un control de estructura, NO autoriza despliegue ni certifica rollback de secretos.');
