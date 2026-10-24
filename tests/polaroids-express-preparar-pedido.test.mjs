import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {prepararPedidoComercialExpress} from '../integraciones/polaroids/express/preparar-pedido-comercial.mjs';

const referencia='POL-'+'A'.repeat(24);
const orderId=randomUUID(),clientOrderId=randomUUID();
const key='central-bridge-secret-for-private-test-2026';
const destination='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-prepare-order';
function mock({status=201,state='awaiting_payment',checkoutEnabled=false}={}){
 let requests=0;
 const env={EXPRESS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:key,EXPRESS_PDF_HMAC_KEY:'separate-pdf-hmac-secret',
  CENTRAL_EXPRESS_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage',
  SABER_CENTRAL:{async fetch(request){
   requests++;
   assert.equal(request.url,destination);
   assert.equal(request.method,'POST');
   assert.equal(request.headers.get('Origin'),null);
   const timestamp=request.headers.get('x-saber-ts');
   const id=request.headers.get('x-saber-request-id');
   const body=await request.text();
   assert.equal(request.headers.get('x-saber-signature'),
    createHmac('sha256',key).update(timestamp+'\n'+id+'\n'+body).digest('hex'));
   assert.deepEqual(JSON.parse(body),{clientOrderId,referencia,
    items:[{code:'ABC-1',qty:2}]});
   return Response.json({created:true,idempotent:false,commercial_order_id:orderId,
    amount_ars:10000,state,checkoutEnabled,paymentAuthorized:false},{status});
  }}};
 return {env,calls:()=>requests};
}
const send=({env},overrides={})=>prepararPedidoComercialExpress({
 referencia,clientOrderId,items:[{code:'ABC-1',qty:2}],
 env,subtle:webcrypto.subtle,requestId:randomUUID,...overrides});
test('HMAC por Service Binding registra pedido sin iniciar checkout',async()=>{
 const state=mock(),result=await send(state);
 assert.equal(result.created,true);
 assert.equal(result.checkoutEnabled,false);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.amountArs,10000);
 assert.equal(result.commercialOrderId,orderId);
 assert.equal(state.calls(),1);
});
test('sin interruptor de preparación o sin binding, no consulta Central',async()=>{
 const state=mock();
 await assert.rejects(()=>send(state,{env:{...state.env,EXPRESS_ORDER_PREPARE_ENABLED:''}}));
 await assert.rejects(()=>send(state,{env:{...state.env,SABER_CENTRAL:undefined}}));
 assert.equal(state.calls(),0);
});
test('rechaza comprador inválido y artículos repetidos antes de firmar',async()=>{
 const state=mock();
 await assert.rejects(()=>send(state,{clientOrderId:'no-uuid'}));
 await assert.rejects(()=>send(state,{items:[{code:'ABC-1',qty:1},{code:'ABC-1',qty:2}]}));
 assert.equal(state.calls(),0);
});
test('no acepta orden si el backend intenta habilitar cobro',async()=>{
 const state=mock({checkoutEnabled:true});
 await assert.rejects(()=>send(state),/pago no autorizado/);
 assert.equal(state.calls(),1);
});
test('no acepta estados de pago o respuestas erróneas de la Central',async()=>{
 for(const response of [{state:'paid'},{status:409}]){
  const state=mock(response);
  await assert.rejects(()=>send(state));
 }
});
