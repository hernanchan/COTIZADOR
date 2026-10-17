// Ejecuta los scripts reales con DOM, almacenamiento y red simulados. No envía fotos ni WhatsApp.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const storage=new Map(),nodes=new Map();let destination='',opened='',calls=0,server=null;
const noop=()=>{};
function node(){return {hidden:true,checked:true,width:840,height:1188,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},append:noop,replaceChildren:noop,addEventListener:noop,setAttribute:noop,getContext:()=>new Proxy({},{get:()=>noop,set:()=>true})};}
const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelector:()=>node(),querySelectorAll:()=>[],createElement:()=>node(),createDocumentFragment:()=>node(),addEventListener:noop};
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const location={origin:'https://libreriasaber.com.ar',hostname:'libreriasaber.com.ar',search:'?unitPrice=1',assign:u=>destination=u,pathname:'/',hash:''};
const sandbox={console,document,localStorage,location,URL,URLSearchParams,crypto:globalThis.crypto,setTimeout,clearTimeout,Intl,Response,history:{replaceState:noop},alert:noop,confirm:()=>true};
sandbox.window=sandbox;sandbox.parent=sandbox;sandbox.addEventListener=noop;sandbox.open=u=>opened=u;
sandbox.fetch=async()=>{calls++;return new Response('{"enabled":false,"showInShop":false}')};
const ctx=vm.createContext(sandbox);
const run=code=>vm.runInContext(code,ctx);
const html=await read('vidriera/polaroids/editor.html');
for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))run(script);
await new Promise(r=>setTimeout(r,0));
assert.equal(calls,1);assert.equal(run('unitPrice'),3000);assert.equal(nodes.get('btnPdf').disabled,true);
run(`saveRecovery=async()=>{};recoveryStore=async()=>{};sheets.splice(0,sheets.length,...Array.from({length:4},(_,k)=>Array.from({length:6},(_,i)=>k*6+i<19?{file:{name:'foto'+(k*6+i),size:100,type:'image/jpeg',lastModified:1},img:{naturalWidth:1000,naturalHeight:1000},zoom:1,cx:.5,cy:.5}:null)));photos=sheets[0];partialConfirmed=19;receiverConfig={enabled:true};receiverApiUrl=location.origin+'/api/polaroids-receiver';turnstileToken='test';readFileBase64=async()=> 'mock-base64';imprimirRecorte=async()=>({});`);
sandbox.fetch=async(url,options)=>{
 const op=new URL(url).searchParams.get('op'),input=JSON.parse(options.body);
 if(op==='status')return new Response(JSON.stringify({ok:true,found:!!server,...server}));
 if(op==='start')server={status:'receiving',received:0,photos:input.payload.photos,sheets:input.payload.sheets};
 if(op==='photo')server.received=input.payload.index+1;
 if(op==='finish')server.status='received';
 return new Response('{"ok":true,"dispatched":true,"confirmed":false}',{status:202});
};
await run('sendSecurePhotos()');
assert.equal(server.received,19);assert.equal(run('receivedOrder.sheets'),4);
assert.equal(run('receivedOrder.price'),12000);assert.equal(nodes.get('btnClear').disabled,true);
run('dropPhoto(0);deleteCurrentSheet();addNewSheet();openEditor(0)');
assert.equal(run('photoCount()'),19);assert.equal(run('editorIndex'),-1);
storage.set('saberCartV1',JSON.stringify([{id:'PRODUCT-1',type:'product',name:'Cuaderno',qty:2,price:1000}]));
await nodes.get('goToCartAfterReceipt').onclick();await nodes.get('goToCartAfterReceipt').onclick();
const cart=JSON.parse(storage.get('saberCartV1'));
assert.equal(cart.length,2);assert.equal(cart[1].price,12000);assert.equal(cart[1].deposit,6000);assert.match(cart[1].detail,/19 Polaroids/);
assert.equal(destination,'../index.html?carrito=1');assert.equal(/uploadKey|base64/.test(storage.get('saberCartV1')),false);
// Usar un contexto nuevo, como la navegación real al carrito.
const shop=vm.createContext({...sandbox,fetch:async()=>new Response('{"enabled":false}'),location:{...location,search:'?carrito=1'}});
shop.window=shop;shop.parent=shop;
for(const [,script] of (await read('vidriera/index.html')).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))vm.runInContext(script,shop);
vm.runInContext('sendWhatsApp()',shop);
const message=decodeURIComponent(opened);assert.match(message,/19 Polaroids/);assert.match(message,/POL-[A-F0-9]{8}/);assert.doesNotMatch(message,/POL-[A-F0-9]{24}/);assert.match(cart[1].receivedReferences[0],/^POL-[A-F0-9]{24}$/);assert.match(message,/Cuaderno/);assert.equal(/uploadKey|base64/.test(message),false);
console.log('PASS: scripts reales con DOM/red simulados: precio único, 19 fotos/4 hojas, estado confirmado, edición bloqueada, carrito mixto sin duplicados y WhatsApp sin secretos.');
