import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,randomUUID} from 'node:crypto';
import {obtenerTarifarioD1Privado} from '../integraciones/autocotizador/recepcion/obtener-tarifario-d1-privado.mjs';
import {cotizarDocumentos} from '../integraciones/autocotizador/pruebas/cotizar-documentos.mjs';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const docs=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const snapshot=vm.runInContext('priceAdminApprovedSnapshot',ctx);
const baseline=vm.runInContext('PRICE_ADMIN_BASELINE',ctx);
const key='CLAVE-HMAC-CONEXION-ENTRE-WORKERS-SEGURA-12345';
let head={approved_revision:0,approved_json:null,draft_json:null,revision:0};
const central={
 CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',PRICE_ADMIN_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:key,DEMO_ADMIN_KEY:'ADMIN-CLAVE-INDEPENDIENTE',MP_WEBHOOK_SECRET:'WEBHOOK-DISTINTO',
 DB:{prepare(sql){
  return {bind(...args){this.args=args;return this},async run(){return {meta:{changes:1}}},async first(){
   if(sql.includes('SELECT revision,approved_revision,draft_json,approved_json'))return {...head};
   if(sql.includes('SELECT created_at FROM central_pricing_admin_history'))return {created_at:'2026-11-03 10:00:00'};
   return null;
  }};
 }}
};
const docsEnv={
 DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_KEY:key,
 SABER_CENTRAL:{fetch:req=>snapshot(req,central)}
};
const opts=()=>({subtle:webcrypto.subtle,now:()=>Math.floor(Date.now()/1000),requestId:randomUUID});
test('editor protege el snapshot: firma obligatoria, ruta exacta y ninguna lectura sin aprobación',async()=>{
 const url='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/pricing-snapshot';
 const unsigned=await snapshot(new Request(url,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'saber-price-snapshot-v1',purpose:'quote-private-test'})}),central);
 assert.equal(unsigned.status,401);
 head={approved_revision:0,approved_json:null,draft_json:JSON.stringify(baseline),revision:1};
 await assert.rejects(()=>obtenerTarifarioD1Privado(docsEnv,opts()),/No existe un tarifario aprobado/);
});
test('D1 devuelve SOLO versión aprobada, nunca borrador en edición',async()=>{
 const approved=JSON.parse(JSON.stringify(baseline));
 const draft=JSON.parse(JSON.stringify(baseline));
 draft.prices.bnA4.scales[0].simple=999;
 head={approved_revision:2,approved_json:JSON.stringify(approved),
  draft_json:JSON.stringify(draft),revision:3};
 const result=await obtenerTarifarioD1Privado(docsEnv,opts());
 assert.equal(result.prices.bnA4.scales[0].simple,100);
 assert.equal(result.revision,2);
 assert.equal(result.prices.generatedAt,'2026-11-03T10:00:00Z');
 assert.equal(result.prices.priceVersion,'d1-approved-revision-2');
 assert.equal(result.promotions.weekly.length,7);
 assert.equal(result.source,'private-d1-approved-only');
});
test('no hay fallback cuando D1 no responde o la firma no coincide',async()=>{
 await assert.rejects(()=>obtenerTarifarioD1Privado({...docsEnv,CENTRAL_BRIDGE_KEY:'CLAVE-NO-COINCIDE-Y-SUFICIENTEMENTE-LARGA'},opts()),/No existe un tarifario aprobado/);
 await assert.rejects(()=>obtenerTarifarioD1Privado({...docsEnv,SABER_CENTRAL:{fetch:async()=>new Response('Falla D1',{status:503})}},opts()),/No existe un tarifario aprobado/);
 await assert.rejects(()=>obtenerTarifarioD1Privado({...docsEnv,DOCS_PRICE_ADMIN_D1_ENABLED:'OFF'},opts()),/no habilitada/);
});
test('el motor documental usa el mismo catálogo D1 para carga, presupuesto, TUS y precio visible',()=>{
 assert.match(docs,/async function preciosPrivados\(env,request\)/);
 assert.match(docs,/DOCS_PRICE_ADMIN_D1_ENABLED/);
 assert.match(docs,/obtenerTarifarioD1Privado\(env\)/);
 assert.match(docs,/preciosServidor:await preciosPrivados\(env,request\)/);
 assert.match(docs,/JSON\.stringify\(await preciosPrivados\(env,request\)\)/);
 assert.match(docs,/preciosActuales=await preciosPrivados\(env,request\)/);
 assert.match(docs,/La versión de precios privada requiere sesión autorizada/);
 assert.equal((docs.match(/preciosPiloto/g)||[]).length,2,
  'No dejar rutas de cotización con lista vieja en la rama D1');
});

test('un cambio aprobado se refleja en el cálculo PRELIMINAR sin arrastrar el borrador',async()=>{
 const data=JSON.parse(JSON.stringify(baseline));
 data.prices.bnA4.scales[0].simple=120;
 const pending=JSON.parse(JSON.stringify(data));
 pending.prices.bnA4.scales[0].simple=555;
 head={revision:9,approved_revision:8,approved_json:JSON.stringify(data),
  draft_json:JSON.stringify(pending)};
 const current=await obtenerTarifarioD1Privado(docsEnv,opts());
 const options={archivos:[{id:'pdf-1',paginas:10,modo:'bn',orden:1}],
  copias:1,formato:'a4',caras:'simple',anillado:'ninguno',materialColor:'obra70'};
 const before=cotizarDocumentos({...options,precios:baseline.prices});
 const after=cotizarDocumentos({...options,precios:current.prices});
 assert.equal(before.total,1000);
 assert.equal(after.total,1200);
 assert.equal(current.revision,8);
 assert.equal(current.prices.bnA4.scales[0].simple,120);
 assert.notEqual(after.total,5550,'No aplicar un borrador privado sin aprobar');
});
