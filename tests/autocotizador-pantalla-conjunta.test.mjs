import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorConjunto} from '../integraciones/autocotizador/recepcion/cotizador-conjunto-pagina.mjs';
import {readFileSync} from 'node:fs';
test('ensayo conjunto solo local: integra las dos pantallas, controla mensajes, no habilita cobros',()=>{
 const pagina=paginaCotizadorConjunto();
 assert.match(pagina,/data-ruta="\/prueba-cotizador-rapido"/);
 assert.match(pagina,/data-ruta="\/prueba-ploteos-rapido"/);
 assert.match(pagina,/event.origin!==location.origin/);
 assert.match(pagina,/f.srcdoc=html/);
 assert.doesNotMatch(pagina,/<iframe[^>]+ src=/);
 assert.match(pagina,/event.source!==iframe.contentWindow/);
 assert.match(pagina,/!Number.isFinite\(total\)/);
 assert.match(pagina,/No hay envío de PDF, pedido confirmado ni pagos/);
 assert.doesNotMatch(pagina,/mercadopago|checkout|\/api\/pago/i);
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(worker,/page==='\/prueba-cotizador-conjunto'/);
 for(const [file,tipo] of [['cotizador-rapido-cliente.mjs','impresiones'],['ploteos-rapido-cliente.mjs','ploteos']]){
  const c=readFileSync(new URL('../integraciones/autocotizador/recepcion/'+file,import.meta.url),'utf8');
  assert.match(c,/saber-cotizacion-parcial-v1/);
  assert.ok(c.includes("modulo:'"+tipo+"'"));
 }
});