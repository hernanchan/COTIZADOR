import test from 'node:test';
import assert from 'node:assert/strict';
import {r2CanaryPedidoAutorizado,r2CanaryArchivoUnico,
 r2GateGeneralOCanary} from './r2-live-canary-order.mjs';
const G='GO_COMERCIAL_CONFIRMADO',OFF='NO_GO';
const ID='WEB-ENSAYO-'+'A'.repeat(32),OTHER='WEB-ENSAYO-'+'B'.repeat(32);
const now=Date.parse('2026-11-12T12:00:00Z');
const valid=()=>({
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:G,CENTRAL_LIVE_BRIDGE_ENABLED:G,CENTRAL_LIVE_POSTPAY_GATE:G,
 CENTRAL_LIVE_ORDER_GATE:G,CENTRAL_LIVE_PRICING_GATE:G,
 CENTRAL_LIVE_R2_GATE:OFF,CENTRAL_LIVE_R2_QUOTA_GATE:OFF,
 CENTRAL_LIVE_R2_STAGING_GATE:OFF,
 CENTRAL_R2_CANARY_MODE:'SOLO_PEDIDO_R2_CONTROLADO',
 CENTRAL_R2_CANARY_ORDER_ID:ID,
 CENTRAL_R2_CANARY_EXPIRES_AT:'2026-11-13T12:00:00Z'
});
const clock={now:()=>now};
const rows=[{transport:'r2',bytes:60*1048576}];
test('modo canary no existe por omisión y no modifica compuertas del público',()=>{
 const e=valid();delete e.CENTRAL_R2_CANARY_MODE;
 assert.equal(r2CanaryPedidoAutorizado(e,ID,clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,rows,clock),false);
 assert.equal(r2GateGeneralOCanary(e,ID,
  ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE'],clock),false);
});
test('sólo ID exacto y PDF único de 40 a 200 MiB durante 48 horas máximo',()=>{
 const e=valid();
 assert.equal(r2CanaryPedidoAutorizado(e,ID,clock),true);
 assert.equal(r2CanaryArchivoUnico(e,ID,rows,clock),true);
 assert.equal(r2CanaryPedidoAutorizado(e,OTHER,clock),false);
 assert.equal(r2CanaryArchivoUnico(e,OTHER,rows,clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,[...rows,...rows],clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,[{transport:'tus',bytes:3}],clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,[{transport:'r2',bytes:40*1048576}],clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,[{transport:'r2',bytes:200*1048576+1}],clock),false);
 assert.equal(r2CanaryArchivoUnico(e,ID,[{transport:'r2',bytes:200*1048576}],clock),true);
});
test('fail closed con expiración, claves y entornos incorrectos',()=>{
 for(const patch of [
  {CENTRAL_R2_CANARY_EXPIRES_AT:'2026-11-12T11:59:59Z'},
  {CENTRAL_R2_CANARY_EXPIRES_AT:'2026-11-15T12:00:00Z'},
  {CENTRAL_R2_CANARY_EXPIRES_AT:'26-11-13'},
  {CENTRAL_R2_CANARY_EXPIRES_AT:undefined},
  {CENTRAL_R2_CANARY_ORDER_ID:OTHER},
  {CENTRAL_R2_CANARY_ORDER_ID:undefined},
  {CENTRAL_R2_CANARY_MODE:'GO_COMERCIAL_CONFIRMADO'},
  {SABER_ENTORNO:'pruebas'}, {CENTRAL_DB_ENV:'pruebas'},
  {MP_LIVE_GATE:OFF}, {CENTRAL_LIVE_BRIDGE_ENABLED:OFF},
  {CENTRAL_LIVE_POSTPAY_GATE:OFF},
  {CENTRAL_LIVE_ORDER_GATE:OFF},
  {CENTRAL_LIVE_PRICING_GATE:OFF},
  {CENTRAL_LIVE_R2_GATE:G},{CENTRAL_LIVE_R2_QUOTA_GATE:G},
  {CENTRAL_LIVE_R2_STAGING_GATE:G}
 ]){
  assert.equal(r2CanaryPedidoAutorizado({...valid(),...patch},ID,clock),false,JSON.stringify(patch));
 }
});
test('la ruta especial sólo permite bypass de los gates indicados',()=>{
 const e=valid();
 assert.equal(r2GateGeneralOCanary(e,ID,
  ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE'],clock),true);
 assert.equal(r2GateGeneralOCanary(e,OTHER,
  ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE'],clock),false);
 const standard={...e,CENTRAL_R2_CANARY_MODE:undefined,CENTRAL_LIVE_R2_GATE:G,
  CENTRAL_LIVE_R2_QUOTA_GATE:G};
 assert.equal(r2GateGeneralOCanary(standard,OTHER,
  ['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE'],clock),true);
});
