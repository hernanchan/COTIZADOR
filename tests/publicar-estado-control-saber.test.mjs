import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTEXTO,prepararEstado,emitirEstado} from '../tools/publicar-estado-control-saber.mjs';

const repo='hernanchan/COTIZADOR',sha='1234567890abcdef1234567890abcdef12345678';
test('estado se adjunta al commit de la PR, no al commit de base',()=>{
 const x=prepararEstado({repo,sha,result:'failure',
  runUrl:'https://github.com/hernanchan/COTIZADOR/actions/runs/12345'});
 assert.equal(CONTEXTO,'saber/contrato');
 assert.equal(x.body.state,'failure');
 assert.equal(x.body.context,CONTEXTO);
 assert.equal(x.url,'https://api.github.com/repos/'+repo+'/statuses/'+sha);
 assert.match(x.body.target_url,/\/runs\/12345$/);
});
test('no se emite un estado aprobado sin resultado positivo verificado',()=>{
 assert.throws(()=>prepararEstado({repo,sha,result:'pending'}),/STATUS_RESULTADO_INVALIDO/);
 assert.throws(()=>prepararEstado({repo:'otro/repo',sha,result:'success'}),/STATUS_REPO_SHA_INVALIDO/);
});
test('un resultado fallido se publica como failure, nunca success',async()=>{
 let payload=null;
 const response=await emitirEstado({
  repo,sha,result:'failure',token:'TOKEN_SIMULADO',
  fetcher:async(url,options)=>{
   assert.equal(options.method,'POST');
   payload=JSON.parse(options.body);
   return {status:201};
  }
 });
 assert.equal(payload.state,'failure');
 assert.equal(response.estado,'failure');
});
test('si GitHub rechaza el estado, se informa error y el control falla',async()=>{
 await assert.rejects(()=>emitirEstado({
  repo,sha,result:'success',token:'TOKEN_SIMULADO',
  fetcher:async()=>({status:403})
 }),/STATUS_NO_PUBLICADO_HTTP_403/);
});
