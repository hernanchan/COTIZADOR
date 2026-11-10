import test from 'node:test';
import assert from 'node:assert/strict';
import {iniciarCheckoutLiveCliente,LIVE_CHECKOUT_STORAGE_KEY} from './checkout-live-cliente.mjs';
const origin='https://pedidos.libreriasaber.com.ar';
const orden={webOrderId:'WEB-ENSAYO-'+'A'.repeat(32),
 commercialOrderId:'123e4567-e89b-42d3-a456-426614174000',
 amountArs:24500,fileCount:1};
const mp='https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc';
function context(data,options={}){
 const saved=new Map(),calls=[];
 return {calls,saved,params:{orden,origin,storage:{setItem:(k,v)=>saved.set(k,v)},
  fetcher:async(path,init)=>{
   calls.push({path,init});
   return {ok:true,json:async()=>({ok:true,...orden,uploadAuthorized:false,
    productionAuthorized:false,checkoutUrl:mp,...data})};
  },...options}};
}
test('inicia solo con orden productiva coincidente, POST mismo origen y conserva IDs antes de redirigir',async()=>{
 const c=context();
 const url=await iniciarCheckoutLiveCliente(c.params);
 assert.equal(url,mp);
 assert.equal(c.calls.length,1);
 assert.equal(c.calls[0].path,'/api/pedido/live/checkout');
 assert.equal(c.calls[0].init.credentials,'same-origin');
 assert.equal(JSON.parse(c.calls[0].init.body).action,'start');
 assert.deepEqual(JSON.parse(c.saved.get(LIVE_CHECKOUT_STORAGE_KEY)),{
  webOrderId:orden.webOrderId,commercialOrderId:orden.commercialOrderId});
});
test('no hay petición ni referencia persistida desde sandbox, ni con orden mal formada',async()=>{
 for(const options of [
  {origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev'},
  {orden:{...orden,amountArs:-1}},
  {orden:{...orden,webOrderId:'OTRA-ORDEN'}},
  {orden:{...orden,secret:'no'}},
 ]){
  const c=context(null,options);
  await assert.rejects(iniciarCheckoutLiveCliente(c.params));
  assert.equal(c.calls.length,0);
  assert.equal(c.saved.size,0);
 }
});
test('rechaza discrepancias y enlaces externos antes de conservar sesión',async()=>{
 for(const data of [
  {amountArs:1},{fileCount:2},{uploadAuthorized:true},
  {productionAuthorized:true},{checkoutUrl:'https://evil.example/pago'},
  {checkoutUrl:'http://www.mercadopago.com.ar/'},
  {checkoutUrl:'https://www.mercadopago.com.ar.evil.example/pago'}
 ]){
  const c=context(data);
  await assert.rejects(iniciarCheckoutLiveCliente(c.params));
  assert.equal(c.saved.size,0);
 }
});
