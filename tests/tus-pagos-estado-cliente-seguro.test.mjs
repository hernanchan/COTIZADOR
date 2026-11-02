import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const checkout=src.slice(src.indexOf('if(url.pathname==="/demo/checkout"'),src.indexOf('if(url.pathname==="/webhooks/mercadopago"'));
const status=src.slice(src.indexOf('if(path==="/checkout/status")'),src.indexOf('let target;',src.indexOf('if(path==="/checkout/status")'));
test('checkout nuevo valida la preferencia remota con las mismas reglas que un reintento',()=>{
 assert.ok(checkout.includes('return returnPreference(preference.id,false)'));
 assert.ok(checkout.includes('return returnPreference(order.preference_id,true)'));
 assert.ok(checkout.includes('const checkoutUrl=preference.sandbox_init_point'));
 assert.ok(!checkout.includes('preference.sandbox_init_point||preference.init_point'));
 assert.ok(!checkout.includes('if(!/^https:'));
 assert.ok(checkout.includes('lines[0].currency_id==="ARS"'));
 assert.ok(checkout.includes('Number(lines[0].unit_price)===order.amount_ars'));
});
test('estado del cliente nunca muestra paid sin revisión verified',()=>{
 assert.ok(status.includes('review?.state==="revoked"?"review"'));
 assert.ok(status.includes('review?.state==="verified"?"paid":"verifying_payment"'));
 assert.ok(status.includes('if(!order)return json({error:"Pedido no encontrado"},404)'));
});
