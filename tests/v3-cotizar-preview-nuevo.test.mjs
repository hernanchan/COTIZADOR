import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const html=readFileSync(new URL('../vidriera/cotizar.html',import.meta.url),'utf8');
const configFile=JSON.parse(readFileSync(new URL('../vidriera/portal-comercial.json',import.meta.url),'utf8'));
const firstScript=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(firstScript,'Debe existir enrutador antes del iframe');
const route=new Script(firstScript);

async function run(hostname,config=configFile){
 const calls=[],requests=[];
 const location={hostname,pathname:'/cotizar',replace(url){calls.push(url)}};
 const fetch=async (url,options)=>{
   requests.push({url,options});
   return {ok:true,json:async()=>config};
 };
 route.runInContext(createContext({location,fetch,URL}));
 // Permitir finalizar la cadena de Promises sin red ni temporizadores propios.
 await new Promise(resolve=>setImmediate(resolve));
 return {calls,requests};
}

test('Pages preview abre SOLO el nuevo comprador de Sandbox, sin config comercial',async()=>{
 for(const host of ['ebf4a244.libreriasaber.pages.dev',
                     'integracion-tus-pedido-priva.libreriasaber.pages.dev']){
   const result=await run(host);
   assert.deepEqual(result.calls,[
     'https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente']);
   assert.equal(result.requests.length,0);
 }
});
test('Publicación queda apagada, en los dos dominios productivos',async()=>{
 assert.deepEqual(configFile,{
   schema:'saber-portal-comercial-v1',enabled:false,
   release:'NO_GO',buyerUrl:null
 });
 for(const host of ['libreriasaber.com.ar','www.libreriasaber.com.ar']){
   const x=await run(host);
   assert.deepEqual(x.calls,[]);
   assert.equal(x.requests.length,1);
   assert.equal(x.requests[0].url,'portal-comercial.json');
   assert.equal(x.requests[0].options.cache,'no-store');
 }
});
test('Ni un flag activado solo puede desviar al comprador al Sandbox',async()=>{
 for(const buyerUrl of [
 'https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente',
 'https://integracion-tus-pedido-priva.libreriasaber.pages.dev/',
 'https://pedidos.libreriasaber.com.ar/prueba-v2/pedido-cliente',
 'https://pedidos.libreriasaber.com.ar/admin',
 'https://pedidos.libreriasaber.com.ar/cotizar?modo=sandbox',
 'http://pedidos.libreriasaber.com.ar/cotizar',
 'https://pedidos.libreriasaber.com.ar.evil.tld/cotizar',
 'https://pedidos.libreriasaber.com.ar:444/cotizar',
 'https://libreriasaber.com.ar/cotizar'
 ]) {
  const x=await run('libreriasaber.com.ar',{
   schema:'saber-portal-comercial-v1',enabled:true,
   release:'GO_COMERCIAL_CONFIRMADO',buyerUrl
  });
  assert.deepEqual(x.calls,[],buyerUrl);
 }
});
test('No basta enabled=true sin GO comercial explícito',async()=>{
 const x=await run('libreriasaber.com.ar',{
  schema:'saber-portal-comercial-v1',enabled:true,
  release:'NO_GO',buyerUrl:'https://pedidos.libreriasaber.com.ar/cotizar'
 });
 assert.deepEqual(x.calls,[]);
});
test('Solo una ruta propia aprobada permite el corte FUTURO; no lo activa',async()=>{
 const x=await run('www.libreriasaber.com.ar',{
  schema:'saber-portal-comercial-v1',enabled:true,
  release:'GO_COMERCIAL_CONFIRMADO',
  buyerUrl:'https://pedidos.libreriasaber.com.ar/cotizar'
 });
 assert.deepEqual(x.calls,['https://pedidos.libreriasaber.com.ar/cotizar']);
});
test('El proyecto no entrega secretos, ni publica cotizador de ensayo en producción',()=>{
 assert.match(html,/hernanchan\.github\.io\/COTIZADOR\/cotizador-web-v2\.html/);
 assert.match(html,/prueba-v2\/pedido-cliente/);
 assert.doesNotMatch(html,/MP_TEST_ACCESS_TOKEN|MP_ACCESS_TOKEN|DOCS_TURNSTILE_SECRET|CHECKOUT_GATEWAY_KEY/);
});
