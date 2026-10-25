import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from './dist/saber-documentos-cotizador-fase4.mjs';
import {paginaCotizadorV2PruebaPrivada} from './pantalla-cotizador-v2-prueba-privada.mjs';
globalThis.crypto ??= webcrypto;
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const password='OnlyPrivateForTest_'+'7'.repeat(40);
const env={
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_SECRET:password,
 DOCS_TURNSTILE_SITE_KEY:'0x4AAAAaa_TEST_SITEKEY_123456',
 DOCS_ALLOWED_ORIGIN:base
};
const authorization='Basic '+Buffer.from('operador:'+password).toString('base64');
async function get(path='/',headers={Authorization:authorization},settings=env,method='GET'){
 return worker.fetch(new Request(base+path,{method,headers}),settings);
}
test('portal privado comienza apagado aunque el Worker haya sido compilado',async()=>{
 const r=await get('/prueba-v2/',{}, {...env,DOCS_V2_PRIVATE_UI_ENABLED:''});
 assert.equal(r.status,503);
 assert.doesNotMatch(await r.text(),/iframe|saber-pdf-local/);
});
test('sin contraseña, contraseña incorrecta o secretos compartidos no abre cotizador',async()=>{
 for(const headers of [
  {},{Authorization:'Basic '+Buffer.from('operador:nope').toString('base64')},
  {Authorization:'Bearer '+password}
 ]){
  const r=await get('/prueba-v2/',headers);
  assert.equal(r.status,401);
  assert.match(r.headers.get('www-authenticate')||'',/Basic/);
 }
 const reused=await get('/prueba-v2/',{Authorization:authorization},{
  ...env,DOCS_RELAY_KEY:password
 });
 assert.equal(reused.status,503,'La contraseña del navegador jamás puede ser HMAC');
});
test('portal copia V2 solo desde el mismo origen; no enlaza a GitHub Pages',async()=>{
 const r=await get('/prueba-v2/');
 assert.equal(r.status,200);
 assert.equal(r.headers.get('X-Frame-Options'),'SAMEORIGIN');
 assert.match(r.headers.get('Cache-Control')||'',/no-store/);
 const h=await r.text();
 assert.match(h,/iframe id="base"/);
 assert.match(h,/src="\/prueba-v2\/cotizador\?integrado=1&ensayoArchivos=1"/);
 assert.match(h,/src="https:\/\/challenges\.cloudflare\.com\/turnstile/);
 assert.match(h,/subirYVincularPdfCotizadorV2/);
 assert.match(h,/event\.origin!==location\.origin/);
 assert.match(h,/event\.source!==frame\.contentWindow/);
 assert.match(h,/crypto\.getRandomValues\(random\)/);
 assert.match(h,/No se transmite ningún PDF a la tienda pública/);
 assert.doesNotMatch(h,/window\.parent\.postMessage|hernanchan\.github\.io/);
 assert.doesNotMatch(h,/dataBase64|driveFileId|CENTRAL_BRIDGE_KEY|DOCS_RELAY_KEY/);
 const source=h.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source&&source.length>800);
 assert.doesNotThrow(()=>new Function(source.replace(/^import \{[^\n]*\} from [^\n]+;\s*/m,'')));
});
test('cotizador V2 y precios originales disponibles sin pedir GitHub Pages',async()=>{
 const r=await get('/prueba-v2/cotizador?integrado=1&ensayoArchivos=1');
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Cotizador · Librería Saber/);
 assert.match(html,/ensayoArchivos/);
 assert.match(html,/cotizador-v2-ensayo-archivos\.mjs/);
 assert.match(html,/precios-web\.json/);
 assert.doesNotMatch(html,/googletagmanager\.com\/gtag/,'Sin telemetría privada en piloto');
 const prices=await get('/prueba-v2/precios-web.json');
 assert.equal(prices.status,200);
 const catalog=await prices.json();
 for(const key of ['bnA4','colorA4','bnA3','colorA3','bindings'])assert.ok(catalog[key],key);
 const reader=await get('/prueba-v2/cotizador-v2-ensayo-archivos.mjs');
 assert.equal(reader.status,200);
 assert.match(reader.headers.get('Content-Type')||'',/javascript/);
 assert.match(await reader.text(),/LOCAL_PRELIMINAR/);
 const uploader=await get('/prueba-v2/subir-vincular-pdf.mjs');
 assert.equal(uploader.status,200);
 const body=await uploader.text();
 assert.match(body,/\/api\/ensayo-pdf-ampliado/);
 assert.match(body,/\/api\/ensayo-vincular-pdf-v2/);
 assert.doesNotMatch(body,/https:\/\/hernanchan\.github\.io/);
});
test('todos los archivos privados mantienen su cerradura y no ejecutan métodos ajenos',async()=>{
 for(const path of ['/prueba-v2/cotizador','/prueba-v2/precios-web.json',
  '/prueba-v2/cotizador-v2-ensayo-archivos.mjs',
  '/prueba-v2/subir-vincular-pdf.mjs']){
  assert.equal((await get(path,{})).status,401);
  assert.equal((await get(path,{Authorization:authorization},{
   ...env,DOCS_V2_PRIVATE_UI_ENABLED:''
  })).status,503);
  assert.notEqual((await get(path,{Authorization:authorization},env,'POST')).status,200);
 }
 assert.equal((await get('/api/ensayo-vincular-pdf-v2',{Origin:base},env,'POST')).status,503);
});
test('el generador de vista exige una clave pública Turnstile válida',()=>{
 assert.throws(()=>paginaCotizadorV2PruebaPrivada(''),/Turnstile/);
 assert.throws(()=>paginaCotizadorV2PruebaPrivada('"><script>x</script>'),/Turnstile/);
});

test('diferencias de precio se marcan para revisión y no habilitan pagos',()=>{
 const html=paginaCotizadorV2PruebaPrivada(env.DOCS_TURNSTILE_SITE_KEY);
 assert.match(html,/diferencia con el cotizador/);
 assert.match(html,/Requiere revisión de tarifas, descuentos y opciones antes de cobrar/);
 assert.match(html,/Pedido D1 y autorización de pago: PENDIENTES/);
 assert.match(html,/item\.references\.length===1/);
 assert.doesNotMatch(html,/checkoutEnabled:true|paymentAuthorized:true/);
});
