import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
import {recuperarPedidoTUSPrivado} from '../integraciones/autocotizador/recepcion/tus-pedido-worker.mjs';

const orderId='WEB-ENSAYO-'+'A'.repeat(32);
const clientOrderId=randomUUID();
const env={
 DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_RECEIPT_KEY:'r'.repeat(48),
 DOCS_TUS_SUPABASE_SERVICE_KEY:'s'.repeat(60),
 DOCS_TUS_PUBLISHABLE_KEY:'p'.repeat(40),
 CENTRAL_BRIDGE_KEY:'b'.repeat(40),
 DOCS_RELAY_KEY:'x'.repeat(40),
 DOCS_CENTRAL_ADMIN_KEY:'y'.repeat(40)
};
const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-tus-recuperar';
function request(data={orderId,clientOrderId}){
 return new Request(url,{method:'POST',headers:{
  Origin:new URL(url).origin,'Content-Type':'application/json'
 },body:JSON.stringify(data)});
}
const confirmed={
 created:true,commercialOrderId:randomUUID(),numeroOrden:'007',
 amountArs:12576,idempotent:true,checkoutEnabled:false,paymentAuthorized:false
};
test('recuperación TUS sin PDF devuelve el número real idempotente de D1',async()=>{
 let calls=0;
 const response=await recuperarPedidoTUSPrivado(request(),env,{
  authorized:true,preparar:async args=>{
   calls++;
   assert.equal(args.webOrderId,orderId);
   assert.equal(args.clientOrderId,clientOrderId);
   assert.deepEqual(args.items,[]);
   return confirmed;
  }
 });
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.equal(body.numeroOrden,'007');
 assert.equal(body.totalArs,12576);
 assert.equal(body.webOrderId,orderId);
 assert.equal(body.idempotent,true);
 assert.equal(body.paymentAuthorized,false);
 assert.equal(body.checkoutEnabled,false);
 assert.equal(body.listoParaProducir,false);
 assert.equal(calls,1);
});
test('ni una llamada a la Central sin autorización, ID válido o flags privados',async()=>{
 let calls=0;
 const preparar=async()=>{calls++;return confirmed};
 for(const [req,e,auth] of [
  [request(),env,false],
  [request({...{orderId,clientOrderId},orderId:'WEB-INVÁLIDO'}),env,true],
  [request(),{...env,DOCS_TUS_PRIVATE_ENABLED:'NO'},true]
 ]){
  const response=await recuperarPedidoTUSPrivado(req,e,{authorized:auth,preparar});
  assert.equal(response.status,409);
  const body=await response.json();
  assert.equal(body.paymentAuthorized,false);
 }
 assert.equal(calls,0);
});
test('nunca se confirma un pedido sin un número verificado',async()=>{
 const res=await recuperarPedidoTUSPrivado(request(),env,{
  authorized:true,preparar:async()=>({...confirmed,numeroOrden:null})
 });
 assert.equal(res.status,409);
 assert.equal((await res.json()).ok,false);
});
test('el navegador recupera el número visible del pedido sin subir PDF',async()=>{
 const html=paginaCotizadorV2PruebaPrivada('test-sitekey',true);
 const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js,'Falta el módulo de portal privado');
 const start=js.indexOf('async function recuperarNumeroCentralTUS(){');
 // Aislar la función TUS: la pantalla incluye ahora otros controladores R2.
 const end=js.indexOf('const r2Panel=',start);
 assert.ok(start>=0&&end>start);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('fetch','document','mostrarEstadoCliente',
  'TUS_ENABLED','orderId','clientOrderId',
  'let registeredOrder=null,registeredShortOrder=null,ultimoTotalServidor=null;\n'+
   js.slice(start,end)+
   '\nconst ok=await recuperarNumeroCentralTUS();return {ok,registeredOrder,registeredShortOrder,ultimoTotalServidor};');
 const price={textContent:''},shown=[],called=[];
 const fetcher=async(path,options)=>{
  called.push({path,options});
  return new Response(JSON.stringify({ok:true,webOrderId:orderId,
   orderId:confirmed.commercialOrderId,numeroOrden:'007',totalArs:12576,
   checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 };
 const result=await run(fetcher,{getElementById:()=>price},
  (...args)=>shown.push(args),true,orderId,clientOrderId);
 assert.equal(result.ok,true);
 assert.equal(result.registeredShortOrder,'007');
 assert.equal(result.ultimoTotalServidor,12576);
 assert.match(price.textContent,/Orden N.º 007/);
 assert.equal(shown[0][0],'registrado');
 assert.equal(called.length,1);
 assert.match(called[0].path,/ensayo-tus-recuperar/);
 assert.deepEqual(JSON.parse(called[0].options.body),{orderId,clientOrderId});
});
