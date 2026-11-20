/**
 * Private PC V4 updater for Libreria Saber.
 * Replaces ONLY pre-existing PC_CSS and PC_JS string constants in the currently
 * deployed isolated trial Worker. Does not upload application source to GitHub.
 * Cloudflare credentials exist ONLY in GitHub Actions secrets.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const worker='saber-ampliaciones-ensayo-20261120';
const account=process.env.SABER_CF_ACCOUNT_ID;
const token=process.env.SABER_CF_DEPLOY_TOKEN;
if(!account || !token) throw Error('CREDENTIALS_MISSING: entorno de Cloudflare no disponible');
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/'+worker;
const headers={Authorization:'Bearer '+token};
const allowed = new Set(['ENSAYO_PASSWORD','SABER_ENTORNO','ENSAYO_VERSION','DOCS_ALLOWED_ORIGIN']);
const js=fs.readFileSync('integraciones/interfaz-pc/interfaz-pc.js','utf8');
const css=fs.readFileSync('integraciones/interfaz-pc/interfaz-pc.css','utf8');
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
function safeUrl(p){return root+p}
async function json(p,init={}){
 const r=await fetch(safeUrl(p),{...init,headers:{...headers,...(init.headers||{})}});
 let v;try{v=await r.json()}catch{throw Error('Cloudflare no devolvio JSON: '+p+' '+r.status)}
 if(!r.ok || v.success!==true)throw Error('Cloudflare '+p+' HTTP '+r.status+' '+JSON.stringify((v.errors||[]).map(x=>x.code)).slice(0,150));
 return v.result;
}
const settings=await json('/settings');
assert(Array.isArray(settings.bindings),'No se pueden inspeccionar bindings');
const bindMap=new Map(settings.bindings.map(x=>[x.name,x.type]));
for(const [name,type] of bindMap) assert(allowed.has(name)&&['secret_text','plain_text'].includes(type),'Binding inesperado '+name+': '+type);
for(const name of allowed) assert(bindMap.has(name),'Binding de aislamiento ausente: '+name);
const deployBefore=await json('/deployments');
const current=deployBefore.deployments?.[0]?.versions;
assert(Array.isArray(current)&&current.length===1&&Number(current[0].percentage)===100,'Despliegue actual no es una version unica al 100%');
const rollback=current[0].version_id;
assert(/^[0-9a-f-]{36}$/i.test(rollback),'No se pudo identificar version anterior de rollback');

async function getParts(){
 const response=await fetch(root,{headers});
 assert(response.ok,'No se pudo leer el codigo del Worker de ensayo (HTTP '+response.status+')');
 const ct=response.headers.get('content-type')||'';
 const files=[];
 if(ct.includes('multipart/form-data')){
  const form=await response.formData();
  for(const [name,obj] of form.entries()){
   if(typeof obj==='string'||name==='metadata')continue;
   const filename=obj.name||name;
   const data=await obj.text();
   files.push({name,filename,type:obj.type||'application/javascript+module',data});
  }
 }else if(/javascript|text\/plain/.test(ct)){
  files.push({name:'index.mjs',filename:'index.mjs',type:'application/javascript+module',data:await response.text()});
 }else throw Error('Formato de codigo Worker no reconocido; no desplegar: '+ct.slice(0,90));
 assert(files.length>0&&files.length<=25,'Cantidad inesperada de modulos');
 return files;
}
const parts=await getParts();
const sourceMaps=parts.map(p=>{try{return {part:p,map:JSON.parse(p.data)}}catch{return null}}).filter(x=>x?.map?.version===3&&Array.isArray(x.map.sources)&&Array.isArray(x.map.sourcesContent));
assert(sourceMaps.length===1,'Se esperaba un solo mapa de fuentes Cloudflare; no publicar');
const map=sourceMaps[0].map;
const contents=new Map();
for(let i=0;i<map.sources.length;i++){
 const key=String(map.sources[i]).replaceAll('\\','/').split('/').pop();
 if(['ensayo-safe.mjs','index.mjs','consulta-seguimiento-cliente.mjs'].includes(key)){
  assert(!contents.has(key)&&typeof map.sourcesContent[i]==='string','Fuente ausente o duplicada: '+key);
  contents.set(key,map.sourcesContent[i]);
 }
}
for(const key of ['ensayo-safe.mjs','index.mjs','consulta-seguimiento-cliente.mjs'])assert(contents.has(key),'Fuente original no encontrada: '+key);
let wrapper=contents.get('ensayo-safe.mjs');
assert(wrapper.includes('ENSAYO_PASSWORD')&&wrapper.includes('const safeEnv = Object.freeze(')&&wrapper.includes('/interfaz-pc'),'Aislador del ensayo no verificado');
function replaceSourceConstant(source,variable,value){
 const prefix='const '+variable+' = ';
 const start=source.indexOf(prefix);
 assert(start>=0&&source.indexOf(prefix,start+prefix.length)<0,'Constante fuente no unica '+variable);
 let i=start+prefix.length;
 assert(source[i]==='"','Se esperaba constante serializada con comillas dobles: '+variable);
 let j=i+1;
 for(;j<source.length;j++){if(source[j]==='\\'){j++;continue}if(source[j]==='"')break}
 assert(j<source.length,'Fin de constante no localizado '+variable);
 let k=j+1;
 while(/\s/.test(source[k]||''))k++;
 assert(source[k]===';','Fin de sentencia no reconocido '+variable);
 return source.slice(0,start)+prefix+JSON.stringify(value)+';'+source.slice(k+1);
}
wrapper=replaceSourceConstant(wrapper,'PC_CSS',css);
wrapper=replaceSourceConstant(wrapper,'PC_JS',js);
assert(wrapper.includes(JSON.stringify(js))&&wrapper.includes(JSON.stringify(css)),'Interfaz V4 no integrada en fuente');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'saber-pc-v4-'));
const srcDir=path.join(directory,'src');fs.mkdirSync(srcDir);
for(const [key,value] of contents)fs.writeFileSync(path.join(srcDir,key),key==='ensayo-safe.mjs'?wrapper:value,'utf8');
const output=path.join(directory,'ensayo-safe.mjs');
const build=spawnSync('npx',['--yes','esbuild@0.25.12',path.join(srcDir,'ensayo-safe.mjs'),'--bundle','--platform=browser','--format=esm','--target=es2022','--outfile='+output,'--log-level=warning'],{encoding:'utf8',maxBuffer:2*1024*1024});
assert(build.status===0,'Compilacion segura fallida: '+(build.stderr||'').slice(0,220));
const bundled=fs.readFileSync(output,'utf8');
assert(bundled.length>100000&&bundled.includes('pc-batch-apply')&&bundled.includes('ENSAYO_PASSWORD'),'Build incompleto');
const check=spawnSync(process.execPath,['--check',output],{encoding:'utf8',maxBuffer:1024*1024});
assert(check.status===0,'Worker compilado invalido: '+(check.stderr||'').slice(0,220));
const metadata={main_module:'ensayo-safe.mjs',bindings:[...bindMap].map(([name])=>({name,type:'inherit'})),annotations:{'workers/message':'Libreria Saber PC V4 - solo ensayo aislado'}};
if(typeof settings.compatibility_date==='string')metadata.compatibility_date=settings.compatibility_date;
if(Array.isArray(settings.compatibility_flags))metadata.compatibility_flags=settings.compatibility_flags;
const form=new FormData();
form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}),'metadata.json');
form.append('ensayo-safe.mjs',new Blob([bundled],{type:'application/javascript+module'}),'ensayo-safe.mjs');
const version=await json('/versions?bindings_inherit=strict',{method:'POST',body:form});
assert(/^[0-9a-f-]{36}$/i.test(version.id||''),'Version nueva no confirmada');
console.log('VERSION_PRIVADA_PREPARADA: '+version.id);
let deployed=false;
try{
 await json('/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:version.id,percentage:100}],annotations:{'workers/message':'PC V4 - ensayo aislado; rollback guardado'}})});
 deployed=true;
 const confirmation=await getParts();
 assert(confirmation.some(p=>p.data.includes('pc-batch-apply')&&p.data.includes('ENSAYO_PASSWORD')),'El Worker activo no contiene la interfaz V4');
 const response=await fetch('https://'+worker+'.libreriasaber.workers.dev/interfaz-pc',{redirect:'manual'});
 assert(response.status===401,'Se esperaba acceso privado HTTP 401, resultado '+response.status);
 console.log('ENSAYO_V4_DESPLEGADO_COMPROBADO: '+version.id);
 console.log('WEB_COMERCIAL_INTACTA: si');
}catch(err){
 console.error('VERIFICACION_FALLIDA: '+err.message);
 if(deployed){
  try{
   await json('/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:rollback,percentage:100}],annotations:{'workers/message':'Rollback automatico a version anterior del ensayo'}})});
   console.log('ROLLBACK_ENSAYO_OK: '+rollback);
  }catch(e){console.error('ROLLBACK_REQUIERE_REVISION: '+e.message)}
 }
 throw err;
}
