/** Operator-only local ZIP screen for paid mixed TUS/R2 orders.
 * Uses existing PDF instruction sheet + ZIP fallback for modest batches.
 * Desktop writes large ZIP progressively to disk without memory copies.
 */
import zipJs from './zip-tus-cliente.txt';
import pdfJs from './pdf-orden-tus-cliente.txt';
import universalJs from './paquete-universal-cliente.txt';
import staffR2Js from './staff-r2-personal-ui.txt';
export function paginaPaqueteUniversalPersonal(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>ZIP mixto · Orden de trabajo · Librería Saber</title>
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
<p id="detalle">Comprobando cantidad de originales y pago conciliado</p>
<div class="warning"><strong>PREPRENSA PENDIENTE — NO IMPRIMIR.</strong>
Esta descarga incluye los PDF originales sin modificar y la hoja A4 de instrucciones.
Revisá en Adobe Acrobat escala, tamaño, páginas por cara, doble faz, rollo y material antes de producir.</div>
<button id="zip" disabled>Descargar ZIP completo</button>
<p><small>Para lotes grandes (hasta 10 PDF de 200 MiB), Chrome o Edge en computadora guardan el ZIP
directamente al disco, sin acumularlo en memoria. Solo personal autorizado.</small></p>
<p id="estado" role="status" aria-live="polite">Esperando verificación D1…</p>
<section id="r2Inspeccion" style="margin-top:24px;border-top:2px solid #d0dae5;padding-top:18px" hidden>
<h2>Inspección R2 pendiente</h2>
<p>Para habilitar el ZIP primero revisá el PDF grande original. El pago acreditado no autoriza imprimir sin preprensa.</p>
<p><button type="button" id="r2Recargar">Ver pedidos pagados</button></p>
<div id="r2Lista" role="status" aria-live="polite"></div>
<label>Referencia web <input id="r2Order" style="width:100%;padding:9px" placeholder="WEB-ENSAYO-…" /></label>
<label>Identificador de archivo <input id="r2FileId" style="width:100%;padding:9px" placeholder="pdf_0" /></label>
<p><button type="button" id="r2Consultar">Consultar original pendiente</button></p>
<p id="r2Estado" role="status" aria-live="polite"></p>
<div id="r2Detalle" hidden>
<p id="r2Ficha" style="white-space:pre-wrap"></p>
<a id="r2Descargar" href="#" style="display:inline-block;margin:6px 0 16px">Descargar PDF original para revisar</a>
<p><strong>Medidas medidas sobre el PDF original (cm)</strong></p>
<p><small>Una línea por página: 21 x 29,7. Para originales de tamaño uniforme, podés usar una sola línea y confirmar todas las páginas.</small></p>
<textarea id="r2Medidas" rows="5" style="width:100%;font:inherit;padding:10px" placeholder="21 x 29,7"></textarea>
<p><label><input type="checkbox" id="r2Uniforme"> Verifiqué que todas las páginas son del mismo tamaño</label></p>
<p><label>Responsable <input id="r2Operador" style="width:100%;padding:9px" maxlength="60" /></label></p>
<p><label><input type="checkbox" id="r2Verificado"> Revisé el archivo real, todas sus páginas y sus medidas; las dimensiones son correctas.</label></p>
<button type="button" id="r2Aprobar">Registrar inspección en Central</button>
</div>
</section>
</main><script>
${zipJs}
${pdfJs}
${universalJs}
${staffR2Js}
</script></body></html>`;
}
