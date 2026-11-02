import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const sync=src.slice(src.indexOf('async function syncPendingPayments('),src.indexOf('const catalogUrl='));
test('reconciliation does not overwrite revoked payment reviews',()=>{
 const start=sync.indexOf('for(const order of paid.results||[])');
 const end=sync.indexOf('for(const order of pending.results||[])',start);
 const block=sync.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(block,/const result=await reconcilePayment\(env,order\.payment_id\)/);
 assert.match(block,/if\(result\.registered\)/);
 assert.match(block,/payment_reviews\.state='revoked' THEN 'revoked'/);
 assert.doesNotMatch(block,/try\{await reconcilePayment\(env,order\.payment_id\);/);
});
