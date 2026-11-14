/**
 * Emite estado de commit (solo el SHA del PR) para usar como required status
 * de Rulesets. Corre en pull_request_target con código de la rama BASE.
 * Nunca lee ni ejecuta contenido del PR.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const SHA=/^[0-9a-f]{40}$/i;
export const CONTEXTO='saber/contrato';

export function prepararEstado({repo,sha,result,runUrl}){
 if(repo!=='hernanchan/COTIZADOR'||!SHA.test(sha||''))
  throw Error('STATUS_REPO_SHA_INVALIDO');
 if(!['success','failure'].includes(result))
  throw Error('STATUS_RESULTADO_INVALIDO');
 return {
  url:'https://api.github.com/repos/'+repo+'/statuses/'+sha,
  body:{
   state:result,
   context:CONTEXTO,
   description:result==='success'?'Contrato Saber: autorizacion validada':
    'Contrato Saber: cambio sin aprobacion o control fallido',
   target_url:/^https:\/\/github\.com\/hernanchan\/COTIZADOR\/actions\/runs\/\d+$/.test(runUrl||'')
    ?runUrl:undefined
  }
 };
}

export async function emitirEstado({repo,sha,result,runUrl,token,fetcher=fetch}){
 if(!token||typeof token!=='string')throw Error('TOKEN_STATUS_AUSENTE');
 const prepared=prepararEstado({repo,sha,result,runUrl});
 const response=await fetcher(prepared.url,{
  method:'POST',
  headers:{
   Accept:'application/vnd.github+json',
   Authorization:'Bearer '+token,
   'Content-Type':'application/json',
   'X-GitHub-Api-Version':'2022-11-28'
  },
  body:JSON.stringify(prepared.body),
  signal:AbortSignal.timeout(12000)
 });
 if(response.status!==201)throw Error('STATUS_NO_PUBLICADO_HTTP_'+response.status);
 return {context:CONTEXTO,estado:result};
}

export async function main(env=process.env){
 if(env.GITHUB_EVENT_NAME!=='pull_request_target')return;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const sha=event.pull_request?.head?.sha;
 const result=env.SABER_CONTRATO_RESULT==='success'?'success':'failure';
 const runUrl='https://github.com/'+env.GITHUB_REPOSITORY+
  '/actions/runs/'+env.GITHUB_RUN_ID;
 const response=await emitirEstado({
  repo:env.GITHUB_REPOSITORY,sha,result,
  runUrl,token:env.GITHUB_TOKEN
 });
 console.log('SABER_COMMIT_STATUS',response.context,response.estado);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{
  console.error('SABER_COMMIT_STATUS_ERROR',e.message);
  process.exitCode=1;
 });
}
