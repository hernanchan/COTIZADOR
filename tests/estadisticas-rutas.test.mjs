import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRutasEstadisticas } from '../integraciones/estadisticas/rutas-worker.mjs';

const evento = { schema: 'saber-analytics-event-v1', eventId: 'evento_12345678901234', type: 'page_view', sessionId: 'sesion_123456789012345', at: Date.now() };
function fakeDb() {
  const calls=[];
  return { calls, prepare(sql) { const row={sql,args:null};calls.push(row);return {bind(...args){row.args=args;return this},async run(){return {meta:{changes:1}}},async first(){return {visitas:1,sesiones:1,iniciadas:0,cotizadas:0,checkout:0,pedidosPagados:0}}}; } };
}
function signed(payload, error = false) {
  return async () => error ? { error: 'bad signature', status: 401 } : { payload };
}

test('estadísticas requieren una firma interna válida', async () => {
  const db=fakeDb(), routes=crearRutasEstadisticas({db,verificarCentral:signed(evento,true),limitarIngesta:async()=>true});
  const response=await routes.evento(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/analytics-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evento)}));
  assert.equal(response.status,401);
  assert.equal(db.calls.length,0);
});

test('la ruta de evento valida y deduplica antes de guardar', async () => {
  const db=fakeDb();let limited;
  const routes=crearRutasEstadisticas({db,verificarCentral:signed(evento),limitarIngesta:async(session)=>{limited=session;return true}});
  const response=await routes.evento(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/analytics-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evento)}));
  assert.equal(response.status,202);
  assert.equal(limited,evento.sessionId);
  assert.deepEqual(db.calls[0].args,[evento.eventId,evento.type,evento.sessionId,evento.at,null,'cliente']);
});

test('evento inválido se rechaza antes de consumir el límite', async () => {
  let limited=false;
  const routes=crearRutasEstadisticas({db:fakeDb(),verificarCentral:signed({...evento,phone:'3511234567'}),limitarIngesta:async()=>{limited=true;return true}});
  const response=await routes.evento(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/analytics-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evento)}));
  assert.equal(response.status,400);
  assert.equal(limited,false);
});

test('el resumen interno usa el período firmado', async () => {
  const db=fakeDb(),payload={schema:'saber-analytics-summary-v1',desdeMs:1000,hastaMs:2000};
  const routes=crearRutasEstadisticas({db,verificarCentral:signed(payload),limitarIngesta:async()=>true});
  const response=await routes.resumen(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/analytics-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{visitas:1,sesiones:1,iniciadas:0,cotizadas:0,checkout:0,pedidosPagados:0,abandonoPorEtapa:null,conversionPorcentaje:null});
});
