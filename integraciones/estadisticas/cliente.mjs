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
    await enviar(evento);
    return true;
  };
}
