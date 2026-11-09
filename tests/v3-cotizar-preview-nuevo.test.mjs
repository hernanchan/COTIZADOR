import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const html=readFileSync(new URL('../vidriera/cotizar.html',import.meta.url),'utf8');
const firstScript=html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
assert.ok(firstScript,'Cotizador debe tener enrutador antes de mostrar el iframe');
const route=new Script(firstScript);

function destination(hostname){
 const calls=[];
 route.runInContext(createContext({location:{
   hostname,replace(url){calls.push(url)}
 }}));
 return calls;
}
test('En Pages preview la entrada de cotización va al portal NUEVO con Sandbox',()=>{
 for(const host of ['ebf4a244.libreriasaber.pages.dev',
 'integracion-tus-pedido-priva.libreriasaber.pages.dev']){
   assert.deepEqual(destination(host),[
    'https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente'
   ]);
 }
});
test('En producción no habilitar jamás el Worker de ensayos por la navegación',()=>{
 for(const host of ['libreriasaber.com.ar','www.libreriasaber.com.ar',
                      'libreriasaber.pages.dev','example.com']){
  assert.deepEqual(destination(host),[],host);
 }
});
test('Página previa no cambia ni expone en producción el viejo iframe mientras corte NO-GO',()=>{
 assert.match(html,/hernanchan\\.github\\.io\\/COTIZADOR\\/cotizador-web-v2\\.html/);
 assert.match(html,/prueba-v2\\/pedido-cliente/);
 assert.doesNotMatch(html,/CHECKOUT_ENABLED|MP_ACCESS_TOKEN|DOCS_TURNSTILE_SECRET/);
});
