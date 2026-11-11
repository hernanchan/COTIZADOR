import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {transferenciaLiveComprador} from './transferencia-live-comprador.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const web='WEB-ENSAYO-'+'A'.repeat(32);
const order='123e4567-e89b-42d3-a456-426614174000';
const nonce='123e4567-e89b-42d3-a456-426614174001';
const origin='https://pedidos.libreriasaber.com.ar';
const input={action:'start',webOrderId:web,commercialOrderId:order};
const req=(data=input,url=origin)=>new Request(url+'/api/pedido/live/transfer',{
 method:'POST',headers:{'Content-Type':'application/json',Origin:url},
 body:JSON.stringify(data)});
function fixture({gate=GO,reply=null,authorized=true}={}){
 const requests=[];
 const response=reply||{ok:true,webOrderId:web,commercialOrderId:order,
  amountArs:2500,estado:'transferencia_pendiente',alias:'SABER.CORDOBA',
  paymentVerified:false,uploadAuthorized:false,productionAuthorized:false};
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  DOCS_LIVE_TRANSFER_GATE:gate,DOCS_LIVE_ORDER_GATE:GO,DOCS_LIVE_TUS_GATE:GO,
  DOCS_MP_LIVE_GATE:GO,
  CENTRAL_LIVE_URL:'https://pagos.libreriasaber.com.ar/internal/central/live/checkout',
  CENTRAL_BRIDGE_KEY:'live-hmac-key-not-sandbox-at-least-32-chars',
  SABER_CENTRAL:{fetch:async request=>{
   requests.push(request);
   return Response.json(response);
  }}};
 return {env,requests,options:{authorized,subtle:webcrypto.subtle,
  now:()=>1794320000,nonce:()=>nonce}};
}
test('transferencia LIVE cerrada no llega a Central',async()=>{
 const f=fixture({gate:'NO_GO'});
 const r=await transferenciaLiveComprador(req(),f.env,f.options);
 assert.equal(r.status,503);
 assert.equal(f.requests.length,0);
});
test('sin cookie del pedido no revela alias ni estado y no llama a Central',async()=>{
 const f=fixture({authorized:false});
 const r=await transferenciaLiveComprador(req(),f.env,f.options);
 assert.equal(r.status,401);
 assert.equal(f.requests.length,0);
});
test('solicitud bancaria firma HMAC interno y no acredita dinero por sí misma',async()=>{
 const f=fixture();
 const r=await transferenciaLiveComprador(req(),f.env,f.options);
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.estado,'transferencia_pendiente');
 assert.equal(body.paymentVerified,false);
 assert.equal(body.uploadAuthorized,false);
 assert.equal(body.alias,'SABER.CORDOBA');
 assert.equal(f.requests.length,1);
 const signed=f.requests[0];
 assert.equal(signed.url,'https://pagos.libreriasaber.com.ar/internal/central/live/transfer-start');
 assert.equal(signed.headers.get('Origin'),null);
 assert.match(signed.headers.get('x-saber-signature'),/^[a-f0-9]{64}$/);
 assert.deepEqual(await signed.json(),{schema:'saber-central-live-transfer-start-v1',
  commercialOrderId:order,webOrderId:web});
});
test('consulta posterior solo reconoce pago verificado por Central',async()=>{
 const f=fixture({reply:{ok:true,webOrderId:web,commercialOrderId:order,
  amountArs:2500,estado:'pagado_esperando_archivos',
  paymentVerified:true,uploadAuthorized:true,productionAuthorized:false}});
 const r=await transferenciaLiveComprador(req({...input,action:'status'}),f.env,f.options);
 assert.equal(r.status,200);
 assert.equal((await r.json()).uploadAuthorized,true);
 assert.ok(f.requests[0].url.endsWith('/transfer-status'));
});
test('rechaza bandera de pago inventada y origen ajeno',async()=>{
 const f=fixture({reply:{ok:true,webOrderId:web,commercialOrderId:order,
  amountArs:2500,estado:'transferencia_pendiente',alias:'SABER.CORDOBA',
  paymentVerified:true,uploadAuthorized:true,productionAuthorized:false}});
 const r=await transferenciaLiveComprador(req(),f.env,f.options);
 assert.equal(r.status,502);
 const g=fixture();
 assert.equal((await transferenciaLiveComprador(req(input,'https://sitio-falso.example'),g.env,g.options)).status,403);
 assert.equal(g.requests.length,0);
});
