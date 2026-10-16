/**
 * DIAGNÓSTICO GRATUITO: Cloudflare Pages Function ejecutada preparada para la
 * web pública pero sin habilitar recepción, sin fotografías ni credenciales y sin almacenamiento.
 * Cloudflare consulta Apps Script como servidor, evitando el bloqueo del
 * navegador contra JavaScript cross-origin de Google ContentService.
 */
const HOST = 'libreriasaber.com.ar';
const APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbxH5hpSS0HjTLQtFIxmTluo7KHzxHj1FWpDkbIwW25_jKVdDq_EFnfBFyNO3XIJpv0TIg/exec';
const CALLBACK = 'saberStatus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function output(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Access-Control-Allow-Origin': 'https://' + HOST
    }
  });
}

export async function onRequestGet({ request }) {
  const local = new URL(request.url);
  if (local.hostname !== HOST) return output({ ok: false, error: 'Host no autorizado.' }, 403);
  const target = new URL(APPS_SCRIPT);
  target.searchParams.set('api', 'ping');
  target.searchParams.set('callback', CALLBACK);
  let response;
  try {
    response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'text/javascript' },
      signal: AbortSignal.timeout(12000)
    });
  } catch (_) {
    return output({ ok: false, error: 'Google no respondió desde el servidor de Cloudflare.' }, 502);
  }
  if (!response.ok) {
    return output({ ok: false, error: 'Google devolvió HTTP ' + response.status }, 502);
  }
  const contents = (await response.text()).trim();
  const prefix = CALLBACK + '(';
  if (!contents.startsWith(prefix) || !contents.endsWith(');') || contents.length > 1024) {
    return output({ ok: false, error: 'Google devolvió un formato distinto al esperado.' }, 502);
  }
  try {
    const result = JSON.parse(contents.slice(prefix.length, -2));
    if (result.ok === true && result.apiVersion === 'v2-noframe') {
      return output({ ok: true, connection: 'cloudflare-to-google', apiVersion: result.apiVersion });
    }
  } catch (_) {
    // Fallar cerrado ante contenido inesperado.
  }
  return output({ ok: false, error: 'La versión de Google no coincide.' }, 502);
}
