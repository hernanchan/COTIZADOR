// Node 24+. SQL real; red externa simulada y rechazada salvo contratos explícitos.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {webcrypto as crypto,createHmac} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(await read('integraciones/mercadopago/pruebas/schema.sql'));
const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this},
 async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},
 async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}},
 async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const stmt of stmts)r.push(await stmt.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const preferences=new Map(),payments=new Map();let received=12,price='3.500,00',posts=0,cfOK=true,dropResponse=false,sellerIsTest=true;
const net=async(url,opts={})=>{
 const u=new URL(url),body=opts.body?JSON.parse(opts.body):null;
 if(u.hostname==='challenges.cloudflare.com')return Response.json({success:cfOK,hostname:'shop.test',action:'checkout'});
 if(u.hostname==='docs.google.com')return new Response('Activo,Código,Producto,Precio,Oferta\nSI,SKU-1,Cuaderno,"'+price+'",0\n');
 if(u.pathname==='/api/polaroids-receiver')return Response.json({ok:true,found:true,status:'received',photos:12,sheets:2,received});
 assert.equal(u.hostname,'api.mercadopago.com','Red no autorizada en pruebas: '+url);
 if(u.pathname==='/users/me')return Response.json({id:123,tags:sellerIsTest?['test_user']:['normal']});
 if(u.pathname==='/checkout/preferences'&&opts.method==='POST'){
  posts++;assert.equal(body.notification_url,env.TEST_WEBHOOK_URL);assert.equal(body.items[0].unit_price,13000);assert.equal(body.expires,true);
  const pref={...body,id:'PREF-'+posts,sandbox_init_point:'https://sandbox.mercadopago.com/checkout/'+posts};preferences.set(pref.id,pref);if(dropResponse){dropResponse=false;throw Error('Respuesta perdida después de crear preferencia')}return Response.json(pref);
 }
 if(u.pathname==='/checkout/preferences/search')return Response.json({elements:[...preferences.values()].filter(p=>p.external_reference===u.searchParams.get('external_reference'))});
 if(u.pathname.startsWith('/checkout/preferences/'))return Response.json(preferences.get(u.pathname.split('/').pop()));
 if(u.pathname==='/v1/payments/search')return Response.json({results:[...payments.values()].filter(p=>p.external_reference===u.searchParams.get('external_reference'))});
 if(u.pathname.startsWith('/v1/payments/'))return Response.json(payments.get(u.pathname.split('/').pop()));
 if(u.pathname.startsWith('/merchant_orders/'))return Response.json({preference_id:order.preference_id,external_reference:order.id,payments:[{id:100,status:'approved'}]});
 throw Error('Red no autorizada: '+url);
};
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,crypto,console,fetch:net});
vm.runInContext((await read('integraciones/mercadopago/pruebas/worker.js')).replace('export default {','globalThis.worker={'),ctx);
const env={DB,DEMO_ADMIN_KEY:'admin-only',MP_TEST_ACCESS_TOKEN:'fake',MP_TEST_SELLER_ID:'123',TEST_WEBHOOK_URL:'https://worker.test/webhooks/mercadopago',MP_WEBHOOK_SECRET:'hmac-secret',
 CHECKOUT_RETURN_URL:'https://shop.test/pedido-pago.html',CHECKOUT_ENABLED:'APROBADO',CHECKOUT_GATEWAY_KEY:'gateway-only',TURNSTILE_SECRET_KEY:'cf-secret',CHECKOUT_HOST:'shop.test',CHECKOUT_RATE_LIMIT:{limit:async()=>({success:true})}};
