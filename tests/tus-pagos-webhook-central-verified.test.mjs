import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const reconcile=src.slice(src.indexOf('async function reconcilePayment('),src.indexOf('async function syncPendingPayments('));
test('successful webhook reconciliation marks payment review immediately',()=>{
 assert.match(reconcile,/const markVerified=\(\)=>env\.DB\.prepare\(/);
 assert.match(reconcile,/if\(samePayment\)await markVerified\(\)/);
 assert.match(reconcile,/if\(res\.meta\?\.changes\)await markVerified\(\)/);
 assert.match(reconcile,/payment_reviews\.state='revoked' THEN 'revoked'/);
 assert.ok(reconcile.indexOf("UPDATE orders SET status='paid'")<reconcile.lastIndexOf('if(res.meta?.changes)await markVerified()'));
});
test('commercial document and Express checkout remains blocked before approval',()=>{
 const checkout=src.slice(src.indexOf('if(url.pathname==="/demo/checkout"'),src.indexOf('if(url.pathname==="/webhooks/mercadopago"'));
 assert.match(checkout,/sku IN \('DOCS_VERIFIED','POLAROID_EXPRESS_A4'\)/);
 assert.match(checkout,/restricted\?\.sku===\"POLAROID_EXPRESS_A4\"/);
 assert.match(checkout,/restricted\?\.sku===\"DOCS_VERIFIED\"/);
 assert.match(checkout,/x-docs-sandbox-preflight/);
 assert.match(src,/env\.CHECKOUT_ENABLED!=="APROBADO"/);
});
