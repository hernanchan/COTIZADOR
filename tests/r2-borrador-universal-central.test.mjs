import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {verificarFichaUniversal,registrarFichaUniversalD1,listarFichasR2Universales} from '../integraciones/mercadopago/pruebas/r2-lote-universal-central.mjs';
import {guardarBorradorUniversal} from '../integraciones/autocotizador/recepcion/r2-borrador-universal-documentos.mjs';
const MIB=1048576;
const webOrderId='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const uid='12345678-1234-4123-8123-123456789abc';
const secret='puente-universal-privado-pruebas-20261109';
const tarifario={source:'private-d1-approved-only',revision:8,
 prices:{...prices,priceVersion:'d1-approved-revision-8'}};
const a4=name=>({nombre:name,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:2,modo:'bn',caras:'double',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
const archivos=[a4('Apuntes.pdf'),a4('Resumen.pdf'),{...a4('Panel.pdf'),
 paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]}];
const manifiestos=archivos.map((f,i)=>({fileId:'pdf_'+i,nombre:f.nombre,
 sha256:String(i+1).repeat(64),bytes:[60*MIB,2*MIB,150*MIB][i]}));
const ficha=()=>fichaPrearchivoUniversal({webOrderId,archivos,manifiestos,tarifario});
async function firmada(q){const digest=await webcrypto.subtle.digest('SHA-256',
 new TextEncoder().encode(JSON.stringify(q)));
 return {...q,quoteHash:Buffer.from(digest).toString('hex')};}
function fakeDB(){
 const drafts=[],files=[],queries=[];
 return {drafts,files,queries,db:{
  prepare(sql){queries.push(sql);return {sql,args:[],bind(...a){this.args=a;return this},
    async run(){return {meta:{changes:1}}},
    async first(){if(sql.startsWith('SELECT draft_id'))
      return drafts.find(r=>r.web_order_id===this.args[0])||null;
      throw Error('SQL no simulado '+sql)}}},
  async batch(statements){
   assert.equal(statements.length,4);
   if(drafts.length)throw Error('UNIQUE');
   const a=statements[0].args;
   drafts.push({web_order_id:a[0],draft_id:a[1],quote_hash:a[2],
    total_ars:a[4],file_count:a[5],state:'draft_not_payable'});
   for(const x of statements.slice(1))files.push({
    webOrderId:x.args[0],fileId:x.args[1],transport:x.args[6],
    trabajo:JSON.parse(x.args[8])});
  }
 }};
}
test('un solo lote con tres PDFs y configuración completa por archivo',()=>{
 const q=ficha();
 assert.deepEqual(q.archivos.map(x=>x.transporte),['r2','tus','r2']);
 assert.deepEqual(q.archivos.map(x=>x.destino),['documentos','documentos','ploteos']);
 assert.equal(q.archivos[0].detalle.caras,'double');
 assert.equal(q.archivos[0].configuracion.copias,2);
 assert.equal(q.archivos[2].detalle.paginas[0].modo,'cad');
 assert.equal(q.totalArs,q.archivos.reduce((n,f)=>n+f.importeArs,0));
 assert.equal(q.pagoAutorizado,false);
});
test('Central: lote se graba atómicamente y reintento no duplica',async()=>{
 const mock=fakeDB(),payload=await firmada(ficha());
 await verificarFichaUniversal(payload,{subtle:webcrypto.subtle});
 const env={CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',DB:mock.db};
 const call=x=>registrarFichaUniversalD1(new Request('https://central.invalid',{method:'POST',
  body:JSON.stringify(x)}),env,{
  readSigned:async req=>({payload:await req.json()}),subtle:webcrypto.subtle,uuid:()=>uid});
 const first=await call(payload);
 assert.equal(first.status,201,JSON.stringify(await first.clone().json()));
 assert.equal((await first.json()).checkoutEnabled,false);
 assert.equal(mock.drafts.length,1);assert.equal(mock.files.length,3);
 assert.deepEqual(mock.files.map(x=>x.transport),['r2','tus','r2']);
 assert.equal(mock.files[0].trabajo.detalle.caras,'double');
 const again=await call(payload);
 assert.equal(again.status,200);
 assert.equal((await again.json()).idempotent,true);
 assert.equal(mock.drafts.length,1);assert.equal(mock.files.length,3);
 const changed=await firmada({...ficha(),totalArs:ficha().totalArs+1});
 assert.equal((await call(changed)).status,422);
 const other=await firmada({...ficha(),archivos:ficha().archivos.map((f,i)=>i===2?
  {...f,configuracion:{...f.configuracion,copias:3}}:f)});
 assert.equal((await call(other)).status,409);
});
test('Central rechaza manipulación, archivo repetido, ruta falsa y estado OFF',async()=>{
 const p=await firmada(ficha());
 for(const x of [
  {...p,quoteHash:'0'.repeat(64)},
  await firmada({...ficha(),archivos:ficha().archivos.map((f,i)=>i===1?{...f,fileId:'pdf_0'}:f)}),
  await firmada({...ficha(),archivos:ficha().archivos.map((f,i)=>i===0?{...f,transporte:'tus'}:f)})
 ])await assert.rejects(verificarFichaUniversal(x,{subtle:webcrypto.subtle}));
 const fake=fakeDB();
 const r=await registrarFichaUniversalD1(new Request('https://central.invalid'),
 {CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'OFF',DB:fake.db},
 {readSigned:async()=>({payload:p}),subtle:webcrypto.subtle});
 assert.equal(r.status,503);assert.equal(fake.queries.length,0);
});
test('Documentos firma HMAC y no crea preferencias de pago',async()=>{
 let sent=0;
 const service={fetch:async request=>{
  sent++;
  assert.equal(new URL(request.url).pathname,'/internal/central/r2-universal-draft');
  const body=await request.text(),payload=JSON.parse(body);
  const mac=createHmac('sha256',secret).update(
   request.headers.get('x-saber-ts')+'\n'+request.headers.get('x-saber-request-id')+'\n'+body).digest('hex');
  assert.equal(request.headers.get('x-saber-signature'),mac);
  return Response.json({ok:true,draftId:uid,webOrderId,totalArs:payload.totalArs,
   fileCount:payload.archivos.length,idempotent:false,checkoutEnabled:false,
   filesUploaded:false,paymentAuthorized:false,productionAuthorized:false},{status:201});
 }};
 const env={DOCS_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY',DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:secret,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const make=x=>new Request(url+'/prueba-v2/api/ensayo-r2-borrador-universal',{
  method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(x)});
 const opts={authorized:true,priceLoader:async()=>tarifario,service,now:()=>1793970000,
  nonce:()=>uid,subtle:webcrypto.subtle};
 const result=await guardarBorradorUniversal(make({webOrderId,archivos,manifiestos}),env,opts);
 assert.equal(result.status,201,JSON.stringify(await result.clone().json()));
 assert.equal((await result.json()).paymentAuthorized,false);
 const invalid=await guardarBorradorUniversal(make({webOrderId,archivos,manifiestos,totalArs:1}),env,opts);
 assert.equal(invalid.status,422);assert.equal(sent,1);
});


test('lectura de Central: sólo personal, ficha con tres trabajos y sin autorización',async()=>{
 const q=await firmada(ficha()),uuid='12345678-1234-4123-8123-123456789abc';
 const db={prepare(sql){
  return {bind(){return this},async all(){
   if(sql.includes('sqlite_master'))return {results:[{name:'central_r2_universal_drafts'},{name:'central_r2_universal_files'}]};
   if(sql.includes('FROM central_r2_universal_drafts'))return {results:[{
    web_order_id:webOrderId,draft_id:uuid,quote_hash:q.quoteHash,
    price_revision:q.priceRevision,total_ars:q.totalArs,file_count:q.archivos.length,
    armados_json:JSON.stringify(q.armados),state:'draft_not_payable',
    created_at:'2026-11-09 18:00:00'}]};
   if(sql.includes('FROM central_r2_universal_files'))return {results:q.archivos.map((x,i)=>({
    file_id:x.fileId,ordinal:i,name:x.nombre,sha256:x.sha256,bytes:x.bytes,
    transport:x.transporte,service:x.destino,work_json:JSON.stringify(x),
    status:'not_received'}))};
   throw Error('Consulta no simulada');
  }};
 }};
 const env={CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED:'PRIVATE_TEST_ONLY',DB:db};
 const req=new Request('https://central.invalid/admin/api/central/r2-universal-drafts');
 const denied=await listarFichasR2Universales(req,env,{authorized:false});
 assert.equal(denied.status,401);
 const accepted=await listarFichasR2Universales(req,env,{authorized:true});
 const data=await accepted.json();
 assert.equal(data.count,1);assert.equal(data.drafts[0].fileCount,3);
 assert.deepEqual(data.drafts[0].trabajos.map(x=>x.transporte),['r2','tus','r2']);
 assert.equal(data.drafts[0].trabajos[0].detalle.caras,'double');
 assert.equal(data.drafts[0].productionAuthorized,false);
 assert.equal(data.drafts[0].checkoutEnabled,false);
});


test('A3 pesado y anillado conjunto TUS/R2 conservan desglose único',()=>{
 const docs=[
  {...a4('Libro grande.pdf'),anillado:'grupo',grupoAnillado:'1'},
  {...a4('Capitulos.pdf'),anillado:'grupo',grupoAnillado:'1'},
  {...a4('Lámina A3.pdf'),paginas:[{numero:1,anchoCm:29.7,altoCm:42,modo:'sin-clasificar'}]}
 ];
 const meta=docs.map((a,i)=>({fileId:'f_'+i,nombre:a.nombre,
  sha256:String(i+3).repeat(64),bytes:[60*MIB,2*MIB,70*MIB][i]}));
 const q=fichaPrearchivoUniversal({webOrderId,archivos:docs,manifiestos:meta,tarifario});
 assert.deepEqual(q.archivos.map(f=>f.transporte),['r2','tus','r2']);
 assert.equal(q.archivos[2].formatoFinal,'a3');
 assert.equal(q.archivos[2].destino,'documentos');
 assert.equal(q.armados.length,1);
 assert.equal(q.armados[0].archivos.length,2);
 assert.equal(q.armados[0].grupo,'1');
 assert.equal(q.totalArs,q.archivos.reduce((sum,f)=>sum+f.importeArs,0)+q.armados[0].subtotal);
 assert.ok(q.armados[0].subtotal>0);
});
