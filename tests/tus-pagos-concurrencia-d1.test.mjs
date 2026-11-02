import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const prepare=source.slice(source.indexOf('async function centralPrepareDraft('),source.indexOf('async function centralPolaroidStage('));
test('recovery of a concurrent D1 purchase only succeeds for matching committed data',()=>{
 assert.match(prepare,/if\(stored&&linked\?\.commercial_order_id===other\.order_id&&\s*stored\.status==="awaiting_payment"&&stored\.amount_ars===total\)\s*\{/);
 assert.match(prepare,/if\(!Number\.isSafeInteger\(number\?\.number\)\|\|number\.number<1\)\s*return json\(\{error:/);
 assert.match(prepare,/numeroOrden:shortWorkNumber\(number\.number\)/);
 const check=prepare.indexOf('if(stored&&linked?.commercial_order_id===other.order_id&&');
 const accepted=prepare.indexOf('return json({created:true,idempotent:true,commercial_order_id:other.order_id',check);
 const reject=prepare.indexOf('return json({error:"Pedido concurrente o recepción reutilizada"},409)',check);
 assert.ok(check>=0 && accepted>check && reject>accepted);
 const matched=prepare.slice(check,accepted);
 assert.ok(matched.includes('stored.amount_ars===total){'),'must enclose success in the validated branch');
});
