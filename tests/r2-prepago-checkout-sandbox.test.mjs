import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {checkoutR2PrepaidSandboxCentral}
 from '../integraciones/mercadopago/pruebas/r2-prepago-checkout-sandbox-central.mjs';
import {checkoutR2PrepaidSandboxDocumentos}
 from '../integraciones/autocotizador/recepcion/r2-prepago-checkout-documentos.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const UUID='12345678-1234-4123-8123-123456789abc';
const SECRET='clave-de-prueba-HMAC-reconocida-por-Central-20261107';
const nowDate=Date.UTC(2026,10,7,16,20,0);
const body={schema:'saber-central-r2-prepaid-checkout-v1',
 action:'start',webOrderId:WEB,commercialOrderId:UUID};
function fake({withIntent=true,amount=15000,status='awaiting_payment',rev='verified',
 transfer=false}={}){
 const queries=[],orders=[];
 const row=withIntent?{
  web_order_id:WEB,amount_ars:15000,state:'awaiting_upload_after_payment',
  created_at:'2026-11-07 16:18:00',id:UUID,
  order_total:amount,deposit_ars:amount,status,
  paid_at:status==='paid'?'2026-11-07 16:19:00':null,
  payment_id:status==='paid'?'123456':null,preference_id:status==='paid'?'ABC123':null,
  order_created_at:'2026-11-07 16:18:00'
 }:null;
 const DB={prepare(sql){
  const q={bind(...args){this.args=args;return this;},
   async first(){
    queries.push({sql,args:this.args||[]});
    if(sql.includes('FROM central_r2_prepaid_intents'))return row;
    if(sql.includes("sqlite_master"))return transfer?{name:'transfer_requests'}:null;
    if(sql.includes('FROM transfer_requests'))return transfer?{order_id:UUID}:null;
    if(sql.includes('SELECT status,paid_at FROM orders'))
     return {status,paid_at:row?.paid_at};
    if(sql.includes('FROM payment_reviews'))return {state:rev};
    throw Error('unexpected query: '+sql);
   }};
  return q;
 }};
 const env={CENTRAL_R2_PREPAY_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DEMO_ADMIN_KEY:'test-only-admin-key-123456789123456789',
  DB};
 let dispatches=0;
 const dispatch=async req=>{
  dispatches++;
  assert.equal(new URL(req.url).pathname,'/demo/checkout');
  assert.equal(req.headers.get('Authorization'),'Bearer '+env.DEMO_ADMIN_KEY);
  assert.deepEqual(await req.json(),{order_id:UUID});
  return Response.json({order_id:UUID,
   checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=ficticio'});
 };
 const readSigned=async r=>({payload:await r.json()});
 const call=(p=body,extra={})=>checkoutR2PrepaidSandboxCentral(new Request(
  'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/r2-prepay-checkout',
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}
 ),env,{readSigned,dispatch,now:()=>nowDate,...extra});
 return {row,env,queries,call,get dispatches(){return dispatches}};
}
test('sandbox: sólo orden prepaga R2 exacta crea preferencia de pruebas',async()=>{
 const f=fake();
 const r=await f.call();
 const x=await r.json();
 assert.equal(r.status,200,JSON.stringify(x));
 assert.equal(f.dispatches,1);
 assert.equal(x.amountArs,15000);
 assert.equal(x.filesUploaded,false);
 assert.equal(x.uploadAuthorized,false);
 assert.equal(x.productionAuthorized,false);
 assert.match(x.checkoutUrl,/mercadopago/);
});
test('sin intención/importe exacto/estado válido NO llama a MP',async()=>{
 for(const opt of [
  {withIntent:false},{amount:16000},{status:'paid'}, {transfer:true}
 ]){
  const f=fake(opt),r=await f.call();
  assert.equal(r.status,409);
  assert.equal(f.dispatches,0);
 }
});
test('sólo estado D1 pago verificado permite mostrar subida autorizable, sin R2',async()=>{
 for(const [rev,expected] of [['verified','pagado_esperando_archivo'],
  ['revoked','revocado'],['other','pendiente']]){
  const f=fake({status:'paid',rev});
  const r=await f.call({...body,action:'status'});
  const x=await r.json();
  assert.equal(r.status,200,JSON.stringify(x));
  assert.equal(x.estado,expected);
  assert.equal(x.uploadAuthorized,rev==='verified');
  assert.equal(x.filesUploaded,false);
  assert.equal(f.dispatches,0);
 }
});
test('switch apagado no consulta D1 ni abre cobro',async()=>{
 const f=fake();
 f.env.CENTRAL_R2_PREPAY_CHECKOUT_ENABLED='OFF';
 const r=await f.call();
 assert.equal(r.status,503);
 assert.equal(f.queries.length,0);
 assert.equal(f.dispatches,0);
});
test('Documentos: vínculo firmado a Central y URL test seller segura',async()=>{
 const env={DOCS_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const service={fetch:async req=>{
  assert.equal(new URL(req.url).pathname,'/internal/central/r2-prepay-checkout');
  const raw=await req.text(),p=JSON.parse(raw);
  assert.deepEqual(p,body);
  const ts=req.headers.get('x-saber-ts'),rid=req.headers.get('x-saber-request-id');
  const hmac=createHmac('sha256',SECRET).update(ts+'\n'+rid+'\n'+raw).digest('hex');
  assert.equal(hmac,req.headers.get('x-saber-signature'));
  return Response.json({ok:true,commercialOrderId:UUID,webOrderId:WEB,
   amountArs:15000,estado:'pendiente',uploadAuthorized:false,
   filesUploaded:false,productionAuthorized:false,
   checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test'});
 }};
 const make=(obj=body)=>new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-r2-prepago-checkout',{
  method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev',
   'Content-Type':'application/json'},body:JSON.stringify({
    action:obj.action,webOrderId:obj.webOrderId,commercialOrderId:obj.commercialOrderId})
 });
 const r=await checkoutR2PrepaidSandboxDocumentos(make(),env,{
  authorized:true,service,now:()=>1794070000,
  nonce:()=>UUID,subtle:webcrypto.subtle
 });
 const x=await r.json();
 assert.equal(r.status,200,JSON.stringify(x));
 assert.equal(x.uploadAuthorized,false);
 assert.equal(x.productionAuthorized,false);
 assert.match(x.checkoutUrl,/mercadopago\.com\.ar/);
});
test('Documentos: sesión ausente o switch apagado NO consulta Central',async()=>{
 let calls=0;
 const service={fetch:async()=>{calls++;throw Error('should not call')}};
 const req=new Request('https://example.test',{method:'POST',headers:{
  'Content-Type':'application/json',Origin:'https://example.test'
 },body:'{}'});
 let r=await checkoutR2PrepaidSandboxDocumentos(req,{},{
  authorized:false,service});
 assert.equal(r.status,401);
 r=await checkoutR2PrepaidSandboxDocumentos(new Request('https://example.test',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.test'},
  body:'{}'
 }),{DOCS_R2_PREPAY_DRAFT_ENABLED:'OFF'},{authorized:true,service});
 assert.equal(r.status,503);
 assert.equal(calls,0);
});
