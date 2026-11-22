import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarEvento, resumenPorPeriodo, purgarEventosAntiguos, RETENCION_MS } from '../integraciones/estadisticas/d1.mjs';

const session = 'sesion_123456789012345';
const eventId = 'evento_12345678901234';
function dbFalsa() {
  const calls = [], seen = new Set();
  return {
    calls,
    prepare(sql) {
      const entry = { sql, args: null };
      calls.push(entry);
      return {
        bind(...args) { entry.args = args; return this; },
        async run() {
          const id = entry.args[0];
          const changes = seen.has(id) ? 0 : 1;
          seen.add(id);
          return { success: true, meta: { changes } };
        },
        async first() {
          return sql.includes('FROM orders') ? { pedidosPagados: 3 } :
            { visitas: 6, sesiones: 4, iniciadas: 2, cotizadas: 2, checkout: 1 };
        }
      };
    }
  };
}

test('rechaza pagos desde el navegador y campos personales', async () => {
  const db = dbFalsa(), now = 1763000000000;
  const base = { eventId, type: 'page_view', sessionId: session, at: now };
  assert.equal((await guardarEvento(db, { ...base, type: 'payment_confirmed' }, 'cliente', now)).status, 400);
  assert.equal((await guardarEvento(db, { ...base, email: 'a@example.com' }, 'cliente', now)).status, 400);
  assert.equal((await guardarEvento(db, base, 'servidor', now)).status, 400);
  assert.equal(db.calls.length, 0);
});

test('guarda eventos idempotentes y sin datos personales', async () => {
  const db = dbFalsa(), now = 1763000000000;
  const evento = { eventId, type: 'quote_viewed', sessionId: session, at: now };
  assert.deepEqual(await guardarEvento(db, evento, 'cliente', now), { ok: true, status: 202, duplicate: false });
  assert.deepEqual(await guardarEvento(db, evento, 'cliente', now), { ok: true, status: 202, duplicate: true });
  assert.deepEqual(db.calls[0].args, [eventId, 'quote_viewed', session, now, null, 'cliente']);
  assert.match(db.calls[0].sql, /INSERT OR IGNORE/);
});

test('cuenta visitas y sesiones por eventos, ventas desde pagos verificados', async () => {
  const db = dbFalsa();
  const resumen = await resumenPorPeriodo(db, 1000, 2000);
  assert.deepEqual(resumen, {
    visitas: 6, sesiones: 4, iniciadas: 2, cotizadas: 2, checkout: 1,
    pedidosPagados: 3, abandonoPorEtapa: null, conversionPorcentaje: null
  });
  assert.match(db.calls[1].sql, /o\.status='paid'/);
  assert.match(db.calls[1].sql, /o\.deposit_ars=o\.amount_ars/);
  assert.match(db.calls[1].sql, /r\.state='verified'/);
  assert.deepEqual(db.calls[1].args, [1000, 2000]);
  await assert.rejects(resumenPorPeriodo(db, 1000, 1000), RangeError);
  await assert.rejects(resumenPorPeriodo(db, 0, 100 * 86400000), RangeError);
});

test('retiene eventos por 90 días y ofrece purga explícita', async () => {
  const db = dbFalsa(), now = 1763000000000;
  await purgarEventosAntiguos(db, now);
  assert.match(db.calls[0].sql, /DELETE FROM saber_analytics_events/);
  assert.equal(db.calls[0].args[0], Math.floor((now - RETENCION_MS) / 1000));
});
