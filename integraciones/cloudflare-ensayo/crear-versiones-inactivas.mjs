/** Etapa nueva versión NO desplegada. Solo 2 scripts previstos; ningún pago.
 * Cloudflare API POST /versions crea versión inactiva. Inherit estricto de
 * TODOS los bindings existentes. Nunca exponer valores al log.
 */
import {readFile} from 'node:fs/promises';
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales del entorno de pruebas ausentes.');
if(process.env.GITHUB_REF!=='refs/heads/polaroids/express-pdf-unico-20261023')
 throw Error('Rama no permitida.');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
const targets=[
 {name:'saber-pagos-pruebas',path:'integraciones/mercadopago/pruebas/worker.js',
  must:['CENTRAL_BRIDGE_KEY','DB','CENTRAL_BRIDGE_ENABLED']},
 {name:'saber-documentos-pruebas',
  path:'integraciones/autocotizador/recepcion/dist/saber-documentos-cotizador-fase4.mjs',
  must:['CENTRAL_BRIDGE_KEY','SABER_CENTRAL','DOCS_SCRIPT_URL','DOCS_RELAY_KEY']}
];
async function apiGet(url){
 const res=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error('No se pudo leer metadatos (HTTP '+res.status+').');
 const o=await res.json();
 if(o?.success!==true||!o.result)throw Error('Metadatos no confirmados.');
 return o.result;
}
// Preflight completo sin escribir ANTES de crear cualquiera de las versiones.
const plan=[];
for(const t of targets){
 const settings=await apiGet(root+t.name+'/settings');
 if(!Array.isArray(settings.bindings)||settings.bindings.length<3)throw Error(t.name+': binding incompleto.');
 const names=settings.bindings.map(b=>b.name);
 if(new Set(names).size!==names.length)throw Error(t.name+': bindings duplicados.');
 for(const k of t.must)if(!names.includes(k))throw Error(t.name+': falta '+k);
 if(settings.bindings.some(b=>b.type==='r2_bucket'))throw Error('R2 no permitido.');
 if(t.name==='saber-pagos-pruebas'&&!settings.bindings.some(b=>b.name==='DB'&&b.type==='d1'))
  throw Error('D1 no coincide.');
 if(t.name==='saber-documentos-pruebas'&&!settings.bindings.some(b=>b.name==='SABER_CENTRAL'&&b.type==='service'&&b.service==='saber-pagos-pruebas'))
  throw Error('La vinculación apunta a otro Worker.');
 const bytes=await readFile(t.path);
 if(bytes.length<500||bytes.length>3_000_000)throw Error(t.name+': compilado fuera de rango.');
 const src=bytes.toString('utf8');
 if(!src.includes('export default'))throw Error(t.name+': módulo inválido.');
 const essential=t.name==='saber-pagos-pruebas'?'/internal/central/bridge-probe':'/api/ensayo-probar-puente-central';
 if(!src.includes(essential))throw Error(t.name+': falta ruta de diagnóstico.');
 plan.push({...t,bytes,bindings:settings.bindings.map(b=>({name:b.name,type:'inherit'}))});
}
console.log('PRECHECK_OK: dos módulos, binding estricto, sin R2, no se despliegan.');
for(const [index,t] of plan.entries()){
 const main='saber-bridge-stage-'+index+'.mjs';
 const metadata={main_module:main,bindings:t.bindings,
  annotations:{'workers/message':'Diagnóstico HMAC de Librería Saber — versión inactiva desde ensayo',
   'workers/commit_sha':process.env.GITHUB_SHA}};
 const form=new FormData();
 form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 form.append(main,new Blob([t.bytes],{type:'application/javascript+module'}),main);
 const u=root+t.name+'/versions?bindings_inherit=strict';
 const res=await fetch(u,{method:'POST',headers:{Authorization:'Bearer '+token},
  body:form,redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!res.ok)throw Error(t.name+': no se pudo preparar la versión (HTTP '+res.status+'). No se desplegó.');
 const o=await res.json();
 if(o?.success!==true||!o.result?.id)throw Error(t.name+': versión no confirmada; NO desplegar.');
 console.log(t.name+': VERSIÓN_INACTIVA_OK; id='+String(o.result.id).replace(/[^a-zA-Z0-9-]/g,'')+
  '; bindings heredados='+t.bindings.length+'; sin despliegue, cobros ni D1.');
}
console.log('DOS_VERSIONES_INACTIVAS_CONFIRMADAS');
