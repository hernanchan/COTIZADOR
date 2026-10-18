/**
 * Librería Saber · propuesta de ajuste para el Apps Script receptor de Polaroids.
 * PREPARACIÓN EXCLUSIVA: NO instalado en Apps Script, NO desplegado.
 *
 * Diagnóstico del piloto 18/10/2026:
 * el challenge de Pages devuelve hostname del piloto; la comprobación de
 * Google que exige únicamente libreriasaber.com.ar devuelve ERROR en start.
 *
 * INTEGRACIÓN SEGURA EN Code.gs EXISTENTE:
 * Tras ejecutar la consulta REAL a Turnstile siteverify, sustituir
 * EXCLUSIVAMENTE la comparación de hostname/action por esta función:
 *
 * if (!saberPolaroidsTurnstileAceptado_(resultadoSiteverify)) {
 *   return respuestaErrorYaExistente;
 * }
 *
 * Conservar la verificación criptográfica real hecha por Siteverify;
 * nunca confiar en un hostname enviado por el cliente.
 * Mantener bloqueo en caso de cualquier valor desconocido.
 */
function saberPolaroidsTurnstileAceptado_(resultadoSiteverify) {
  if (!resultadoSiteverify || typeof resultadoSiteverify !== 'object') return false;
  if (resultadoSiteverify.success !== true) return false;
  if (resultadoSiteverify.action !== 'polaroids') return false;
  var hostname = resultadoSiteverify.hostname;
  if (typeof hostname !== 'string') return false;
  return hostname === 'libreriasaber.com.ar' ||
    hostname === 'polaroids-integracion-sin-r2.libreriasaber.pages.dev';
}
