// Analítica del recorrido comercial. Nunca recibe datos personales.
export const EVENTOS = Object.freeze([
  'page_view', 'quote_started', 'upload_started', 'upload_completed',
  'quote_viewed', 'checkout_started', 'payment_method_selected',
  'order_created', 'payment_confirmed', 'order_delivered'
]);
const CLIENTE = new Set(EVENTOS.slice(0, 7));
const SERVIDOR = new Set(EVENTOS.slice(7));
const CAMPOS = new Set(['eventId', 'type', 'sessionId', 'at', 'stage']);

export function validarEvento(evento, origen) {
  if (!evento || typeof evento !== 'object' || Array.isArray(evento)) return false;
  if (Object.keys(evento).some(k => !CAMPOS.has(k))) return false;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(evento.eventId || '')) return false;
  if (typeof evento.type !== 'string') return false;
  if (origen === 'cliente' ? !CLIENTE.has(evento.type) : origen === 'servidor' ? !SERVIDOR.has(evento.type) : true) return false;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(evento.sessionId || '')) return false;
  if (typeof evento.at !== 'number' || !Number.isFinite(evento.at)) return false;
  if (evento.stage !== undefined && !['inicio', 'archivo', 'precio', 'confirmacion', 'pago'].includes(evento.stage)) return false;
  return true;
}

export function resumirEmbudo(eventos) {
  const validos = eventos.filter(e => e && EVENTOS.includes(e.type) && typeof e.sessionId === 'string');
  const unique = new Map();
  for (const e of validos) unique.set(e.eventId || `${e.type}:${e.sessionId}:${e.at}`, e);
  const lista = [...unique.values()];
  const sesiones = new Map();
  for (const e of lista) {
    if (!sesiones.has(e.sessionId)) sesiones.set(e.sessionId, new Set());
    sesiones.get(e.sessionId).add(e.type);
  }
  const cuenta = type => [...sesiones.values()].filter(s => s.has(type)).length;
  return {
    visitas: lista.filter(e => e.type === 'page_view').length,
    sesiones: new Set(lista.filter(e => e.type === 'page_view').map(e => e.sessionId)).size,
    iniciadas: cuenta('quote_started'),
    cotizadas: cuenta('quote_viewed'),
    checkout: cuenta('checkout_started'),
    // Sin vínculo verificable pedido-sesión no se estima abandono ni conversión.
    abandonoPorEtapa: null,
    conversionPorcentaje: null
  };
}
