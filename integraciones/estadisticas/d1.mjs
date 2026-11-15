import { validarEvento } from './embudo.mjs';

export const RETENCION_MS = 90 * 86400000;

// Solo eventos de navegador. Pagos y pedidos se leen del registro comercial existente.
export async function guardarEvento(db, evento, origen, now = Date.now()) {
  if (!validarEvento(evento, origen)) return { ok: false, status: 400 };
  if (origen !== 'cliente' || Math.abs(evento.at - now) > 5 * 60 * 1000) return { ok: false, status: 400 };
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Falta D1');
  const saved = await db.prepare(
    'INSERT OR IGNORE INTO saber_analytics_events (event_id,event_type,session_id,event_time_ms,stage,source) VALUES (?,?,?,?,?,?)'
  ).bind(evento.eventId, evento.type, evento.sessionId, evento.at, evento.stage ?? null, 'cliente').run();
  return { ok: true, status: 202, duplicate: Number(saved?.meta?.changes) === 0 };
}

// El resumen de ventas usa pedidos pagados con revisión verificada; nunca eventos del cliente.
export async function resumenPorPeriodo(db, desdeMs, hastaMs) {
  if (!Number.isSafeInteger(desdeMs) || !Number.isSafeInteger(hastaMs) ||
      hastaMs <= desdeMs || hastaMs - desdeMs > 93 * 86400000) {
    throw new RangeError('Periodo inválido');
  }
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Falta D1');
  const eventos = await db.prepare(
    `SELECT
      SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) AS visitas,
      COUNT(DISTINCT CASE WHEN event_type='page_view' THEN session_id END) AS sesiones,
      COUNT(DISTINCT CASE WHEN event_type='quote_started' THEN session_id END) AS iniciadas,
      COUNT(DISTINCT CASE WHEN event_type='quote_viewed' THEN session_id END) AS cotizadas,
      COUNT(DISTINCT CASE WHEN event_type='checkout_started' THEN session_id END) AS checkout
    FROM saber_analytics_events WHERE event_time_ms >= ? AND event_time_ms < ?`
  ).bind(desdeMs, hastaMs).first();
  const ventas = await db.prepare(
    `SELECT COUNT(DISTINCT o.id) AS pedidosPagados
    FROM orders o JOIN payment_reviews r ON r.order_id=o.id
    WHERE o.status='paid' AND o.paid_at IS NOT NULL
      AND o.deposit_ars=o.amount_ars AND r.state='verified'
      AND CAST(strftime('%s', o.paid_at) AS INTEGER) * 1000 >= ?
      AND CAST(strftime('%s', o.paid_at) AS INTEGER) * 1000 < ?`
  ).bind(desdeMs, hastaMs).first();
  return {
    visitas: Number(eventos?.visitas ?? 0),
    sesiones: Number(eventos?.sesiones ?? 0),
    iniciadas: Number(eventos?.iniciadas ?? 0),
    cotizadas: Number(eventos?.cotizadas ?? 0),
    checkout: Number(eventos?.checkout ?? 0),
    pedidosPagados: Number(ventas?.pedidosPagados ?? 0),
    // No atribuir pagos a sesiones sin vínculo confiable en la creación del pedido.
    abandonoPorEtapa: null,
    conversionPorcentaje: null
  };
}

// La integración debe invocar esta purga desde un cron diario del Worker.
export async function purgarEventosAntiguos(db, now = Date.now()) {
  if (!Number.isSafeInteger(now)) throw new TypeError('Reloj inválido');
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Falta D1');
  const cutoffSeconds = Math.floor((now - RETENCION_MS) / 1000);
  return db.prepare(
    "DELETE FROM saber_analytics_events WHERE received_at < datetime(?, 'unixepoch')"
  ).bind(cutoffSeconds).run();
}
