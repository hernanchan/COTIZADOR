// Instrumentación opt-in; se activa solo al integrar el recorrido y la política de privacidad.
import { validarEvento } from './embudo.mjs';

export function crearRegistrador({ enviar, ahora = () => Date.now(), sesion, crearId = () => crypto.randomUUID() }) {
  if (typeof enviar !== 'function') throw new TypeError('Falta transporte');
  if (typeof sesion !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(sesion)) throw new TypeError('Sesión inválida');
  if (typeof crearId !== 'function') throw new TypeError('Falta generador de idempotencia');
  return async function registrar(type, stage) {
    const evento = { eventId: crearId(), type, sessionId: sesion, at: ahora() };
    if (stage !== undefined) evento.stage = stage;
    if (!validarEvento(evento, 'cliente')) return false;
    try { return (await enviar(evento)) !== false; } catch { return false; }
  };
}

// Transporte del navegador sin cookies ni credenciales del personal.
// El endpoint solo acepta eventos anónimos y el Worker de documentos firma el puente.
export function crearEmisorHttp({ fetcher = globalThis.fetch?.bind(globalThis), endpoint = '/api/estadisticas/evento' } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('Falta transporte HTTP');
  if (typeof endpoint !== 'string' || endpoint !== '/api/estadisticas/evento') throw new TypeError('Ruta de estadísticas inválida');
  return async evento => {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true
    });
    return response.status === 202;
  };
}
