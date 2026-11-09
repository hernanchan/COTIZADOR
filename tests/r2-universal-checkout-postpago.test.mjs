import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import precios from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {verificarPedidoUniversalCobrable,checkoutUniversalSandboxCentral,
 consultarPagoUniversalR2} from '../integraciones/mercadopago/pruebas/r2-universal-checkout-central.mjs';
import {pagoSandboxUniversalDocumentos} from '../integraciones/autocotizador/recepcion/r2-universal-checkout-documentos.mjs';
const MiB=1048576;
const webOrderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const orderId='12345678-1234-4123-8123-123456789abc';
const secret='clave-privada-HMAC-saber-ensayo-20261109';
const base={nombre:'A4.pdf',paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:2,modo:'bn',caras:'double',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'};
async function fixture({paid=false,tampered=false}={}){
 const files=[base,{...base,nombre:'A1.pdf',copias:1,
  paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]}];
 const manifest=[{fileId:'small',nombre:'A4.pdf',bytes:2*MiB,sha256:'1'.repeat(64)},
  {fileId:'huge',nombre:'A1.pdf',bytes:100*MiB,sha256:'2'.repeat(64)}];
 const ficha=fichaPrearchivoUniversal({webOrderId,archivos:files,manifiestos:manifest,
  tarifario:{source:'private-d1-approved-only',revision:8,
   prices:{...precios,priceVersion:'d1-approved-revision-8'}}});
 const quoteHash=Buffer.from(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(ficha)))).toString('hex');
 const f=ficha.archivos,nR2=f.filter(v=>v.transporte==='r2').length;
 const detail=JSON.stringify({schema:'saber-r2-universal-commercial-v1',
  webOrderId,quoteHash,priceRevision:ficha.priceRevision,
  fileCount:f.length,r2Count:nR2,tusCount:f.length-nR2,
  armadosCount:ficha.armados.length,prepressPending:true,originalsReceived:false});
 const state={paid,paymentId:'1234567890',review:paid?'verified':null};
 const env={
  CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DEMO_ADMIN_KEY:'operador-demo-solo-prueba'
 };
 const db={prepare(sql){return {
  args:[],bind(...v){this.args=v;return this},
  async all(){
   if(sql.includes('FROM order_items')){
    return {results:[{sku:'PDF_UNIVERSAL_PREPAID',quantity:1,
     unit_price_ars:ficha.totalArs,line_total_ars:ficha.totalArs,
     detail_json:tampered?'{}':detail,file_references_json:JSON.stringify(f.map(x=>x.fileId))}]};
   }
   if(sql.includes('FROM central_r2_universal_files'))
    return {results:f.map((x,i)=>({file_id:x.fileId,ordinal:i,
     name:x.nombre,sha256:x.sha256,bytes:x.bytes,transport:x.transporte,
     service:x.destino,work_json:JSON.stringify(x),received:0}))};
   throw Error('Unexpected all '+sql);
  },
  async first(){
   if(sql.includes('FROM central_r2_universal_order_links')&&!sql.includes('JOIN'))
    return {commercial_order_id:orderId};
   if(sql.includes('FROM central_r2_universal_order_links l'))
    return {web_order_id:webOrderId,quote_hash:quoteHash,
     amount_ars:ficha.totalArs,draft_id:orderId,price_revision:ficha.priceRevision,
     total_ars:ficha.totalArs,file_count:f.length,armados_json:JSON.stringify(ficha.armados),
     state:'draft_not_payable',id:orderId,status:state.paid?'paid':'awaiting_payment',
     deposit_ars:ficha.totalArs,order_total:ficha.totalArs,
     created_at:'2026-11-09 19:00:00',paid_at:state.paid?'2026-11-09 19:10:00':null,
     payment_id:state.paid?state.paymentId:null,preference_id:state.paid?'pref-123':null};
   if(sql.includes('SELECT status,paid_at,payment_id,preference_id'))
    return {status:state.paid?'paid':'awaiting_payment',paid_at:state.paid?'2026-11-09 19:10:00':null,
     payment_id:state.paid?state.paymentId:null,
     preference_id:state.paid?'pref-123':null,
     amount_ars:ficha.totalArs,deposit_ars:ficha.totalArs};
   if(sql.includes('SELECT state FROM payment_reviews'))
    return state.review?{state:state.review}:null;
   if(sql.includes("name='transfer_requests'"))return null;
   throw Error('Unexpected first '+sql);
  }}
 }};
 env.DB=db;
 const signed=r=>r.json().then(payload=>({payload}));
 return {env,ficha,state,signed,quoteHash};
}
const request=(endpoint,p)=>new Request('https://central.invalid/'+endpoint,{
 method:'POST',body:JSON.stringify(p)});
