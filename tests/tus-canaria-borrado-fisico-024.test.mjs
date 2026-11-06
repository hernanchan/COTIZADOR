import test from 'node:test';
import assert from 'node:assert/strict';
import {borrarCanariaSinteticaUnica,UNIQUE_CANARY} from '../integraciones/autocotizador/recepcion/ensayo-borrado-fisico-canaria-024.mjs';

const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const api='/internal/ensayo-unico-borrar-canaria-024';
const nonce='0123456789abcdef'.repeat(3);
const secret='operator_only_test_password_0123456789';
const env={
 DOCS_CANARY_DISPOSAL_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_PURGE_ENABLED:'OFF',
 DOCS_TUS_PURGE_CANARY_ORDER:UNIQUE_CANARY.webOrderId,
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_SECRET:secret,
 DOCS_CANARY_DISPOSAL_NONCE:nonce,
 DOCS_TUS_SUPABASE_SERVICE_KEY:'test_storage_value_long_enough_for_validation_123'
};
const req=(webOrderId=UNIQUE_CANARY.webOrderId)=>new Request(origin+api,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
  Authorization:'Basic '+btoa('operador:'+secret),'x-saber-disposable-nonce':nonce},
 body:JSON.stringify({webOrderId,operation:'delete-synthetic-canary-only'})
});
test('el identificador canario permanece fijo y no admite otros pedidos',async()=>{
 let calls=0;
 const result=await borrarCanariaSinteticaUnica(req('WEB-ENSAYO-'+'A'.repeat(32)),env,{
  fetcher:async()=>{calls++;return new Response(null,{status:500});}
 });
 assert.equal(result.status,422);
 assert.equal(calls,0);
});
test('la eliminación temporal exige bandera propia; no responde en modo apagado',async()=>{
 let calls=0;
 const result=await borrarCanariaSinteticaUnica(req(),{...env,DOCS_CANARY_DISPOSAL_ENABLED:'OFF'},{
  fetcher:async()=>{calls++;return new Response(null,{status:500});}
 });
 assert.equal(result.status,403);
 assert.equal(calls,0);
});
