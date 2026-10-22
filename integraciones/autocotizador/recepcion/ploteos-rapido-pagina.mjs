/** Módulo de ploteos preliminar, aislado de documentos e impresión comercial. */
export function paginaPloteosRapido(){
return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Librería Saber · Ploteos de prueba</title>
<style>*{box-sizing:border-box}body{font:16px system-ui,Arial;background:#edf3f7;color:#19334a;margin:0}main{max-width:880px;margin:20px auto;padding:22px;background:white;border-radius:12px}a{color:#165d8d}h1{margin:0 0 12px;font-size:25px}h2{font-size:19px}.aviso{padding:12px;background:#fff1d4;border-left:4px solid #d29c3b;line-height:1.5}.total{position:sticky;top:0;background:#174e75;color:white;padding:16px;border-radius:9px;z-index:2;display:flex;justify-content:space-between;gap:10px;align-items:center}.total strong{font-size:26px}input,select,button{font:inherit;border:1px solid #aebdcc;border-radius:7px;padding:10px;max-width:100%}button{background:#17608d;color:white;border:0;cursor:pointer}button:disabled{opacity:.55}.trabajo{padding:15px;background:#f4f8fb;border:1px solid #d9e4ec;border-radius:9px;margin:12px 0}.controles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.controles label{font-size:13px;font-weight:600;display:block}.controles input,.controles select{width:100%;margin-top:5px}.nombre{font-size:14px;overflow-wrap:anywhere;margin:0 0 10px}.resultado{line-height:1.8;background:#f0f6fb;border-radius:9px;padding:14px;margin-top:20px}li{overflow-wrap:anywhere;padding:6px 0}small{color:#526477}@media(max-width:540px){main{margin:0;padding:14px;border-radius:0}.total{margin:0 -14px;border-radius:0;padding:12px}.total strong{font-size:22px}}</style></head><body><main>
<h1>Ploteos · Presupuesto rápido</h1>
<p><a href="/prueba-cotizador-rapido">← Volver a impresiones A4/A3</a></p>
<div id="barra" class="total" role="status"><span>Precio preliminar<br><small style="color:#fff">Aún no calculado</small></span><strong id="importe">A cotizar</strong></div>
<p class="aviso"><strong>Prueba privada.</strong> Se usan las tarifas de ploteo ya configuradas en el cotizador. El sistema detecta las medidas de cada página del PDF en tu dispositivo; no se envían archivos para cotizar. Se debe verificar el documento antes de confirmar el precio. Pagos desactivados.</p>
<p>Elegí uno o varios PDF de planos o pósteres. Detectamos sus tamaños automáticamente; seleccioná el rollo, el tipo de trabajo y las copias.</p>
<input type="file" id="archivosPloteo" multiple accept=".pdf,application/pdf"><button type="button" id="calcular" disabled>Calcular ploteos</button>
<div id="trabajos"></div>
<div id="resultado" class="resultado" role="status">Seleccioná los archivos y configurá cada ploteo.</div>
</main><script src="/prueba-ploteos-rapido.js" defer></script></body></html>`;
}
