import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {aprobarPreprensaUniversalCentral,comprobarPreprensaUniversal}
 from '../integraciones/mercadopago/pruebas/r2-universal-preprensa-central.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ORDER='12345678-1234-4123-8123-123456789abc';
const TUS='12345678-1234-4123-8123-123456789abd';
const R2='12345678-1234-4123-8123-123456789abe';
const M=1048576;
const hash=v=>createHash('sha256').update(v).digest('hex');
const KEYS=['archivo','caras','clasificacion','copias','escala','material','medidas','paginas','precio','rollo'];
const confirmed=Object.fromEntries(KEYS.map(x=>[x,true]));
const req=p=>new Request('https://central.invalid/admin/api/central/r2-universal-prepress-approve',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
const args={schema:'saber-central-r2-universal-prepress-approval-v1',
 webOrderId:WEB,commercialOrderId:ORDER,operator:'Operador Saber',confirmed};
function build({paid=true,received=true,r2Receipt=true}={}){
 const base=n=>({nombre:n,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
 const files=[base('Apuntes.pdf'),{...base('A1.pdf'),paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]}];
 const meta=[{fileId:'small',nombre:'Apuntes.pdf',bytes:2*M,sha256:'a'.repeat(64)},
 {fileId:'big',nombre:'A1.pdf',bytes:70*M,sha256:'b'.repeat(64)}];
 const ficha=fichaPrearchivoUniversal({webOrderId:WEB,archivos:files,manifiestos:meta,
  tarifario:{source:'private-d1-approved-only',revision:8,
   prices:{...prices,priceVersion:'d1-approved-revision-8'}}});
 const quoteHash=hash(JSON.stringify(ficha));
 const detail={schema:'saber-r2-universal-commercial-v1',webOrderId:WEB,quoteHash,
  priceRevision:ficha.priceRevision,fileCount:2,r2Count:1,tusCount:1,
  armadosCount:0,prepressPending:true,originalsReceived:false};
 const f=ficha.archivos.map((x,i)=>({file_id:x.fileId,ordinal:i,
  name:x.nombre,sha256:x.sha256,bytes:x.bytes,transport:x.transporte,
  service:x.destino,work_json:JSON.stringify(x),received:received?1:i}));
 let approval=null,inserted=0;
 const env={CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY'};
 env.DB={prepare(sql){return {sql,args:[],bind(...a){this.args=a;return this},
  async all(){
   if(sql.includes('FROM order_items'))return {results:[{
    sku:'PDF_UNIVERSAL_PREPAID',quantity:1,
    unit_price_ars:ficha.totalArs,line_total_ars:ficha.totalArs,
    detail_json:JSON.stringify(detail),
    file_references_json:'["small","big"]'}]};
   if(sql.includes('FROM central_r2_universal_files'))return {results:f};
   throw Error('unknown all '+sql);
  },
  async first(){
   if(sql.includes('FROM central_r2_universal_order_links l'))
    return {web_order_id:WEB,quote_hash:quoteHash,amount_ars:ficha.totalArs,
     draft_id:ORDER,price_revision:ficha.priceRevision,total_ars:ficha.totalArs,
     file_count:2,armados_json:'[]',state:'draft_not_payable',
     id:ORDER,status:paid?'paid':'awaiting_payment',deposit_ars:ficha.totalArs,
     order_total:ficha.totalArs,created_at:'2026-11-09 19:00:00',
     paid_at:paid?'2026-11-09 19:30:00':null,
     payment_id:paid?'12345678':null,preference_id:paid?'sandbox':null};
   if(sql.includes('FROM central_r2_universal_order_links'))
    return {commercial_order_id:ORDER};
   if(sql.includes('SELECT status,paid_at,payment_id,preference_id'))
    return {status:paid?'paid':'awaiting_payment',
     paid_at:paid?'2026-11-09 19:30:00':null,
     payment_id:paid?'12345678':null,preference_id:paid?'sandbox':null,
     amount_ars:ficha.totalArs,deposit_ars:ficha.totalArs};
   if(sql.includes('SELECT state FROM payment_reviews'))
    return {state:paid?'verified':'pending'};
   if(sql.includes("name='central_production_status'"))return null;
   if(sql.includes("name='central_r2_universal_prepress_approvals'"))
    return approval?{name:'central_r2_universal_prepress_approvals'}:null;
   if(sql.includes('FROM central_r2_universal_prepress_approvals a'))
    return approval?{...approval,web_order_id:WEB,quote_hash:quoteHash,
     file_count:2}:null;
   if(sql.includes('SELECT quote_hash,file_count,operator'))
    return approval;
   if(sql.includes('SELECT number FROM central_work_order_numbers'))
    return {number:41};
   if(sql.includes('FROM central_r2_universal_tus_receipts'))
    return {receipt_id:'DOC-'+TUS,object_name:'v2/'+WEB+'/'+TUS+'.pdf',
     sha256:'a'.repeat(64),bytes:2*M,page_count:1};
   if(sql.includes('FROM central_r2_large_pending p JOIN'))
    return r2Receipt?{receipt_id:'DOC-'+R2,object_key:'r2-v1/'+WEB+'/'+R2+'.pdf',
     sha256:'b'.repeat(64),bytes:70*M,pages_claimed:1,
     status:'awaiting_pdf_analysis',reservation_state:'reserved'}:null;
   throw Error('unknown first '+sql);
  },
  async run(){
   if(sql.startsWith('INSERT INTO central_r2_universal_prepress_approvals')){
    inserted++;approval={quote_hash:quoteHash,file_count:2,operator:'Operador Saber'};
    return {meta:{changes:1}};
   }
   return {meta:{changes:1}};
  }
 }}};
 return {env,get approval(){return approval},get inserted(){return inserted}};
}
test('preprensa: aprobación de lote pagado, recibos íntegros y 10 controles',async()=>{
 const f=build();
 const r=await aprobarPreprensaUniversalCentral(req(args),f.env,{
  authorized:true,subtle:webcrypto.subtle});
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 assert.equal((await r.json()).productionGatePassed,true);
 assert.equal(f.inserted,1);
 assert.equal(await comprobarPreprensaUniversal(f.env,ORDER),true);
 const again=await aprobarPreprensaUniversalCentral(req(args),f.env,{
  authorized:true,subtle:webcrypto.subtle});
 assert.equal(again.status,200);
 assert.equal((await again.json()).idempotent,true);
 assert.equal(f.inserted,1);
});
test('preprensa deniega falta de pago, PDF, confirmación, sesión y flag',async()=>{
 for(const opts of [{paid:false},{received:false},{r2Receipt:false}]){
  const f=build(opts);
  const r=await aprobarPreprensaUniversalCentral(req(args),f.env,{
   authorized:true,subtle:webcrypto.subtle});
  assert.notEqual(r.status,201,JSON.stringify(opts));
  assert.equal(f.inserted,0);
 }
 const f=build();
 assert.equal((await aprobarPreprensaUniversalCentral(req(args),f.env,{
  authorized:false})).status,401);
 const missing={...confirmed,rollo:false};
 assert.equal((await aprobarPreprensaUniversalCentral(req({...args,confirmed:missing}),f.env,{
  authorized:true})).status,422);
 f.env.CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED='OFF';
 assert.equal((await aprobarPreprensaUniversalCentral(req(args),f.env,{
  authorized:true})).status,503);
});
