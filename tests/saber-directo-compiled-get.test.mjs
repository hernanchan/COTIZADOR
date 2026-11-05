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
