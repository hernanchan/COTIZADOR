// Reproduce el error ocultado por Turnstile y el reintento del mismo pedido.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto as crypto} from 'node:crypto';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const nodes=new Map(),noop=()=>{};
const node=()=>({hidden:true,checked:true,width:840,height:1188,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},append:noop,replaceChildren:noop,addEventListener:noop,setAttribute:noop,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})});
const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelector:()=>node(),querySelectorAll:()=>[],createElement:()=>node(),createDocumentFragment:()=>node(),addEventListener:noop};
const host='polaroids-integracion-sin-r2.libreriasaber.pages.dev';
let callbacks,server=null,phase='reject',starts=[],statusCalls=0;
const sandbox={console,document,URL,URLSearchParams,crypto,setTimeout,clearTimeout,Intl,Response,
 location:{origin:'https://'+host,hostname:host,search:'',pathname:'/',hash:''},history:{replaceState:noop},localStorage:{getItem:()=>null,setItem:noop},alert:noop,confirm:()=>true,
 turnstile:{render:(target,cfg)=>{callbacks=cfg;return 1},reset:()=>{}},fetch:async()=>Response.json({enabled:false})};
sandbox.window=sandbox;sandbox.parent=sandbox;sandbox.addEventListener=noop;sandbox.removeEventListener=noop;
const ctx=vm.createContext(sandbox),run=code=>vm.runInContext(code,ctx);
const html=await read('prototipos/pagos-piloto/editor-con-reintentos.html');
for(const [,script]of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))run(script);
await new Promise(r=>setTimeout(r,0));
run(`sheets.splice(0,sheets.length,Array.from({length:6},(_,i)=>({file:{name:'demo'+i,size:100,type:'image/jpeg',lastModified:1},img:{naturalWidth:1000,naturalHeight:1000},zoom:1,cx:.5,cy:.5})));photos=sheets[0];receiverConfig={enabled:true};receiverApiUrl=location.origin+'/api/polaroids-receiver';readFileBase64=async()=> 'mock';imprimirRecorte=async()=>({});`);
await run('loadTurnstile("public-key")');callbacks.callback('first');
sandbox.fetch=async(url,opts)=>{
 const op=new URL(url).searchParams.get('op'),input=JSON.parse(opts.body);
 if(op==='start'){starts.push(input.payload);if(phase==='reject')return Response.json({ok:false,rejected:true,error:'Google rechazó start'},{status:422});server={found:true,status:'receiving',received:0,photos:6,sheets:1}}
 if(op==='status'){statusCalls++;return Response.json({ok:true,found:!!server,...server})}
 if(op==='photo')server.received=input.payload.index+1;
 if(op==='finish')server.status='received';
 return Response.json({ok:true,dispatched:true,confirmed:false},{status:202});
};
await run('sendSecurePhotos()');assert.equal(starts.length,1);assert.equal(statusCalls,0);assert.ok(run('receivingSession'));
const previousReference=run('receivingSession.reference');
callbacks.callback('fresh');assert.match(nodes.get('status').textContent,/envío anterior no se confirmó/);assert.equal(nodes.get('status').textContent.includes('Ya podés enviar'),false);
phase='success';await Promise.all([run('sendSecurePhotos()'),run('sendSecurePhotos()')]);
assert.equal(starts.length,2);assert.equal(starts[0].reference,starts[1].reference);assert.equal(starts[0].uploadKey,starts[1].uploadKey);
assert.equal(run('receivedReference'),previousReference);assert.equal(server.received,6);
// Verificar el relay real de esta revisión: Google ERROR nunca se interpreta como recepción aceptada.
const relay=await import('data:text/javascript;base64,'+Buffer.from(await read('prototipos/pagos-piloto/receiver-con-respuesta.js')).toString('base64'));
const cfg={enabled:true,allowedHost:host,bridgeUrl:'https://script.google.com/macros/s/AKfycbzF2lx1Q0qmVOoshCigtQQaMmR4IF0kiT8vK_3fwBGgwXgpUW8CixpDJoprhLuOxv20/exec'};
const env={ASSETS:{fetch:async()=>Response.json(cfg)}};
const request=()=>new Request('https://'+host+'/api/polaroids-receiver?op=start',{method:'POST',headers:{Origin:'https://'+host,'Content-Type':'application/json'},body:'{"op":"start","payload":{}}'});
const savedFetch=globalThis.fetch;
try{
 for(const [reply,status]of [['ERROR',422],['OK',202],['<html>unexpected</html>',502]]){
  globalThis.fetch=async(url,opts)=>{assert.equal(opts.redirect,'manual');return new Response(reply)};
  const r=await relay.onRequestPost({request:request(),env});assert.equal(r.status,status);
  const data=await r.json();if(reply==='ERROR')assert.equal(data.rejected,true);if(reply==='OK')assert.equal(data.confirmed,false);
 }
 let calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==='POST'){
   assert.equal(opts.redirect,'manual');assert.ok(opts.body instanceof Uint8Array);
   const body=await new Response(opts.body).text();assert.match(body,/start/);
   return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?user_content_key=test'}});
  }
  assert.equal(opts.method,'GET');assert.equal(opts.body,undefined);assert.equal(opts.redirect,'follow');
  return new Response('OK');
 };
 assert.equal((await relay.onRequestPost({request:request(),env})).status,202);
 assert.equal(calls.length,2);
 for(const location of ['https://attacker.example/macros/echo','https://accounts.google.com/login','https://script.googleusercontent.com/other']){
  let count=0;globalThis.fetch=async()=>{count++;return new Response(null,{status:302,headers:{Location:location}})};
  assert.equal((await relay.onRequestPost({request:request(),env})).status,502);assert.equal(count,1);
 }
 globalThis.fetch=async()=>{throw new TypeError('sensitive URL stream failure')};
 const failure=await relay.onRequestPost({request:request(),env});const detail=await failure.json();
 assert.equal(detail.diagnostic,'post-body');assert.equal(JSON.stringify(detail).includes('sensitive'),false);
 let contacted=false;globalThis.fetch=async()=>{contacted=true;return new Response('OK')};
 const oversized=new Request('https://'+host+'/api/polaroids-receiver?op=photo',{method:'POST',headers:{Origin:'https://'+host,'Content-Type':'application/json'},body:new Uint8Array(15*1024*1024+1)});
 assert.equal((await relay.onRequestPost({request:oversized,env})).status,413);assert.equal(contacted,false);
}finally{globalThis.fetch=savedFetch}
console.log('PASS reintento: error visible, sin espera en rechazo explícito, referencia/clave conservadas, doble clic bloqueado y Google ERROR rechazado.');
