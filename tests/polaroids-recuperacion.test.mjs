// npm install --prefix /tmp/polaroids-test fake-indexeddb@6.2.6 --no-save
// POLAROIDS_IDB_MODULE=/tmp/polaroids-test/node_modules/fake-indexeddb/build/esm/index.js node tests/polaroids-recuperacion.test.mjs
// IndexedDB realista; DOM, imágenes y servidor simulados. No envía fotografías reales.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {IDBFactory}=await import(process.env.POLAROIDS_IDB_MODULE||'fake-indexeddb');
const html=await readFile(new URL('../vidriera/polaroids/editor.html',import.meta.url),'utf8');
const indexedDB=new IDBFactory();
let server=null,uploads=[],starts=[],finishes=0,interruptAt=3,interrupt=true;
const noop=()=>{};
function makeNode(){return {hidden:true,checked:true,width:840,height:1188,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},append:noop,replaceChildren:noop,addEventListener:noop,setAttribute:noop,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})};}
async function page(){
 const nodes=new Map();
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)},querySelector:()=>makeNode(),querySelectorAll:()=>[],createElement:()=>makeNode(),createDocumentFragment:()=>makeNode(),addEventListener:noop};
 const ctx=vm.createContext({console,document,indexedDB,URL,URLSearchParams,crypto:globalThis.crypto,Response,setTimeout,clearTimeout,Intl,location:{origin:'https://libreriasaber.com.ar',hostname:'libreriasaber.com.ar',search:''},history:{replaceState:noop},localStorage:{getItem:()=>null,setItem:noop},alert:noop,confirm:()=>true});
 ctx.window=ctx;ctx.parent=ctx;ctx.addEventListener=noop;
 ctx.fetch=async(url,options)=>{
  if(url==='recepcion-config.json')return new Response('{"enabled":false}');
  const op=new URL(url).searchParams.get('op'),input=JSON.parse(options.body);
  if(op==='status')return new Response(JSON.stringify({ok:true,found:!!server,...server}));
  if(op==='start'){starts.push(input.payload.reference);server={status:'receiving',received:0,photos:input.payload.photos,sheets:input.payload.sheets};}
  if(op==='photo'){uploads.push(input.payload.index);server.received=input.payload.index+1;}
  if(op==='finish'){finishes++;server.status='received';}
  return new Response('{"ok":true}',{status:202});
 };
 const run=s=>vm.runInContext(s,ctx);
 for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))run(script.replace('restoreRecovery().then','window.recoveryReady=restoreRecovery().then'));
 run(`loadImage=async file=>({file,name:file.name,img:{naturalWidth:1000,naturalHeight:1000},zoom:1,cx:.5,cy:.5});readFileBase64=async()=> 'base64';imprimirRecorte=async()=>({});`);
 await ctx.recoveryReady;
 run(`receiverConfig={enabled:true};receiverApiUrl=location.origin+'/api/polaroids-receiver';`);
 return {ctx,run,nodes};
}
let p=await page();
p.run(`sheets.splice(0,sheets.length,...Array.from({length:10},(_,k)=>Array.from({length:6},(_,i)=>({file:{name:'foto'+(k*6+i),size:100,type:'image/jpeg',lastModified:1},img:{naturalWidth:1000,naturalHeight:1000},zoom:1.2,cx:.4,cy:.6}))));photos=sheets[0];turnstileToken='test';`);
// Corte después de que el servidor recibió la foto 3, antes de guardar su confirmación local.
p.ctx.shouldInterrupt=()=>interrupt&&server?.received===interruptAt;
p.run(`const realSave=saveRecovery;saveRecovery=async(...args)=>{if(shouldInterrupt())throw new Error('simulated storage interruption');return realSave(...args)};`);
await p.run('sendSecurePhotos()');
assert.equal(server.received,3);const reference=p.run('receivingSession.reference');
interrupt=false;
p=await page();
assert.equal(p.run('photoCount()'),60);assert.equal(p.run('photos[0].cx'),.4);assert.equal(p.run('photos[0].zoom'),1.2);
assert.equal(p.run('receivingSession.reference'),reference);
assert.equal(p.run('receivingSession.uploaded.size'),2);
assert.equal(p.run('turnstileToken'),''); // no nuevo CAPTCHA para un pedido ya iniciado
await p.run('sendSecurePhotos()');
assert.deepEqual(uploads,Array.from({length:60},(_,i)=>i));assert.equal(starts.length,1);assert.equal(finishes,1);
assert.equal(p.run('receivedReference'),reference);assert.equal(p.run('receivedOrder.price'),30000);
p=await page();
assert.equal(p.run('receivedReference'),reference);assert.equal(p.run('photoCount()'),60);
await p.run('sendSecurePhotos()');assert.equal(uploads.length,60);assert.equal(finishes,1);
// Corte entre el guardado local inicial y el alta remota: conserva la referencia al reintentar.
await p.run("recoveryStore('readwrite',s=>s.clear())");server=null;
p=await page();p.run(`sheets.splice(0,sheets.length,[...Array.from({length:6},(_,i)=>({file:{name:'n'+i,size:100,type:'image/jpeg',lastModified:2},img:{naturalWidth:1000,naturalHeight:1000},zoom:1,cx:.5,cy:.5}))]);photos=sheets[0];receivingSession={reference:secureOrderReference(),uploadKey:secureOrderKey(),uploaded:new Set(),fingerprint:photoFingerprint(),started:false};`);
const pendingRef=p.run('receivingSession.reference');await p.run('saveRecovery(true)');
p=await page();await p.run('sendSecurePhotos()');assert.equal(server,null);assert.equal(p.run('receivingSession.reference'),pendingRef);
p.run("turnstileToken='fresh'");await p.run('sendSecurePhotos()');assert.equal(p.run('receivedReference'),pendingRef);
console.log('PASS: 60 fotos, recuperación en página nueva tras corte en foto 3, encuadres intactos, sin duplicados, pedido terminado recuperable y alta interrumpida reintentable con la misma referencia.');
