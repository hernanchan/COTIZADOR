/**
 * SABER - control de cambios: comprobación READ-ONLY para GitHub PR.
 * En pull_request_target SE EJECUTA EXCLUSIVAMENTE EL CODIGO DE LA RAMA BASE.
 * Nunca hace checkout ni ejecuta scripts de la rama propuesta.
 * No publica, no modifica secretos, no llama a Cloudflare.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const OWNER='hernanchan';
const REPO='hernanchan/COTIZADOR';
const REF_SHA=/^[0-9a-f]{40}$/i;

export function esArchivoProtegido(file) {
 const p=String(file||'').replaceAll('\\','/');
 if (p==='AGENTS.md'||p==='README.md'||p==='config.json'||
     p==='precios-web.json'||p==='promos.json'||p==='app.js'||
     p==='index.html'||p==='cotizador-web-v2.html'||
     p==='cotizador-v2-ensayo-archivos.mjs') return true;
 const prefixes=[
  '.github/workflows/', '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE', 'docs/GOBERNANZA/',
  'docs/MANUAL_MAESTRO_SABER/',
  'integraciones/', 'functions/', 'vidriera/', 'tests/', 'tools/',
  'prototipos/', 'prueba/', 'pruebas/'
 ];
 return prefixes.some(prefix=>p.startsWith(prefix));
}

export function archivosProtegidos(files) {
 return [...new Set(files.filter(esArchivoProtegido))].sort();
}

export function fraseAprobacion(numero,sha) {
 if(!Number.isInteger(numero)||numero<1||!REF_SHA.test(String(sha)))
  throw Error('IDENTIFICADOR_APROBACION_INVALIDO');
 return 'AUTORIZO CAMBIO SABER PR #' + numero + ' SHA ' + sha.toLowerCase();
}

export function hayAprobacionTitular(comments,numero,sha) {
 const esperada=fraseAprobacion(numero,sha);
 return Array.isArray(comments)&&comments.some(c=>
  c?.user?.login===OWNER && c?.user?.type==='User' &&
  typeof c?.body==='string' && c.body.trim()===esperada);
}

export function descripcionCompleta(body) {
 if(typeof body!=='string')return false;
 const required=['Motivo:', 'Alcance:', 'Pruebas:', 'Retroceso:'];
 return required.every(key=>{
  const start=body.toLowerCase().indexOf(key.toLowerCase());
  if(start<0)return false;
  const after=body.slice(start+key.length).split('\n')[0].trim();
  return after.length>=8 && !/^(pendiente|ninguna|ninguno|n\/a|tbd|sin definir|no aplica)$/i.test(after);
 });
}

async function comentariosPr(repo,numero,token) {
 if(!token)throw Error('GITHUB_TOKEN_AUSENTE');
 const encontrados=[];
 for(let page=1;page<=5;page++){
  const uri='https://api.github.com/repos/'+repo+'/issues/'+numero+
   '/comments?per_page=100&page='+page;
  const response=await fetch(uri,{
   headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'},
   signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error('NO_SE_PUDO_VERIFICAR_APROBACION_HTTP_'+response.status);
  const body=await response.json();
  if(!Array.isArray(body))throw Error('RESPUESTA_GITHUB_INVALIDA');
  encontrados.push(...body);
  if(body.length<100)return encontrados;
 }
 throw Error('DEMASIADOS_COMENTARIOS_PARA_VERIFICACION_SEGURA');
}

export async function comprobarCambioPr({pr,repository,token,files,fetchComments=comentariosPr}) {
 if(repository!==REPO)throw Error('REPOSITORIO_INCORRECTO');
 if(!Number.isSafeInteger(pr?.number)||!REF_SHA.test(pr?.head?.sha||'')||
    !REF_SHA.test(pr?.base?.sha||''))
   throw Error('PR_O_COMMITS_INVALIDOS');
 if(!['integracion/tus-pedido-privado-20261101','main'].includes(pr.base.ref))
   throw Error('RAMA_BASE_NO_ESPERADA');
 const critical=archivosProtegidos(files);
 if(!critical.length)return {ok:true,critical,reason:'SIN_ARCHIVOS_PROTEGIDOS'};
 if(!descripcionCompleta(pr.body))
  throw Error('DESCRIPCION_PR_INCOMPLETA_MOTIVO_ALCANCE_PRUEBAS_RETROCESO');
 const comments=await fetchComments(repository,pr.number,token);
 if(!hayAprobacionTitular(comments,pr.number,pr.head.sha))
  throw Error('FALTA_AUTORIZACION_TITULAR_PARA_SHA_'+pr.head.sha);
 return {ok:true,critical,reason:'TITULAR_AUTORIZO_SHA_EXACTO'};
}

function diffPr(baseSha,headSha,numero){
 if(!REF_SHA.test(baseSha)||!REF_SHA.test(headSha)||
    !Number.isInteger(numero)||numero<1)throw Error('DIFF_PR_INVALIDO');
 // Referencia de PR de GitHub: se descargan OBJETOS, nunca se ejecutan.
 execFileSync('git',['fetch','--no-tags','origin',
  '+refs/pull/'+numero+'/head:refs/remotes/saber/pr-'+numero],
  {stdio:'pipe',timeout:30000});
 const data=execFileSync('git',['diff','--name-only','-z',baseSha,headSha],
  {encoding:'utf8',timeout:15000});
 return data.split('\0').filter(Boolean);
}

export async function main(env=process.env) {
 if(env.GITHUB_EVENT_NAME!=='pull_request_target'){
  console.log('SABER_CONTROL_REGRESION_SOLO_TEST_NO_AUTORIZA_DESPLIEGUE');
  return;
 }
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const pr=event.pull_request;
 if(!pr)throw Error('EVENTO_PR_AUSENTE');
 const files=diffPr(pr.base.sha,pr.head.sha,pr.number);
 const critical=archivosProtegidos(files);
 console.log('SABER_CONTROL_PR',pr.number,'FILES',files.length,'PROTECTED',critical.length);
 if(critical.length)console.log('SABER_CONTROL_PATHS',critical.slice(0,25).join(' | '));
 const verdict=await comprobarCambioPr({
  pr,repository:env.GITHUB_REPOSITORY,token:env.GITHUB_TOKEN,files
 });
 console.log('SABER_CONTROL_PASS',verdict.reason);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(err=>{
  console.error('SABER_CONTROL_BLOQUEADO',err.message);
  process.exitCode=1;
 });
}