const proxy=await import('data:text/javascript;base64,'+Buffer.from(await read('functions/api/checkout.js')).toString('base64'));
const gatewayEnv={...env,PAYMENTS:{fetch:req=>ctx.worker.fetch(req,env)}};
const intent=crypto.randomUUID();let token;
async function customer(op,body={},id=intent,origin='https://shop.test'){
 const req=new Request('https://shop.test/api/checkout?op='+op,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({...body,client_order_id:id})});
 const r=await proxy.onRequestPost({request:req,env:gatewayEnv});return {status:r.status,data:await r.json()};
}
async function admin(path,body){const r=await ctx.worker.fetch(new Request('https://worker.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
assert.equal((await customer('status')).status,401);
assert.equal((await customer('session',{turnstileToken:'fake'},intent,'https://evil.test')).status,403);
cfOK=false;assert.equal((await customer('session',{turnstileToken:'bad'})).status,403);cfOK=true;
token=(await customer('session',{turnstileToken:'good'})).data.session_token;assert.ok(token);
assert.equal((await customer('status')).data.state,'draft');
assert.equal((await customer('status',{},crypto.randomUUID())).status,401);
received=11;const proofInput={reference:'POL-'+'A'.repeat(24),uploadKey:'a'.repeat(64)};
assert.equal((await customer('polaroid-proof',proofInput)).status,422);received=12;
const proof=await customer('polaroid-proof',proofInput);assert.equal(proof.status,201);
assert.equal((await admin('/demo/polaroid-proof-pilot',{...proofInput,client_order_id:intent})).data.proof_token,proof.data.proof_token);
assert.equal((await customer('polaroid-proof',proofInput)).data.proof_token,proof.data.proof_token);
assert.equal(/uploadKey|aaaaaaaa/.test(JSON.stringify(proof.data)),false);
const cart={schema:'saber-cart-v1',currency:'ARS',paymentMode:'FULL',displayTotal:1,items:[{type:'product',code:'SKU-1',qty:2,displayUnitPrice:1},{type:'print',code:'POLAROID_A4',qty:1,proof_token:proof.data.proof_token}]};
const result=await customer('cart-order',cart);assert.equal(result.status,201);assert.equal(result.data.total_ars,13000);
assert.equal((await customer('cart-order',cart)).data.order_id,result.data.order_id);
assert.equal((await customer('cart-order',{...cart,items:[cart.items[0]]})).status,409);
assert.equal((await admin('/admin/api/orders')).data.orders.length,0);
assert.equal((await customer('pay',{order_id:crypto.randomUUID()})).status,403);
const attempts=await Promise.all([customer('pay',{order_id:result.data.order_id}),customer('pay',{order_id:result.data.order_id})]);
assert.ok(attempts.some(x=>x.status===200));assert.ok(attempts.every(x=>[200,409].includes(x.status)));assert.equal(posts,1);
assert.equal((await customer('pay',{order_id:result.data.order_id})).data.reused,true);assert.equal(posts,1);
const order=sqlite.prepare('SELECT * FROM orders WHERE id=?').get(result.data.order_id);
const payment={id:100,status:'approved',live_mode:false,currency_id:'ARS',collector_id:123,transaction_amount:13000,external_reference:order.id,order:{id:200}};
payments.set('100',{...payment,transaction_amount:1});assert.equal((await admin('/demo/reconcile',{payment_id:'100'})).data.registered,false);
payments.set('100',{...payment,collector_id:999});assert.equal((await admin('/demo/reconcile',{payment_id:'100'})).data.registered,false);
payments.set('100',{...payment,status:'pending'});assert.equal((await admin('/demo/reconcile',{payment_id:'100'})).data.registered,false);
// Con cuentas de test, live_mode puede ser true: exigir confirmación de test_user desde la API.
payment.live_mode=true;sellerIsTest=false;payments.set('100',payment);
assert.equal((await admin('/demo/reconcile',{payment_id:'100'})).data.reason,'test_seller_unverified');
assert.equal((await admin('/admin/api/orders')).data.orders.length,0);
sellerIsTest=true;
assert.equal((await admin('/demo/payment-check',{payment_id:'100'})).data.checks.paymentEnvironmentAllowed,true);

async function webhook(valid=true,age=0){const ts=String(Math.floor(Date.now()/1000)-age),requestId='request-1';const sig=createHmac('sha256',env.MP_WEBHOOK_SECRET).update('id:100;request-id:'+requestId+';ts:'+ts+';').digest('hex');
 return ctx.worker.fetch(new Request('https://worker.test/webhooks/mercadopago?data.id=100&type=payment',{method:'POST',headers:{'x-signature':'ts='+ts+',v1='+(valid?sig:'0'.repeat(64)),'x-request-id':requestId,'Content-Type':'application/json'},body:'{"type":"payment"}'}),env)}
assert.equal((await webhook(false)).status,401);assert.equal((await admin('/admin/api/orders')).data.orders.length,0);
assert.equal((await webhook(true,3600)).status,401);
// Recuperación si no llegó el webhook: conciliación consulta el pago y registra el mismo pedido.
const sync=await admin('/demo/sync-pending',{});assert.equal(sync.status,200);assert.equal(sync.data.registered,1);
assert.equal((await webhook()).status,200);assert.equal((await webhook()).status,200);
assert.equal((await customer('status')).data.state,'paid');
const detail=await admin('/admin/api/order?id='+order.id);assert.equal(detail.data.items.length,2);
assert.deepEqual(JSON.parse(detail.data.items[1].file_references_json),[proofInput.reference]);
assert.equal(/uploadKey|gateway-only|admin-only|cf-secret/.test(JSON.stringify(detail.data)),false);
assert.equal((await customer('pay',{order_id:order.id})).status,409);
const unauthorized=await ctx.worker.fetch(new Request('https://worker.test/admin/api/orders'),env);assert.equal(unauthorized.status,401);
payments.set('100',{...payment,transaction_amount_refunded:500});
assert.equal((await webhook()).status,200);assert.equal((await admin('/admin/api/orders')).data.orders.length,0);
assert.equal((await customer('status')).data.state,'review');assert.equal((await admin('/admin/api/order?id='+order.id)).status,404);
assert.equal((await customer('cart-order',cart)).status,409);
// Una recepción ya consumida no puede entrar en una orden distinta; el batch revierte TODO.
const other=crypto.randomUUID();sqlite.prepare('UPDATE polaroid_proofs SET client_order_id=?').run(other);
const previousCount=sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n;
assert.equal((await admin('/demo/cart-order',{...cart,client_order_id:other})).status,409);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,previousCount);
// Una cotización vencida nunca genera una preferencia adicional.
sqlite.prepare("UPDATE orders SET status='awaiting_payment',created_at=datetime('now','-2 days') WHERE id=?").run(order.id);
assert.equal((await admin('/demo/checkout',{order_id:order.id})).status,409);assert.equal(posts,1);
// Bloqueo por defecto, por rate limit y por vencimiento de sesión.
const oldEnabled=env.CHECKOUT_ENABLED;env.CHECKOUT_ENABLED='';assert.equal((await customer('status')).status,503);env.CHECKOUT_ENABLED=oldEnabled;
env.CHECKOUT_RATE_LIMIT.limit=async()=>({success:false});assert.equal((await customer('status')).status,429);env.CHECKOUT_RATE_LIMIT.limit=async()=>({success:true});
sqlite.exec("UPDATE checkout_sessions SET created_at=datetime('now','-2 days')");assert.equal((await customer('status')).status,401);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
// Respuesta perdida: recupera preferencia por referencia, sin otro POST de creación.
const uncertain=crypto.randomUUID();
sqlite.prepare('INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)').run(uncertain,'Respuesta perdida',13000,13000);
dropResponse=true;assert.equal((await admin('/demo/checkout',{order_id:uncertain})).status,502);
const createdBefore=posts;const recovered=await admin('/demo/checkout',{order_id:uncertain});
assert.equal(recovered.status,200);assert.equal(recovered.data.reused,true);assert.equal(posts,createdBefore);
console.log('PASS integral: proxy → sesión Turnstile → recepción → carrito $13.000 → preferencia única → webhook HMAC → panel privado → devolución; SQL real, aislamiento y rollback.');
sqlite.close();
