/**
 * Cloudflare test-only preflight. Two GET metadata requests; ZERO writes.
 * Accepts an account-owned token with Individual Workers Metadata Read-Only
 * scoped to EXACTLY the two test Workers. Never output token, binding values,
 * HTTP bodies, environment secrets or Worker script source.
 *
 * Run in GitHub Actions protected Environment saber-cloudflare-pruebas.
 */
const EXPECTED_WORKERS=Object.freeze([
 'saber-pagos-pruebas',
 'saber-documentos-pruebas'
]);
const HEX32=/^[a-f0-9]{32}$/i;
const VALID_TOKEN=/^[A-Za-z0-9_\-]{20,300}$/;
const DOCUMENTS_BINDINGS=Object.freeze(['SABER_CENTRAL','DOCS_SCRIPT_URL','DOCS_RELAY_KEY',
 'DOCS_ALLOWED_ORIGIN','DOCS_TURNSTILE_SITE_KEY','DOCS_TURNSTILE_SECRET',
 'DOCS_EXTENDED_RECEIVER_ENABLED','DOCS_V2_RECEIPT_LINK_ENABLED',
 'DOCS_V2_PRIVATE_UI_ENABLED','DOCS_V2_PRIVATE_UI_SECRET',
 'DOCS_CENTRAL_PROBE_ENABLED','DOCS_CENTRAL_ADMIN_KEY','CENTRAL_TEST_URL',
 'DOCS_CENTRAL_SYNC_ENABLED','DOCS_ORDER_PREPARE_ENABLED',
 'DOCS_PRINT_DRAFT_ENABLED','DOCS_PRINT_DRAFT_CENTRAL_ENABLED']);
const CENTRAL_BINDINGS=Object.freeze(['CENTRAL_BRIDGE_ENABLED','CENTRAL_BRIDGE_PROBE_ENABLED']);
export async function verificarWorkersEnsayoSoloLectura({
 accountId,token,fetcher=fetch
}){
 if(!HEX32.test(accountId||'')||!VALID_TOKEN.test(token||''))
  throw Error('Faltan las credenciales del entorno privado de pruebas.');
 if(typeof fetcher!=='function')
  throw Error('No hay cliente de lectura disponible.');
 const findings=[];
 for(const name of EXPECTED_WORKERS){
  const url='https://api.cloudflare.com/client/v4/accounts/'+accountId+
   '/workers/scripts/'+name+'/settings';
  let reply;
  try{
   reply=await fetcher(url,{
    method:'GET',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    redirect:'error',
    signal:AbortSignal.timeout(12000)
   });
  }catch(_){
   throw Error('No se pudo consultar la configuración de '+name+
    '. No se ejecutó ningún cambio.');
  }
  if(!reply||!reply.ok)
   throw Error('Cloudflare no autorizó consultar '+name+
    ' (HTTP '+(Number(reply?.status)||'sin respuesta')+'). No se ejecutó ningún cambio.');
  let data;
  try{data=await reply.json()}catch(_){
   throw Error('Cloudflare no devolvió metadatos legibles para '+name);
  }
  if(!data||data.success!==true||!data.result||typeof data.result!=='object')
   throw Error('Cloudflare no confirmó los metadatos de '+name);
  const bindings=Array.isArray(data.result.bindings)?data.result.bindings:null;
  const names=bindings?.map(x=>x?.name).filter(x=>typeof x==='string')||[];
  findings.push(Object.freeze({
   worker:name,
   metadataAccessible:true,
   centralBridgeKeyConfigured:bindings===null?null:names.includes('CENTRAL_BRIDGE_KEY'),
   d1BindingConfigured:bindings===null?null:bindings.some(x=>x?.type==='d1'),
   serviceBindingConfigured:bindings===null?null:bindings.some(x=>x?.type==='service'),
   centralBindingsPresent:name==='saber-pagos-pruebas'?Object.freeze(
    Object.fromEntries(CENTRAL_BINDINGS.map(binding=>[
     binding,bindings===null?null:names.includes(binding)
    ]))):null,
   documentsBindingsPresent:name==='saber-documentos-pruebas'?Object.freeze(
    Object.fromEntries(DOCUMENTS_BINDINGS.map(binding=>[
     binding,bindings===null?null:bindings.some(x=>x?.name===binding&&(
      binding==='SABER_CENTRAL'?x?.type==='service':true))
    ]))):null
  }));
 }
 return Object.freeze({
  schema:'saber-cloudflare-lectura-ensayo-v1',
  scope:'METADATA_ONLY',
  methodsUsed:['GET','GET'],
  productionTouched:false,
  deploymentPerformed:false,
  paymentEnabled:false,
  d1Queried:false,
  workers:findings
 });
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  const r=await verificarWorkersEnsayoSoloLectura({
   accountId:process.env.SABER_CF_ACCOUNT_ID,
   token:process.env.SABER_CF_READONLY_TOKEN
  });
  for(const w of r.workers){
   const value=x=>x===null?'desconocido':x?'sí':'no';
   console.log(w.worker+': lectura de metadatos OK; '+
    'CENTRAL_BRIDGE_KEY='+value(w.centralBridgeKeyConfigured)+
    '; D1='+value(w.d1BindingConfigured)+
    '; Service Binding='+value(w.serviceBindingConfigured));
   if(w.centralBindingsPresent)for(const name of CENTRAL_BINDINGS){
    console.log('  '+name+': binding presente='+value(w.centralBindingsPresent[name]));
   }
   if(w.documentsBindingsPresent)for(const name of DOCUMENTS_BINDINGS){
    console.log('  '+name+': binding presente='+value(w.documentsBindingsPresent[name]));
   }
  }
  console.log('SIN DESPLIEGUES; SIN CAMBIOS D1; SIN COBROS; SITIO PÚBLICO INTACTO.');
 }catch(e){
  // Deliberately omit HTTP bodies, responses and secret values from Actions logs.
  console.error('Preflight Cloudflare: '+String(e?.message||'error desconocido'));
  process.exitCode=1;
 }
}
