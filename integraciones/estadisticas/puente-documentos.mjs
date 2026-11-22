import { validarEvento } from './embudo.mjs';

const ORIGEN_COMERCIAL = 'https://pedidos.libreriasaber.com.ar';
const URL_PAGOS = 'https://pagos.libreriasaber.com.ar';
const RUTA_EVENTO = '/internal/central/live/analytics-event';
const RUTA_RESUMEN = '/internal/central/live/analytics-summary';
const PERIODOS = new Set(['hoy', '7d', '30d']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respuesta(datos, status = 200) {
  return Response.json(datos, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

function partesFecha(epochMs, zona) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(epochMs));
  return Object.fromEntries(partes.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

function medianocheLocalUtc(year, month, day, zona) {
  const utcPretendido = Date.UTC(year, month - 1, day);
  const local = partesFecha(utcPretendido, zona);
  const utcLocalRepresentado = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const diferenciaZona = utcLocalRepresentado - utcPretendido;
  return utcPretendido - diferenciaZona;
}

function rangoPeriodo(periodo, ahoraMs, zona) {
  if (!PERIODOS.has(periodo)) return null;
  if (periodo === '7d' || periodo === '30d') {
    return { desdeMs: ahoraMs - (periodo === '7d' ? 7 : 30) * 86400000, hastaMs: ahoraMs };
  }
  const local = partesFecha(ahoraMs, zona);
  const fecha = new Date(Date.UTC(local.year, local.month - 1, local.day));
  return {
    desdeMs: medianocheLocalUtc(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate(), zona),
    hastaMs: ahoraMs
  };
}

async function firmarYEnviar({ env, fetchCentral, ruta, cuerpo, ahora, crearId }) {
  const clave = env?.CENTRAL_BRIDGE_KEY;
  const servicio = fetchCentral || env?.SABER_CENTRAL?.fetch?.bind(env.SABER_CENTRAL);
  if (env?.SABER_ANALYTICS_ENABLED !== 'true' || typeof clave !== 'string' || clave.length < 32 || typeof servicio !== 'function') {
    return { error: true, status: 503 };
  }
  const marca = Math.floor(ahora() / 1000);
  const requestId = crearId();
  if (!Number.isSafeInteger(marca) || marca < 1e9 || marca > 9999999999 || !UUID.test(requestId)) {
    return { error: true, status: 503 };
  }
  const raw = JSON.stringify(cuerpo);
  const cryptoApi = globalThis.crypto;
  const key = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = Array.from(new Uint8Array(await cryptoApi.subtle.sign('HMAC', key, new TextEncoder().encode(`${marca}\n${requestId}\n${raw}`))), b => b.toString(16).padStart(2, '0')).join('');
  const url = new URL(ruta, URL_PAGOS);
  try {
    return await servicio(new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-saber-ts': String(marca),
        'x-saber-request-id': requestId,
        'x-saber-signature': firma
      },
      body: raw
    }));
  } catch {
    return { error: true, status: 503 };
  }
}

// Se monta en el Worker de documentos. La ingesta pública requiere origen
// exacto y un limitador provisto por Cloudflare; el resumen exige auth de personal.
export function crearPuenteDocumentosEstadisticas({
  env,
  fetchCentral,
  limitarIngesta,
  ahora = () => Date.now(),
  crearId = () => crypto.randomUUID(),
  zona = 'America/Argentina/Cordoba'
}) {
  if (typeof limitarIngesta !== 'function') throw new TypeError('Falta limitador de ingesta');
  if (typeof crearId !== 'function') throw new TypeError('Falta generador de identificadores');

  return {
    async evento(request) {
      const url = new URL(request.url);
      if (url.origin !== ORIGEN_COMERCIAL || url.pathname !== '/api/estadisticas/evento' || url.search || url.hash) return respuesta({ ok: false }, 404);
      if (request.method !== 'POST') return respuesta({ ok: false }, 405);
      if (request.headers.get('Origin') !== ORIGEN_COMERCIAL || request.headers.get('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin') return respuesta({ ok: false }, 403);
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return respuesta({ ok: false }, 415);
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 1024) return respuesta({ ok: false }, 413);
      const raw = await request.text();
      if (raw.length > 1024) return respuesta({ ok: false }, 413);
      let evento;
      try { evento = JSON.parse(raw); } catch { return respuesta({ ok: false }, 400); }
      if (!validarEvento(evento, 'cliente')) return respuesta({ ok: false }, 400);
      let permitido = false;
      try { permitido = await limitarIngesta(request, evento.sessionId) === true; } catch {}
      if (!permitido) return respuesta({ ok: false }, 429);
      const upstream = await firmarYEnviar({
        env, fetchCentral, ruta: RUTA_EVENTO,
        cuerpo: { schema: 'saber-analytics-event-v1', ...evento },
        ahora, crearId
      });
      if (upstream?.error || !upstream?.ok) return respuesta({ ok: false }, 503);
      return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    },

    async resumen(request, { authorized = false } = {}) {
      if (!authorized) return respuesta({ ok: false }, 401);
      const url = new URL(request.url);
      if (url.origin !== ORIGEN_COMERCIAL || url.pathname !== '/personal/api/live-analytics' || url.hash) return respuesta({ ok: false }, 404);
      if (request.method !== 'GET') return respuesta({ ok: false }, 405);
      const claves = [...url.searchParams.keys()];
      const periodo = url.searchParams.get('periodo');
      if (claves.length !== 1 || claves[0] !== 'periodo' || !PERIODOS.has(periodo)) return respuesta({ ok: false }, 400);
      const rango = rangoPeriodo(periodo, ahora(), zona);
      const upstream = await firmarYEnviar({
        env, fetchCentral, ruta: RUTA_RESUMEN,
        cuerpo: { schema: 'saber-analytics-summary-v1', ...rango },
        ahora, crearId
      });
      if (upstream?.error || !upstream?.ok) return respuesta({ ok: false }, 503);
      const datos = await upstream.json().catch(() => null);
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return respuesta({ ok: false }, 502);
      return respuesta({ ok: true, periodo, ...datos });
    }
  };
}

export { rangoPeriodo };
