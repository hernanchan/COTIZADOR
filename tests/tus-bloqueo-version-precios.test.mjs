import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
import {verificarVersionPrecioPedido,finalizarPedidoTUSPrivado} from '../integraciones/autocotizador/recepcion/tus-pedido-worker.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const direct=read('integraciones/autocotizador/recepcion/tus-directo-cliente.mjs');
const page=paginaCotizadorV2PruebaPrivada('0123456789abcdef',true,{invalidos:[]});
const testEnv={
 DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_RECEIPT_KEY:'private_receipt_key_longer_than_32_characters',
 DOCS_TUS_SUPABASE_SERVICE_KEY:'private_key_example_00000000000000000000000000000000',
 DOCS_TUS_PUBLISHABLE_KEY:'sb_publishable_example_00000000000000000000000000000',
 CENTRAL_BRIDGE_KEY:'private_bridge_key_0000000000000000000000000000',
 DOCS_CENTRAL_ADMIN_KEY:'admin_key_example_00000000000000000000000000000',
 DOCS_RELAY_KEY:'relay_key_example_00000000000000000000000000000',
};
const serverPrices={priceVersion:'d1-approved-revision-5'};
test('si D1 está activo, la versión exacta debe coincidir y no admite ausencia de revisión',()=>{
 assert.equal(verificarVersionPrecioPedido({
  versionVista:'d1-approved-revision-5',preciosServidor:serverPrices,tarifarioD1Activo:true}).ok,true);
 for(const expected of [undefined,'', 'd1-approved-revision-4','d1-approved-revision-999',
  'legacy-5', 'd1-approved-revision-0']){
  assert.equal(verificarVersionPrecioPedido({versionVista:expected,
   preciosServidor:serverPrices,tarifarioD1Activo:true}).ok,false);
 }
 assert.equal(verificarVersionPrecioPedido({versionVista:'d1-approved-revision-4',
  preciosServidor:serverPrices,tarifarioD1Activo:false}).ok,true,
  'Sin el flag D1, no cambia el circuito de legado');
});
test('TUS rechaza versión vieja con HTTP 409 ANTES de leer PDF o escribir D1',async()=>{
 let reads=0,registers=0;
 const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-tus-registrar';
 const request=new Request(url,{method:'POST',headers:{
  Origin:new URL(url).origin,'Content-Type':'application/json'},
  body:JSON.stringify({orderId:'WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF',
   clientOrderId:'5f4ed4b1-2d7c-4446-aee6-36e9fd1e7a22',
   expectedPriceVersion:'d1-approved-revision-4',
   entries:[{proof:'invalido',opciones:{}}]})
 });
 const answer=await finalizarPedidoTUSPrivado(request,testEnv,{
  authorized:true,preciosServidor:serverPrices,
  fetcher:async()=>{reads++;throw Error('No debe consultar Storage')},
  registrar:async()=>{registers++;throw Error('No debe escribir D1')},
  preparar:async()=>{registers++;throw Error('No debe crear orden')},
 });
 assert.equal(answer.status,409);
 const data=await answer.json();
 assert.equal(data.ok,false);
 assert.equal(data.code,'TARIFA_MODIFICADA');
 assert.equal(data.paymentAuthorized,false);
 assert.equal(reads,0);
 assert.equal(registers,0);
});
test('Portal comprueba versión antes de iniciar subida y avisa qué pasó',()=>{
 assert.match(page,/preciosVistos=await catalogPromise/);
 assert.match(page,/if\(vigente\.priceVersion!==preciosVistos\.priceVersion\)/);
 assert.match(page,/TARIFA_ANTES_DE_SUBIR/);
 assert.match(page,/No se subieron archivos/);
 assert.match(page,/expectedPriceVersion/);
 assert.match(page,/TARIFA_MODIFICADA/);
 assert.match(direct,/expectedPriceVersion/);
 assert.match(direct,/code==='TARIFA_MODIFICADA'/);
 assert.match(direct,/entries:trabajos\.map/);
});
