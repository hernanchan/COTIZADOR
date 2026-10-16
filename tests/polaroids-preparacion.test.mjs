import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const config=JSON.parse(await read('vidriera/polaroids/recepcion-config.json'));
assert.equal(config.enabled,false);assert.equal(config.showInShop,false);
assert.equal(config.rollout,'PENDIENTE_DE_APROBACION');assert.equal(config.turnstileSiteKey,'');
for(const path of ['vidriera/index.html','vidriera/cotizar.html','vidriera/polaroids/editor.html']){
 const html=await read(path);
 for(const [,code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(code,{filename:path});
}
const source=await read('functions/api/polaroids-receiver.js');
const receiver=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const host='https://libreriasaber.com.ar';
const enabled={...config,enabled:true,rollout:'APROBADO',turnstileSiteKey:'0xTESTKEY12345'};
const env=state=>({ASSETS:{fetch:async()=>new Response(JSON.stringify(state))}});
let calls=0;const actualFetch=globalThis.fetch;
globalThis.fetch=async()=>{calls++;throw Error('Unexpected upstream request');};
const post=(body='{}',op='start',origin=host,base=host,extra={})=>new Request(base+'/api/polaroids-receiver?op='+op,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body});
for(const state of [config,{...enabled,enabled:false},{...enabled,rollout:'PENDIENTE_DE_APROBACION'},{...enabled,allowedHost:'example.com'},{...enabled,turnstileSiteKey:''},{...enabled,bridgeUrl:'https://example.com'}]){
 const r=await receiver.onRequestPost({request:post(),env:env(state)});assert.equal(r.status,503);
}
for(const invalidEnv of [undefined,{}, {ASSETS:{fetch:async()=>new Response('bad json')}}])assert.equal((await receiver.onRequestPost({request:post(),env:invalidEnv})).status,503);
assert.equal((await receiver.onRequestPost({request:post('{}','start','https://example.com'),env:env(enabled)})).status,403);
assert.equal((await receiver.onRequestPost({request:post('{}','start',host,'https://preview.pages.dev'),env:env(enabled)})).status,403);
assert.equal((await receiver.onRequestPost({request:post('{}','start',host,host,{'Sec-Fetch-Site':'cross-site'}),env:env(enabled)})).status,403);
for(const body of ['null','[]','{}','"text"','bad json',' '.repeat(2001)])assert.equal((await receiver.onRequestPost({request:post(body,'status'),env:env(enabled)})).status,400);
assert.equal((await receiver.onRequestPost({request:post('{}','invalid'),env:env(enabled)})).status,400);
assert.equal((await receiver.onRequestPost({request:post('{}','photo',host,host,{'Content-Length':String(16*1024*1024)}),env:env(enabled)})).status,413);
assert.equal(calls,0);
const info=await receiver.onRequestGet({request:new Request(host+'/api/polaroids-receiver'),env:env(config)});
assert.equal((await info.json()).receptionEnabled,false);
const reference='POL-'+'A'.repeat(24),uploadKey='a'.repeat(64);
globalThis.fetch=async()=>new Response('saberStatus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa('+JSON.stringify({ok:true,found:true,status:'received',received:19,photos:19,sheets:4,pdfUrl:'PRIVATE',uploadKey})+');');
const result=await receiver.onRequestPost({request:post(JSON.stringify({reference,uploadKey}),'status'),env:env(enabled)});
assert.deepEqual(await result.json(),{ok:true,found:true,status:'received',received:19,photos:19,sheets:4});
globalThis.fetch=async()=>new Response('',{status:302});
const dispatched=await receiver.onRequestPost({request:post('{"op":"start","payload":{}}'),env:env(enabled)});
assert.equal(dispatched.status,202);assert.equal((await dispatched.json()).confirmed,false);
globalThis.fetch=actualFetch;
console.log('PASS: sintaxis, configuración apagada, bloqueo de origen/host, fallos cerrados, estado inválido, tamaño, privacidad y despacho sin confirmación.');
