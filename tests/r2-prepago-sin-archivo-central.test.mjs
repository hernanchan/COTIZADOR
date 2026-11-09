import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {validarIntencionR2Prepaga,registrarIntencionR2Prepaga}
 from '../integraciones/mercadopago/pruebas/r2-prepago-intencion-central.mjs';
import {prepararR2PagoSinArchivo}
 from '../integraciones/autocotizador/recepcion/r2-prepago-documentos.mjs';
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const UUID='12345678-1234-4123-8123-123456789abc';
const SECRET='clave-de-prueba-para-HMAC-central-A1-20261107-123456';
const TS=1793970000;
const META={fileId:'planoA1',sha256:'a'.repeat(64),bytes:150*1024*1024};
const quote={
 nombre:'Plano A1 150 MB.pdf',
 paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}],
 seleccion:'original',servicio:'auto',
 copias:1,modo:'bn',caras:'simple',anillado:'ninguno',
 grupoAnillado:'',materialColor:'',papelPoster:'obra80'
};
const priceLoader=async()=>({
 source:'private-d1-approved-only',revision:3,
 prices:{...prices,priceVersion:'d1-approved-revision-3'}
});
const p={
 schema:'saber-central-r2-prepaid-intent-v1',
 webOrderId:ORDER,...META,amountArs:12000,declaredPages:1,
 quoteSha256:'b'.repeat(64),quoteRevision:'d1-approved-revision-3'
};
function fakeDB(){
 const orders=[],intents=[],items=[],statements=[];
 const prepare=sql=>{
  statements.push(sql);
  const s={sql,args:[],
   bind(...args){this.args=args;return this;},
   async run(){return {meta:{changes:1}}},
   async first(){
    if(sql.startsWith('SELECT i.web_order_id')){
     const found=intents.find(x=>x.web_order_id===s.args[0]&&x.file_id===s.args[1]);
     if(!found)return null;
     return {...found,order_status:orders.find(x=>x.id===found.commercial_order_id)?.status};
    }
    throw Error('consulta inesperada: '+sql);
   }
  };return s;
 };
 return {
  orders,intents,items,statements,
  db:{prepare,async batch(inserts){
   assert.equal(inserts.length,3);
   assert.match(inserts[0].sql,/INSERT INTO orders/);
   assert.match(inserts[1].sql,/INSERT INTO central_r2_prepaid_intents/);
   assert.match(inserts[2].sql,/R2_PREPAID_PLOT/);
   const [a,b,c]=inserts;
   if(intents.some(x=>x.web_order_id===b.args[0]&&x.file_id===b.args[1]))
    throw Error('UNIQUE');
   orders.push({id:a.args[0],amount_ars:a.args[2],status:'awaiting_payment'});
   intents.push({web_order_id:b.args[0],file_id:b.args[1],sha256:b.args[2],
    bytes:b.args[3],amount_ars:b.args[4],declared_pages:b.args[5],
    quote_sha256:b.args[6],quote_revision:b.args[7],
    commercial_order_id:b.args[8],state:'awaiting_upload_after_payment'});
   items.push({sku:'R2_PREPAID_PLOT',order_id:c.args[0],amount_ars:c.args[2]});
   return [];
  }}
 };
}
test('intención: declara exactamente un archivo/importe/tarifa aprobada',()=>{
 assert.equal(validarIntencionR2Prepaga(p),p);
 for(const invalid of [
  {...p,amountArs:0},{...p,sha256:'invalid'},
  {...p,bytes:201*1024*1024},{...p,quoteRevision:'catalogo-local'},
  {...p,quoteSha256:'1'},
  {...p,webOrderId:'WEB-FAKE-12345'},
  {...p,filesUploaded:true}
 ])assert.throws(()=>validarIntencionR2Prepaga(invalid),/R2_PREPAGO_INTENCION_INVALIDA/);
});
test('D1: crea orden, intención y SKU restringido de modo atómico, sin R2 ni MP',async()=>{
 const store=fakeDB(),env={CENTRAL_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',DB:store.db};
 const call=()=>registrarIntencionR2Prepaga(new Request('https://central.example/internal/central/r2-prepay-intent',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)
 }),env,{readSigned:async request=>({payload:await request.json()}),uuid:()=>UUID});
 const first=await call();
 assert.equal(first.status,201);
 const data=await first.json();
 assert.equal(data.commercialOrderId,UUID);
 assert.equal(data.amountArs,p.amountArs);
 assert.equal(data.filesUploaded,false);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(store.orders.length,1);
 assert.equal(store.intents.length,1);
 assert.equal(store.items.length,1);
 assert.equal(store.items[0].sku,'R2_PREPAID_PLOT');
 const second=await call();
 assert.equal(second.status,200);
 assert.equal((await second.json()).idempotent,true);
 assert.equal(store.orders.length,1);
 const conflict=await registrarIntencionR2Prepaga(new Request('https://central.example',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...p,amountArs:p.amountArs+1})
 }),env,{readSigned:async r=>({payload:await r.json()}),uuid:()=>UUID});
 assert.equal(conflict.status,409);
 assert.equal(store.orders.length,1);
});
test('Central: flags OFF nunca escriben ni crean tabla',async()=>{
 const store=fakeDB();
 const r=await registrarIntencionR2Prepaga(new Request('https://central.example'),{
  CENTRAL_R2_PREPAY_DRAFT_ENABLED:'OFF',DB:store.db
 },{readSigned:async()=>({payload:p})});
 assert.equal(r.status,503);
 assert.equal(store.statements.length,0);
});
test('Documentos: cotiza A1 de 150 MiB sin PDF/R2 y no acepta un total del comprador',async()=>{
 const requests=[];
 const env={
  DOCS_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'
 };
 const service={fetch:async signed=>{
  requests.push(signed);
  assert.equal(new URL(signed.url).pathname,'/internal/central/r2-prepay-intent');
  const raw=await signed.text(),payload=JSON.parse(raw);
  assert.equal(payload.schema,'saber-central-r2-prepaid-intent-v2');
  assert.equal(payload.quoteSnapshot.schema,'saber-r2-cotizacion-firmada-v1');
  assert.equal(payload.quoteSnapshot.importeArs,payload.amountArs);
  assert.equal(payload.quoteSnapshot.copias,1);
  assert.equal(payload.quoteSnapshot.rolloBase.startsWith('rollo'),true);
  assert.deepEqual(payload.quoteSnapshot.paginas[0].slice(0,3),[59.4,84.1,'cad']);
  assert.equal(payload.webOrderId,ORDER);
  assert.equal(payload.bytes,META.bytes);
  assert.ok(payload.amountArs>0);
  assert.equal(payload.quoteRevision,'d1-approved-revision-3');
  const mac=createHmac('sha256',SECRET)
   .update(signed.headers.get('x-saber-ts')+'\n'+
    signed.headers.get('x-saber-request-id')+'\n'+raw).digest('hex');
  assert.equal(mac,signed.headers.get('x-saber-signature'));
  return Response.json({ok:true,webOrderId:ORDER,commercialOrderId:UUID,
   amountArs:payload.amountArs,filesUploaded:false,paymentAuthorized:false,
   idempotent:false},{status:201});
 }};
 const body={webOrderId:ORDER,...META,archivos:[quote]};
 const make=obj=>new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-r2-prepago',{
  method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev',
   'Content-Type':'application/json'},body:JSON.stringify(obj)
 });
 const ok=await prepararR2PagoSinArchivo(make(body),env,{
  authorized:true,priceLoader,service,now:()=>TS,nonce:()=>UUID,
  subtle:webcrypto.subtle
 });
 const response=await ok.json();
 assert.equal(ok.status,201,JSON.stringify(response));
 assert.equal(response.filesUploaded,false);
 assert.equal(response.paymentAuthorized,false);
 assert.equal(response.checkoutEnabled,false);
 assert.equal(response.commercialOrderId,UUID);
 assert.equal(requests.length,1);
 const forged=await prepararR2PagoSinArchivo(make({...body,amountArs:1}),env,{
  authorized:true,priceLoader,service,now:()=>TS,nonce:()=>UUID,
  subtle:webcrypto.subtle
 });
 assert.equal(forged.status,422);
 assert.equal(requests.length,1);
 const expired=await prepararR2PagoSinArchivo(make(body),env,{
  authorized:true,priceLoader:async()=>({
   source:'local',revision:3,prices:{...prices,priceVersion:'catalogo-local'}
  }),service
 });
 assert.equal(expired.status,422);
 assert.equal(requests.length,1);
});
test('Documentos: sesión ausente nunca consulta D1 ni crea pedido',async()=>{
 let calls=0;
 const service={fetch:async()=>{calls++;return Response.json({ok:false})}};
 const r=await prepararR2PagoSinArchivo(new Request('https://example.com'),{
  DOCS_R2_PREPAY_DRAFT_ENABLED:'PRIVATE_TEST_ONLY'
 },{authorized:false,service});
 assert.equal(r.status,401);
 assert.equal(calls,0);
});

