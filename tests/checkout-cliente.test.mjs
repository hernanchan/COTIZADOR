import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto as crypto} from 'node:crypto';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const intent=crypto.randomUUID(),proof=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
const cart=[{type:'product',id:'SKU',qty:2,price:3500,name:'Cuaderno'},
 {type:'print',photoOrder:true,qty:1,price:6000,name:'Polaroids',filesReceived:true,receivedReferences:['POL-'+'A'.repeat(24)],receiptProofToken:proof}];
const store=new Map([['saberCartV1',JSON.stringify(cart)],['saberCheckoutIntentV2',intent],['saberCheckoutSessionV1',JSON.stringify({intent,token,expires:Date.now()+3600000})]]);
const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
let count=0,redirect='',state='awaiting_payment',enabled=true;
const ctx=vm.createContext({localStorage,crypto,URL,Date,console,Response,confirm:()=>true,location:{assign:u=>redirect=u},SABER_CHECKOUT_CONFIG:{enabled:true,rollout:'APROBADO',turnstileSiteKey:'public'},
 fetch:async(url,opts)=>{
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  assert.equal(/admin|gateway|uploadKey/.test(opts.body),false);
  const b=JSON.parse(opts.body);assert.equal(b.client_order_id,intent);
  if(!enabled)return Response.json({error:'Sesión vencida'},{status:401});
  const op=new URL(url,'https://shop.test').searchParams.get('op');
  if(op==='cart-order'){count++;assert.equal(b.paymentMode,'FULL');assert.equal(b.items[1].proof_token,proof);return Response.json({order_id:'ORDER',total_ars:13000,paid:state==='paid'})}
  if(op==='pay')return Response.json({checkout_url:'https://sandbox.mercadopago.com/checkout/1'});
  if(op==='status')return Response.json({order_id:'ORDER',state});
  throw Error('Operación inesperada '+op);
 }});ctx.window=ctx;
vm.runInContext(await read('integraciones/mercadopago/pruebas/carrito-adapter.js'),ctx);
vm.runInContext(await read('integraciones/mercadopago/pruebas/checkout-client.js'),ctx);
await Promise.all([ctx.SaberCheckout.checkout(),ctx.SaberCheckout.checkout()]);assert.equal(count,1);assert.equal(redirect,'https://sandbox.mercadopago.com/checkout/1');
// La intención usada para la constancia existe antes de cerrar el carrito y no cambia por precio visual.
assert.equal(ctx.SaberCartPaymentAdapter.intentId(),intent);
await assert.rejects(()=>ctx.SaberCheckout.newOrder(),/no está confirmado/);
state='paid';await ctx.SaberCheckout.newOrder();assert.equal(store.has('saberCartV1'),false);assert.equal(store.has('saberCheckoutIntentV2'),false);
ctx.SABER_CHECKOUT_CONFIG.enabled=false;await assert.rejects(()=>ctx.SaberCheckout.begin(),/no está habilitado/);
// Los HTML generados deben mantener sintaxis válida y el hook antes de descartar uploadKey.
for(const file of ['index.html','polaroids/editor.html','pedido-pago.html']){
 const html=await readFile('/tmp/saber-checkout-preview/'+file,'utf8');
 for(const [,code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(code,{filename:file});
 if(file.includes('editor')){assert.ok(html.indexOf('SaberCheckout.receipt(reference,receivingSession.uploadKey)')<html.indexOf('receivedReference=reference;receivingSession=null'));assert.match(html,/receiptProofToken:receivedOrder.receiptProofToken/)}
}
console.log('PASS cliente: carrito mixto, intención estable, doble clic, enlace seguro, pago total, nuevo pedido y HTML de ensayo separado.');
