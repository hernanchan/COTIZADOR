import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const begin=source.indexOf('function docsJsonAsciiFirmado(');
const after=source.indexOf('async function handleDocumentsPost(',begin);
assert.ok(begin>0&&after>begin);
const sut=source.slice(begin,after);
function prepare(signature){
 const factory=new Function('googleScriptUrl','signature','AbortSignal',
   sut+';return {docsJsonAsciiFirmado,postToScript};');
 return factory(
  url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url),
  signature,
  {timeout:()=>({})}
 );
}
const key='TEST_ONLY_abcdefghijklmnopqrstuvwxyz_0123456789';
const env={DOCS_SCRIPT_URL:'https://script.google.com/macros/s/TESTONLY/exec',DOCS_RELAY_KEY:key};
const simple=prepare(async()=> 'signed-test-value').docsJsonAsciiFirmado;

test('el JSON sin Unicode conserva exactamente el formato anterior',()=>{
 const payload={op:'ping',purpose:'saber-docs-hmac-v1'};
 assert.equal(simple(payload),JSON.stringify(payload));
});

test('el JSON para HMAC es ASCII puro y conserva acentos, emoji y signos tras JSON.parse',()=>{
 const payload={op:'multiStartBatch',metas:[
  {orderId:'WEB-PRUEBA',fileId:'pdf-01',name:'Día de las familias.pdf',mode:'bn'},
  {orderId:'WEB-PRUEBA',fileId:'pdf-02',name:'Poliza ñandú 😊 impresora 🖨️.pdf',mode:'color'}
 ],quote:'sí, año "2026" \\\\ prueba'};
 const str=simple(payload);
 assert.doesNotMatch(str,/[^\x00-\x7f]/);
 assert.match(str,/\\u00ed/);
 assert.match(str,/\\ud83d/);
 assert.deepEqual(JSON.parse(str),payload);
});

test('se firma exactamente el payload ASCII enviado y GAS puede recuperar el nombre',async()=>{
 const signatures=[];
 const {postToScript}=prepare(async (json,time,secret)=>{
  signatures.push({json,time,secret});
  return 'signed-test-value';
 });
 const payload={op:'multiStartBatch',metas:[{name:'Día de las familias.pdf'}]};
 let outgoing;
 const reply=await postToScript(env,payload,async (_url,request)=>{
  outgoing=JSON.parse(request.body);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true})};
 });
 assert.equal(reply.ok,true);
 assert.equal(signatures.length,1);
 assert.equal(signatures[0].json,outgoing.payloadJson);
 assert.equal(signatures[0].time,outgoing.timestamp);
 assert.equal(signatures[0].secret,key);
 assert.equal(outgoing.signature,'signed-test-value');
 assert.deepEqual(JSON.parse(outgoing.payloadJson),payload);
 assert.doesNotMatch(outgoing.payloadJson,/[^\x00-\x7f]/);
});

test('no se afloja la autenticación ni se altera el flujo de datos',()=>{
 assert.match(sut,/signature\(payloadJson,timestamp,env\.DOCS_RELAY_KEY\)/);
 assert.match(sut,/method:'POST'/);
 assert.match(sut,/redirect:'manual'/);
 assert.match(sut,/JSON\.parse\(data\)/);
});
