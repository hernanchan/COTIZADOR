import test from 'node:test';
import assert from 'node:assert/strict';
import prices from '../precios-web.json' with {type:'json'};
import {cotizarPlanUniversalSinSubida} from '../integraciones/autocotizador/recepcion/r2-plan-universal-api-privada.mjs';
import {readFileSync} from 'node:fs';

const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-r2-plan-universal';
const flags={DOCS_R2_UNIVERSAL_PLAN_ENABLED:'PRIVATE_TEST_ONLY',DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY'};
const mib=1024*1024;
const doc={nombre:'Libro universitario.pdf',paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'};
const manifiesto={fileId:'libro01',nombre:doc.nombre,bytes:70*mib,sha256:'a'.repeat(64)};
const priceLoader=async()=>({source:'private-d1-approved-only',revision:4,
 prices:{...prices,priceVersion:'d1-approved-revision-4'}});
const request=(body,origin=new URL(url).origin)=>new Request(url,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify(body)
});
test('ruta no autorizada no lee tarifario ni cotiza',async()=>{
 let reads=0;
 const r=await cotizarPlanUniversalSinSubida(request({archivos:[doc],manifiestos:[manifiesto]}),flags,{
  authorized:false,priceLoader:async()=>{reads++;return priceLoader()}
 });
 assert.equal(r.status,401);assert.equal(reads,0);
});
test('flag OFF: no lee D1, no devuelve precio, no crea pedido',async()=>{
 let reads=0;
 const r=await cotizarPlanUniversalSinSubida(request({archivos:[doc],manifiestos:[manifiesto]}),
  {...flags,DOCS_R2_UNIVERSAL_PLAN_ENABLED:'OFF'},{
  authorized:true,priceLoader:async()=>{reads++;return priceLoader()}
 });
 assert.equal(r.status,503);assert.equal(reads,0);
});
test('PDF A4 grande recibe cotización y R2 sin subir ni cobrar',async()=>{
 const r=await cotizarPlanUniversalSinSubida(request({archivos:[doc],manifiestos:[manifiesto]}),
  flags,{authorized:true,priceLoader});
 assert.equal(r.status,200);
 const x=await r.json();
 assert.equal(x.ok,true);assert.equal(x.archivos.length,1);
 assert.equal(x.archivos[0].destino,'documentos');
 assert.equal(x.archivos[0].transporte,'r2');
 assert.equal(x.filesUploaded,false);
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.productionAuthorized,false);
 assert.equal(x.requiresPaymentConfirmation,true);
 assert.ok(x.totalArs>0);
 assert.equal(x.archivos[0].sha256,undefined,'No exponer huella del original en respuesta pública');
});
test('origen cruzado bloqueado antes de leer D1',async()=>{
 let called=false;
 const r=await cotizarPlanUniversalSinSubida(request({archivos:[doc],manifiestos:[manifiesto]},
  'https://example.com'),flags,{authorized:true,priceLoader:async()=>{called=true;return priceLoader()}});
 assert.equal(r.status,403);assert.equal(called,false);
});
test('no acepta subtotal del cliente ni tamaño >200 MiB',async()=>{
 const body={archivos:[doc],manifiestos:[manifiesto],totalArs:1};
 const r=await cotizarPlanUniversalSinSubida(request(body),flags,{authorized:true,priceLoader});
 assert.equal(r.status,422);
 const oversized=await cotizarPlanUniversalSinSubida(request({
  archivos:[doc],manifiestos:[{...manifiesto,bytes:201*mib}]
 }),flags,{authorized:true,priceLoader});
 assert.equal(oversized.status,422);
});
test('Worker integra ruta bajo autorización de comprador y sigue OFF',()=>{
 const text=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(text,/page==='\/prueba-v2\/api\/ensayo-r2-plan-universal'/);
 assert.match(text,/return cotizarPlanUniversalSinSubida\(request,env/);
 assert.match(readFileSync(new URL('../integraciones/autocotizador/recepcion/r2-plan-universal-api-privada.mjs',import.meta.url),'utf8'),
 /DOCS_R2_UNIVERSAL_PLAN_ENABLED/);
});