test('elegibilidad desde D1 comprueba hash, importes, renglón y hojas de cada PDF',async()=>{
 const {env,ficha}=await fixture();
 const r=await verificarPedidoUniversalCobrable(env,orderId,{webOrderId,
  subtle:webcrypto.subtle});
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.amountArs,ficha.totalArs);
 assert.equal(r.works.length,2);
 assert.equal(r.works[0].transporte,'tus');
 assert.equal(r.works[1].transporte,'r2');
 const forged=await fixture({tampered:true});
 assert.equal((await verificarPedidoUniversalCobrable(forged.env,orderId)).ok,false);
 env.CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED='OFF';
 assert.equal((await verificarPedidoUniversalCobrable(env,orderId)).ok,false);
});
test('checkout genera una única preferencia Sandbox sólo para orden D1 verificada',async()=>{
 const {env,signed,ficha}=await fixture();
 let count=0;
 const p={schema:'saber-central-r2-universal-checkout-v1',
  action:'start',webOrderId,commercialOrderId:orderId};
 const x=await checkoutUniversalSandboxCentral(request('internal/central/r2-universal-checkout',p),env,{
  readSigned:signed,now:()=>Date.parse('2026-11-09T20:00:00Z'),subtle:webcrypto.subtle,
  dispatch:async req=>{
   assert.equal(req.headers.get('Authorization'),'Bearer '+env.DEMO_ADMIN_KEY);
   assert.equal((await req.json()).order_id,orderId);
   count++;
   return Response.json({order_id:orderId,
    checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test'});
  }
 });
 assert.equal(x.status,200,JSON.stringify(await x.clone().json()));
 const body=await x.json();
 assert.equal(body.amountArs,ficha.totalArs);
 assert.equal(body.uploadAuthorized,false);
 assert.equal(count,1);
 const altered=await checkoutUniversalSandboxCentral(request('internal/central/r2-universal-checkout',{
  ...p,commercialOrderId:'12345678-1234-4123-8123-111111111111'}),env,{
  readSigned:signed,now:()=>Date.parse('2026-11-09T20:00:00Z'),
  subtle:webcrypto.subtle,dispatch:()=>{throw Error('should not call');}
 });
 assert.equal(altered.status,409);
 assert.equal(count,1);
});
test('estado pago viene de reconciliación MP; sin pago no habilita R2',async()=>{
 const {env,signed,state}=await fixture();
 const p={schema:'saber-central-r2-universal-checkout-v1',
  action:'status',webOrderId,commercialOrderId:orderId};
 const pending=await checkoutUniversalSandboxCentral(request('internal/central/r2-universal-checkout',p),env,{
  readSigned:signed,now:()=>Date.parse('2026-11-09T20:00:00Z')});
 assert.equal((await pending.json()).uploadAuthorized,false);
 state.paid=true;state.review='verified';
 const paid=await checkoutUniversalSandboxCentral(request('internal/central/r2-universal-checkout',p),env,{
  readSigned:signed,now:()=>Date.parse('2026-11-09T20:00:00Z')});
 const val=await paid.json();
 assert.equal(val.estado,'pagado_esperando_archivos');
 assert.equal(val.uploadAuthorized,true);
 assert.equal(val.pendingFiles,2);
 state.review='revoked';
 const revoked=await checkoutUniversalSandboxCentral(request('internal/central/r2-universal-checkout',p),env,{
  readSigned:signed,now:()=>Date.parse('2026-11-09T20:00:00Z')});
 assert.equal((await revoked.json()).uploadAuthorized,false);
});
test('pago por archivo R2 exacto: no permite PDF TUS, hash distinto, ni venta no conciliada',async()=>{
 const {env,signed,state}=await fixture({paid:false});
 const q={schema:'saber-central-r2-universal-payment-lookup-v1',
  orderId:webOrderId,fileId:'huge',sha256:'2'.repeat(64),bytes:100*MiB};
 const go=p=>consultarPagoUniversalR2(request('internal/central/r2-universal-payment-lookup',p),
  env,{readSigned:signed,now:()=>1794250000,subtle:webcrypto.subtle});
 assert.equal((await go(q)).status,402);
 state.paid=true;state.review='verified';
 const ok=await go(q);const body=await ok.json();
 assert.equal(ok.status,200,JSON.stringify(body));
 assert.equal(body.paymentAuthorizedForR2,true);
 assert.equal(body.receipt.orderId,webOrderId);
 assert.equal(body.receipt.sha256,q.sha256);
 assert.equal(body.receipt.amountArs>0,true);
 assert.equal((await go({...q,sha256:'9'.repeat(64)})).status,409);
 assert.equal((await go({...q,fileId:'small',sha256:'1'.repeat(64),bytes:2*MiB})).status,422);
 state.review='revoked';
 assert.equal((await go(q)).status,402);
});
test('bridge comprador HMAC no acepta precios o sesión ajena',async()=>{
 const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const {ficha}=await fixture();let calls=0;
 const env={DOCS_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:secret,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const svc={fetch:async req=>{
  calls++;const raw=await req.text();
  assert.equal(new URL(req.url).pathname,'/internal/central/r2-universal-checkout');
  const mac=createHmac('sha256',secret).update(
   req.headers.get('x-saber-ts')+'\n'+req.headers.get('x-saber-request-id')+
   '\n'+raw).digest('hex');
  assert.equal(req.headers.get('x-saber-signature'),mac);
  return Response.json({ok:true,webOrderId,commercialOrderId:orderId,
   amountArs:ficha.totalArs,fileCount:2,estado:'pendiente',
   uploadAuthorized:false,productionAuthorized:false,
   checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?test=true'});
 }};
 const make=p=>new Request(host+'/prueba-v2/api/ensayo-r2-checkout-universal',{
  method:'POST',headers:{Origin:host,'Content-Type':'application/json'},
  body:JSON.stringify(p)});
 const p={action:'start',webOrderId,commercialOrderId:orderId};
 const opts={authorized:true,service:svc,subtle:webcrypto.subtle,
  now:()=>1794250000,nonce:()=>orderId};
 const result=await pagoSandboxUniversalDocumentos(make(p),env,opts);
 assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 assert.equal((await result.json()).amountArs,ficha.totalArs);
 const forged=await pagoSandboxUniversalDocumentos(make({...p,totalArs:1}),env,opts);
 assert.equal(forged.status,422);
 const notMine=await pagoSandboxUniversalDocumentos(make(p),env,
  {...opts,authorized:false});
 assert.equal(notMine.status,401);
 assert.equal(calls,1);
});
