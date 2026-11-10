import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {checkoutMPLiveCentral,conciliarWebhookMPLive,estadoMPLiveCentral}
 from './mercadopago-live-central.mjs';
const ORDER='123e4567-e89b-42d3-a456-426614174000';
const WEB='WEB-ENSAYO-'+'A'.repeat(32),SELLER='123456789';
const envBase={
 SABER_ENTORNO:'produccion',MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
 CENTRAL_DB_ENV:'produccion',MP_LIVE_ACCESS_TOKEN:'APP_USR-'+ 'x'.repeat(64),
 MP_TEST_ACCESS_TOKEN:'TEST-'+ 'y'.repeat(60),MP_LIVE_SELLER_ID:SELLER,
 MP_TEST_SELLER_ID:'987654321',MP_LIVE_WEBHOOK_SECRET:'w'.repeat(48),
 CENTRAL_BRIDGE_KEY:'b'.repeat(48),
 MP_LIVE_WEBHOOK_URL:'https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live',
 MP_LIVE_RETURN_URL:'https://libreriasaber.com.ar/pedido/estado'
};
const order=()=>({
 id:ORDER,description:'Libreria Saber',amount_ars:4400,deposit_ars:4400,
 status:'awaiting_payment',preference_id:null,payment_id:null,
 created_at:new Date(Date.now()-60000).toISOString().slice(0,19).replace('T',' ')
});
const response=x=>({ok:true,status:200,json:async()=>x});
function fixture(){
 const o=order(),review={state:null};let attempts=0,posts=0;
 const lock=new Set(),attemptSet=new Set();
 const db={
  prepare(sql){let args=[];return {
    bind(...next){args=next;return this},
    async first(){
     if(sql.includes('FROM orders WHERE id=?'))return args[0]===ORDER?{...o}:null;
     if(sql.includes('FROM central_r2_universal_order_links'))
      return args[0]===WEB&&args[1]===ORDER?{file_count:1}:null;
     if(sql.includes('FROM central_document_manifests'))return null;
     if(sql.includes('sqlite_master'))return null;
     if(sql.includes('FROM orders o LEFT JOIN payment_reviews'))
      return args[0]===ORDER?{...o,review_state:review.state}:null;
     if(sql.includes('FROM orders WHERE payment_id=? AND id<>?'))return null;
     return null
    },
    async all(){
     if(sql.includes('FROM order_items'))return {results:[{line_total_ars:4400,quantity:1,unit_price_ars:4400}]};
     if(sql.includes('FROM central_r2_universal_files'))return {results:[{file_id:'pdf_0_abcdef',received:0}]};
     return {results:[]};
    },
    async run(){
     if(sql.startsWith('INSERT INTO live_checkout_locks')){if(lock.has(args[0]))return {meta:{changes:0}};lock.add(args[0]);return {meta:{changes:1}}}
     if(sql.startsWith('DELETE FROM live_checkout_locks')){lock.delete(args[0]);return {meta:{changes:1}}}
     if(sql.startsWith('INSERT OR IGNORE INTO live_checkout_attempts')){
      if(attemptSet.has(args[0]))return{meta:{changes:0}};
      attemptSet.add(args[0]);return{meta:{changes:1}};
     }
     if(sql.includes('UPDATE orders SET preference_id=')){
      if(o.preference_id||o.status!=='awaiting_payment')return{meta:{changes:0}};
      o.preference_id=args[0];return{meta:{changes:1}};
     }
     if(sql.includes("UPDATE orders SET status='paid'")){
      if(o.status!=='awaiting_payment'||o.preference_id!==args[2])return{meta:{changes:0}};
      o.status='paid';o.payment_id=args[0];return{meta:{changes:1}};
     }
     if(sql.includes("INSERT INTO payment_reviews")){
      if(sql.includes("SELECT id,'verified'")&&
         (o.status!=='paid'||String(o.payment_id)!==String(args[1])))
       return {meta:{changes:0}};
      review.state=review.state==='revoked'?'revoked':
       sql.includes("VALUES(?,'revoked'")?'revoked':'verified';
      return{meta:{changes:1}};
     }
     return {meta:{changes:1}};
    }
   }},
  async batch(statements){let rows=[];for(const s of statements)rows.push(await s.run());return rows}
 };
 const preference=id=>({id,external_reference:ORDER,collector_id:SELLER,
  items:[{currency_id:'ARS',quantity:1,unit_price:4400}],
  init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id='+id});
 const payment={id:123456,order:{id:567890},external_reference:ORDER,
  status:'approved',live_mode:true,currency_id:'ARS',transaction_amount:4400,
  transaction_amount_refunded:0,collector_id:SELLER};
 const merchant={id:567890,preference_id:'MP-LIVE-PREF-1',external_reference:ORDER,
  payments:[{id:123456,status:'approved'}]};
 const mpFetch=async (url,options={})=>{
  const path=new URL(url).pathname;
  if(path==='/users/me')return response({id:SELLER,tags:[]});
  if(path==='/checkout/preferences'&&options.method==='POST'){
   posts++;return response({id:'MP-LIVE-PREF-1'});
  }
  if(path.startsWith('/checkout/preferences/'))return response(preference(decodeURIComponent(path.split('/').at(-1))));
  if(path.startsWith('/v1/payments/'))return response(payment);
  if(path.startsWith('/merchant_orders/'))return response(merchant);
  throw Error('MP unexpected path '+path);
 };
 const env={...envBase,DB:db};
 const signed=async()=>({payload:{
  schema:'saber-mp-live-checkout-v1',
  commercialOrderId:ORDER,webOrderId:WEB
 }});
 return {env,db,o,payment,merchant,review,mpFetch,signed,
  get posts(){return posts}};
}
async function signedWebhook(secret=envBase.MP_LIVE_WEBHOOK_SECRET){
 const ts=String(Math.floor(Date.now()/1000)),rid='qa-live-hmac-12345',id='123456';
 const message='id:'+id+';request-id:'+rid+';ts:'+ts+';';
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hex=Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))).toString('hex');
 return new Request('https://pagos.libreriasaber.com.ar/webhooks/mercadopago-live?type=payment&data.id='+id,{
  method:'POST',headers:{'x-signature':'ts='+ts+',v1='+hex,'x-request-id':rid,'Content-Type':'application/json'},
  body:JSON.stringify({type:'payment',data:{id}})
 });
}
test('nunca consulta MP ni D1 con compuerta de produccion cerrada',async()=>{
 const f=fixture();let calls=0;
 const off={...f.env,MP_LIVE_GATE:'NO_GO'};
 const reply=await checkoutMPLiveCentral(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/checkout',{method:'POST'}),off,{
  readSigned:f.signed,fetcher:async()=>{calls++;throw Error('NO_MP')}
 });
 assert.equal(reply.status,503);assert.equal(calls,0);assert.equal(f.posts,0);
 const wh=await conciliarWebhookMPLive(await signedWebhook(),off,{
  fetcher:async()=>{calls++;throw Error('NO_MP')}
 });
 assert.equal(wh.status,503);assert.equal(calls,0);
});
test('checkout LIVE requiere HMAC de Central, orden asociada y vendedor real',async()=>{
 const f=fixture(),req=new Request('https://pagos.libreriasaber.com.ar/internal/central/live/checkout',{method:'POST'});
 assert.equal((await checkoutMPLiveCentral(req,f.env,{readSigned:async()=>({error:'bad',status:401}),fetcher:f.mpFetch})).status,401);
 assert.equal(f.posts,0);
 const mismatched=fixture();
 const bad={...mismatched.env,MP_LIVE_SELLER_ID:'98765'};
 const blocked=await checkoutMPLiveCentral(req,bad,{readSigned:mismatched.signed,fetcher:mismatched.mpFetch});
 assert.equal(blocked.status,503);assert.equal(mismatched.posts,0);
 const ok=await checkoutMPLiveCentral(req,f.env,{readSigned:f.signed,fetcher:f.mpFetch});
 assert.equal(ok.status,200);
 const data=await ok.json();
 assert.equal(data?.amountArs,4400);assert.equal(data?.fileCount,1);assert.equal(f.posts,1);
 assert.equal(f.o.preference_id,'MP-LIVE-PREF-1');
 const again=await checkoutMPLiveCentral(req,f.env,{readSigned:f.signed,fetcher:f.mpFetch});
 assert.equal(again.status,200);assert.equal((await again.json()).fileCount,1);assert.equal(f.posts,1,'un solo POST aunque repita el botón');
});
test('webhook LIVE no puede conciliar firma incorrecta, vendedor falso o monto distinto',async()=>{
 const f=fixture();f.o.preference_id='MP-LIVE-PREF-1';
 const bad=await signedWebhook('clave-incorrecta');
 assert.equal((await conciliarWebhookMPLive(bad,f.env,{fetcher:f.mpFetch})).status,401);
 assert.equal(f.o.status,'awaiting_payment');
 const mismatched={...f.payment,transaction_amount:4100};
 const wrong=async (url)=>String(url).includes('/v1/payments/')?response(mismatched):f.mpFetch(url);
 const c=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:wrong});
 assert.equal(c.status,200);
 assert.equal((await c.json()).registered,false);
 assert.equal(f.o.status,'awaiting_payment');
});
test('HMAC + MP pago/merchant/seller + D1 correctos marcan una sola vez',async()=>{
 const f=fixture();f.o.preference_id='MP-LIVE-PREF-1';
 const one=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:f.mpFetch});
 assert.equal(one.status,200);
 assert.equal((await one.json()).registered,true);
 assert.equal(f.o.status,'paid');assert.equal(f.o.payment_id,'123456');
 assert.equal(f.review.state,'verified');
 const twice=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:f.mpFetch});
 assert.equal(twice.status,200);assert.equal((await twice.json()).idempotent,true);
});

