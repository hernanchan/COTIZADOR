import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pagoUnicoDeOrdenComerciante,pagoUnicoDeBusqueda,rescatarPagosMPLiveCentral,conciliarPendientesMPLiveAutomatico}
 from './central-mp-live-rescate.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const ID='123e4567-e89b-42d3-a456-426614174000';
const PREF='86264123-72c1091a-53bf-4c46-8a36-733ec89782b2';
const PAY='188888888888';
const MO='1234567890';
const SELLER='123456789';
const mockOrder={id:ID,status:'awaiting_payment',payment_id:null,preference_id:PREF,
 amount_ars:100,deposit_ars:100,review_state:null};
const envBase={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:GO,CENTRAL_LIVE_BRIDGE_ENABLED:GO,
 CENTRAL_LIVE_ORDER_GATE:GO,CENTRAL_LIVE_POSTPAY_GATE:GO,
 MP_LIVE_ACCESS_TOKEN:'APP_USR_'+''.padEnd(32,'x'),
 MP_LIVE_WEBHOOK_SECRET:''.padEnd(32,'s'),
 MP_LIVE_SELLER_ID:SELLER
};
const req=()=>new Request('https://pagos.libreriasaber.com.ar/internal/central/live/staff-reconcile',{method:'POST'});
const readSigned=async()=>({payload:{schema:'saber-central-live-staff-reconcile-v1',
 purpose:'revisar-cobros-pendientes'}});
