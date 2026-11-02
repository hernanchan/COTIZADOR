import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const client=readFileSync(new URL('../integraciones/mercadopago/pruebas/checkout-client.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../tools/build-checkout-preview.mjs',import.meta.url),'utf8');
const start=worker.indexOf('if(url.pathname==="/demo/transfer-request"');
const end=worker.indexOf('if(url.pathname==="/demo/checkout"',start);
const section=worker.slice(start,end);
test('transferencia de ensayo requiere cuenta y flag sin activar cobros',()=>{
 assert.ok(start>=0&&end>start);
 assert.ok(section.includes('env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY"'));
 assert.ok(section.includes('env.TRANSFER_ALIAS'));
 assert.ok(section.includes("order.status!==\"awaiting_payment\"||order.preference_id"));
 assert.ok(section.includes('order.amount_ars!==order.deposit_ars'));
 assert.ok(section.includes('INSERT OR IGNORE INTO transfer_requests'));
 assert.ok(section.includes("status TEXT NOT NULL CHECK(status='awaiting_bank_verification')"));
 assert.ok(section.includes('payment_confirmed:false,production_enabled:false'));
 assert.ok(!section.includes("UPDATE orders SET status='paid'"));
});
test('checkout conserva protecciones contra doble cobro',()=>{
 assert.ok(worker.includes('if(path==="/checkout/transfer")'));
 assert.ok(worker.includes('cart.order_id!==body.order_id'));
 assert.ok(worker.includes('SELECT order_id FROM transfer_requests WHERE order_id=?'));
 assert.ok(worker.includes('No generes un segundo pago.'));
 assert.ok(worker.includes('env.CHECKOUT_ENABLED!=="APROBADO"'));
});
test('cliente y preview muestran transferencia pendiente sin precios inventados',()=>{
 assert.ok(client.includes("return api('transfer',{order_id:order.order_id})"));
 assert.ok(client.includes('const order=await api(\'cart-order\',body)'));
 assert.ok(client.includes('Object.freeze({begin,receipt,checkout,transfer,status,newOrder})'));
 assert.ok(preview.includes('value="transferencia"'));
 assert.ok(preview.includes('Queda pendiente de acreditación bancaria'));
 assert.ok(preview.includes('No se aplican recargos ni descuentos'));
});

test('retorno de pago distingue transferencia pendiente y no ofrece pagar otra vez',()=>{
 const page=readFileSync(new URL('../integraciones/mercadopago/pruebas/pedido-pago.html',import.meta.url),'utf8');
 const status=worker.slice(worker.indexOf('if(path==="/checkout/status")'),worker.indexOf('let target;',worker.indexOf('if(path==="/checkout/status")')));
 assert.ok(status.includes('if(state==="awaiting_payment")'));
 assert.ok(status.includes('FROM transfer_requests WHERE order_id=?'));
 assert.ok(status.includes('state="awaiting_bank_verification"'));
 assert.ok(page.includes('awaiting_bank_verification:'));
 assert.ok(page.includes('verifying_payment:'));
 assert.ok(page.includes("document.querySelector('#retry').hidden=result.state!=='awaiting_payment'"));
});