test('Validador R2 v2 rechaza alterar páginas, importe o parámetros antes del registro',()=>{
 const snapshot={schema:'saber-r2-cotizacion-firmada-v1',nombre:'A1.pdf',
  seleccion:'original',modoImpresion:'bn',copias:1,papelPoster:'obra80',
  rolloBase:'rollo60',importeArs:12000,paginas:[[59.4,84.1,'cad','rollo60','obra80']]};
 const valid={...p,schema:'saber-central-r2-prepaid-intent-v2',quoteSnapshot:snapshot};
 assert.equal(validarIntencionR2Prepaga(valid),valid);
 for(const bad of [
  {...valid,quoteSnapshot:{...snapshot,importeArs:1}},
  {...valid,quoteSnapshot:{...snapshot,paginas:[]}},
  {...valid,quoteSnapshot:{...snapshot,paginas:[[59.4,84.1,'poster','rollo60','obra80'],[1,1,'cad','rollo60','obra80']]}},
  {...valid,quoteSnapshot:{...snapshot,paginas:[[59.4,84.1,'cad','rec60','recubierto']]}},
  {...valid,quoteSnapshot:{...snapshot,rolloBase:'../../otro'}}
 ])assert.throws(()=>validarIntencionR2Prepaga(bad),/R2_PREPAGO_INTENCION_INVALIDA/);
});
