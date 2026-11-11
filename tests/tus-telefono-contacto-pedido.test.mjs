import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {prepararDocumentosCentralFirmado} from '../integraciones/autocotizador/recepcion/preparar-documentos-central.mjs';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs');
const direct=read('integraciones/autocotizador/recepcion/tus-directo-cliente.mjs');
const tus=read('integraciones/autocotizador/recepcion/tus-pedido-worker.mjs');
const central=read('integraciones/mercadopago/pruebas/worker.js');

test('UI pide nombre y teléfono, dirección opcional, conserva cotización independiente',()=>{
 assert.match(ui,/id="cliente-nombre"[^>]*required/);
 assert.match(ui,/id="cliente-direccion"[^>]*maxlength="180"/);
 assert.match(ui,/if\(!nombreValido\(\)\)/);
 assert.match(ui,/direccionValida\(\)===null/);
 assert.match(ui,/nombre:nombreCliente\.value\.trim\(\)/);
 assert.match(ui,/direccion:direccionCliente\.value\.trim\(\)/);
 assert.match(ui,/<input id="cliente-telefono" type="tel"[^>]*required/);
 assert.match(ui,/telefonoContacto\.value\.trim\(\)/);
 assert.match(ui,/if\(!telefonoValido\(\)\)/);
 assert.ok(ui.indexOf("if(!telefonoValido())")>ui.indexOf("sendAllButton.addEventListener('click'"));
 assert.match(ui,/telefono:telefonoContacto\.value\.trim\(\)/);
 assert.match(ui,/No se usa para publicidad/i);
 assert.match(ui,/para enviar el pedido/i);
 assert.doesNotMatch(ui,/localStorage\.setItem\(['"]cliente-telefono/);
 const rendered=paginaCotizadorV2PruebaPrivada('0123456789abcdef',true,{invalidos:[]});
 const m=/function telefonoValido\(\)\{[\s\S]+?telefonoContacto\.addEventListener/.exec(rendered);
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
test('los contactos viajan en pedido TUS y no en Storage',()=>{
 assert.match(direct,/typeof nombre==='string'/);
 assert.match(direct,/typeof direccion==='string'/);
 assert.match(tus,/input\.nombre/);
 assert.match(tus,/input\.direccion/);
 assert.match(central,/central_order_customer_details/);
 assert.match(central,/c\.phone AS customer_phone,d\.name AS customer_name,d\.address AS customer_address/);
 assert.match(central,/nombreCliente:row\.nombreCliente\|\|null/);
 assert.match(central,/direccionCliente:row\.direccionCliente\|\|null/);
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
  telefono:'351 555 1234',nombre:'María Belén Gómez',direccion:'Av. Colón 1234, Córdoba',items:[],subtle:webcrypto.subtle,
  requestId:()=> 'e3d76c8b-ce1c-4daf-9030-4bd402295a68',
  now:()=>1762165000
 });
 assert.equal(result.created,true);
 assert.equal(received.body.telefono,'351 555 1234');
 assert.equal(received.body.nombre,'María Belén Gómez');
 assert.equal(received.body.direccion,'Av. Colón 1234, Córdoba');
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


test('rechaza identidad incompleta en el puente firmado, sin consultar Central',async()=>{
 await assert.rejects(()=>prepararDocumentosCentralFirmado({
  env,webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
  clientOrderId:'e2d76c8b-ce1c-4daf-9030-4bd402295a68',
  telefono:'351 555 1234',nombre:'X',items:[],subtle:webcrypto.subtle
 }),/Nombre/);
 await assert.rejects(()=>prepararDocumentosCentralFirmado({
  env,webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
  clientOrderId:'e2d76c8b-ce1c-4daf-9030-4bd402295a68',
  telefono:'351 555 1234',nombre:'Ana Pérez',direccion:'x'.repeat(181),
  items:[],subtle:webcrypto.subtle
 }),/Dirección/);
});

test('los tres datos integran la orden PDF y las tarjetas; transferencia sigue bajo verificación bancaria',()=>{
 const pdf=read('integraciones/autocotizador/recepcion/pdf-orden-tus-cliente.txt');
 assert.match(pdf,/d\.nombreCliente/);
 assert.match(pdf,/d\.telefonoContacto/);
 assert.match(pdf,/d\.direccionCliente/);
 assert.match(central,/Cliente: /);
 assert.match(central,/customer_address/);
 assert.match(central,/confirm\("¿Confirmás la acreditación de ENSAYO/);
 assert.match(central,/bank_reference:bankReference/);
});

test('ploteos R2 y lotes mixtos conservan los mismos datos antes de pagar',()=>{
 const r2=read('integraciones/autocotizador/recepcion/r2-prepago-documentos.mjs');
 const uni=read('integraciones/autocotizador/recepcion/r2-orden-universal-documentos.mjs');
 const r2Central=read('integraciones/mercadopago/pruebas/r2-prepago-intencion-central.mjs');
 const uniCentral=read('integraciones/mercadopago/pruebas/r2-universal-order-central.mjs');
 for(const file of [r2,uni,r2Central,uniCentral]){
  assert.match(file,/nombre/);
  assert.match(file,/direccion/);
 }
 assert.match(r2Central,/INSERT INTO central_order_customer_details/);
 assert.match(uniCentral,/INSERT INTO central_order_customer_details/);
});