const response=v=>Response.json(v);
test('rechazar endpoint sin ambiente productivo o sin firma interna',async()=>{
 let r=await rescatarPagosMPLiveCentral(req(),{...envBase,DB:{prepare(){},batch(){}}},
  {readSigned});
 assert.equal(r.status,503);
 const env={...envBase,DB:{prepare(){return{}},batch(){}}};
 r=await rescatarPagosMPLiveCentral(req(),env,{readSigned:async()=>({error:'firma',status:401})});
 assert.equal(r.status,401);
});
test('selector rechaza ambiguedad, pago inexistente y preferencias ajenas',()=>{
 const merchant={id:MO,preference_id:PREF,external_reference:ID,
   payments:[{id:PAY,status:'approved'}]};
 assert.deepEqual(pagoUnicoDeOrdenComerciante({elements:[merchant]},mockOrder),
  {merchantId:MO,paymentId:PAY});
 assert.equal(pagoUnicoDeOrdenComerciante({elements:[merchant,merchant]},mockOrder),null);
 assert.equal(pagoUnicoDeOrdenComerciante({elements:[{...merchant,preference_id:'otra'}]},mockOrder),null);
 assert.equal(pagoUnicoDeOrdenComerciante({elements:[{...merchant,payments:[{id:PAY,status:'pending'}]}]},mockOrder),null);
 assert.equal(pagoUnicoDeOrdenComerciante({elements:[{...merchant,payments:[{id:PAY,status:'approved'},
  {id:'177777777777',status:'approved'}]}]},mockOrder),null);
});
test('búsqueda oficial MP por referencia detecta un solo pago aprobado y rechaza ambiguos',()=>{
 const p={id:PAY,status:'approved',external_reference:ID,order:{id:MO}};
 assert.deepEqual(pagoUnicoDeBusqueda({results:[p]},mockOrder),{paymentId:PAY,merchantId:MO});
 assert.equal(pagoUnicoDeBusqueda({results:[p,p]},mockOrder),null);
 assert.equal(pagoUnicoDeBusqueda({results:[{...p,external_reference:'otra'}]},mockOrder),null);
 assert.equal(pagoUnicoDeBusqueda({results:[{...p,status:'rejected'}]},mockOrder),null);
 assert.equal(pagoUnicoDeBusqueda({results:[{...p,order:null}]},mockOrder),null);
});
test('solo pagos oficialmente verificados se escriben una vez, sin crear cargos',async()=>{
 const logs=[];let batchCount=0;
 const db={
  prepare(sql){
   logs.push(sql);
   const q={bind(...args){this.args=args;return this},
    async first(){return null},async all(){return{results:[mockOrder]}}};
   return q;
  },
  async batch(statements){batchCount++;assert.equal(statements.length,2);
   return [{meta:{changes:1}},{meta:{changes:1}}];}
 };
 const seller={id:Number(SELLER),test_user:false};
 const payment={id:Number(PAY),order:{id:Number(MO)},collector_id:Number(SELLER),
  live_mode:true,status:'approved',currency_id:'ARS',transaction_amount:100,
  transaction_amount_refunded:0,external_reference:ID,preference_id:PREF};
 const merchant={id:Number(MO),preference_id:PREF,external_reference:ID,
  payments:[{id:Number(PAY),status:'approved'}]};
 const fakeFetch=async(url,options)=>{
  assert.equal(options.method,'GET','PROHIBIDO_MODIFICAR_MERCADO_PAGO');
  assert.match(options.headers.Authorization,/^Bearer APP_USR_/);
  const path=new URL(url).pathname;
  if(path==='/users/me')return response(seller);
  if(path==='/v1/payments/search'){
   assert.equal(new URL(url).searchParams.get('external_reference'),ID);
   return response({results:[payment]});
  }
  if(path==='/merchant_orders/search')return response({elements:[merchant]});
  if(path==='/merchant_orders/'+MO)return response(merchant);
  if(path==='/v1/payments/'+PAY)return response(payment);
  throw Error('UNEXPECTED_URL');
 };
 const r=await rescatarPagosMPLiveCentral(req(),{...envBase,DB:db},
  {readSigned,fetcher:fakeFetch});
 assert.equal(r.status,200);
 const v=await r.json();
 assert.equal(v.ok,true);
 assert.equal(v.revisados,1);
 assert.equal(v.recuperados,1);
 assert.equal(batchCount,1);
 assert.ok(logs.some(s=>s.includes("status='awaiting_payment'")));
 assert.ok(logs.some(s=>s.includes("payment_reviews")));
});
test('si el importe no coincide NO se acredita',async()=>{
 let wrote=false;
 const env={...envBase,DB:{
  prepare(sql){return{bind(){return this},async first(){return null},
    async all(){return{results:[mockOrder]}}}},
  async batch(){wrote=true;return[]}
 }};
 const seller={id:Number(SELLER),test_user:false};
 const payment={id:Number(PAY),order:{id:Number(MO)},collector_id:Number(SELLER),
  live_mode:true,status:'approved',currency_id:'ARS',transaction_amount:200,
  transaction_amount_refunded:0,external_reference:ID};
 const merchant={id:Number(MO),preference_id:PREF,external_reference:ID,
  payments:[{id:Number(PAY),status:'approved'}]};
 const fetcher=async url=>{
  const path=new URL(url).pathname;
  return response(path==='/users/me'?seller:path==='/v1/payments/search'?
   {results:[payment]}:path==='/merchant_orders/search'?
   {elements:[merchant]}:path==='/merchant_orders/'+MO?merchant:payment);
 };
 const r=await rescatarPagosMPLiveCentral(req(),env,{readSigned,fetcher});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.recuperados,0);
 assert.equal(data.enRevision,1);
 assert.equal(wrote,false);
});

test('cron LIVE llama conciliación automáticamente y nunca ejecuta sincronización Sandbox en producción',async()=>{
 const worker=await readFile(new URL('./worker.js',import.meta.url),'utf8');
 assert.match(worker,/SABER_ENTORNO==='produccion'&&env\?\.CENTRAL_DB_ENV==='produccion'/);
 assert.match(worker,/conciliarPendientesMPLiveAutomatico\(env\)/);
 assert.match(worker,/else\{\s*ctx\.waitUntil\(runScheduledReconciliation/);
});
test('automático no requiere intervención humana y no consulta MP si no hay órdenes pendientes',async()=>{
 let calls=0;
 const fakeDB={prepare(sql){
  assert.match(sql,/SELECT o\.id,o\.status/);
  return {all:async()=>({results:[]})};
 },batch(){throw Error('NO_DEBE_ESCRIBIR')}};
 const r=await conciliarPendientesMPLiveAutomatico({...envBase,DB:fakeDB},{
  fetcher:()=>{calls++;throw Error('SIN_ORDENES')}});
 assert.deepEqual(r,{ok:true,revisados:0,recuperados:0,pendientes:0,enRevision:0,errores:0});
 assert.equal(calls,0);
});
