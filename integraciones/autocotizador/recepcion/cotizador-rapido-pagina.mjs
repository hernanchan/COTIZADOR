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
 small{color:#54677a}#estado{margin:14px 0}</style></head><body><main>
 <h1>Presupuesto rápido de varios PDF</h1>
 <p class="note"><strong>Ensayo de precio preliminar.</strong> Los PDF se leen en este dispositivo y no se envían a Google Drive para cotizar. Tarifas orientativas pendientes de aprobación comercial. Los archivos grandes se procesan uno por uno y pueden tardar o superar la memoria de algunos celulares. Para comprar, será necesaria una verificación posterior de archivos y precio. <strong>Pagos desactivados.</strong></p>
 <label for="archivo">Elegí hasta 30 PDF juntos (hasta 250 MB por PDF para este ensayo)</label><input id="archivo" type="file" accept=".pdf,application/pdf" multiple>
 <div id="soltar" tabindex="0">O arrastrá aquí todos los PDF</div>
 <p id="estado" role="status">Cargando lector local…</p><strong id="paginas">0 páginas detectadas</strong>
 <ol id="documentos"></ol>
 <div class="config">
  <div><label for="formato">Tamaño</label><select id="formato"><option value="a4">A4</option><option value="a3">A3</option></select></div>
  <div><label for="caras">Caras</label><select id="caras"><option value="simple">Simple faz</option><option value="double">Doble faz</option></select></div>
  <div><label for="copias">Copias por PDF</label><input id="copias" type="number" min="1" max="500" value="1"></div>
  <div><label for="anillado">Anillado</label><select id="anillado"><option value="ninguno">Sin anillado</option><option value="juntos">Todos juntos</option><option value="separados">Por separado</option></select></div>
 </div>
 <p><button id="cotizar" type="button" disabled>Ver precio preliminar</button></p>
 <div id="precio" role="status" aria-live="polite">Elegí tus archivos para obtener el precio.</div>
 <p><small>Los valores de esta demostración no constituyen una oferta ni permiten pagar. No cierres la pestaña durante la lectura local.</small></p>
 </main><script src="/prueba-cotizador-rapido.js" defer></script></body></html>`;
}