test('el token sandbox no se puede usar como token LIVE aunque el gate diga GO',async()=>{
 const f=fixture();
 const env={...f.env,MP_LIVE_ACCESS_TOKEN:f.env.MP_TEST_ACCESS_TOKEN};
 const r=await checkoutMPLiveCentral(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/checkout',{method:'POST'}),env,{
  readSigned:f.signed,fetcher:async()=>{throw Error('nunca pedir a MP')}
 });
 assert.equal(r.status,503);
});
test('vendedor test_user queda rechazado incluso con ID de seller coincidente',async()=>{
 const f=fixture(),req=new Request('https://pagos.libreriasaber.com.ar/internal/central/live/checkout',{method:'POST'});
 const fetcher=async (url,options)=>{
  if(String(url).endsWith('/users/me'))return response({id:SELLER,tags:['test_user']});
  return f.mpFetch(url,options);
 };
 const r=await checkoutMPLiveCentral(req,f.env,{readSigned:f.signed,fetcher});
 assert.equal(r.status,503);
 assert.equal(f.posts,0);
});
test('un webhook firmado con merchantOrder ajena no cambia D1',async()=>{
 const f=fixture();f.o.preference_id='MP-LIVE-PREF-1';
 const fetcher=async (url,options)=>{
  if(String(url).includes('/merchant_orders/'))return response({...f.merchant,external_reference:'otra-orden'});
  return f.mpFetch(url,options);
 };
 const r=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher});
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.registered,false);
 assert.equal(f.o.status,'awaiting_payment');
 assert.equal(f.review.state,null);
});
test('reembolso posterior revoca verificación y nunca vuelve a marcarla verificada',async()=>{
 const f=fixture();f.o.preference_id='MP-LIVE-PREF-1';
 let r=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:f.mpFetch});
 assert.equal((await r.json()).registered,true);
 const refunded={...f.payment,transaction_amount_refunded:4400,status:'refunded'};
 const fake=async (url,options)=>
   String(url).includes('/v1/payments/')?response(refunded):f.mpFetch(url,options);
 r=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:fake});
 assert.equal(r.status,200);assert.equal((await r.json()).reason,'pago_revocado');
 assert.equal(f.review.state,'revoked');
 r=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:f.mpFetch});
 assert.equal(r.status,200);assert.equal((await r.json()).registered,false);
 assert.equal(f.review.state,'revoked');
});

