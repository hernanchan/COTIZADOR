import { validarEvento } from './embudo.mjs';

// Adaptador aislado. NO exponer la ruta sin controles de origen y tasa en el Worker.
// Se recibe la DB explícitamente para no inventar bindings de producción.
export async function guardarEvento(db, evento, origen, now = Date.now()) {
  if (!validarEvento(evento, origen)) return { ok: false, status: 400 };
  if (Math.abs(evento.at - now) > 5 * 60 * 1000) return { ok: false, status: 400 };
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Falta D1');
  await db.prepare(
    'INSERT INTO saber_analytics_events (event_type,session_id,event_time_ms,stage,source) VALUES (?,?,?,?,?)'
  ).bind(evento.type, evento.sessionId, evento.at, evento.stage ?? null, origen).run();
  return { ok: true, status: 202 };
}

// Consulta agregada: solo el backend autenticado de la Central debe invocarla.
export async function resumenPorPeriodo(db, desdeMs, hastaMs) {
  if (!Number.isSafeInteger(desdeMs) || !Number.isSafeInteger(hastaMs) ||
      hastaMs <= desdeMs || hastaMs - desdeMs > 93 * 86400000) {
    throw new RangeError('Periodo inválido');
  }
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Falta D1');
  const result = await db.prepare(
    `SELECT
      COUNT(DISTINCT CASE WHEN event_type='page_view' THEN session_id END) AS visitas,
      COUNT(DISTINCT CASE WHEN event_type='quote_started' THEN session_id END) AS iniciadas,
      COUNT(DISTINCT CASE WHEN event_type='quote_viewed' THEN session_id END) AS cotizadas,
      COUNT(DISTINCT CASE WHEN event_type='checkout_started' THEN session_id END) AS checkout,
      COUNT(CASE WHEN event_type='payment_confirmed' AND source='servidor' THEN 1 END) AS eventosPagoConfirmado
    FROM saber_analytics_events WHERE event_time_ms >= ? AND event_time_ms < ?`
  ).bind(desdeMs, hastaMs).first();
  return {
    visitas: Number(result?.visitas ?? 0),
    iniciadas: Number(result?.iniciadas ?? 0),
    cotizadas: Number(result?.cotizadas ?? 0),
    checkout: Number(result?.checkout ?? 0),
    eventosPagoConfirmado: Number(result?.eventosPagoConfirmado ?? 0)
  };
}
