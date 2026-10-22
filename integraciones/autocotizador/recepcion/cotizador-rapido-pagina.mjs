/** Página independiente de cotización local, sin recibos ni checkout. */
export function paginaCotizadorRapido(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex,nofollow"><title>Saber | Presupuesto rápido preliminar</title>
 <style>*{box-sizing:border-box}body{font:16px system-ui,Arial;background:#edf3f7;color:#19334a;margin:0}main{max-width:860px;margin:25px auto;padding:24px;background:white;border-radius:14px}
 h1{font-size:25px}.note{background:#fff2d5;border-left:4px solid #bc8625;padding:12px;line-height:1.5}
 #soltar{padding:32px;border:2px dashed #6c97ba;border-radius:12px;text-align:center;background:#f4f9ff;margin:16px 0}
 #soltar.active{background:#e2f5ff}#archivo{max-width:100%;font:inherit}ol{padding-left:24px}li{padding:8px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 li span{flex:1;overflow-wrap:anywhere}select,input,button{font:inherit;padding:9px;border:1px solid #a9b8c5;border-radius:6px}
 button{cursor:pointer;background:#145c89;color:white;border:0}button:disabled{opacity:.55}.config{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:14px}
 label{display:block;font-weight:600;margin-bottom:6px}.config select,.config input{width:100%}
 #precio{font-size:20px;font-weight:700;background:#eff5fb;padding:16px;margin-top:16px;border-radius:9px;line-height:1.6}
 #resumenRapido{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#164a71;color:#fff;padding:12px 16px;margin:12px -8px 18px;border-radius:10px;box-shadow:0 4px 12px #14375125}
 #resumenRapido .importe{font-size:clamp(20px,3vw,30px);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
 #resumenRapido .estado-importe{font-size:12px;line-height:1.25;opacity:.94}
 #resumenRapido .metadatos{font-size:12px;opacity:.9}
 #resumenRapido .estado-precio{display:flex;flex-direction:column;gap:3px}
 #resumenRapido[data-estado="pendiente"]{background:#4d6579}
 #resumenRapido[data-estado="calculando"]{background:#315d7c}
 #resumenRapido[data-estado="error"]{background:#795c43}
 @media(max-width:520px){#resumenRapido{position:sticky;top:0;margin:8px -16px 14px;border-radius:0;padding:8px 16px;gap:8px}#resumenRapido .importe{font-size:21px}#resumenRapido .metadatos{font-size:11px}}
  small{color:#54677a}#estado{margin:14px 0}
 #resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px;margin:16px 0}
 .panel-resumen{border:1px solid #cad7e2;border-radius:12px;padding:20px;min-width:0;background:#fff}
 .panel-resumen h2{font-size:21px;margin:0 0 10px;color:#164a71}
 .panel-resumen h3{font-size:16px;margin:0 0 5px}
 .subtitulo{color:#53697c;font-size:14px;line-height:1.5}
 .resumen-linea{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e2e8ee}
 .resumen-linea strong{text-align:right;white-space:nowrap}
 .resumen-linea.destacada{background:#e8f3fb;padding:16px 10px;border:0;border-radius:8px;font-size:18px;color:#124868}
 .panel-resumen details{margin:18px 0}.panel-resumen summary{cursor:pointer;font-weight:600}
 .aviso{font-size:13px;color:#845514;background:#fff6e6;padding:12px;border-radius:8px;line-height:1.5}
 .ficha{border-left:3px solid #2773aa;padding:10px 12px;margin:12px 0;background:#f5f9fc;overflow-wrap:anywhere}
 .ficha p{margin:5px 0;font-size:14px;line-height:1.45}
 .ficha .instruccion{font-weight:650}
 .armado{padding:12px;border:1px solid #d3e0ea;border-radius:8px;margin:10px 0;font-size:14px}
 .armado li{display:list-item;padding:2px 0;overflow-wrap:anywhere}
 .acciones-resumen{margin-top:16px} .acciones-resumen button{width:100%;padding:12px}
 @media(max-width:520px){main{margin:0;padding:16px;border-radius:0}.panel-resumen{padding:14px}}
</style></head><body><main>
 <h1>Presupuesto rápido de varios PDF</h1>
 <section id="resumenRapido" data-estado="pendiente" role="status" aria-live="polite" aria-label="Precio orientativo de tu pedido">
  <div class="estado-precio"><span class="estado-importe" id="estadoImporte">Precio preliminar</span><strong class="importe" id="importeArriba">A cotizar</strong></div>
  <span class="metadatos" id="detalleArriba">Elegí los PDF y sus opciones</span>
 </section>
 <p class="note"><strong>Ensayo de precio preliminar.</strong> Los PDF se leen en este dispositivo y no se envían a Google Drive para cotizar. Tarifas orientativas pendientes de aprobación comercial. Los archivos grandes se procesan uno por uno y pueden tardar o superar la memoria de algunos celulares. Para comprar, será necesaria una verificación posterior de archivos y precio. <strong>Pagos desactivados.</strong></p>
 <label for="archivo">Elegí hasta 30 PDF juntos (hasta 250 MB por PDF para este ensayo)</label><input id="archivo" type="file" accept=".pdf,application/pdf" multiple>
 <div id="soltar" tabindex="0">O arrastrá aquí todos los PDF</div>
 <p id="estado" role="status">Cargando lector local…</p><strong id="paginas">0 páginas detectadas</strong>
 <p><strong>Anillado de varios archivos:</strong> elegí «Junto con grupo 1» en dos o más PDF para unirlos en ese orden. Podés usar hasta cinco grupos. Todos los archivos de cada grupo deben tener el mismo tamaño y la misma cantidad de copias; pueden mezclar B/N, color y simple/doble faz. El precio del anillado se calcula por cada juego completo.</p><ol id="documentos"></ol>
 <p><strong>Configuración para nuevos archivos o para aplicar a todos:</strong></p><div class="config">
  <div><label for="modoGeneral">Impresión</label><select id="modoGeneral"><option value="bn">B/N</option><option value="color">Color</option></select></div>
  <div><label for="formato">Tamaño</label><select id="formato"><option value="a4">A4</option><option value="a3">A3</option></select></div>
  <div><label for="caras">Caras</label><select id="caras"><option value="simple">Simple faz</option><option value="double">Doble faz</option></select></div>
  <div><label for="copias">Copias por PDF</label><input id="copias" type="number" min="1" max="500" value="1"></div>
  <div><label for="anillado">Anillado</label><select id="anillado"><option value="ninguno">Sin anillado</option><option value="juntos">Todos juntos</option><option value="separados">Por separado</option></select></div>
 </div>
 <p><button id="aplicarTodos" type="button">Aplicar configuración a todos</button> <button id="cotizar" type="button" disabled>Ver precio preliminar</button></p>
 <div id="precio" role="status" aria-live="polite">Elegí tus archivos para obtener el precio.</div>
 <div id="resumen" aria-label="Presupuesto para cliente y detalle de producción"></div>
 <p><small>Los valores de esta demostración no constituyen una oferta ni permiten pagar. No cierres la pestaña durante la lectura local.</small></p>
 </main><script src="/prueba-cotizador-rapido.js" defer></script></body></html>`;
}
