import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {probarPuenteCentral} from '../integraciones/autocotizador/recepcion/probar-puente-central.mjs';
const bridge='KeyPrivateForTwoTestWorkersOnly-2026';
const url='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage';
function setup({wrongSignature=false,switchedOff=false}={}){
 let calls=0;
 const env={CENTRAL_TEST_URL:url,
  DOCS_CENTRAL_PROBE_ENABLED:switchedOff?'':'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:bridge,DOCS_RELAY_KEY:'different',
  DOCS_CENTRAL_ADMIN_KEY:'another-admin-key',
  SABER_CENTRAL:{async fetch(req){
   calls++;
   assert.equal(req.url,url.replace('/stage','/bridge-probe'));
   assert.equal(req.method,'POST');
   assert.equal(req.headers.get('Origin'),null);
   const raw=await req.text(),data=JSON.parse(raw);
   assert.equal(data.operation,'verify-only');
   assert.equal(data.challenge,req.headers.get('x-saber-request-id'));
   const h=createHmac('sha256',wrongSignature?'incorrect-key':bridge)
    .update(req.headers.get('x-saber-ts')+'\n'+data.challenge+'\n'+raw).digest('hex');
   if(h!==req.headers.get('x-saber-signature'))
    return Response.json({ok:false},{status:401});
   return Response.json({ok:true,schema:'saber-central-bridge-probe-v1',
    challenge:data.challenge,verifiedSignature:true,dbTouched:false,
    orderCreated:false,paymentAuthorized:false,checkoutEnabled:false});
  }}
 };
 return {env,calls:()=>calls};
}
test('bridge firmado, respuesta sin secretos y sin escribir datos',async()=>{
 const x=setup();
 const result=await probarPuenteCentral({env:x.env,subtle:webcrypto.subtle,
  nuevoId:randomUUID});
 assert.equal(result.ok,true);
 assert.equal(result.signed,true);
 assert.equal(result.dbTouched,false);
 assert.equal(result.orderCreated,false);
 assert.equal(result.checkoutEnabled,false);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(x.calls(),1);
 assert.doesNotMatch(JSON.stringify(result),new RegExp(bridge));
});
test('clave incorrecta y bandera apagada: falla cerrado',async()=>{
 const off=setup({switchedOff:true});
 await assert.rejects(probarPuenteCentral({env:off.env,subtle:webcrypto.subtle}),/no habilitado/);
 assert.equal(off.calls(),0);
 const bad=setup({wrongSignature:true});
 await assert.rejects(probarPuenteCentral({env:bad.env,subtle:webcrypto.subtle}),/no validó/);
});
test('sin Service Binding o con destino ajeno no intenta enviar',async()=>{
 const x=setup();
 await assert.rejects(probarPuenteCentral({env:{...x.env,SABER_CENTRAL:null},
  subtle:webcrypto.subtle}),/no habilitado/);
 await assert.rejects(probarPuenteCentral({env:{...x.env,
  CENTRAL_TEST_URL:'https://otro.example/internal/central/stage'},
  subtle:webcrypto.subtle}),/Destino externo/);
 assert.equal(x.calls(),0);
});
test('la ruta administrativa está separada de pedidos y apagada por defecto',()=>{
 const src=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(src,/page==='\/api\/ensayo-probar-puente-central'/);
 const start=src.indexOf('async function diagnosticoPuenteCentral(');
 const end=src.indexOf('async function apiFichaCentralPrivada(',start);
 assert.ok(start>=0&&end>start);
 const handler=src.slice(start,end);
 assert.match(handler,/DOCS_CENTRAL_ADMIN_KEY/);
 assert.match(handler,/probarPuenteCentral\(\{env\}\)/);
 assert.doesNotMatch(handler,/enviarCentralFirmada|prepararDocumentosCentralFirmado|paymentAuthorized:true/);
});
