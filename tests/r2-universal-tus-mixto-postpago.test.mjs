import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {autorizarTUSUniversalCentral,recibirTUSUniversalCentral}
 from '../integraciones/mercadopago/pruebas/r2-universal-tus-central.mjs';
import {iniciarLoteTUSUniversal,confirmarLoteTUSUniversal}
 from '../integraciones/autocotizador/recepcion/tus-universal-worker.mjs';
import {crearTandaTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ID='12345678-1234-4123-8123-123456789abc';
const DOC='DOC-'+ID;
const B=Uint8Array.from(new TextEncoder().encode('%PDF-1.7 test private bytes'));
const HASH=Buffer.from(await webcrypto.subtle.digest('SHA-256',B)).toString('hex');
const SHA=/^[a-f0-9]{64}$/;
const SECRET='clave-privada-firmada-pruebas-TUS-universal-2026';
const N=()=>1794240000;
async function fixture({paid=true,altered=false}={}){
 const a4=(name,anchoCm,altoCm)=>({nombre:name,
  paginas:[{numero:1,anchoCm,altoCm,modo:'sin-clasificar'}],
  seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
  anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
 const files=[a4('Apuntes.pdf',21,29.7),a4('Panel.pdf',59.4,84.1)];
 files[1].paginas[0].modo='cad';
 const metas=[{fileId:'small',nombre:'Apuntes.pdf',bytes:B.length,sha256:HASH},
  {fileId:'large',nombre:'Panel.pdf',bytes:70*1048576,sha256:'b'.repeat(64)}];
 const ficha=fichaPrearchivoUniversal({webOrderId:ORDER,archivos:files,
  manifiestos:metas,tarifario:{source:'private-d1-approved-only',revision:8,
   prices:{...prices,priceVersion:'d1-approved-revision-8'}}});
 const q=Buffer.from(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(ficha)))).toString('hex');
 const fs=ficha.archivos;
 const detail=JSON.stringify({schema:'saber-r2-universal-commercial-v1',
  webOrderId:ORDER,quoteHash:q,priceRevision:ficha.priceRevision,
  fileCount:2,r2Count:1,tusCount:1,armadosCount:0,
  prepressPending:true,originalsReceived:false});
 let receipt=null;
 const rows=fs.map((x,i)=>({file_id:x.fileId,ordinal:i,name:x.nombre,
  sha256:x.sha256,bytes:x.bytes,transport:x.transporte,
  service:x.destino,work_json:JSON.stringify(x),received:0}));
 const env={
  CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_TUS_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_TUS_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_RECEIPT_KEY:SECRET,
  DOCS_TUS_SUPABASE_SERVICE_KEY:'x'.repeat(45),
  DOCS_TUS_PUBLISHABLE_KEY:'x'.repeat(40)
 };
 const db={prepare(sql){return {args:[],bind(...v){this.args=v;return this},
  async run(){return {meta:{changes:0}}},
  async all(){
   if(sql.includes('FROM order_items'))return {results:[{sku:'PDF_UNIVERSAL_PREPAID',
    quantity:1,unit_price_ars:ficha.totalArs,line_total_ars:ficha.totalArs,
    detail_json:altered?'{}':detail,file_references_json:JSON.stringify(fs.map(x=>x.fileId))}]};
   if(sql.includes('FROM central_r2_universal_files'))return {results:rows};
   throw Error('Unexpected all '+sql);
  },
  async first(){
   if(sql.includes('FROM central_r2_universal_order_links l'))
    return {web_order_id:ORDER,quote_hash:q,amount_ars:ficha.totalArs,
     draft_id:ID,price_revision:ficha.priceRevision,total_ars:ficha.totalArs,
     file_count:2,armados_json:'[]',state:'draft_not_payable',
     id:ID,status:paid?'paid':'awaiting_payment',deposit_ars:ficha.totalArs,
     order_total:ficha.totalArs,created_at:'2026-11-09 19:00:00',
     paid_at:paid?'2026-11-09 19:10:00':null,
     payment_id:paid?'123456789':null,preference_id:paid?'pref-test':null};
   if(sql.includes('FROM central_r2_universal_order_links'))return {commercial_order_id:ID};
   if(sql.includes('SELECT status,paid_at,payment_id,preference_id'))
    return {status:paid?'paid':'awaiting_payment',
     paid_at:paid?'2026-11-09 19:10:00':null,
     payment_id:paid?'123456789':null,preference_id:paid?'pref-test':null,
     deposit_ars:ficha.totalArs,amount_ars:ficha.totalArs};
   if(sql.includes('SELECT state FROM payment_reviews'))
    return {state:paid?'verified':'pending'};
   if(sql.includes("name='central_production_status'"))return null;
   if(sql.includes('FROM central_r2_universal_tus_receipts'))
    return receipt;
   if(sql.includes('SELECT received FROM central_r2_universal_files'))
    return {received:rows[0].received};
   throw Error('Unexpected first '+sql);
  }
 }},async batch(cmds){
  assert.equal(cmds.length,2);
  assert.match(cmds[0].sql,/INSERT INTO central_r2_universal_tus_receipts/);
  assert.match(cmds[1].sql,/UPDATE central_r2_universal_files SET received=1/);
  if(receipt)throw Error('already received');
  const args=cmds[0].args;
  receipt={receipt_id:args[0],object_name:args[1],sha256:args[2],
   bytes:args[3],page_count:args[4]};
  rows[0].received=1;
  return [{meta:{changes:1}},{meta:{changes:1}}];
 }};
 env.DB=db;
 const meta={schema:'saber-central-r2-universal-tus-gate-v1',
  action:'start',orderId:ORDER,fileId:'small',name:'Apuntes.pdf',
  sha256:HASH,bytes:B.length,pages:1};
 const doc={schema:'saber-central-r2-universal-tus-received-v1',
  orderId:ORDER,fileId:'small',receiptId:DOC,
  objectName:'v2/'+ORDER+'/'+ID+'.pdf',name:'Apuntes.pdf',
  sha256:HASH,bytes:B.length,pages:1,
  metrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]};
 return {env,meta,doc,rows,get receipt(){return receipt}};
}
const sign=r=>r.json().then(payload=>({payload}));
const call=(payload,route='gate')=>new Request('https://central.invalid/r2-universal-tus-'+route,
 {method:'POST',body:JSON.stringify(payload)});
