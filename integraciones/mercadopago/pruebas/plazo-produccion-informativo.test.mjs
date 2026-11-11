import test from 'node:test';
import assert from 'node:assert/strict';
import {plazoInformativo,plazoPublicoCentral} from './plazo-produccion-informativo.mjs';
const wednesday=Date.parse('2026-11-11T12:00:00Z');
const closing=Date.parse('2026-11-11T23:15:00Z');
const saturday=Date.parse('2026-11-14T12:00:00Z');
const request=()=>new Request('https://pagos.libreriasaber.com.ar/public/api/plazo-produccion');
test('modo hoy publicado antes del pago indica máximo ORIENTATIVO sin hora de retiro',()=>{
 const value=plazoInformativo('hoy',wednesday);
 assert.equal(value.mode,'hoy');
 assert.match(value.heading,/máximo orientativo/);
 assert.match(value.label,/día de hoy/);
 assert.equal(value.exactReadyAt,null);
 assert.equal(value.guaranteed,false);
 assert.match(value.notice,/acreditación del pago/);
 assert.match(value.notice,/feriados/);
 assert.match(value.notice,/iniciemos la preparación/);
});
test('no prometer hoy después del cierre ni en fin de semana',()=>{
 for(const now of [closing,saturday]){
  const x=plazoInformativo('hoy',now);
  assert.equal(x.mode,'por_confirmar');
  assert.doesNotMatch(x.label,/día de hoy/);
  assert.equal(x.guaranteed,false);
 }
});
test('día siguiente es una franja, no inventa día y hora calendario',()=>{
 const x=plazoInformativo('proximo_dia',wednesday);
 assert.equal(x.mode,'proximo_dia');
 assert.match(x.label,/Próximo día de atención/);
 assert.equal(x.exactReadyAt,null);
});
test('plazo se lee de la Central SIN modificar tablas ni estado de pedidos',async()=>{
 const seen=[],env={DB:{prepare(sql){seen.push(sql);return {first:async()=>({mode:'hoy_tarde'})}}}};
 const res=await plazoPublicoCentral(request(),env,{now:()=>wednesday});
 assert.equal(res.status,200);
 const x=await res.json();
 assert.equal(x.mode,'hoy_tarde');
 assert.equal(x.guaranteed,false);
 assert.equal(seen.length,1);
 assert.match(seen[0],/^SELECT mode FROM central_delivery_plan/);
});
test('sin configuración devuelve pendiente por confirmar y no inventa promesas',async()=>{
 const env={DB:{prepare(){return {first:async()=>{throw Error('no table')}}}}};
 const res=await plazoPublicoCentral(request(),env,{now:()=>wednesday});
 assert.equal((await res.json()).mode,'por_confirmar');
});
