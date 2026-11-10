import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightOriginalR2Live} from './r2-live-preflight-documentos.mjs';
const ON='GO_COMERCIAL_CONFIRMADO',WEB='WEB-ENSAYO-'+'A'.repeat(32);
const HOST='https://pedidos.libreriasaber.com.ar';
const input={orderId:WEB,fileId:'pdf_0',name:'Panel.pdf',
 bytes:60*1048576,sha256:'a'.repeat(64),pages:1};
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_R2_GATE:ON,
 DOCS_LIVE_RECEPCION_GATE:ON,DOCS_MP_LIVE_GATE:ON};
const req=(obj=input,host=HOST)=>new Request(host+'/api/pedido/live/r2/preflight',{
 method:'POST',headers:{Origin:host,'Content-Type':'application/json'},
 body:JSON.stringify(obj)});
test('R2 no solicita pago si gate o sesión están cerrados',async()=>{
 for(const [patch,auth,host] of [[{},false,HOST],
  [{DOCS_LIVE_R2_GATE:'NO_GO'},true,HOST],
  [{DOCS_LIVE_RECEPCION_GATE:'NO_GO'},true,HOST],
  [{SABER_ENTORNO:'preparacion'},true,HOST],
  [{},true,'https://saber-documentos-pruebas.workers.dev']]){
  let calls=0;
  const r=await preflightOriginalR2Live(req(input,host),{...env,...patch},{
   authorized:auth,check:async()=>{calls++;return {}}});
  assert.equal(r.status,503);assert.equal(calls,0);
 }
});
test('R2 preflight pagado no entrega token, reserva ni permisos para producción',async()=>{
 const calls=[];
 const r=await preflightOriginalR2Live(req(),env,{authorized:true,
  check:async(_env,x)=>{calls.push(x);return {ok:true,webOrderId:WEB,fileId:x.fileId}}});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.paymentVerified,true);
 assert.equal(body.uploadAuthorized,false);
 assert.equal(body.storageReserved,false);
 assert.equal(body.productionAuthorized,false);
 assert.equal(body.next,'R2_WAITING_FOR_MULTIPART');
 assert.deepEqual(calls,[input]);
});
test('sin pago verificado devuelve error sin almacenar',async()=>{
 const r=await preflightOriginalR2Live(req(),env,{authorized:true,
  check:async()=>{throw Error('PAGO_PENDIENTE')}});
 assert.equal(r.status,402);
 assert.equal((await r.json()).ok,false);
});
test('JSON alterado no consulta Central',async()=>{
 let calls=0;
 const r=await preflightOriginalR2Live(req({...input,pagado:true}),env,{
  authorized:true,check:async()=>{calls++}});
 assert.equal(r.status,422);assert.equal(calls,0);
});
