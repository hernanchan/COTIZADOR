import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import {consultarPaqueteTUSPersonal} from '../integraciones/autocotizador/recepcion/tus-paquete-personal.mjs';
const repoSource=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
 AbortSignal,fetch:()=>{throw Error('No network in test')}});
vm.runInContext(repoSource.replace('export default {','globalThis.worker = {'),ctx);
const webOrderId='WEB-ENSAYO-01937C3514FB89DC23D78AE7BCBCDDDD';
const orderId='e2d76c8b-ce1c-4daf-9030-4bd402295a68';
const receipt='DOC-1175c8c4-fac1-4cd2-bc71-23104635ecd3';
const key='TEST-CENTRAL-BRIDGE-KEY-UNIQUE-123456789-A';
const manifest={schema:'saber-central-documentos-d1-v1',webOrderId,
 trabajos:[{orden:1,nombreOriginal:'original.pdf',reciboPrivado:receipt,
  servicio:'documentos',paginasOriginales:16,paginasElegidas:[1,2,3],
  copias:1,formatoFinal:'a4',carasPresupuestadas:'double',modo:'bn',
  paginasPorCaraPresupuestadas:1,tipoAnillado:'individual',
  bytes:10131027,sha256:'b'.repeat(64),fileId:'FILE1'}]};
const db={prepare(sql){
 let args=[];
 const stmt={
  bind(...xs){args=xs;return stmt},
  async run(){return {meta:{changes:0}}},
  async first(){
   if(sql.includes('FROM central_document_manifests m JOIN orders o')&&
     sql.includes('JOIN central_work_order_numbers')){
    return args[0]===webOrderId?{
     web_order_id:webOrderId,commercial_order_id:orderId,
     manifest_json:JSON.stringify(manifest),amount_ars:2432,
     file_count:1,number:1,status:'awaiting_payment'
    }:null;
   }
   return null;
  }
 };
 return stmt;
}};
const env={DB:db,CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:key,DEMO_ADMIN_KEY:'OTHER_ADMIN_KEY',
 MP_WEBHOOK_SECRET:'NOT_BRIDGE',MP_TEST_ACCESS_TOKEN:'FAKE',
 MP_TEST_SELLER_ID:'TEST',TEST_WEBHOOK_URL:'https://example.invalid/test',
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
async function signed(body){
 const raw=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000));
 const nonce=randomUUID();
 const imported=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(key),
 {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await webcrypto.subtle.sign('HMAC',imported,
 new TextEncoder().encode(timestamp+'\n'+nonce+'\n'+raw)));
 return new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/tus-package',{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':timestamp,'x-saber-request-id':nonce,
   'x-saber-signature':Buffer.from(signed).toString('hex')},body:raw});
}
test('Central devuelve ficha numerada solo a Worker firmado y preserva opciones',async()=>{
 const unauth=await ctx.worker.fetch(new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/tus-package',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({schema:'saber-central-tus-package-v1',webOrderId})
 }),env);
 assert.equal(unauth.status,401);
 const r=await ctx.worker.fetch(await signed({schema:'saber-central-tus-package-v1',webOrderId}),env);
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.numeroOrden,'001');
 assert.equal(body.trabajos.length,1);
 assert.equal(body.trabajos[0].carasPresupuestadas,'double');
 assert.equal(body.trabajos[0].tipoAnillado,'individual');
 assert.equal(body.paymentAuthorized,false);
 assert.equal(body.listoParaProducir,false);
 assert.ok(!JSON.stringify(body).includes('https://qkbbqzbannyhuanngjpw'));
});
test('Portal Basic rechaza llamadas de clientes y devuelve ficha firmada al operador',async()=>{
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-tus-paquete-manifiesto';
 const request=()=>new Request(url,{method:'POST',headers:{
  Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev',
  'Content-Type':'application/json'},body:JSON.stringify({webOrderId})});
 const service={fetch:async req=>ctx.worker.fetch(req,env)};
 const cfEnv={
  DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_RECEIPT_KEY:'different-tus-secret-01234567890000123',
  DOCS_TUS_SUPABASE_SERVICE_KEY:'A'.repeat(80),
  DOCS_TUS_PUBLISHABLE_KEY:'sb_publishable_dummy_test_key_0123456789',
  CENTRAL_BRIDGE_KEY:key,
  SABER_CENTRAL:service,CENTRAL_TEST_URL:env.CENTRAL_TEST_URL
 };
 const deny=await consultarPaqueteTUSPersonal(request(),cfEnv,{authorized:false,service});
 assert.equal(deny.status,403);
 const ok=await consultarPaqueteTUSPersonal(request(),cfEnv,{authorized:true,service});
 assert.equal(ok.status,200);
 const body=await ok.json();
 assert.equal(body.numeroOrden,'001');
 assert.equal(body.trabajos[0].nombreOriginal,'original.pdf');
});


test('Central devuelve en paquete privado el detalle inmutable por página de ploteo',async()=>{
 const plano={orden:1,nombreOriginal:'Plano y póster.pdf',reciboPrivado:receipt,
  servicio:'ploteos',paginasOriginales:2,paginasElegidas:[1,2],
  copias:2,formatoFinal:'original',bytes:10131027,
  planoPorPagina:[
   {numeroOriginal:1,modo:'cad',anchoCm:60,altoCm:85,rollo:'rollo60',papel:'obra80'},
   {numeroOriginal:2,modo:'poster',anchoCm:60,altoCm:85,rollo:'rec60',papel:'recubierto'}
  ]};
 const modified={...manifest,trabajos:[plano]};
 const fakeDb={prepare(sql){
  if(sql.includes('FROM central_document_manifests m JOIN orders o')&&
     sql.includes('JOIN central_work_order_numbers')){
   let order;
   const item={bind(...args){order=args[0];return item},
    async first(){return order===webOrderId?{web_order_id:webOrderId,
     commercial_order_id:orderId,manifest_json:JSON.stringify(modified),
     amount_ars:2432,file_count:1,number:1,status:'awaiting_payment'}:null}};
   return item;
  }
  return db.prepare(sql);
 }};
 const r=await ctx.worker.fetch(await signed({schema:'saber-central-tus-package-v1',webOrderId}),
  {...env,DB:fakeDb});
 assert.equal(r.status,200);
 const result=await r.json();
 const t=result.trabajos[0];
 assert.equal(t.servicio,'ploteos');
 assert.equal(t.planoPorPagina.length,2);
 assert.deepEqual(Array.from(t.planoPorPagina,p=>p.modo),['cad','poster']);
 assert.equal(t.planoPorPagina[1].rollo,'rec60');
 assert.equal(t.planoPorPagina[1].papel,'recubierto');
 assert.equal(result.paymentAuthorized,false);
});
