import test from 'node:test';
import assert from 'node:assert/strict';

const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const mod=await import('../integraciones/autocotizador/recepcion/dist/saber-documentos-cotizador-fase4.mjs');
const worker=mod.default;
const secret='x'.repeat(48);
const env={DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',DOCS_V2_PRIVATE_UI_SECRET:secret};
const credential='Basic '+Buffer.from('operador:'+secret).toString('base64');

for(const [path,marker] of [
 ['/prueba-v2/diseno-saber-directo','class="hero hero-direct"'],
 ['/prueba-v2/diseno-saber-directo/ofertas.html','VISTA PREVIA PRIVADA DE DISEÑO']
]){
 test('Worker compilado: ruta protegida '+path,async()=>{
  const request=new Request(origin+path,{headers:{Authorization:credential}});
  const response=await worker.fetch(request,env,{});
  const body=await response.text();
  assert.equal(response.status,200,'Worker devolvió '+response.status+' en '+path+': '+body.slice(0,600));
  assert.ok(body.includes(marker),'Marcador de vista ausente: '+marker);
  assert.match(response.headers.get('Content-Security-Policy')||'',/style-src 'unsafe-inline'/);
  assert.match(response.headers.get('Cache-Control')||'',/private/);
 });
 test('Worker compilado: bloquea anónimos '+path,async()=>{
  const response=await worker.fetch(new Request(origin+path),env,{});
  assert.equal(response.status,401);
 });
}

for(const [path,marker] of [
 ['/prueba-v2/diseno-sin-clave','VISTA DE DISEÑO · SIN CONTRASEÑA'],
 ['/prueba-v2/diseno-sin-clave/ofertas.html','VISTA DE DISEÑO · SIN CONTRASEÑA']
]){
 test('Worker compilado: vista libre sin datos privados '+path,async()=>{
  const response=await worker.fetch(new Request(origin+path),{},{});
  const html=await response.text();
  assert.equal(response.status,200,'HTTP '+response.status+': '+html.slice(0,300));
  assert.ok(html.includes(marker),'Aviso de demostración ausente');
  assert.match(response.headers.get('Content-Security-Policy')||'',/connect-src 'none'/);
  assert.equal(response.headers.get('Set-Cookie'),null);
  assert.match(response.headers.get('X-Robots-Tag')||'',/noindex/);
  for(const forbidden of ['localStorage','sendWhatsApp','productsCsvUrl','libreriasaber.mp','20-22792046'])
   assert.ok(!html.includes(forbidden),'Información de compra expuesta: '+forbidden);
 });
}
test('Worker compilado: cotizador continúa protegido',async()=>{
 const r=await worker.fetch(new Request(origin+'/prueba-v2/'),env,{});
 assert.equal(r.status,401);
});
