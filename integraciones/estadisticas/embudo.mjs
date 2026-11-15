// Librería Saber — analítica comercial. Módulo puro; no registra ni envía datos por sí solo.
// No importar datos personales ni nombres de archivos.
export const EVENTOS = Object.freeze([
  'page_view', 'quote_started', 'upload_started', 'upload_completed',
  'quote_viewed', 'checkout_started', 'payment_method_selected',
  'order_created', 'payment_confirmed', 'order_delivered'
]);
const CLIENTE = new Set(EVENTOS.slice(0, 7));
const SERVIDOR = new Set(EVENTOS.slice(7));
export function validarEvento(evento, origen) {
  if (!evento || typeof evento !== 'object' || Array.isArray(evento)) return false;
  const keys = Object.keys(evento);
  if (keys.some(k => !['type', 'sessionId', 'at', 'stage'].includes(k))) return false;
  if (typeof evento.type !== 'string') return false;
  if (origen === 'cliente' ? !CLIENTE.has(evento.type) : origen === 'servidor' ? !SERVIDOR.has(evento.type) : true) return false;
  if (typeof evento.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(evento.sessionId)) return false;
  if (typeof evento.at !== 'number' || !Number.isFinite(evento.at)) return false;
  if (evento.stage !== undefined && !['inicio','archivo','precio','confirmacion','pago'].includes(evento.stage)) return false;
  return true;
}
export function resumirEmbudo(eventos) {
  const sesiones = new Map();
  for (const e of eventos) {
    if (!e || !EVENTOS.includes(e.type) || typeof e.sessionId !== 'string') continue;
    if (!sesiones.has(e.sessionId)) sesiones.set(e.sessionId, new Set());
    sesiones.get(e.sessionId).add(e.type);
  }
  const cuenta = type => [...sesiones.values()].filter(s => s.has(type)).length;
  const vistas = cuenta('page_view');
  const cotizaciones = cuenta('quote_viewed');
  const pagos = cuenta('payment_confirmed');
  return {
    sesiones: sesiones.size, vistas, cotizaciones,
    checkout: cuenta('checkout_started'), pagos,
    // Sin pago observado no equivale a abandono confirmado: puede estar pendiente.\n    cotizacionesSinPago: [...sesiones.values()].filter(s => s.has('quote_viewed') && !s.has('payment_confirmed')).length,
    checkoutSinPago: [...sesiones.values()].filter(s => s.has('checkout_started') && !s.has('payment_confirmed')).length,
    conversionPorcentaje: vistas ? Math.round(pagos / vistas * 10000) / 100 : 0
  };
}
