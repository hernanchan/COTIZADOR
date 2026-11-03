import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {prepararDocumentosCentralFirmado} from '../integraciones/autocotizador/recepcion/preparar-documentos-central.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs');
const direct=read('integraciones/autocotizador/recepcion/tus-directo-cliente.mjs');
const tus=read('integraciones/autocotizador/recepcion/tus-pedido-worker.mjs');
const central=read('integraciones/mercadopago/pruebas/worker.js');

test('UI exige un único teléfono al enviar, conserva cotización independiente',()=>{
 assert.match(ui,/<input id="cliente-telefono" type="tel"[^>]*required/);
 assert.match(ui,/telefonoContacto\.value\.trim\(\)/);
 assert.match(ui,/if\(!telefonoValido\(\)\)/);
 assert.ok(ui.indexOf("if(!telefonoValido())")>ui.indexOf("sendAllButton.addEventListener('click'"));
 assert.match(ui,/telefono:telefonoContacto\.value\.trim\(\)/);
 assert.match(ui,/No se usa para publicidad/i);
 assert.match(ui,/para enviar el pedido/i);
 assert.doesNotMatch(ui,/localStorage\.setItem\(['"]cliente-telefono/);
 const m=/function telefonoValido\(\)\{[\s\S]+?telefonoContacto\.addEventListener/.exec(ui);
 assert.ok(m,'Se encuentra la validación de teléfono');
 const fake={value:'+54 9 351 555 1234',setAttribute(){},removeAttribute(){}};
 const error={textContent:''};
 const snippet=m[0].replace(/telefonoContacto\.addEventListener[\s\S]*$/,'');
 const fn=vm.runInNewContext(snippet+'\ntelefonoValido',{telefonoContacto:fake,telefonoError:error});
 assert.equal(fn(),'+54 9 351 555 1234');
 fake.value='123';
 assert.equal(fn(),null);
 assert.match(error.textContent,/válido/);
});
test('el teléfono viaja dentro del POST TUS y solo en pedido, no en Storage',()=>{
 assert.match(direct,/\.{3}\(typeof telefono==='string'\?\{telefono:telefono\.trim\(\)\}:\{\}\)/);
 assert.match(tus,/input\.telefono!==undefined/);
 assert.match(tus,/\.\.\.\(input\.telefono\?\{telefono:input\.telefono\.trim\(\)\}:\{\}\)/);
 assert.match(central,/central_order_contacts/);
 assert.match(central,/INSERT INTO central_order_contacts\(order_id,phone\)/);
 assert.match(central,/c\.phone AS customer_phone/);
 assert.match(central,/telefonoContacto:row\.telefonoContacto\|\|null/);
});
const env={
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'12345678901234567890123456789012',
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
};
test('se entrega el teléfono a Central firmado por HMAC y no en URL',async()=>{
 let received;
 env.SABER_CENTRAL={async fetch(req){
  received={method:req.method,url:req.url,headers:req.headers,body:await req.json()};
  return new Response(JSON.stringify({
   created:true,commercial_order_id:'b69f8ef5-63eb-4728-a967-584c63f39c41',
   numeroOrden:'013',amount_ars:4730,state:'awaiting_payment',
   checkoutEnabled:false,paymentAuthorized:false
  }),{status:201});
 }};
 const result=await prepararDocumentosCentralFirmado({
  env,webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
  clientOrderId:'e2d76c8b-ce1c-4daf-9030-4bd402295a68',
  telefono:'351 555 1234',items:[],subtle:webcrypto.subtle,
  requestId:()=> 'e3d76c8b-ce1c-4daf-9030-4bd402295a68',
  now:()=>1762165000
 });
 assert.equal(result.created,true);
 assert.equal(received.body.telefono,'351 555 1234');
 assert.equal(received.method,'POST');
 assert.equal(received.url.includes('351'),false);
 assert.ok(received.headers.get('x-saber-signature'));
});
test('el backend rechaza teléfonos inválidos antes de la Central',async()=>{
 await assert.rejects(()=>prepararDocumentosCentralFirmado({
  env,webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
  clientOrderId:'e2d76c8b-ce1c-4daf-9030-4bd402295a68',
  telefono:'1234',items:[],subtle:webcrypto.subtle
 }),/Teléfono/);
});
