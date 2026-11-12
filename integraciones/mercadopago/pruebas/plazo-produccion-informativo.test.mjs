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
test('no prometer hoy después del cierre ni en fin de semana; explicar el motivo al cliente',()=>{
 for(const now of [closing,saturday]){
  const x=plazoInformativo('hoy',now);
  assert.equal(x.mode,'por_confirmar');
  assert.equal(x.configuredMode,'hoy');
  assert.match(x.label,/previsión de hoy venció/);
  assert.match(x.notice,/ya terminó el horario/);
  assert.equal(x.estimatedDeadlineDate,null);
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
 assert.equal(seen.length,3);
 assert.match(seen[0],/^SELECT mode FROM central_delivery_plan/);
 assert.match(seen[1],/^SELECT weekly_json,closed_json FROM central_eta_calendar/);
 assert.match(seen[2],/^SELECT approved_json FROM central_pricing_admin_head/);
});
test('sin configuración devuelve pendiente por confirmar y no inventa promesas',async()=>{
 const env={DB:{prepare(){return {first:async()=>{throw Error('no table')}}}}};
 const res=await plazoPublicoCentral(request(),env,{now:()=>wednesday});
 assert.equal((await res.json()).mode,'por_confirmar');
});


const calendar={
 weekly:{mon:'07:00-13:30,16:30-20:00',tue:'07:00-13:30,16:30-20:00',
 wed:'07:00-13:30,16:30-20:00',thu:'07:00-13:30,16:30-20:00',
 fri:'07:00-13:30,16:30-20:00',sat:'',sun:''},
 closedDates:[]
};
test('fecha visible del día de hoy desde agenda Córdoba verificada',()=>{
 const x=plazoInformativo('hoy',wednesday,calendar);
 assert.equal(x.mode,'hoy');
 assert.equal(x.estimatedDeadlineDate,'2026-11-11');
 assert.equal(x.guaranteed,false);
});
test('próximo día respeta fines de semana y feriado editable',()=>{
 const viernes=Date.parse('2026-11-13T14:00:00Z');
 const x=plazoInformativo('proximo_dia',viernes,{...calendar,
  closedDates:['2026-11-16']});
 assert.equal(x.estimatedDeadlineDate,'2026-11-17');
});
test('si la Central fijó hoy, mostrar la fecha local aun sin agenda D1',()=>{
 const x=plazoInformativo('hoy',wednesday,null);
 assert.equal(x.mode,'hoy');
 assert.equal(x.estimatedDeadlineDate,'2026-11-11');
 assert.equal(x.calendarVerified,false);
 assert.equal(x.guaranteed,false);
 assert.equal(x.exactReadyAt,null);
});
test('sin agenda D1, próximo día no inventa fecha calendario',()=>{
 const x=plazoInformativo('proximo_dia',wednesday,null);
 assert.equal(x.estimatedDeadlineDate,null);
 assert.equal(x.mode,'proximo_dia');
});
test('no prometer fecha de feriado o cierre informado',()=>{
 const x=plazoInformativo('hoy',wednesday,{...calendar,closedDates:['2026-11-11']});
 assert.equal(x.estimatedDeadlineDate,null);
 assert.equal(x.mode,'por_confirmar');
});
test('día cerrado no disfraza una previsión hoy como a confirmar genérico',()=>{
 const x=plazoInformativo('hoy',wednesday,{...calendar,closedDates:['2026-11-11']});
 assert.equal(x.mode,'por_confirmar');
 assert.equal(x.configuredMode,'hoy');
 assert.match(x.label,/día sin atención/);
 assert.match(x.notice,/calendario registra un cierre o feriado/);
 assert.equal(x.estimatedDeadlineDate,null);
});
test('promo semanal solo informativa y nunca aplicada a un importe cobrado',async()=>{
 const snapshot={promotions:{enabled:true,weekly:[
  {day:3,title:'Miércoles de fotos',summary:'Premium al precio normal',enabled:true}
 ]}};
 const env={DB:{prepare(sql){return {first:async()=>{
  if(sql.includes('central_delivery_plan'))return {mode:'hoy'};
  if(sql.includes('central_eta_calendar'))return {
   weekly_json:JSON.stringify(calendar.weekly),closed_json:'[]'};
  if(sql.includes('central_pricing_admin_head'))
   return {approved_json:JSON.stringify(snapshot)};
  throw Error('unexpected');
 }}}}};
 const res=await plazoPublicoCentral(request(),env,{now:()=>wednesday});
 const x=await res.json();
 assert.equal(x.estimatedDeadlineDate,'2026-11-11');
 assert.equal(x.dayPromotion.title,'Miércoles de fotos');
 assert.equal(x.dayPromotion.appliedToQuote,false);
 assert.equal(x.dayPromotion.informationalOnly,true);
});
