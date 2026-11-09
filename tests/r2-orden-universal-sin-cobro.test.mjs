import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {promoverPedidoUniversalD1,validarPromocionUniversal,UNIVERSAL_ORDER_SKU}
 from '../integraciones/mercadopago/pruebas/r2-universal-order-central.mjs';
import {prepararOrdenUniversalSinCheckout}
 from '../integraciones/autocotizador/recepcion/r2-orden-universal-documentos.mjs';

const MIB=1048576,order='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const uuid='12345678-1234-4123-8123-123456789abc';
const draftId='12345678-1234-4123-8123-123456789abd';
const secret='clave-puente-prueba-universal-20261109-HMAC';
const tariff={source:'private-d1-approved-only',revision:8,
 prices:{...prices,priceVersion:'d1-approved-revision-8'}};
const a4=n=>({nombre:n,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:2,modo:'bn',caras:'double',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
const configs=[a4('Apuntes.pdf'),a4('Resumen.pdf'),{...a4('Plano.pdf'),copias:1,
 paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]}];
const manifests=configs.map((x,i)=>({fileId:'file_'+i,nombre:x.nombre,
 bytes:[60*MIB,2*MIB,150*MIB][i],sha256:String(i+1).repeat(64)}));
async function fixture(){
 const f=fichaPrearchivoUniversal({webOrderId:order,archivos:configs,manifiestos:manifests,tarifario:tariff});
 const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(f)))).toString('hex');
 return {f,hash,request:{schema:'saber-central-r2-universal-create-order-v1',
  webOrderId:order,draftId,quoteHash:hash,telefono:'3515551234'}};
}
function fakeDB(f,hash,{wrongTransport=false,oldReference=false}={}){
 const orders=[],items=[],links=[],numbers=[],contacts=[],queries=[];
 const tables=['orders','order_items','central_work_order_numbers',
  'central_r2_universal_drafts','central_r2_universal_files',
  'central_document_manifests','central_order_contacts'];
 const DB={prepare(sql){
  const stmt={sql,args:[],bind(...v){this.args=v;return this},
   async run(){return {meta:{changes:0}}},
   async all(){
    if(sql.includes('sqlite_master'))return {results:tables.map(name=>({name}))};
    if(sql.includes('FROM central_r2_universal_files'))return {results:f.archivos.map((x,i)=>({
     file_id:x.fileId,ordinal:i,name:x.nombre,sha256:x.sha256,bytes:x.bytes,
     transport:i===0&&wrongTransport?'tus':x.transporte,
     service:x.destino,work_json:JSON.stringify(x),received:0}))};
    throw Error('unhandled all: '+sql);
   },
   async first(){
    if(sql.includes('FROM central_document_manifests'))return oldReference?{web_order_id:order}:null;
    if(sql.includes('FROM central_r2_universal_drafts'))return {
     web_order_id:order,draft_id:draftId,quote_hash:hash,
     price_revision:f.priceRevision,total_ars:f.totalArs,file_count:f.archivos.length,
     armados_json:JSON.stringify(f.armados),state:'draft_not_payable'};
    if(sql.includes('FROM central_r2_universal_order_links'))return links[0]||null;
    if(sql.includes('FROM orders WHERE id=?'))return orders.find(r=>r.id===this.args[0])||null;
    if(sql.includes('FROM order_items WHERE order_id=? AND line_number=1'))
     return items.find(r=>r.order_id===this.args[0])||null;
    if(sql.includes('COUNT(*) AS total FROM order_items'))
     return {total:items.filter(r=>r.order_id===this.args[0]).length};
    if(sql.includes('FROM central_work_order_numbers'))
     return numbers.find(r=>r.commercial_order_id===this.args[0])||null;
    if(sql.includes('FROM central_order_contacts'))
     return contacts.find(r=>r.order_id===this.args[0])||null;
    throw Error('unhandled first: '+sql);
   }
  };queries.push(stmt);return stmt;
 },async batch(stmts){
  assert.equal(stmts.length,5);
  if(links.length)throw Error('duplicate');
  const [a,b,c,d,e]=stmts;
  assert.match(a.sql,/INSERT INTO orders/);
  assert.match(b.sql,/INSERT INTO order_items/);
  assert.match(c.sql,/INSERT INTO central_r2_universal_order_links/);
  assert.match(d.sql,/INSERT INTO central_work_order_numbers/);
  assert.match(e.sql,/INSERT INTO central_order_contacts/);
  orders.push({id:a.args[0],status:'awaiting_payment',amount_ars:a.args[2],deposit_ars:a.args[3]});
  items.push({order_id:b.args[0],sku:b.args[2],quantity:b.args[4],
   line_total_ars:b.args[6],detail_json:b.args[7],
   file_references_json:b.args[8]});
  links.push({web_order_id:c.args[0],commercial_order_id:c.args[1],
   quote_hash:c.args[2],amount_ars:c.args[3]});
  numbers.push({commercial_order_id:d.args[0],number:24});
  contacts.push({order_id:e.args[0],phone:e.args[1]});
  return stmts.map(()=>({meta:{changes:1}}));
 }};
 return {DB,orders,items,links,numbers,contacts,queries};
}
function promote(db,p,flag='PRIVATE_TEST_ONLY'){
 return promoverPedidoUniversalD1(new Request('https://central.invalid/internal/central/r2-universal-order',{
  method:'POST',body:JSON.stringify(p)}),{
  DB:db.DB,CENTRAL_R2_UNIVERSAL_ORDER_ENABLED:flag,
  CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY'
 },{readSigned:async r=>({payload:await r.json()}),subtle:webcrypto.subtle,uuid:()=>uuid});
}
test('promoción obliga UUID, hash e identificador exacto, sin importes de UI',async()=>{
 const {request:p}=await fixture();
 assert.equal(validarPromocionUniversal(p),p);
 for(const x of [{...p,totalArs:1},{...p,uploadAuthorized:true},
  {...p,draftId:'invalido'},{...p,quoteHash:'0'},
  {...p,telefono:'123'},{...p,telefono:'351 555 1234',amountArs:1}])
  assert.throws(()=>validarPromocionUniversal(x));
});
test('tres archivos se convierten en un pedido D1 y una línea agregada sin checkout',async()=>{
 const {f,hash,request:p}=await fixture(),db=fakeDB(f,hash);
 const first=await promote(db,p);const data=await first.clone().json();
 assert.equal(first.status,201,JSON.stringify(data));
 assert.equal(data.totalArs,f.totalArs);
 assert.equal(data.commercialOrderId,uuid);
 assert.equal(data.numeroOrden,'024');
 assert.equal(data.checkoutEnabled,false);
 assert.equal(data.uploadAuthorized,false);
 assert.equal(data.productionAuthorized,false);
 assert.equal(db.orders.length,1);
 assert.equal(db.items.length,1);
 assert.equal(db.items[0].sku,UNIVERSAL_ORDER_SKU);
 assert.deepEqual(JSON.parse(db.items[0].file_references_json),
  ['file_0','file_1','file_2']);
 assert.equal(db.links.length,1);
 assert.equal(db.numbers.length,1);
 assert.equal(db.contacts.length,1);
 assert.equal(db.contacts[0].phone,'3515551234');
 const replay=await promote(db,p);
 assert.equal(replay.status,200);
 assert.equal((await replay.json()).idempotent,true);
 assert.equal(db.orders.length,1);
});
test('dos solicitudes simultáneas son idempotentes, sin duplicar orden ni número',async()=>{
 const {f,hash,request:p}=await fixture(),db=fakeDB(f,hash);
 const results=await Promise.all([promote(db,p),promote(db,p)]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);
 assert.equal(db.orders.length,1);
 assert.equal(db.links.length,1);
 assert.equal(db.numbers.length,1);
});
test('rechaza hash falso, transporte manipulado, referencia histórica y flags OFF',async()=>{
 const {f,hash,request:p}=await fixture();
 const wrong=fakeDB(f,hash,{wrongTransport:true});
 assert.equal((await promote(wrong,p)).status,409);
 assert.equal(wrong.orders.length,0);
 const old=fakeDB(f,hash,{oldReference:true});
 assert.equal((await promote(old,p)).status,409);
 const mismatch=fakeDB(f,hash);
 assert.equal((await promote(mismatch,{...p,quoteHash:'a'.repeat(64)})).status,409);
 assert.equal(mismatch.orders.length,0);
 const off=fakeDB(f,hash);
 assert.equal((await promote(off,p,'OFF')).status,503);
 assert.equal(off.queries.length,0);
});
test('Documentos firma HMAC y exige personal; jamás fabrica checkout',async()=>{
 const {f,request:p}=await fixture();
 let calls=0;
 const svc={fetch:async req=>{
  calls++;
  assert.equal(new URL(req.url).pathname,'/internal/central/r2-universal-order');
  const body=await req.text();
  assert.deepEqual(JSON.parse(body),p);
  assert.equal(req.headers.get('x-saber-signature'),createHmac('sha256',secret)
   .update(req.headers.get('x-saber-ts')+'\n'+req.headers.get('x-saber-request-id')+
    '\n'+body).digest('hex'));
  return Response.json({ok:true,webOrderId:order,commercialOrderId:uuid,numeroOrden:'024',
   totalArs:f.totalArs,fileCount:3,idempotent:false,checkoutEnabled:false,
   paymentAuthorized:false,uploadAuthorized:false,
   filesUploaded:false,productionAuthorized:false},{status:201});
 }};
 const env={DOCS_R2_UNIVERSAL_ORDER_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:secret,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const make=x=>new Request(host+'/prueba-v2/api/ensayo-r2-orden-universal',{
  method:'POST',headers:{Origin:host,'Content-Type':'application/json'},
  body:JSON.stringify(x)});
 const args={authorized:true,service:svc,subtle:webcrypto.subtle,
  now:()=>1793970000,nonce:()=>uuid};
 const ok=await prepararOrdenUniversalSinCheckout(make({
  webOrderId:p.webOrderId,draftId:p.draftId,quoteHash:p.quoteHash,telefono:p.telefono}),env,args);
 assert.equal(ok.status,201,JSON.stringify(await ok.clone().json()));
 assert.equal((await ok.json()).checkoutEnabled,false);
 const forged=await prepararOrdenUniversalSinCheckout(make({
  webOrderId:p.webOrderId,draftId:p.draftId,quoteHash:p.quoteHash,telefono:p.telefono,totalArs:1}),env,args);
 assert.equal(forged.status,422);assert.equal(calls,1);
 const denied=await prepararOrdenUniversalSinCheckout(make({
  webOrderId:p.webOrderId,draftId:p.draftId,quoteHash:p.quoteHash,telefono:p.telefono}),env,{
  ...args,authorized:false});
 assert.equal(denied.status,401);assert.equal(calls,1);
});
test('checkout administrativo tiene bloqueo explícito para SKU universal',()=>{
 const central=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
 assert.match(central,/sku IN \([^)]*'PDF_UNIVERSAL_PREPAID'/);
 assert.match(central,/restricted\?\.sku==="PDF_UNIVERSAL_PREPAID"[\s\S]*?return json\(/);
});
