/**
 * Private PC V4 updater for Libreria Saber.
 * Replaces ONLY pre-existing PC_CSS and PC_JS string constants in the currently
 * deployed isolated trial Worker. Does not upload application source to GitHub.
 * Cloudflare credentials exist ONLY in GitHub Actions secrets.
 */
import fs from 'node:fs';
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
const files=await getParts();
const candidates=files.filter(p=>p.data.includes('const PC_CSS = ')&&p.data.includes('const PC_JS = '));
assert(candidates.length===1,'No se encontro exactamente una interfaz PC existente; despliegue cancelado');
const target=candidates[0];
assert(target.data.includes('ENSAYO_PASSWORD')&&target.data.includes('const safeEnv = Object.freeze(')&&target.data.includes('/interfaz-pc'),'El aislador privado no coincide');
// Sustituir literales en sintaxis JS sin suponer comillas dobles, simples o template.
function replaceLiteral(source,variable,newValue) {
 const prefix='const '+variable+' = ';
 const start=source.indexOf(prefix);
 assert(start>=0&&source.indexOf(prefix,start+prefix.length)<0,'No se identifico un literal unico '+variable);
 let i=start+prefix.length;
 while(/\\s/.test(source[i]||'')) i++;
 const q=source[i];
 assert(q==='"'||q==="'"||q==='`','Tipo de literal no permitido para '+variable);
 let j=i+1;
 for(;j<source.length;j++){
  if(source[j]==='\\\\'){j++;continue}
  if(source[j]===q)break;
 }
 assert(j<source.length,'Literal sin cierre: '+variable);
 const semi=source.indexOf(';',j+1);
 assert(semi>=0&&/^\\s*$/.test(source.slice(j+1,semi)),'Se esperaba fin de literal simple: '+variable);
 return source.slice(0,start)+prefix+JSON.stringify(newValue)+';'+source.slice(semi+1);
}
target.data=replaceLiteral(target.data,'PC_CSS',css);
target.data=replaceLiteral(target.data,'PC_JS',js);
assert(target.data.includes(JSON.stringify(js))&&target.data.includes(JSON.stringify(css)),'No se pudieron inyectar los activos PC');
const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:target.data,encoding:'utf8',maxBuffer:10*1024*1024});
assert(check.status===0,'Sintaxis invalida en Worker modificado: '+(check.stderr||'').slice(0,200));
const metadata={main_module:target.filename,bindings:[...bindMap].map(([name])=>({name,type:'inherit'})),annotations:{'workers/message':'Libreria Saber PC V4 - solo ensayo aislado'}};
if(typeof settings.compatibility_date==='string') metadata.compatibility_date=settings.compatibility_date;
if(Array.isArray(settings.compatibility_flags)) metadata.compatibility_flags=settings.compatibility_flags;
const form=new FormData();
form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}),'metadata.json');
for(const part of files) form.append(part.name,new Blob([part.data],{type:part.type.includes('javascript')?part.type:'application/javascript+module'}),part.filename);
const version=await json('/versions?bindings_inherit=strict',{method:'POST',body:form});
assert(/^[0-9a-f-]{36}$/i.test(version.id||''),'Version nueva no confirmada');
console.log('VERSION_PRIVADA_PREPARADA: '+version.id);
let deployed=false;
try{
 await json('/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:version.id,percentage:100}],annotations:{'workers/message':'PC V4 - ensayo aislado; rollback guardado'}})});
 deployed=true;
 const confirmation=await getParts();
 assert(confirmation.some(p=>p.data.includes(JSON.stringify(js))&&p.data.includes(JSON.stringify(css))),'El Worker activo no contiene la interfaz V4');
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
