import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto,createHmac} from 'node:crypto';
import {consultarFichaR2AprobadaCentral}
 from '../integraciones/mercadopago/pruebas/r2-ficha-produccion-firmada-central.mjs';
import {fichaR2Personal}
 from '../integraciones/autocotizador/recepcion/r2-ficha-produccion-documentos.mjs';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const receipt='DOC-12345678-1234-4123-8123-123456789abc';
const id='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const sha='a'.repeat(64);
const secret='R2_TEST_BRIDGE_SECRET_'.padEnd(50,'x');
const quote={schema:'saber-r2-cotizacion-firmada-v1',
 nombre:'A1 Plano.pdf',seleccion:'original',modoImpresion:'bn',copias:2,
 rolloBase:'rollo60',papelPoster:'obra80',importeArs:4400,
 paginas:[[59.4,84.1,'cad','rollo60','obra80']]};
function fixture({paid=true,approved=true,delivered=false}={}){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE orders(id TEXT,status TEXT,amount_ars INTEGER,deposit_ars INTEGER,paid_at TEXT);'+
  'CREATE TABLE payment_reviews(order_id TEXT,state TEXT);'+
  'CREATE TABLE central_r2_prepaid_intents(commercial_order_id TEXT,web_order_id TEXT,file_id TEXT,sha256 TEXT,bytes INTEGER,declared_pages INTEGER);'+
  'CREATE TABLE central_r2_large_pending(web_order_id TEXT,file_id TEXT,receipt_id TEXT,sha256 TEXT,bytes INTEGER,pages_claimed INTEGER);'+
  'CREATE TABLE central_r2_prepress_approvals(order_id TEXT,receipt_id TEXT,sha256 TEXT,amount_ars INTEGER,operator TEXT,approved_at TEXT);'+
  'CREATE TABLE central_work_order_numbers(commercial_order_id TEXT,number INTEGER);'+
  'CREATE TABLE order_items(order_id TEXT,sku TEXT,line_number INTEGER,detail_json TEXT);'+
  'CREATE TABLE central_production_status(order_id TEXT,state TEXT);');
 sql.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(id,paid?'paid':'awaiting_payment',4400,4400,paid?'2026-11-09 15:00:00':null);
 sql.prepare('INSERT INTO payment_reviews VALUES(?,?)').run(id,paid?'verified':'pending');
 sql.prepare('INSERT INTO central_r2_prepaid_intents VALUES(?,?,?,?,?,?)').run(id,web,'planoA1',sha,62915011,1);
 sql.prepare('INSERT INTO central_r2_large_pending VALUES(?,?,?,?,?,?)').run(web,'planoA1',receipt,sha,62915011,1);
 if(approved)sql.prepare('INSERT INTO central_r2_prepress_approvals VALUES(?,?,?,?,?,?)')
  .run(id,receipt,sha,4400,'Mostrador 1','2026-11-09 15:10:00');
 sql.prepare('INSERT INTO central_work_order_numbers VALUES(?,?)').run(id,37);
 sql.prepare('INSERT INTO order_items VALUES(?,?,?,?)')
  .run(id,'R2_PREPAID_PLOT',1,JSON.stringify({quoteSnapshot:quote}));
 if(delivered)sql.prepare('INSERT INTO central_production_status VALUES(?,?)').run(id,'entregado');
 const db={prepare:q=>({statement:sql.prepare(q),args:[],
  bind(...args){this.args=args;return this},
  first:async function(){return this.statement.get(...this.args)}
 })};
 const env={DB:db,CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY'};
 const request=()=>new Request('https://saber-pagos-pruebas.example/internal/central/r2-production-sheet',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({schema:'saber-central-r2-production-sheet-v1',webOrderId:web,receiptId:receipt})
 });
 const call=(readSigned=async req=>({payload:await req.json()}))=>
  consultarFichaR2AprobadaCentral(request(),env,{readSigned});
 return {sql,db,env,call,request};
}
test('Central: firma aprobada y pago íntegro devuelven instrucciones exactas, sin autorización de impresión',async()=>{
 const f=fixture();try{
  const r=await f.call();const x=await r.json();
  assert.equal(r.status,200,JSON.stringify(x));
  assert.equal(x.numeroOrden,'037');
  assert.equal(x.importe,4400);
  assert.equal(x.copias,2);
  assert.deepEqual(x.paginas,quote.paginas);
  assert.equal(x.papelPoster,'obra80');
  assert.equal(x.rolloBase,'rollo60');
  assert.equal(x.productionAuthorized,false);
  assert.equal(x.readyForPrinting,false);
  assert.equal(x.preprensaAprobada,true);
  assert.ok(!JSON.stringify(x).includes(sha));
 }finally{f.sql.close()}
});
test('Central rechaza impagos, sin aprobación, entregados o sin firma HMAC',async()=>{
 for(const options of [{paid:false},{approved:false},{delivered:true}]){
  const f=fixture(options);try{const r=await f.call();assert.equal(r.status,409)}
  finally{f.sql.close()}
 }
 const f=fixture();try{const r=await f.call(async()=>({error:'Firma inválida',status:401}));assert.equal(r.status,401)}
 finally{f.sql.close()}
});
test('Documentos: sólo operador y HMAC exacto; rechaza enlaces o fichas inventados',async()=>{
 const f=fixture();try{
  const env={DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
   DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_BRIDGE_KEY:secret,
   CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
  let calls=0;
  const service={fetch:async req=>{
   calls++;
   const text=await req.text(),ts=req.headers.get('x-saber-ts');
   const nonce=req.headers.get('x-saber-request-id');
   const expected=createHmac('sha256',secret).update(ts+'\n'+nonce+'\n'+text).digest('hex');
   assert.equal(req.headers.get('x-saber-signature'),expected);
   assert.equal(new URL(req.url).pathname,'/internal/central/r2-production-sheet');
   return f.call(async()=>({payload:JSON.parse(text)}));
  }};
  const send=()=>new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-r2-ficha-produccion-personal',{
   method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev',
    'Content-Type':'application/json'},
   body:JSON.stringify({webOrderId:web,receiptId:receipt})
  });
  let response=await fichaR2Personal(send(),env,{authorized:false,service});
  assert.equal(response.status,403);
  assert.equal(calls,0);
  response=await fichaR2Personal(send(),env,{authorized:true,service,
   now:()=>1794230000,nonce:()=>id,subtle:webcrypto.subtle});
  const x=await response.json();
  assert.equal(response.status,200,JSON.stringify(x));
  assert.equal(x.numeroOrden,'037');
  assert.equal(x.productionAuthorized,false);
  const fake={fetch:async()=>Response.json({...x,importe:0})};
  const bad=await fichaR2Personal(send(),env,{authorized:true,service:fake,
   now:()=>1794230000,nonce:()=>id,subtle:webcrypto.subtle});
  assert.equal(bad.status,502);
 }finally{f.sql.close()}
});
