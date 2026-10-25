// Auditoría y respaldo privado de 2 Workers: GET únicamente.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const names=['saber-pagos-pruebas','saber-documentos-pruebas'];
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_EDITOR_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||typeof token!=='string'||token.length<20)
 throw Error('Cuenta o token editor no disponibles en el entorno protegido.');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
const out='artifacts/cloudflare-backup-private';
const footprints=[];
await mkdir(out,{recursive:true});
for(const name of names){
 const saved=[];
 for(const [kind,path,accept] of [
  ['script',name,'application/javascript'],
  ['settings',name+'/settings','application/json']
 ]){
  const url=root+path;
  let response;
  try{response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:accept},redirect:'error',signal:AbortSignal.timeout(20000)});}
  catch{throw Error(name+': no fue posible descargar '+kind+' (sin cambios).');}
  if(!response.ok)throw Error(name+': lectura '+kind+' denegada (HTTP '+response.status+'); sin cambios.');
  const buf=new Uint8Array(await response.arrayBuffer());
  if(buf.length<20||buf.length>10_000_000)throw Error(name+': tamaño de '+kind+' inesperado; sin cambios.');
  if(kind==='settings'){
   let data;try{data=JSON.parse(new TextDecoder().decode(buf))}catch{throw Error(name+': ajustes ilegibles.');}
   if(data.success!==true||!Array.isArray(data.result?.bindings))
    throw Error(name+': ajustes incompletos; no se puede certificar respaldo.');
   // Guardar sólo nombres y tipos de bindings, sin valores de variables ni secretos.
   const minimal={worker:name,bindings:data.result.bindings.map(b=>({name:b.name,type:b.type,
    service:b.type==='service'?b.service:undefined,
    environment:b.type==='service'?b.environment:undefined
   }))};
   await writeFile(join(out,name+'.bindings.json'),JSON.stringify(minimal,null,2)+'\n',{mode:0o600});
   saved.push('bindings');
  }else{
   const prefix=new TextDecoder().decode(buf.slice(0,100)).trimStart();
   if(prefix.startsWith('<!DOCTYPE html')||prefix.startsWith('<html')||prefix.startsWith('{'))
    throw Error(name+': Cloudflare no devolvió código del Worker; no se guarda.');
   const ext=(response.headers.get('content-type')||'').includes('multipart/')?'multipart':'js';
   await writeFile(join(out,name+'.'+ext),buf,{mode:0o600});
   saved.push('script');
   const text=new TextDecoder().decode(buf);
   const tests=name==='saber-pagos-pruebas'?
    ['\/health','\/internal\/central\/stage','\/internal\/central\/bridge-probe','\/admin\/api\/orders','\/checkout\/']:
    ['\/prueba-google','\/api\/ensayo-preparar-documentos-v2','\/api\/ensayo-probar-puente-central','\/prueba-v2\/','\/api\/ensayo-carga-unica'];
   footprints.push({worker:name,contentType:response.headers.get('content-type')||'unknown',
    sourceBytes:buf.length,routeHints:Object.fromEntries(tests.map(t=>[t,text.includes(t)]))});
  }
 }
 console.log(name+': respaldo obtenido ('+saved.join(', ')+'). Sin publicación ni cambios.');
}
await writeFile(join(out,'route-inventory.json'),JSON.stringify(footprints,null,2)+'\n',{mode:0o600});
for(const f of footprints)console.log(f.worker+': inventario de rutas generado; '+f.sourceBytes+' bytes respaldados.');
console.log('BACKUP_2_WORKERS_OK. No se consultó D1; sin despliegue; sin cobros.');
