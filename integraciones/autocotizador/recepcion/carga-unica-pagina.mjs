/** Primera pantalla de ingreso único: prueba privada sin precios ni pedidos. */
export function paginaCargaUnica(){
return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Librería Saber · Tamaño final de impresión</title><style>
*{box-sizing:border-box}
:root{color-scheme:light}
body{margin:0;background:#edf3f7;color:#18334a;font:17px/1.5 system-ui,Arial,sans-serif}
main{width:min(1160px,calc(100% - 32px));margin:24px auto 55px;background:#fff;padding:32px;border-radius:16px;box-shadow:0 6px 30px #1236530c}
h1{font-size:clamp(25px,3vw,32px);line-height:1.2;margin:0 0 10px;color:#113c60}
.nota{background:#fff5e6;padding:16px 18px;border-left:4px solid #d99428;line-height:1.5;border-radius:6px;font-size:15px;margin:14px 0 24px}
h2{margin:30px 0 12px;font-size:22px;color:#123a5b}
.archivo{border:1px solid #cfdae4;background:#f8fafc;border-radius:12px;margin:16px 0;padding:24px;min-width:0}
.archivo h3{font-size:21px;margin:0 0 12px;overflow-wrap:anywhere;color:#143f62}
.archivo p{overflow-wrap:anywhere;line-height:1.5;margin:10px 0}
.archivo .origen{color:#4b6172;font-size:15px}
.archivo .destino{font-weight:700;color:#0f5c85}
.archivo .advertencia{background:#fff1da;border-radius:7px;padding:10px 12px;color:#654514;font-size:15px}
.controles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 22px;margin:18px 0 8px}
label{display:flex;flex-direction:column;gap:7px;font-weight:650;font-size:16px;min-width:0}
input,select{font:inherit;font-weight:400;width:100%;min-width:0;padding:12px;border:1px solid #a1b3c3;border-radius:9px;background:#fff;color:#18334a;min-height:48px}
input:focus,select:focus{outline:3px solid #bedcf4;border-color:#2878ad}
#archivos{width:100%;max-width:620px;border:2px dashed #9fb8cd;background:#f5faff;padding:20px;min-height:68px}
#estado{margin:12px 0;color:#556a7d;font-size:15px}
#presupuesto{background:#eaf3fa;border:1px solid #bad2e7;padding:22px 26px;position:sticky;top:8px;z-index:3;box-shadow:0 4px 10px #173c5210}
#presupuesto strong{font-size:25px;color:#113d61;line-height:1.4}
#presupuesto p{margin:7px 0;font-size:16px}
.pie{font-size:14px;color:#5e6d78}
@media(max-width:680px){main{width:100%;margin:0;padding:18px 14px 35px;border-radius:0}body{font-size:16px}.archivo{padding:17px}.archivo h3{font-size:18px}.controles{grid-template-columns:1fr;gap:13px}.nota{font-size:14px}#presupuesto{top:0;padding:14px 16px}#presupuesto strong{font-size:20px}}
.archivo{padding:0;margin:8px 0;background:#fff;overflow:hidden}
.fila{display:grid;grid-template-columns:minmax(0,1fr) minmax(105px,auto) 88px;align-items:center;gap:16px;padding:13px 17px;min-height:74px}
.fila-principal{min-width:0}.nombre{display:block;overflow-wrap:anywhere;font-size:16px;color:#143f62}
.resumen-archivo{font-size:14px;color:#53697b;margin-top:3px;line-height:1.35}
.precio-archivo{text-align:right;font-weight:750;font-size:16px;white-space:nowrap;color:#154d73}
.editar{border:1px solid #aac3d7;background:#fff;color:#0e5179;font-weight:700;border-radius:8px;font-size:14px;padding:9px 12px;cursor:pointer}
.editar:hover,.editar:focus-visible{background:#e7f3fc}
.panel-edicion{border-top:1px solid #d5e1eb;background:#f5f8fb;padding:15px 18px 20px}
.panel-edicion p{font-size:14px;margin:8px 0}
.panel-edicion .controles{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 16px;margin:12px 0 0}
.panel-edicion label{font-size:14px;gap:4px}
.panel-edicion input,.panel-edicion select{font-size:15px;min-height:42px;padding:8px}
#presupuesto{position:static;padding:12px 18px;box-shadow:none}
#presupuesto strong{font-size:22px}#presupuesto p{font-size:14px;margin:4px 0}
h2{font-size:19px;margin:20px 0 7px}
@media(max-width:720px){.fila{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:12px}.fila-principal{grid-column:1/-1}.precio-archivo{text-align:left}.editar{justify-self:end}.panel-edicion .controles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:440px){.panel-edicion .controles{grid-template-columns:1fr}}
</style></head><body><main><h1>Una sola carga · Tamaño final</h1><p class="nota"><strong>Prueba privada de clasificación.</strong> Seleccioná varios PDF sin elegir de antemano entre impresiones y ploteos. Confirmá en qué tamaño querés imprimir cada archivo: el original puede ser A2, aunque quieras A4. Sin envío de originales, pedidos ni pagos. Presupuestos orientativos sin validez comercial hasta verificar los archivos. La clasificación CAD/Póster y las tarifas existentes no se modifican.</p><label for="archivos">Agregar PDF (hasta 30)</label><input id="archivos" type="file" accept=".pdf,application/pdf" multiple><p id="estado" role="status">Cargando…</p><h2>Resumen del presupuesto</h2><section class="archivo" id="presupuesto" aria-live="polite">Esperando archivos…</section><h2>Configuración de tus archivos</h2><div id="lista"></div><p><a href="/prueba-cotizador-conjunto">Volver a los presupuestos de prueba</a></p></main><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" defer></script><script src="/prueba-carga-unica.js" defer></script></body></html>`;
}
