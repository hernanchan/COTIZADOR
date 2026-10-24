import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {enviarCentralFirmada} from '../integraciones/autocotizador/recepcion/enviar-central-firmada.mjs';

const key='central-documents-internal-test-secret-2026';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage';
const orderId='WEB-DOCUMENTOS-ENSAYO-20261024';
const proof={
 schema:'saber-central-recepcion-verificada-v1',orderId,
 filesReceived:true,paymentAuthorized:false,listoParaProducir:false,
 importeVerificado:21000,
 recibos:[{fileId:'file01',receiptId:'DOC-12345678-1234-4234-8234-1234567890ab',
  sha256:'a'.repeat(64),bytes:1200,pages:2}],
 ficha:{schema:'saber-central-ficha-produccion-v1',orderId,
  pagoConfirmado:false,listoParaProducir:false,trabajos:[]}
};
const options={verificacion:proof,url:central,clave:key,habilitado:'PRIVATE_TEST_ONLY',
 subtle:webcrypto.subtle,nuevoId:randomUUID};
function mock(){
 let calls=0,publicCalls=0;
 const service={async fetch(req){
  calls++;
  assert.equal(req.url,central);
  assert.equal(req.method,'POST');
  assert.equal(req.headers.get('Origin'),null);
  assert.equal(req.headers.get('Content-Type'),'application/json');
  const timestamp=req.headers.get('x-saber-ts');
  const nonce=req.headers.get('x-saber-request-id');
  const body=await req.text();
  const signature=createHmac('sha256',key)
   .update(timestamp+'\n'+nonce+'\n'+body).digest('hex');
  assert.equal(req.headers.get('x-saber-signature'),signature);
  assert.deepEqual(JSON.parse(body),{
   schema:proof.schema,orderId,filesReceived:true,
   paymentAuthorized:false,listoParaProducir:false,
   importeVerificado:21000,recibos:proof.recibos,ficha:proof.ficha
  });
  return Response.json({saved:true,idempotent:false,
   web_order_id:orderId,paymentAuthorized:false},{status:201});
 }};
 return {service,calls:()=>calls,
  publicFetcher:async()=>{publicCalls++;throw Error('No usar Workers público')},
  publicCalls:()=>publicCalls};
}
test('Documentos: Service Binding firma HMAC y no usa Workers público',async()=>{
 const h=mock();
 const result=await enviarCentralFirmada({...options,service:h.service,fetcher:h.publicFetcher});
 assert.equal(result.ok,true);
 assert.equal(result.guardado,true);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.listoParaProducir,false);
 assert.equal(h.calls(),1);
 assert.equal(h.publicCalls(),0);
});
test('Documentos: se bloquea si falta vinculación interna de Central',async()=>{
 await assert.rejects(enviarCentralFirmada(options),/vinculación privada/);
});
test('Documentos: clave inválida, manifest sin verificar y host extraño no envían nada',async()=>{
 const h=mock();
 for(const arg of [
  {...options,habilitado:''},
  {...options,clave:'corta'},
  {...options,verificacion:{...proof,paymentAuthorized:true}},
  {...options,url:'https://central-ajena.example/internal/central/stage'}
 ]){
  await assert.rejects(enviarCentralFirmada({...arg,service:h.service}));
 }
 assert.equal(h.calls(),0);
});
test('Documentos: nunca se acepta confirmación que autoriza el pago',async()=>{
 let calls=0;
 const result=enviarCentralFirmada({...options,service:{async fetch(){
  calls++;
  return Response.json({saved:true,web_order_id:orderId,paymentAuthorized:true});
 }}});
 await assert.rejects(result,/no confirmó/);
 assert.equal(calls,1);
});
