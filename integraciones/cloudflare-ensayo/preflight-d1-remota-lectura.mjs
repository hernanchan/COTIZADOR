/** Inspección exclusivamente GET, sin query SQL, escrituras ni cambios de flags. */
const account=process.env.SABER_CF_ACCOUNT_ID,token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Credenciales de auditoría ausentes');
const h={Authorization:'Bearer '+token,Accept:'application/json'};
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
async function metadata(path){
 const r=await fetch(root+path,{method:'GET',headers:h,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)return {http:r.status,success:false};
 const data=await r.json().catch(()=>null);
 if(data?.success!==true||!data.result)throw Error('No hay metadata confirmada');
 return {success:true,result:data.result};
}
const settings=await metadata('/workers/scripts/saber-pagos-pruebas/settings');
if(!settings.success)throw Error('Sin acceso lectura a bindings de Central HTTP '+settings.http);
const b=settings.result.bindings;
if(!Array.isArray(b))throw Error('Bindings no disponibles');
const db=b.find(x=>x.name==='DB'&&x.type==='d1');
if(!db)throw Error('Central no tiene D1 vinculada');
const other=b.find(x=>x.name==='CENTRAL_PREPARE_ENABLED');
const enabled=other?.type==='plain_text'&&other.text==='PRIVATE_TEST_ONLY';
if(enabled)throw Error('La preparación comercial está habilitada; requiere revisión antes de ensayos remotos.');
const probe=b.find(x=>x.name==='CENTRAL_BRIDGE_PROBE_ENABLED');
if(probe?.type==='plain_text'&&probe.text!=='OFF')throw Error('Diagnóstico HMAC debería estar OFF.');
console.log('CENTRAL_FLAGS_SAFE: preparación comercial no habilitada, diagnóstico OFF.');
const id=db.id||db.database_id;
if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)){
 console.log('D1_REMOTE_METADATA_UNAVAILABLE: Cloudflare no expone ID D1 en bindings GET.');
}else{
 const live=await metadata('/d1/database/'+id);
 if(live.success){
  if(live.result.uuid&&live.result.uuid!==id)throw Error('Cloudflare devolvió otra base D1');
  console.log('D1_REMOTE_METADATA_OK: base de ensayo existe y admite lectura de metadatos, sin SQL.');
 }else{
  console.log('D1_REMOTE_METADATA_RESTRICTED: HTTP '+live.http+'; token sin acceso a metadatos D1.');
 }
}
console.log('REMOTE_PREFLIGHT_READ_ONLY_OK: no se creó pedido, sin modificaciones en Cloudflare.');
