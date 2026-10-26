/** Verifica apagado de diagnósticos en ambos Workers: GET solamente. */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales de auditoría no disponibles.');
const checks=[
 ['saber-pagos-pruebas','CENTRAL_BRIDGE_PROBE_ENABLED'],
 ['saber-documentos-pruebas','DOCS_CENTRAL_PROBE_ENABLED']
];
for(const [name,key] of checks){
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name+'/settings';
 const r=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
 redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(name+': lectura de configuración HTTP '+r.status);
 const json=await r.json();
 if(json?.success!==true||!Array.isArray(json.result?.bindings))throw Error(name+': lectura incompleta.');
 const binding=json.result.bindings.find(b=>b.name===key);
 if(!binding||binding.type!=='plain_text')throw Error(name+': interruptor no auditable como texto.');
 if(binding.text!=='OFF')throw Error(name+': diagnóstico NO confirmado en OFF.');
 console.log(name+': '+key+' = OFF. Diagnóstico cerrado.');
}
console.log('HMAC_DIAGNOSTICS_BOTH_OFF; sin escrituras en Cloudflare, D1 ni pagos.');
