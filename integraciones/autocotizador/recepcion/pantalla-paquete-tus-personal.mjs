/**
 * Portal de armado local ZIP de originales verificados. Accesible sólo
 * con Basic del Worker documental. Nunca lee claves de Supabase en el cliente.
 */
import zipJs from './zip-tus-cliente.txt';
import paqueteJs from './paquete-tus-cliente.txt';
export function paginaPaqueteTUSPersonal(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Paquete de orden de trabajo · Librería Saber</title>
<style>
*{box-sizing:border-box}
body{font:16px system-ui,Arial,sans-serif;background:#edf4fa;color:#153956;max-width:780px;margin:32px auto;padding:20px}
main{background:white;padding:24px;border:1px solid #c5d6e4;border-radius:12px}
h1{font-size:1.5rem}
button{background:#135187;color:white;border:0;border-radius:7px;padding:14px 18px;font:inherit;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
#estado{margin-top:15px;font-weight:600;white-space:pre-wrap}
.note{font-size:.9rem;color:#526981}.warning{border-left:4px solid #bd6609;padding:10px;background:#fff4e5}
</style></head><body><main>
<h1 id="numero">Orden de trabajo · verificando…</h1>
<p id="detalle"></p>
<p>Se incluirán los PDF originales numerados y una hoja de instrucciones de impresión, en HTML imprimible y TXT. No se alteran los documentos.</p>
<p class="warning">Ensayo privado: el pedido NO está pagado y no está autorizado para imprimir ni entregar.</p>
<button id="zip" disabled>Descargar ZIP completo</button>
<p class="note">Los originales se comprueban nuevamente contra D1 y SHA-256 antes de incorporarlos.</p>
<p id="estado" role="status" aria-live="polite">Verificando la orden con la Central…</p>
</main><script>
${zipJs}
${paqueteJs}
</script></body></html>`;
}
