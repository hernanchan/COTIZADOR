import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPuenteDocumentosEstadisticas, rangoPeriodo } from '../integraciones/estadisticas/puente-documentos.mjs';

const origen = 'https://pedidos.libreriasaber.com.ar';
const marca = Date.parse('2026-11-15T12:00:00.000Z');
const evento = {
  eventId: 'evento_12345678901234',
  type: 'quote_started',
  sessionId: 'sesion_123456789012345',
  at: marca
};
const requestId = 'b19e78db-9a99-4c18-8bd6-4426f9d602cb';
const env = { SABER_ANALYTICS_ENABLED: 'true', CENTRAL_BRIDGE_KEY: 'clave_de_prueba_no_real_con_32_caracteres_o_mas' };

function puente({ fetchCentral, limitar = async () => true, config = env } = {}) {
  let secuencia = 0;
  return crearPuenteDocumentosEstadisticas({
    env: config,
    fetchCentral,
    limitarIngesta: limitar,
    ahora: () => marca,
    crearId: () => (++secuencia === 1 ? requestId : '8b4ac45f-671d-4cb8-b54f-5b307f22d3f0')
  });
}

function requestEvento(body = evento, headers = {}) {
  return new Request(`${origen}/api/estadisticas/evento`, {
    method: 'POST',
    headers: { Origin: origen, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

async function verificaFirma(request) {
  const ts = request.headers.get('x-saber-ts');
  const id = request.headers.get('x-saber-request-id');
  const raw = await request.clone().text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from((request.headers.get('x-saber-signature') || '').match(/../g).map(x => parseInt(x, 16)));
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(`${ts}\n${id}\n${raw}`));
}

test('la ingesta valida origen, esquema y tasa antes de firmar', async () => {
  const sent = [];
  const routes = puente({ fetchCentral: async req => { sent.push(req); return new Response(null, { status: 202 }); } });
  const response = await routes.evento(requestEvento());
  assert.equal(response.status, 202);
  assert.equal(sent.length, 1);
  assert.equal(await verificaFirma(sent[0]), true);
  assert.equal(sent[0].url, 'https://pagos.libreriasaber.com.ar/internal/central/live/analytics-event');
  assert.deepEqual(await sent[0].clone().json(), { schema: 'saber-analytics-event-v1', ...evento });
});

test('rechaza origen externo, PII y limitador excedido sin llamar a la Central', async () => {
  let llamadas = 0, limite = 0;
  const routes = puente({ fetchCentral: async () => { llamadas++; return new Response(null, { status: 202 }); }, limitar: async () => { limite++; return false; } });
  assert.equal((await routes.evento(requestEvento(evento, { Origin: 'https://otro.example' }))).status, 403);
  assert.equal((await routes.evento(requestEvento({ ...evento, phone: '3515550101' }))).status, 400);
  assert.equal((await routes.evento(requestEvento())).status, 429);
  assert.equal(limite, 1);
  assert.equal(llamadas, 0);
});

test('la ingesta permanece apagada hasta habilitarla explícitamente', async () => {
  let llamadas = 0;
  const routes = puente({ config: { ...env, SABER_ANALYTICS_ENABLED: 'false' }, fetchCentral: async () => { llamadas++; return new Response(null, { status: 202 }); } });
  assert.equal((await routes.evento(requestEvento())).status, 503);
  assert.equal(llamadas, 0);
});

test('el resumen requiere autenticación de personal y firma un rango permitido', async () => {
  let sent;
  const routes = puente({ fetchCentral: async req => { sent = req; return Response.json({ visitas: 4, sesiones: 3, pedidosPagados: 1 }); } });
  const unauthorized = new Request(`${origen}/personal/api/live-analytics?periodo=7d`);
  assert.equal((await routes.resumen(unauthorized)).status, 401);
  const response = await routes.resumen(unauthorized, { authorized: true });
  assert.equal(response.status, 200);
  assert.equal(await verificaFirma(sent), true);
  const body = await sent.clone().json();
  assert.deepEqual(Object.keys(body).sort(), ['desdeMs', 'hastaMs', 'schema']);
  assert.equal(body.schema, 'saber-analytics-summary-v1');
  assert.equal(body.hastaMs - body.desdeMs, 7 * 86400000);
  assert.deepEqual(await response.json(), { ok: true, periodo: '7d', visitas: 4, sesiones: 3, pedidosPagados: 1 });
});

test('los períodos de 7 y 30 días son ventanas móviles y hoy usa medianoche de Córdoba', () => {
  assert.deepEqual(rangoPeriodo('7d', marca, 'America/Argentina/Cordoba'), { desdeMs: marca - 7 * 86400000, hastaMs: marca });
  assert.deepEqual(rangoPeriodo('30d', marca, 'America/Argentina/Cordoba'), { desdeMs: marca - 30 * 86400000, hastaMs: marca });
  const hoy = rangoPeriodo('hoy', marca, 'America/Argentina/Cordoba');
  assert.equal(hoy.desdeMs, Date.parse('2026-11-15T03:00:00.000Z'));
  assert.equal(hoy.hastaMs, marca);
  assert.equal(rangoPeriodo('90d', marca, 'America/Argentina/Cordoba'), null);
});
