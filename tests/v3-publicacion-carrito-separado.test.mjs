import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
for(const file of ['index.html','ofertas.html']){
 test('V3 '+file+' separa productos y ploteos sin ofrecer seña antigua',()=>{
  const html=readFileSync(new URL('../vidriera/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(html,/Un solo pedido|Seña trabajos de producción|Encargar todo por WhatsApp|El trabajo vuelve automáticamente a este carrito/i);
  assert.match(html,/Consultar artículos por WhatsApp/);
  assert.match(html,/x\.type==='product'&&typeof x\.id==='string'/);
  assert.match(html,/TOTAL ORIENTATIVO/);
  assert.ok(html.includes("window.location.assign('https://wa.me/5493513110130?text='"),
    'WhatsApp debe navegar en la misma pestaña tras validar el catálogo');
  assert.ok(!html.includes("window.open('https://wa.me/5493513110130?text='"));
  assert.match(html,/No pudimos verificar los precios actuales/);
  assert.doesNotMatch(html,/\*DATOS PARA TRANSFERIR LA SEÑA\*/);
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length);
  for(const m of scripts)assert.doesNotThrow(()=>new Script(m[1]));
 });
}
