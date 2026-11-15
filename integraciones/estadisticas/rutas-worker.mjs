import { guardarEvento, resumenPorPeriodo } from './d1.mjs';

// Rutas internas para incorporar EXPLÍCITAMENTE al router existente, no publicadas.
// La autenticación se delega al middleware REAL de la Central; sin él, fail closed.
export function crearRutasEstadisticas({ db, autorizarPersonal, verificarIngesta, limitarIngesta }) {
  if (typeof autorizarPersonal !== 'function' ||
      typeof verificarIngesta !== 'function' ||
      typeof limitarIngesta !== 'function') {
    throw new TypeError('Faltan controles obligatorios');
  }
  return {
    async resumen(request) {
      if (!(await autorizarPersonal(request))) return new Response('No autorizado', { status: 401 });
      const url = new URL(request.url);
      const desde = Number(url.searchParams.get('desde'));
      const hasta = Number(url.searchParams.get('hasta'));
      if (!url.searchParams.has('desde') || !url.searchParams.has('hasta')) {
        return new Response('Período requerido', { status: 400 });
      }
      try {
        const datos = await resumenPorPeriodo(db, desde, hasta);
        return Response.json(datos, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        if (error instanceof RangeError) return new Response('Período inválido', { status: 400 });
        throw error;
      }
    },
    async evento(request) {
      if (!(await verificarIngesta(request)) || !(await limitarIngesta(request))) {
        return new Response('No autorizado', { status: 403 });
      }
      if (request.method !== 'POST') return new Response('Método inválido', { status: 405 });
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
        return new Response('Formato inválido', { status: 415 });
      }
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 1024) return new Response('Excede tamaño máximo', { status: 413 });
      const body = await request.text();
      if (body.length > 1024) return new Response('Excede tamaño máximo', { status: 413 });
      let evento;
      try { evento = JSON.parse(body); } catch { return new Response('JSON inválido', { status: 400 }); }
      const resultado = await guardarEvento(db, evento, 'cliente');
      return new Response(null, { status: resultado.status });
    }
  };
}
