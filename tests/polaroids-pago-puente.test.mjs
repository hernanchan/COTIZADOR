import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const script=await read('prototipos/pagos-piloto/receipt-bridge.js');
let listener=null,sent=0;
const nonce='10000000-1000-4000-8000-100000000001',origin='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const window={addEventListener:(type,fn)=>listener=fn,removeEventListener:()=>listener=null,
 opener:{postMessage:(data,to)=>{sent++;assert.equal(to,origin);assert.equal(data.uploadKey,'private-in-memory');
 // Una respuesta ajena no debe confirmar la recepción.
 listener({origin:'https://other.test',source:window.opener,data:{type:'SABER_PAYMENT_PROOF_RESULT',nonce,ok:true}});assert.ok(listener);
 listener({origin,source:window.opener,data:{type:'SABER_PAYMENT_PROOF_RESULT',nonce,ok:true}});
 }}};
const ctx=vm.createContext({window,URLSearchParams,location:{search:'?pagosNonce='+nonce},setTimeout:()=>1,clearTimeout:()=>{}});
vm.runInContext(script,ctx);await window.saberPaymentReceipt({reference:'POL-'+'A'.repeat(24),uploadKey:'private-in-memory'});assert.equal(sent,1);assert.equal(listener,null);
ctx.location.search='';await window.saberPaymentReceipt({});assert.equal(sent,1); // Piloto anterior inalterado sin opción de pagos.
ctx.location.search='?pagosNonce=bad';await assert.rejects(()=>window.saberPaymentReceipt({}),/desde el panel/);
const html=await read('integraciones/mercadopago/pruebas/polaroids-demo.html');
for(const [,code]of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(code);
assert.equal(/localStorage|sessionStorage/.test(html),false);assert.ok(html.includes('delete msg.uploadKey'));
console.log('PASS puente: origen/emisor/nonce, confirmación antes de descartar clave, sin almacenamiento ni efecto en piloto habitual.');
