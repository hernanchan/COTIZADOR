// Instrumentación opt-in: no se activa automáticamente.
// Integrar únicamente después de validar ruta, privacidad y política de consentimiento.
import { validarEvento } from './embudo.mjs';

export function crearRegistrador({ enviar, ahora = () => Date.now(), sesion }) {
  if (typeof enviar !== 'function') throw new TypeError('Falta transporte');
  if (typeof sesion !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(sesion)) {
    throw new TypeError('Sesión inválida');
  }
  return async function registrar(type, stage) {
    const evento = { type, sessionId: sesion, at: ahora() };
    if (stage !== undefined) evento.stage = stage;
    if (!validarEvento(evento, 'cliente')) return false;
    await enviar(evento);
    return true;
  };
}
