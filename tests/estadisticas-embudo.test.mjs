import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEvento, resumirEmbudo } from '../integraciones/estadisticas/embudo.mjs';
import { crearEmisorHttp, crearRegistrador } from '../integraciones/estadisticas/cliente.mjs';

const session = 'sesion_123456789012345';
test('rechaza datos personales y eventos de pago falsificados por navegador', () => {
  const base = { eventId: 'evento_12345678901234', type: 'quote_viewed', sessionId: session, at: Date.now() };
  assert.equal(validarEvento(base, 'cliente'), true);
  assert.equal(validarEvento({ ...base, phone: '3511234567' }, 'cliente'), false);
  assert.equal(validarEvento({ ...base, type: 'payment_confirmed' }, 'cliente'), false);
  assert.equal(validarEvento({ ...base, eventId: undefined }, 'cliente'), false);
  assert.equal(validarEvento({ ...base, type: 'payment_confirmed' }, 'servidor'), true);
});

test('cuenta visitas separadas de sesiones y no fabrica abandono o conversión', () => {
  const eventos = [
    { eventId: 'evento_00000000000001', type: 'page_view', sessionId: session },
    { eventId: 'evento_00000000000002', type: 'page_view', sessionId: session },
    { eventId: 'evento_00000000000003', type: 'quote_viewed', sessionId: session },
    { eventId: 'evento_00000000000004', type: 'checkout_started', sessionId: session },
    { eventId: 'evento_00000000000005', type: 'page_view', sessionId: 'sesion_987654321098765' },
    { eventId: 'evento_00000000000006', type: 'payment_confirmed', sessionId: 'sesion_987654321098765' }
  ];
  assert.deepEqual(resumirEmbudo(eventos), {
    visitas: 3, sesiones: 2, iniciadas: 0, cotizadas: 1, checkout: 1,
    abandonoPorEtapa: null, conversionPorcentaje: null
  });
});

test('el transporte del navegador omite credenciales y falla sin interrumpir el flujo', async () => {
  let captured;
  const enviar = crearEmisorHttp({ fetcher: async (url, options) => {
    captured = { url, options };
    return new Response(null, { status: 202 });
  } });
  const registrar = crearRegistrador({ enviar, sesion: session, crearId: () => 'evento_12345678901234', ahora: () => 1763000000000 });
  assert.equal(await registrar('quote_started', 'inicio'), true);
  assert.equal(captured.url, '/api/estadisticas/evento');
  assert.equal(captured.options.credentials, 'omit');
  assert.equal(captured.options.cache, 'no-store');
  assert.equal(JSON.parse(captured.options.body).type, 'quote_started');
  const error = crearRegistrador({ enviar: async () => { throw new Error('sin red'); }, sesion: session });
  assert.equal(await error('quote_started'), false);
  assert.throws(() => crearEmisorHttp({ endpoint: 'https://otro.example/evento' }), /Ruta de estadísticas inválida/);
});
