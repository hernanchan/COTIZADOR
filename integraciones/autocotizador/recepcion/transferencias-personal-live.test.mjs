import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {transferenciasPersonalLive} from './transferencias-personal-live.mjs';
import {paginaTransferenciasPersonalLive,jsTransferenciasPersonalLive}
 from './pantalla-transferencias-personal-live.mjs';
import {leerFirmaInternaLive} from '../../mercadopago/pruebas/central-live-bridge.mjs';
const DOC='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar';
const ID='123e4567-e89b-42d3-a456-426614174000';
const BRIDGE='test-HMAC-secret-key-that-is-more-than-32-bytes-123';
const GO='GO_COMERCIAL_CONFIRMADO',now=1794480000;
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_LIVE_TRANSFER_GATE:GO,DOCS_LIVE_STAFF_GATE:GO,
 DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_PACKAGE_GATE:GO,
 MP_LIVE_GATE:GO,CENTRAL_LIVE_BRIDGE_ENABLED:GO,
 CENTRAL_BRIDGE_KEY:BRIDGE
};
const request=(path,method='GET',body,origin=DOC)=>new Request(DOC+path,{
 method,headers:body?{'Content-Type':'application/json',Origin:origin}:undefined,
 body:body?JSON.stringify(body):undefined
});
const pendingPath='/personal/api/live-transferencias-pendientes';
const approvePath='/personal/api/live-transferencias-aprobar';
function mockedCentral(){
 let calls=0,approvals=0;
 return {get calls(){return calls},get approvals(){return approvals},service:{
  async fetch(r){
   calls++;
   assert.equal(new URL(r.url).origin,CENTRAL);
   assert.equal(r.method,'POST');
   assert.equal(r.headers.get('Origin'),null);
   const sig=r.headers.get('x-saber-signature');
   const id=r.headers.get('x-saber-request-id'),ts=r.headers.get('x-saber-ts');
   const json=await r.json();
   const body=JSON.stringify(json);
   const expected=createHmac('sha256',BRIDGE).update(ts+'\n'+id+'\n'+body).digest('hex');
   assert.equal(sig,expected);
   const bridge=await leerFirmaInternaLive(new Request(r.url,{
    method:'POST',headers:{
     'Content-Type':'application/json','x-saber-signature':sig,
     'x-saber-request-id':id,'x-saber-ts':ts
    },body
   }),env,{now:()=>now,subtle:webcrypto.subtle});
   assert.equal(bridge.error,undefined,JSON.stringify(bridge));
   if(new URL(r.url).pathname.endsWith('pending')){
    assert.deepEqual(json,{schema:'saber-central-live-transfer-staff-pending-v1',
     purpose:'listar-transferencias-pendientes'});
    return Response.json({ok:true,pending:[{order_id:ID,
     amount_ars:7524,numero_orden:3,nombre:'Persona de prueba',telefono:'0000000000'}]});
   }
   approvals++;
   assert.equal(json.schema,'saber-central-live-transfer-staff-approve-v1');
   assert.equal(json.bank_reference,'REFERENCIA-BANCO-ABC');
   assert.equal(json.confirmed,true);
   return Response.json({ok:true,paymentVerified:true,productionAuthorized:false,
    order_id:ID,amount_ars:7524});
  }
 }};
}
const deps=m=>({authorized:true,service:m.service,now:()=>now,
 nonce:()=>ID,subtle:webcrypto.subtle});
test('staff sin autenticación no consulta Central aunque conozca URL',async()=>{
 const m=mockedCentral();
 const r=await transferenciasPersonalLive(request(pendingPath),env,
  {...deps(m),authorized:false});
 assert.equal(r.status,401);assert.equal(m.calls,0);
});
test('staff con compuerta OFF no obtiene ni aprueba transferencias',async()=>{
 const m=mockedCentral();
 const r=await transferenciasPersonalLive(request(pendingPath),
  {...env,DOCS_LIVE_TRANSFER_GATE:'NO_GO'},deps(m));
 assert.equal(r.status,503);assert.equal(m.calls,0);
});
test('listado protegido usa HMAC y nunca llama a rutas públicas de Central',async()=>{
 const m=mockedCentral();
 const r=await transferenciasPersonalLive(request(pendingPath),env,deps(m));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.pending.length,1);assert.equal(m.calls,1);
 assert.equal(r.headers.get('Cache-Control'),'no-store,private');
});
test('aprobación exige Origen, confirmación y referencia bancaria no archivo',async()=>{
 const m=mockedCentral();
 for(const inp of [
  {order_id:ID,amount_ars:7524,operator:'Responsable',bank_reference:'ARCHIVO.PDF',confirmed:true},
  {order_id:ID,amount_ars:7524,operator:'Responsable',bank_reference:'REFERENCIA-BANCO-ABC',confirmed:false},
  {order_id:ID,amount_ars:0,operator:'Responsable',bank_reference:'REFERENCIA-BANCO-ABC',confirmed:true}
 ]){
  const r=await transferenciasPersonalLive(request(approvePath,'POST',inp),env,deps(m));
  assert.equal(r.status,422);
 }
 const req=request(approvePath,'POST',{
  order_id:ID,amount_ars:7524,operator:'Responsable',
  bank_reference:'REFERENCIA-BANCO-ABC',confirmed:true
 },'https://evil.example');
 const r=await transferenciasPersonalLive(req,env,deps(m));
 assert.equal(r.status,403);assert.equal(m.calls,0);
});
test('sólo la confirmación explícita de operador habilita llamada HMAC',async()=>{
 const m=mockedCentral();
 const r=await transferenciasPersonalLive(request(approvePath,'POST',{
  order_id:ID,amount_ars:7524,operator:'Responsable',
  bank_reference:'REFERENCIA-BANCO-ABC',confirmed:true
 }),env,deps(m));
 assert.equal(r.status,200);assert.equal((await r.json()).paymentVerified,true);
 assert.equal(m.calls,1);assert.equal(m.approvals,1);
});
test('pantalla de personal no usa comprobante del cliente como prueba de pago',()=>{
 const html=paginaTransferenciasPersonalLive(),js=jsTransferenciasPersonalLive();
 assert.match(html,/No acreditar por capturas o comprobantes/);
 assert.match(js,/confirm\('/);
 assert.match(js,/confirmed:true/);
 assert.match(js,/bank_reference/);
 assert.match(html,/personal\/transferencias.js/);
 assert.doesNotThrow(()=>new Function(js));
});

test('la pantalla bancaria conserva el número de operación al refrescar y evita alert genéricos',()=>{
 const html=paginaTransferenciasPersonalLive(),js=jsTransferenciasPersonalLive();
 assert.match(html,/Volver a Central/);
 assert.match(js,/const drafts=new Map/);
 assert.match(js,/if\(background&&drafts\.size\)return/);
 assert.match(js,/reference\.value=saved\.reference/);
 assert.match(js,/operator\.value=saved\.operator/);
 assert.match(js,/TRANSFER_LIVE_REFERENCIA_YA_UTILIZADA/);
 assert.match(js,/TRANSFER_LIVE_ACREDITACION_NO_COMPLETADA/);
 assert.match(js,/Consultá el número de operación de este movimiento en el banco/);
 assert.doesNotMatch(js,/alert\('No se acreditó/);
 assert.doesNotThrow(()=>new Function(js));
});
