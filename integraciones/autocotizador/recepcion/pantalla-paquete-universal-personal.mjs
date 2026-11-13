/** Operator-only local ZIP screen for paid mixed TUS/R2 orders.
 * Uses existing PDF instruction sheet + ZIP fallback for modest batches.
 * Desktop writes large ZIP progressively to disk without memory copies.
 */
import zipJs from './zip-tus-cliente.txt';
import pdfJs from './pdf-orden-tus-cliente.txt';
import universalJs from './paquete-universal-cliente.txt';
export function paginaPaqueteUniversalPersonal(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Descargar pedido · Librería Saber</title>
<style>
*{box-sizing:border-box}body{font:16px system-ui,Arial,sans-serif;background:#f1f5f9;color:#163951;max-width:850px;margin:25px auto;padding:20px}
main{background:white;border:1px solid #d0dae5;border-radius:14px;padding:25px}
h1{font-size:1.65rem;margin:0 0 8px}p{line-height:1.55}
button{background:#155a87;color:white;border:0;border-radius:8px;font:inherit;font-weight:700;padding:15px 22px;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
.warning{border-left:4px solid #be7a2a;background:#fff7e6;padding:12px 15px;margin:17px 0}
#estado{white-space:pre-wrap;font-weight:600}
small{color:#586c7d}
</style></head><body><main>
<h1 id="numero">Orden de trabajo · verificando…</h1>
<p><a href="/personal/central" style="color:#0c5688;font-weight:700">Volver a la Central de Pedidos</a></p>
<p id="detalle">Comprobando cantidad de originales y pago conciliado</p>
<div class="warning"><strong>PREPRENSA PENDIENTE — NO IMPRIMIR.</strong>
La descarga reúne todos los PDF originales sin modificar y la hoja de instrucciones del pedido.
Revisá en Adobe Acrobat escala, tamaño, páginas por cara, doble faz, rollo y material antes de producir.</div>
<button id="zip" disabled>Descargar ZIP completo</button>
<p><small>Para lotes grandes (hasta 10 PDF de 200 MiB), Chrome o Edge en computadora guardan el ZIP
directamente al disco, sin acumularlo en memoria. Solo personal autorizado.</small></p>
<p id="estado" role="status" aria-live="polite">Esperando verificación D1…</p>

</main><script>
${zipJs}
${pdfJs}
${universalJs}
</script></body></html>`;
}