test('TUS: pago conciliado habilita exclusivamente PDF chico de su propia orden',async()=>{
 const f=await fixture();
 const a=await autorizarTUSUniversalCentral(call(f.meta),f.env,
  {readSigned:sign,subtle:webcrypto.subtle});
 const body=await a.json();
 assert.equal(a.status,200);
 assert.equal(body.uploadAuthorized,true);
 assert.equal(body.fileId,'small');
 assert.deepEqual(body.expectedMetrics,[{anchoCm:21,altoCm:29.7}]);
 assert.equal(body.productionAuthorized,false);
 const unpaid=await fixture({paid:false});
 assert.equal((await autorizarTUSUniversalCentral(call(unpaid.meta),unpaid.env,
  {readSigned:sign,subtle:webcrypto.subtle})).status,402);
 assert.equal((await autorizarTUSUniversalCentral(call({...f.meta,fileId:'large'}),f.env,
  {readSigned:sign,subtle:webcrypto.subtle})).status,402);
 assert.equal((await autorizarTUSUniversalCentral(call({...f.meta,sha256:'f'.repeat(64)}),f.env,
  {readSigned:sign,subtle:webcrypto.subtle})).status,402);
});
test('TUS: registra recibo dentro de orden D1 existente; reintento no duplica',async()=>{
 const f=await fixture();
 const req=()=>call(f.doc,'received');
 const opts={readSigned:sign,subtle:webcrypto.subtle};
 const one=await recibirTUSUniversalCentral(req(),f.env,opts);
 assert.equal(one.status,201,JSON.stringify(await one.clone().json()));
 assert.equal((await one.json()).productionAuthorized,false);
 assert.equal(f.rows[0].received,1);
 assert.equal(f.receipt.receipt_id,DOC);
 const replay=await recibirTUSUniversalCentral(req(),f.env,opts);
 assert.equal(replay.status,200);
 assert.equal((await replay.json()).idempotent,true);
 assert.equal(f.rows[0].received,1);
 const tampered=await fixture();
 assert.equal((await recibirTUSUniversalCentral(call({...tampered.doc,
   metrics:[{anchoCm:32,altoCm:40,modo:'sin-clasificar'}]},'received'),
   tampered.env,opts)).status,409);
 assert.equal(tampered.rows[0].received,0);
 assert.equal((await recibirTUSUniversalCentral(call({...tampered.doc,
   objectName:'v2/'+ORDER+'/otro.pdf'},'received'),tampered.env,opts)).status,422);
 assert.equal(tampered.rows[0].received,0);
});
test('TUS: comprobante sin pago no graba original',async()=>{
 const f=await fixture({paid:false});
 const resp=await recibirTUSUniversalCentral(call(f.doc,'received'),f.env,
  {readSigned:sign,subtle:webcrypto.subtle});
 assert.equal(resp.status,409);
 assert.equal(f.rows[0].received,0);
});
test('Documentos: inicio exige gate de todos antes de firmar subida TUS',async()=>{
 const f=await fixture();let signed=0,gates=0;
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const input={orderId:ORDER,metas:[{fileId:'small',name:'Apuntes.pdf',
  mode:'bn',bytes:B.length,sha256:HASH,pages:1}]};
 const req=()=>new Request(url+'/prueba-v2/api/ensayo-tus-universal-iniciar',{
  method:'POST',headers:{Origin:url,'Content-Type':'application/json'},
  body:JSON.stringify(input)});
 const gate=async(env,route,p)=>{gates++;assert.equal(route,'gate');
  assert.equal(p.orderId,ORDER);
  return {ok:true,fileId:'small',uploadAuthorized:true,mode:'bn',
   sha256:HASH,bytes:B.length,pages:1}};
 const start=async()=>{signed++;return Response.json({ok:true,orderId:ORDER,
  sessions:[{fileId:'small',bytes:B.length}],paymentAuthorized:false})};
 const good=await iniciarLoteTUSUniversal(req(),f.env,
  {authorized:true,gate,start});
 assert.equal(good.status,200);assert.equal(signed,1);assert.equal(gates,1);
 const denied=await iniciarLoteTUSUniversal(req(),f.env,
  {authorized:false,gate,start});
 assert.equal(denied.status,403);assert.equal(signed,1);
 const bad=await iniciarLoteTUSUniversal(req(),f.env,
  {authorized:true,gate:async()=>{throw Error('unpaid')},start});
 assert.equal(bad.status,402);assert.equal(signed,1);
});
test('Documentos: firmar recibo, leer bytes, SHA y tamaño físico; sin segundo pedido',async()=>{
 const f=await fixture();
 const created=await crearTandaTUS({orderId:ORDER,
  metas:[{fileId:'small',name:'Apuntes.pdf',mode:'bn',bytes:B.length,sha256:HASH,pages:1}],
  secret:SECRET,firmarSubida:async()=>'signed-supabase-token-00000',
  uuid:()=>ID,ahora:N,subtle:webcrypto.subtle});
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const req=()=>new Request(url+'/prueba-v2/api/ensayo-tus-universal-confirmar',{
  method:'POST',headers:{Origin:url,'Content-Type':'application/json'},
  body:JSON.stringify({orderId:ORDER,entries:[{proof:created.sessions[0].proof}]})});
 let storage=0,linked=0;
 const gate=async(_env,route,p)=>{
  if(route==='gate')return {ok:true,uploadAuthorized:true,fileId:'small',
   name:'Apuntes.pdf',sha256:HASH,bytes:B.length,pages:1,mode:'bn',
   expectedMetrics:[{anchoCm:21,altoCm:29.7}]};
  linked++;
  assert.equal(p.schema,'saber-central-r2-universal-tus-received-v1');
  assert.equal(p.receiptId,DOC);
  assert.equal(p.sha256,HASH);
  assert.equal(p.metrics[0].anchoCm,21);
  return {ok:true,saved:true,fileId:'small',idempotent:false};
 };
 const options={authorized:true,gate,
  read:async()=>{storage++;return B;},
  measure:async()=>({pageCount:1,
   pageMetrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]}),
  subtle:webcrypto.subtle,ahora:N};
 const result=await confirmarLoteTUSUniversal(req(),f.env,options);
 assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 assert.equal((await result.json()).savedFiles,1);
 assert.equal(storage,1);assert.equal(linked,1);
 const wrong=await confirmarLoteTUSUniversal(req(),f.env,{
  ...options,read:async()=>Uint8Array.from([...B,0])
 });
 assert.equal(wrong.status,409);assert.equal(linked,1);
 const noPayment=await confirmarLoteTUSUniversal(req(),f.env,{
  ...options,gate:async()=>{throw Error('payment not verified')},
  read:async()=>{throw Error('must not reach Storage')}
 });
 assert.equal(noPayment.status,409);assert.equal(storage,1);
});
