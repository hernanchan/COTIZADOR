import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {consultarPaqueteUniversalCentral,consultarArchivoUniversalCentral}
 from '../integraciones/mercadopago/pruebas/r2-universal-package-central.mjs';
import {descargarUniversalPersonal}
 from '../integraciones/autocotizador/recepcion/r2-universal-paquete-personal.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ID='12345678-1234-4123-8123-123456789abc';
const TUS='12345678-1234-4123-8123-123456789abd';
const R2='12345678-1234-4123-8123-123456789abe';
const PDF=new TextEncoder().encode('%PDF-1.7\nHola Saber!\n%%EOF');
const hash=b=>createHash('sha256').update(b).digest('hex');
const M=1048576;
function make({paid=true,received=true,missingR2=false,delivered=false}={}){
 const base=n=>({nombre:n,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
  seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
  anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
 const files=[base('Clase.pdf'),{...base('Plano.pdf'),paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]}];
 const m=[{fileId:'small',nombre:'Clase.pdf',bytes:PDF.length,sha256:hash(PDF)},
  {fileId:'large',nombre:'Plano.pdf',bytes:70*M,sha256:'b'.repeat(64)}];
 const f=fichaPrearchivoUniversal({webOrderId:WEB,archivos:files,manifiestos:m,
  tarifario:{source:'private-d1-approved-only',revision:8,
   prices:{...prices,priceVersion:'d1-approved-revision-8'}}});
 const q=hash(JSON.stringify(f)),w=f.archivos;
 const detail={schema:'saber-r2-universal-commercial-v1',
  webOrderId:WEB,quoteHash:q,priceRevision:f.priceRevision,
  fileCount:2,r2Count:1,tusCount:1,armadosCount:0,
  prepressPending:true,originalsReceived:false};
 const rows=w.map((x,i)=>({file_id:x.fileId,ordinal:i,name:x.nombre,
  sha256:x.sha256,bytes:x.bytes,transport:x.transporte,service:x.destino,
  work_json:JSON.stringify(x),received:received?1:i}));
 const env={CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY'};
 env.DB={prepare(sql){return {args:[],bind(...v){this.args=v;return this},
  async all(){
   if(sql.includes('FROM order_items'))return {results:[{sku:'PDF_UNIVERSAL_PREPAID',
    quantity:1,unit_price_ars:f.totalArs,line_total_ars:f.totalArs,
    detail_json:JSON.stringify(detail),file_references_json:'["small","large"]'}]};
   if(sql.includes('FROM central_r2_universal_files'))return {results:rows};
   throw Error('UNHANDLED_ALL '+sql);
  },
  async first(){
   if(sql.includes('FROM central_r2_universal_order_links l'))return {
    web_order_id:WEB,quote_hash:q,amount_ars:f.totalArs,draft_id:ID,
    price_revision:f.priceRevision,total_ars:f.totalArs,file_count:2,
    armados_json:'[]',state:'draft_not_payable',id:ID,
    status:paid?'paid':'awaiting_payment',deposit_ars:f.totalArs,order_total:f.totalArs,
    created_at:'2026-11-09 18:00:00',paid_at:paid?'2026-11-09 18:20:00':null,
    payment_id:paid?'123456789':null,preference_id:paid?'pref-test':null};
   if(sql.includes('FROM central_r2_universal_order_links'))return {commercial_order_id:ID};
   if(sql.includes('SELECT status,paid_at,payment_id,preference_id'))return {
    status:paid?'paid':'awaiting_payment',paid_at:paid?'2026-11-09 18:20:00':null,
    payment_id:paid?'123456789':null,preference_id:paid?'pref-test':null,
    amount_ars:f.totalArs,deposit_ars:f.totalArs};
   if(sql.includes('SELECT state FROM payment_reviews'))return {state:paid?'verified':'pending'};
   if(sql.includes("name='central_production_status'"))
    return delivered?{name:'central_production_status'}:null;
   if(sql.includes('SELECT state FROM central_production_status'))
    return delivered?{state:'entregado'}:null;
   if(sql.includes('SELECT number FROM central_work_order_numbers'))return {number:41};
   if(sql.includes('FROM central_r2_universal_tus_receipts'))return {
    receipt_id:'DOC-'+TUS,object_name:'v2/'+WEB+'/'+TUS+'.pdf',
    sha256:hash(PDF),bytes:PDF.length,page_count:1};
   if(sql.includes('FROM central_r2_large_pending p JOIN'))return missingR2?null:{
    receipt_id:'DOC-'+R2,object_key:'r2-v1/'+WEB+'/'+R2+'.pdf',
    pages_claimed:1,sha256:'b'.repeat(64),bytes:70*M,
    status:'awaiting_pdf_analysis',reservation_state:'reserved'};
   throw Error('UNHANDLED_FIRST '+sql);
  }
 }}};
 return {env,f};
}
const signed=async r=>({payload:await r.json()});
const req=(p)=>new Request('https://central.invalid/package',{method:'POST',body:JSON.stringify(p)});
test('ficha D1: dos originales TUS/R2, orden única y pago confirmado',async()=>{
 const {env,f}=make();
 const p={schema:'saber-central-r2-universal-package-manifest-v1',webOrderId:WEB};
 const r=await consultarPaqueteUniversalCentral(req(p),env,{readSigned:signed,subtle:webcrypto.subtle});
 const x=await r.json();
 assert.equal(r.status,200,JSON.stringify(x));
 assert.equal(x.numeroOrden,'041');assert.equal(x.importe,f.totalArs);
 assert.deepEqual(x.trabajos.map(t=>t.transporte),['tus','r2']);
 assert.equal(x.trabajos[1].detalle.paginas[0].material,'rollo60');
 assert.equal(x.productionAuthorized,false);assert.equal(x.preprensaPendiente,true);
 const f2={schema:'saber-central-r2-universal-package-file-v1',webOrderId:WEB,fileId:'large'};
 const file=await consultarArchivoUniversalCentral(req(f2),env,{readSigned:signed,subtle:webcrypto.subtle});
 assert.equal(file.status,200,JSON.stringify(await file.clone().json()));
 assert.equal((await file.json()).objectKey,'r2-v1/'+WEB+'/'+R2+'.pdf');
});
test('no empaqueta pedidos sin pago, entrega o recibos originales completos',async()=>{
 const p={schema:'saber-central-r2-universal-package-manifest-v1',webOrderId:WEB};
 for(const opt of [{paid:false},{received:false},{missingR2:true},{delivered:true}]){
  const {env}=make(opt);
  const r=await consultarPaqueteUniversalCentral(req(p),env,
   {readSigned:signed,subtle:webcrypto.subtle});
  assert.equal(r.status,409,JSON.stringify(await r.clone().json()));
 }
});
test('descarga TUS personal: SHA verificado; negación por alteración y sin Basic',async()=>{
 const {env}=make();Object.assign(env,{
  DOCS_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_POSTPAY_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_RECEIPT_KEY:'t'.repeat(40),
  DOCS_TUS_SUPABASE_SERVICE_KEY:'s'.repeat(45),
  DOCS_TUS_PUBLISHABLE_KEY:'p'.repeat(40),
  CENTRAL_BRIDGE_KEY:'b'.repeat(40),
  SABER_CENTRAL:{fetch:async()=>{throw Error('not used')}}
 });
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-universal-descargar-personal';
 const request=()=>new Request(url,{method:'POST',
  headers:{Origin:new URL(url).origin,'Content-Type':'application/json'},
  body:JSON.stringify({webOrderId:WEB,fileId:'small'})});
 const lookup=async()=>({ok:true,schema:'saber-central-r2-universal-package-file-v1',
  webOrderId:WEB,fileId:'small',bytes:PDF.length,sha256:hash(PDF),
  transporte:'tus',objectKey:'v2/'+WEB+'/'+TUS+'.pdf',
  receiptId:'DOC-'+TUS,preprensaPendiente:true});
 const opts={authorized:true,lookup,readTUS:async()=>PDF,subtle:webcrypto.subtle};
 const r=await descargarUniversalPersonal(request(),env,opts);
 assert.equal(r.status,200,await r.clone().text());
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),PDF);
 const bad=await descargarUniversalPersonal(request(),env,{...opts,
  readTUS:async()=>new Uint8Array(PDF.length)});
 assert.equal(bad.status,409);
 assert.equal((await descargarUniversalPersonal(request(),env,{
  ...opts,authorized:false})).status,403);
});
