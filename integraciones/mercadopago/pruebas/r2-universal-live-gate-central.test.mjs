import test from 'node:test';
import assert from 'node:assert/strict';
import {autorizarOriginalR2Live} from './r2-universal-live-gate-central.mjs';
const ON='GO_COMERCIAL_CONFIRMADO',WEB='WEB-ENSAYO-'+'A'.repeat(32);
const ORDER='123e4567-e89b-42d3-a456-426614174000';
const MIB=1048576;
const payload={schema:'saber-central-r2-universal-live-gate-v1',
 orderId:WEB,fileId:'pdf_0',name:'A1.pdf',sha256:'a'.repeat(64),
 bytes:60*MIB,pages:1};
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:ON,CENTRAL_LIVE_BRIDGE_ENABLED:ON,
 CENTRAL_LIVE_POSTPAY_GATE:ON,CENTRAL_LIVE_R2_GATE:ON,
 CENTRAL_LIVE_ORDER_GATE:ON,CENTRAL_LIVE_PRICING_GATE:ON};
const req=()=>new Request('https://pagos.libreriasaber.com.ar/internal/central/live/r2-gate',{
 method:'POST'});
function fake({verified=true,received=0}={}){
 let calls=[];
 const db={prepare(sql){calls.push(sql);
  return {bind(){return this},
   async first(){
    if(sql.includes('SELECT commercial_order_id'))return {commercial_order_id:ORDER};
    if(sql.includes('FROM central_r2_universal_order_links l'))return {
     web_order_id:WEB,quote_hash:'b'.repeat(64),amount_ars:18000,
     total_ars:18000,order_total:18000,deposit_ars:18000,
     id:ORDER,status:verified?'paid':'awaiting_payment',
     draft_id:ORDER,price_revision:'d1-approved-revision-1',file_count:1,
     armados_json:'[]',state:'draft_not_payable'
    };
    if(sql.includes('FROM orders WHERE id=?'))return {
     status:verified?'paid':'awaiting_payment',paid_at:verified?'2026-11-10':null,
     payment_id:verified?'44444':null,preference_id:verified?'pref':null,
     amount_ars:18000,deposit_ars:18000
    };
    if(sql.includes('FROM payment_reviews'))return {state:verified?'verified':'pending'};
    return null;
   },
   async all(){
    if(sql.includes('FROM order_items'))return {results:[{
     sku:'R2_UNIVERSAL_PDF_ORDER',quantity:1,unit_price_ars:18000,
     line_total_ars:18000,detail_json:'{}',file_references_json:'[]'
    }]};
    if(sql.includes('FROM central_r2_universal_files'))return {results:[]};
    return {results:[]};
   }
  };
 }};
 return {db,calls};
}
test('bloqueos LIVE no consultan D1 y no crean almacenamiento',async()=>{
 for(const patch of [{CENTRAL_LIVE_R2_GATE:'NO_GO'},
  {MP_LIVE_GATE:'NO_GO'}, {SABER_ENTORNO:'preparacion'},
  {CENTRAL_DB_ENV:'pruebas'}, {CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY'}]){
  let reads=0,sign=0;
  const r=await autorizarOriginalR2Live(req(),{...env,...patch,
   DB:{prepare(){reads++;throw Error('MUST_NOT_TOUCH_DB')}}},{
    readSigned:async()=>{sign++;return {payload}}});
  assert.equal(r.status,503);
  assert.equal(reads,0);assert.equal(sign,0);
 }
});
test('archivo grande incorrecto o firma no válida se rechaza antes de D1',async()=>{
 const {db,calls}=fake();
 const signed=async()=>({payload:{...payload,bytes:30*MIB}});
 const r=await autorizarOriginalR2Live(req(),{...env,DB:db},{readSigned:signed});
 assert.equal(r.status,422);assert.equal(calls.length,0);
 const wrong=await autorizarOriginalR2Live(req(),{...env,DB:db},{
  readSigned:async()=>({error:'Firma inválida',status:401})});
 assert.equal(wrong.status,401);assert.equal(calls.length,0);
});
test('sin vínculo de orden rechaza con cero autorizaciones',async()=>{
 const {db,calls}=fake();
 const old=db.prepare.bind(db);
 db.prepare=sql=>sql.includes('SELECT commercial_order_id')?
  {bind(){return this},first:async()=>null}:old(sql);
 const r=await autorizarOriginalR2Live(req(),{...env,DB:db},{
  readSigned:async()=>({payload})});
 assert.equal(r.status,404);
 assert.equal((await r.json()).uploadAuthorized,false);
});
test('si la ficha D1 no concilia, jamás emite permiso R2',async()=>{
 const {db}=fake();
 const r=await autorizarOriginalR2Live(req(),{...env,DB:db},{
  readSigned:async()=>({payload})});
 assert.equal(r.status,409);
 assert.equal((await r.json()).uploadAuthorized,false);
});