test('estado LIVE solo por HMAC y vínculo de orden; no autoriza carga por retorno del navegador',async()=>{
 const f=fixture();const req=new Request(
  'https://pagos.libreriasaber.com.ar/internal/central/live/status',{method:'POST'});
 const unsigned=await estadoMPLiveCentral(req,f.env,{readSigned:async()=>({error:'bad',status:401})});
 assert.equal(unsigned.status,401);
 const pending=await estadoMPLiveCentral(req,f.env,{
  readSigned:async()=>({payload:{schema:'saber-mp-live-status-v1',
   commercialOrderId:ORDER,webOrderId:WEB}})
 });
 assert.equal(pending.status,200);
 const p=await pending.json();
 assert.equal(p.estado,'pendiente');assert.equal(p.uploadAuthorized,false);
 assert.equal(p.fileCount,1);assert.equal(p.pendingFiles,1);
 assert.equal(p.amountArs,4400);
 // Haber recibido pago del servidor, pero sin revisión no basta.
 f.o.status='paid';f.o.payment_id='123456';f.o.paid_at='2026-11-10 10:20:00';
 f.o.preference_id='MP-LIVE-PREF-1';
 const unverified=await estadoMPLiveCentral(req,f.env,{
  readSigned:async()=>({payload:{schema:'saber-mp-live-status-v1',
   commercialOrderId:ORDER,webOrderId:WEB}})
 });
 assert.equal((await unverified.json()).uploadAuthorized,false);
 f.review.state='verified';
 const paid=await estadoMPLiveCentral(req,f.env,{
  readSigned:async()=>({payload:{schema:'saber-mp-live-status-v1',
   commercialOrderId:ORDER,webOrderId:WEB}})
 });
 const d=await paid.json();assert.equal(d.estado,'pagado_esperando_archivos');
 assert.equal(d.uploadAuthorized,true);assert.equal(d.productionAuthorized,false);
 f.review.state='revoked';
 const reversed=await estadoMPLiveCentral(req,f.env,{
  readSigned:async()=>({payload:{schema:'saber-mp-live-status-v1',
   commercialOrderId:ORDER,webOrderId:WEB}})
 });
 assert.equal((await reversed.json()).uploadAuthorized,false);
});
test('status LIVE exige pedido propio, firma y gate; sin fallback sandbox',async()=>{
 const f=fixture(),url='https://pagos.libreriasaber.com.ar/internal/central/live/status';
 const readSigned=async()=>({payload:{
  schema:'saber-mp-live-status-v1',webOrderId:WEB,commercialOrderId:ORDER}});
 const off=await estadoMPLiveCentral(new Request(url,{method:'POST'}),{...f.env,MP_LIVE_GATE:'NO_GO'},{readSigned});
 assert.equal(off.status,503);
 const bad=await estadoMPLiveCentral(new Request(url,{method:'POST'}),f.env,{
  readSigned:async()=>({payload:{schema:'saber-mp-live-status-v1',webOrderId:'WEB-ENSAYO-B'.padEnd(43,'B'),commercialOrderId:ORDER}})
 });
 assert.notEqual(bad.status,200);
 assert.equal(f.posts,0,'No se crea preferencia al consultar estado');
});

test('carrera D1 que cancela el pedido NO registra review verified',async()=>{
 const f=fixture();f.o.preference_id='MP-LIVE-PREF-1';
 const prepare=f.db.prepare.bind(f.db);
 f.db.prepare=function(sql){
  if(sql.startsWith("UPDATE orders SET status='paid'")){
   return {bind(){return this},async run(){
    f.o.status='cancelled';
    return {meta:{changes:0}};
   }};
  }
  return prepare(sql);
 };
 const r=await conciliarWebhookMPLive(await signedWebhook(),f.env,{fetcher:f.mpFetch});
 assert.equal(r.status,200);
 assert.equal((await r.json()).registered,false);
 assert.equal(f.review.state,null);
});
