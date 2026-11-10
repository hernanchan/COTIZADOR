import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {obtenerTarifarioD1Live} from './obtener-tarifario-d1-live.mjs';
const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_LIVE_PRICING_GATE:gate,DOCS_MP_LIVE_GATE:gate,
 CENTRAL_BRIDGE_KEY:'this-key-is-only-for-signing-libreria-saber-live'};
const valid={ok:true,schema:'saber-price-snapshot-v1',source:'production-d1-approved-only',
 approvedRevision:2,approvedAt:'2026-11-10T12:00:00Z',
 paymentAuthorized:false,commercialRelease:false,
 prices:{schema:'saber-web-prices-v1',bnA4:{scales:[]},colorA4:{materials:[]},
  plotter:{supports:[]}},promotions:{codes:[]}};
const run=(patch={},payload=valid,status=200)=>{
 const calls=[];
 const cfg={...env,...patch};
 const promise=obtenerTarifarioD1Live(cfg,{
  subtle:webcrypto.subtle,now:()=>1794320000,
  nonce:()=> '123e4567-e89b-42d3-a456-426614174001',
  fetchService:async req=>{
   calls.push(req);
   return new Response(JSON.stringify(payload),{status});
  }
 });
 return {calls,promise};
};
test('no consulta D1 con compuerta cerrada o entorno sandbox',async()=>{
 for(const patch of [{DOCS_LIVE_PRICING_GATE:'NO_GO'},
  {DOCS_MP_LIVE_GATE:'NO_GO'},{SABER_ENTORNO:'preparacion'},
  {CENTRAL_DB_ENV:'pruebas'},{CENTRAL_BRIDGE_KEY:'short'}]){
  const x=run(patch);
  await assert.rejects(x.promise,/LIVE_PRICING_OFF/);
  assert.equal(x.calls.length,0);
 }
});
test('consulta por service binding al origen LIVE, no servidor sandbox',async()=>{
 const x=run(),p=await x.promise;
 assert.equal(p.revision,2);
 assert.equal(p.source,'production-d1-approved-only');
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].url,'https://pagos.libreriasaber.com.ar/internal/central/live/pricing');
 assert.equal(x.calls[0].headers.get('Origin'),null);
 assert.deepEqual(await x.calls[0].json(),{
  schema:'saber-price-snapshot-live-v1',purpose:'quote-production-approved'});
});
test('rechaza tarifa no aprobada, fuente sandbox y error D1 sin usar fallback',async()=>{
 for(const [payload,status] of [
  [{...valid,source:'private-d1-approved-only'},200],
  [{...valid,commercialRelease:true},200],
  [{...valid,approvedRevision:0},200],
  [valid,503]
 ]){
  const x=run({},payload,status);
  await assert.rejects(x.promise,/LIVE_PRICING_(INVALID|NO_APPROVAL)/);
 }
});
