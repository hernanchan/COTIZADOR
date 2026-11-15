import { guardarEvento, resumenPorPeriodo } from './d1.mjs';

// Estas rutas se montan en el Worker que posee D1. Solo las invoca el Worker
// de documentos después de autenticar personal o validar origen de navegador;
// el puente entre Workers se autentica con el HMAC LIVE existente.
export function crearRutasEstadisticas({ db, verificarCentral, limitarIngesta }) {
  if (typeof verificarCentral !== 'function' || typeof limitarIngesta !== 'function') {
    throw new TypeError('Faltan controles HMAC o de tasa');
  }
  return {
    async resumen(request) {
      if (request.method !== 'POST') return new Response('Método inválido', { status: 405 });
      const signed = await verificarCentral(request.clone());
      if (signed?.error || !signed?.payload) return new Response('No autorizado', { status: signed?.status || 401 });
      const p = signed.payload;
      if (!p || typeof p !== 'object' || Array.isArray(p) ||
          Object.keys(p).sort().join(',') !== 'desdeMs,hastaMs,schema' ||
          p.schema !== 'saber-analytics-summary-v1') {
        return new Response('Consulta inválida', { status: 400 });
      }
      try {
        const datos = await resumenPorPeriodo(db, p.desdeMs, p.hastaMs);
        return Response.json(datos, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        if (error instanceof RangeError) return new Response('Período inválido', { status: 400 });
        throw error;
      }
    },
    async evento(request) {
      if (request.method !== 'POST') return new Response('Método inválido', { status: 405 });
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
        return new Response('Formato inválido', { status: 415 });
      }
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 1024) return new Response('Excede tamaño máximo', { status: 413 });
      const signed = await verificarCentral(request.clone());
      if (signed?.error || !signed?.payload) return new Response('No autorizado', { status: signed?.status || 401 });
      const { schema, ...evento } = signed.payload;
      if (schema !== 'saber-analytics-event-v1') return new Response('Evento inválido', { status: 400 });
      if (!(await limitarIngesta(evento.sessionId))) return new Response('Límite excedido', { status: 429 });
      const resultado = await guardarEvento(db, evento, 'cliente');
      return new Response(null, { status: resultado.status });
    }
  };
}
