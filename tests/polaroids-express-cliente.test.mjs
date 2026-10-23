import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {inflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {webcrypto as crypto} from 'node:crypto';
import {prepararEnvioExpress} from '../vidriera/polaroids/express-cliente.mjs';
const bytes=Uint8Array.from(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const imgBlob=new Blob([bytes],{type:'image/jpeg'});
test('cliente prepara 24 fotos en 4 tandas y nunca incorpora originales al payload',async()=>{
 const progress=[];
 const sheets=Array.from({length:4},(_,h)=>Array.from({length:6},(_,i)=>({fileName:'foto'+(h*6+i)})));
 const result=await prepararEnvioExpress({
  hojas:sheets,recortar:async()=>imgBlob,onAvance:x=>progress.push(x)
 });
 assert.equal(result.hojas.length,4);
 assert.equal(result.fotos,24);
 assert.equal(progress.length,24);
 assert.equal(progress[5].hoja,1);
 assert.equal(progress[6].hoja,2);
 assert.equal(result.originalesIncluidos,false);
 assert.equal(result.pdfCliente,false);
 assert.equal(result.hojas[0][0],Buffer.from(bytes).toString('base64'));
 assert.equal(JSON.stringify(result).includes('fileName'),false);
});
test('editor existente usa Express en vez de transportar originales',async()=>{
 const nodes=new Map(),noop=()=>{};
 const elt=()=>({textContent:'',hidden:false,disabled:false,checked:true,
  classList:{add:noop,remove:noop,toggle:noop},style:{},dataset:{},
  append:noop,replaceChildren:noop,addEventListener:noop,
  setAttribute:noop,getContext:()=>new Proxy({},{get:()=>noop}),
  toBlob:callback=>callback(imgBlob),
  click:noop,onclick:noop,width:840,height:1188});
 const document={
  getElementById:id=>{if(!nodes.has(id))nodes.set(id,elt());return nodes.get(id)},
  querySelector:()=>elt(),querySelectorAll:()=>[],createDocumentFragment:()=>elt(),
  createElement:()=>elt(),addEventListener:noop
 };
 const location={origin:'https://libreriasaber.com.ar',hostname:'libreriasaber.com.ar',
  search:'',pathname:'/polaroids/editor',hash:''};
 const store=new Map();
 let requests=[];
 const sandbox={document,location,URL,URLSearchParams,Blob,Response,crypto,console,
  setTimeout,clearTimeout,Intl,confirm:()=>true,alert:noop,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  history:{replaceState:noop},turnstile:{reset:noop},Image:class{},FileReader:class{
   constructor(){throw Error('Express no puede abrir originales por FileReader.')}
  }};
 sandbox.window=sandbox;sandbox.parent=sandbox;
 sandbox.open=noop;sandbox.addEventListener=noop;
 sandbox.fetch=async()=>Response.json({enabled:false,rollout:'PENDIENTE_DE_APROBACION'});
 const context=vm.createContext(sandbox);
 const run=code=>vm.runInContext(code,context);
 const html=await readFile(new URL('../vidriera/polaroids/editor.html',import.meta.url),'utf8');
 const importModuleDynamically=async(specifier)=>{
  assert.equal(specifier,'./express-cliente.mjs');
  return await import('../vidriera/polaroids/express-cliente.mjs');
 };
 for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  const compiled=new vm.Script(script,{filename:'editor.html',importModuleDynamically});
  compiled.runInContext(context);
 }
 await new Promise(resolve=>setTimeout(resolve,0));
 run(`sheets.splice(0,sheets.length,...Array.from({length:4},(_,h)=>
  Array.from({length:6},(_,i)=>({
   file:{name:'foto'+(h*6+i)+'.jpg',size:150000,type:'image/jpeg',lastModified:10},
   img:{naturalWidth:1500,naturalHeight:1500},zoom:1,cx:.5,cy:.5
  }))));
  photos=sheets[0];receiverConfig={enabled:true,mode:'express'};
  receiverApiUrl=location.origin+'/api/polaroids-express';
  turnstileToken='verified-turnstile-token';`);
 sandbox.fetch=async(url,options)=>{
  assert.equal(url,location.origin+'/api/polaroids-express');
  assert.equal(options.method,'POST');
  const payload=JSON.parse(options.body);
  requests.push(payload);
  assert.deepEqual(Object.keys(payload).sort(),['hojas','reference','turnstileToken']);
  assert.equal(payload.hojas.length,4);
  assert.equal(payload.hojas[3].length,6);
  assert.equal(payload.hojas.every(a=>a.length===6),true);
  assert.equal(JSON.stringify(payload).includes('foto0.jpg'),false);
  assert.equal(JSON.stringify(payload).includes('crop'),false);
  assert.equal(payload.hojas[0][0],Buffer.from(bytes).toString('base64'));
  return Response.json({ok:true,verified:true,pdfPrivateConfirmed:true,
   reference:payload.reference,photos:24,sheets:4,pdfForClient:false,
   checkoutAuthorized:false});
 };
 await run('sendSecurePhotos()');
 assert.equal(requests.length,1);
 assert.equal(run('receivedOrder.photos'),24);
 assert.equal(run('receivedOrder.sheets'),4);
 assert.equal(run('receivedOrder.price'),12000);
 assert.equal(run('receivingSession'),null);
 assert.match(run('receivedReference'),/^POL-[A-F0-9]{24}$/);
 assert.equal(nodes.get('btnPdf').disabled,true);
});
