import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaContinuarPagoLive} from './pagina-continuar-pago-live.mjs';
const url='https://pedidos.libreriasaber.com.ar/pedido/continuar';
const env={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',
 DOCS_LIVE_SESSION_GATE:'GO_COMERCIAL_CONFIRMADO',
 DOCS_LIVE_TURNSTILE_SITE_KEY:'0x4AAAAAABBBBBCCCCCDDDD1111'};
test('sesión vencida abre desafío Turnstile para reingresar SIN duplicar pedido',async()=>{
 const r=paginaContinuarPagoLive(new Request(url),env,{authorized:false});
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Retomá tu pedido/);
 assert.match(html,/data-action="saber_pedido_live"/);
 assert.match(html,/location.replace\('\/pedido\/continuar'\)/);
 assert.match(html,/\/api\/pedido\/live\/sesion/);
 assert.doesNotMatch(html,/\/api\/pedido\/live\/(borrador|orden)/);
 assert.match(r.headers.get('Content-Security-Policy'),/challenges.cloudflare.com/);
 const script=html.match(/<script>\s*([\s\S]*?)<\/script><\/body>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
});
test('retomar no expone orden ajena, producción inactiva ni URL externa',()=>{
 for(const [u,e,a] of [
  [url,{...env,DOCS_MP_LIVE_GATE:'NO_GO'},true],
  ['https://saber-documentos-pruebas.workers.dev/pedido/continuar',env,true],
  [url+'?clave=123',env,true]
 ]){
  const r=paginaContinuarPagoLive(new Request(u),e,{authorized:a});
  assert.ok([401,404].includes(r.status));
 }
});
test('pantalla para retomar mismo pedido nunca crea orden y verifica acreditacion primero',async()=>{
  const res=paginaContinuarPagoLive(new Request(url),env,{authorized:true});
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/sessionStorage\.getItem\("saber-live-archivos-v1"\)/);
  assert.match(html,/post\("status",saved\)/);
  assert.match(html,/\/api\/pedido\/live\/revincular/);
  assert.match(html,/r\.status===401/);
  assert.match(html,/recuperada!==true/);
  assert.match(html,/post\("start",order\)/);
  assert.match(html,/sessionStorage\.setItem\("saber-live-pedido-v1"/);
  assert.match(html,/\/pedido\/estado/);
  assert.match(html,/location\.replace\(\"\/pedido\/estado\"\)/);
  assert.doesNotMatch(html,/button\.textContent=\"Enviar PDF pagado\"/);
  assert.doesNotMatch(html,/\/api\/pedido\/live\/(borrador|orden)/);
  const nonce=html.match(/<script nonce="([a-f0-9]{32})">/)?.[1];
  assert.ok(nonce);
  const script=html.split('<script nonce="'+nonce+'">')[1]?.split('</script>')[0];
  assert.ok(script);
  assert.doesNotThrow(()=>new Function(script),'JavaScript servido debe ser sintácticamente válido');
  assert.ok(res.headers.get('Content-Security-Policy').includes("'nonce-"+nonce+"'"));
  assert.equal(res.headers.get('Cache-Control'),'no-store,private');
  assert.match(html,/No se va a generar otro pedido/);
});

test('sesión vencida de transferencia NO ofrece Mercado Pago en la recuperación',async()=>{
 const res=paginaContinuarPagoLive(new Request(url),env,{authorized:true});
 const html=await res.text();
 assert.match(html,/sessionStorage\.getItem\("saber-live-medio-v1"\)==="transferencia"/);
 assert.match(html,/Ver seguimiento de transferencia/);
 assert.match(html,/button\.dataset\.transfer="yes"/);
 assert.match(html,/button\.dataset\.transfer==="yes"/);
 assert.match(html,/action:"status",webOrderId:order\.webOrderId/);
 assert.match(html,/No pagues por otro medio ni generes otra orden/);
 assert.match(html,/>Continuar pedido<\/button>/);
 assert.doesNotMatch(html,/>Continuar a Mercado Pago<\/button>/);
 const nonce=html.match(/<script nonce="([a-f0-9]{32})">/)?.[1];
 assert.doesNotThrow(()=>new Function(html.split('<script nonce="'+nonce+'">')[1].split('</script>')[0]));
});
