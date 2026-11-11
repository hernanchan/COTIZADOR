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
/* Error bloqueante visible en la ficha SIN abrir «Más opciones». */
.archivo.archivo-no-admitido{border:2px solid #b42318;background:#fff7f6;box-shadow:0 0 0 1px #f9c5c0}
.archivo-no-admitido .nombre,.archivo-no-admitido .precio-archivo{color:#981b1b;white-space:normal}
.archivo .advertencia-recepcion{display:block;margin:8px 0 0;background:#fee8e6;border-left:4px solid #b42318;border-radius:6px;padding:10px 12px;color:#8f1d1d;font-size:14px;line-height:1.45;font-weight:750}
#estado.estado-recepcion-error,.pie.estado-recepcion-error{background:#fee8e6;border-left:4px solid #b42318;border-radius:6px;color:#8f1d1d;padding:10px 12px;font-weight:700}
.archivo .consulta-archivo-grande{display:inline-flex;align-items:center;margin:9px 0 4px;padding:10px 13px;background:#0c527a;border-radius:8px;color:#fff;font-size:14px;font-weight:750;text-decoration:none}
.archivo .consulta-archivo-grande:hover,.archivo .consulta-archivo-grande:focus-visible{background:#083c60;outline-offset:3px}
.archivo .nota-consulta-grande{display:block;margin:4px 0 0;color:#70423c;font-size:12px;line-height:1.4}


.controles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 22px;margin:18px 0 8px}
label{display:flex;flex-direction:column;gap:7px;font-weight:650;font-size:16px;min-width:0}
input,select{font:inherit;font-weight:400;width:100%;min-width:0;padding:12px;border:1px solid #a1b3c3;border-radius:9px;background:#fff;color:#18334a;min-height:48px}
input:focus,select:focus{outline:3px solid #bedcf4;border-color:#2878ad}
#archivos{width:100%;max-width:620px;border:2px dashed #9fb8cd;background:#f5faff;padding:20px;min-height:68px}
#zonaArchivos{border:2px solid #2376a9;background:#f0f8ff;border-radius:12px;padding:20px;margin:18px 0;transition:background .15s,border-color .15s}
#zonaArchivos.arrastrando{background:#dfedfa;border-color:#0c6193}
#zonaArchivos p{margin:0 0 12px;color:#375873}
#zonaArchivos>label{font-size:17px;color:#083f6b;font-weight:800;margin:8px 0}
#zonaArchivos #archivos{background:#fff;border:2px solid #2272a8;padding:14px;cursor:pointer}
@media(max-width:650px){#zonaArchivos{margin:12px 0;padding:17px}#zonaArchivos>label{font-size:18px}#zonaArchivos #archivos{font-size:16px;min-height:62px}}
#estado{margin:12px 0;color:#556a7d;font-size:15px}
#presupuesto{background:#eaf3fa;border:1px solid #bad2e7;padding:22px 26px;position:sticky;top:8px;z-index:3;box-shadow:0 4px 10px #173c5210}
#presupuesto strong{font-size:25px;color:#113d61;line-height:1.4}
#presupuesto p{margin:7px 0;font-size:16px}
.pie{font-size:14px;color:#5e6d78}
@media(max-width:680px){main{width:100%;margin:0;padding:18px 14px 35px;border-radius:0}body{font-size:16px}.archivo{padding:17px}.archivo h3{font-size:18px}.controles{grid-template-columns:1fr;gap:13px}.nota{font-size:14px}#presupuesto{top:0;padding:14px 16px}#presupuesto strong{font-size:20px}}
.archivo{padding:0;margin:8px 0;background:#fff;overflow:hidden}
.grupo-pedido{border:1px solid #cedce8;border-radius:12px;background:#f8fbfe;margin:14px 0 16px;padding:12px}
.titulo-grupo{font-size:17px;color:#0b4269;margin:0 0 9px;padding:2px 3px}
.grupo-pedido .archivo{margin:7px 0;background:#fff}
.opciones-comunes{display:flex;align-items:flex-end;flex-wrap:wrap;gap:9px;margin:4px 0 11px;padding:11px 12px;background:#eaf3fa;border-radius:9px}
.opciones-comunes>strong{flex-basis:100%;font-size:13px;color:#34556e}
.opciones-comunes label{font-size:13px;flex:1 1 140px;font-weight:600;min-width:130px}
.opciones-comunes input,.opciones-comunes select{margin:0;padding:7px 9px;min-height:38px;font-size:14px}
@media(max-width:650px){.grupo-pedido{padding:9px}.opciones-comunes{gap:8px}.opciones-comunes label{flex-basis:45%}}

.fila{display:grid;grid-template-columns:minmax(0,1fr) minmax(105px,auto) minmax(135px,auto);align-items:center;gap:16px;padding:13px 17px;min-height:74px}
.acciones-archivo{display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap}
.acciones-archivo button{min-height:37px}
.acciones-archivo button:disabled{opacity:.45;cursor:not-allowed}
.fila-principal{min-width:0}.nombre{display:block;overflow-wrap:anywhere;font-size:16px;color:#143f62}
.eleccion-plotter{margin:9px 0 7px;padding:12px;border:2px solid #39769c;background:#edf6fc;border-radius:10px}
.eleccion-plotter>strong{display:block;font-size:14px;letter-spacing:.01em;color:#103e60}
.archivo .eleccion-plotter p{font-size:13px;margin:5px 0;color:#214760;line-height:1.42}
.eleccion-plotter-opciones{display:flex;flex-wrap:wrap;gap:9px;margin:9px 0}
.eleccion-plotter-boton{flex:1 1 140px;min-height:46px;background:#fff;color:#125278;border:1px solid #8eb3ce;border-radius:8px;font-size:14px;font-weight:750;padding:9px 12px;cursor:pointer}
.eleccion-plotter-boton.seleccionada{background:#114d75;color:#fff;border-color:#114d75}
.eleccion-plotter-boton:focus-visible{outline:3px solid #e28b12;outline-offset:2px}
.eleccion-plotter small{display:block;font-size:12px;line-height:1.4;color:#2b5470}
.consulta-clasificacion-ploteo{display:inline-block;margin:8px 0 5px;color:#0d527d;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:3px}
.consulta-clasificacion-ploteo:focus-visible{outline:3px solid #e28b12;outline-offset:2px}
.eleccion-plotter-papel{margin-top:9px;max-width:310px;font-size:13px}
.eleccion-plotter-papel select{font-size:14px;min-height:40px;padding:7px 10px}
@media(max-width:480px){.eleccion-plotter{padding:10px}.eleccion-plotter-boton{flex-basis:100%}}
.clasificacion-ploteo-visible{display:block;width:max-content;max-width:100%;
margin-top:6px;padding:5px 10px;border-radius:6px;border:1px solid #a9c4d5;
background:#edf5fb;color:#103d60;font-size:14px;letter-spacing:.01em}
.resumen-archivo{font-size:14px;color:#53697b;margin-top:3px;line-height:1.35}
.precio-archivo{text-align:right;font-weight:750;font-size:16px;white-space:nowrap;color:#154d73}
.editar{border:1px solid #aac3d7;background:#fff;color:#0e5179;font-weight:700;border-radius:8px;font-size:14px;padding:9px 12px;cursor:pointer}
.editar:hover,.editar:focus-visible{background:#e7f3fc}
.panel-edicion{border-top:1px solid #d5e1eb;background:#f5f8fb;padding:15px 18px 20px}
.panel-edicion p{font-size:14px;margin:8px 0}
.panel-edicion .controles{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 16px;margin:12px 0 0}
.panel-edicion label{font-size:14px;gap:4px}
.panel-edicion input,.panel-edicion select{font-size:15px;min-height:42px;padding:8px}
#presupuesto{position:sticky;top:8px;padding:12px 18px;box-shadow:0 4px 12px #173c5215;max-height:38vh;overflow:auto}
#presupuesto strong{font-size:22px}#presupuesto p{font-size:14px;margin:4px 0}
h2{font-size:19px;margin:20px 0 7px}
#prepararPedido{display:block;background:#113d61;color:white;border:0;border-radius:8px;padding:14px 18px;font:700 16px system-ui;cursor:pointer;margin:15px 0}
#prepararPedido:disabled{background:#d7e0e8;color:#627483;cursor:not-allowed}
#resumenPedido{margin:12px 0}#resumenPedido li{padding:5px 0;overflow-wrap:anywhere}#resumenPedido .advertencia{background:#fff1da;border-left:4px solid #d99428;padding:12px}
@media(max-width:720px){.fila{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:12px}.fila-principal{grid-column:1/-1}.precio-archivo{text-align:left}.editar{justify-self:end}.panel-edicion .controles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:440px){.panel-edicion .controles{grid-template-columns:1fr}}
.composicion-visible{margin:0 15px 12px;max-width:100%;border-color:#9dbed6;background:#f5faff}
.composicion-visible legend{font-size:15px}
.composicion-visible .composicion-opciones{display:flex;align-items:stretch;gap:9px}
@media(max-width:540px){.composicion-visible{margin:0 10px 10px}.composicion-visible .composicion-opcion{flex:1 1 105px}}
.composicion-por-cara{grid-column:1/-1;min-width:0;border:1px solid #c5d8e7;border-radius:9px;padding:10px 12px;background:#fff}
.composicion-por-cara legend{font-size:14px;font-weight:700;color:#19476b;padding:0 5px}
.composicion-opciones{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.archivo .composicion-opcion{flex:1 1 135px;display:flex;flex-direction:row;gap:9px;align-items:center;justify-content:center;min-height:44px;border:1px solid #b3cbde;border-radius:8px;background:#f6faff;padding:8px 12px;cursor:pointer;font-weight:650;font-size:14px}
.composicion-opcion:has(input:checked){background:#deeffc;border-color:#0d527d;color:#0b496f}
.archivo .composicion-opcion input{appearance:auto;accent-color:#0d527d;width:18px;height:18px;min-height:18px;flex:0 0 18px;margin:0;padding:0;outline-offset:3px}
.composicion-avanzada{margin:9px 0 0}
.composicion-avanzada summary{font-size:13px;font-weight:600;color:#0d527d;cursor:pointer;display:list-item;list-style:disclosure-closed;margin:6px 0}
.composicion-avanzada[open] summary{list-style:disclosure-open}
.composicion-avanzada .composicion-opciones{padding:7px 0 2px}
.tamano-rapido{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:10px 0 3px}
.tamano-rapido button{background:#fff;color:#174c70;border:1px solid #aac4d9;border-radius:7px;padding:8px 12px;font-weight:700;font-size:14px;cursor:pointer}
.tamano-rapido button.seleccionada{background:#0d527d;color:#fff;border-color:#0d527d}
.tamano-rapido button:focus-visible{outline:3px solid #e08d16;outline-offset:2px}
.tamano-rapido small{display:block;flex-basis:100%;font-size:12px;color:#38546a}
.pregunta-tamano{background:#fff4df;border:2px solid #dc8c19;border-radius:10px;padding:13px;margin:10px 0}
.pregunta-tamano strong{display:block;flex-basis:100%;font-size:17px;color:#603d0b}
.pregunta-tamano p{flex-basis:100%;margin:0;color:#634823;font-size:13px}
.pregunta-tamano button{border:1px solid #986521;background:#fff;font-size:14px;min-height:40px}
@media(max-width:520px){.pregunta-tamano button{flex:1 1 100%}}

.modo-config{border:1px solid #c9d8e7;background:#f9fbfe;padding:17px;border-radius:12px;margin:12px 0}
.modo-config h2{margin:0 0 6px;font-size:21px}.modo-config p{margin:5px 0 12px;font-size:14px;color:#526b80}
.modo-elecciones{display:grid;grid-template-columns:1fr 1fr;gap:12px}.modo-tarjeta{display:flex;flex-direction:row;align-items:flex-start;gap:12px;padding:15px;border:2px solid #d9e3ed;border-radius:10px;background:white;cursor:pointer}
.modo-tarjeta:has(input:checked){border-color:#12659c;background:#edf7ff}.modo-tarjeta input{width:20px;min-width:20px;min-height:20px;margin:3px 0 0;accent-color:#0a6193}.modo-tarjeta span{display:grid;gap:5px}.modo-tarjeta strong{font-size:16px}.modo-tarjeta small{font-weight:400;line-height:1.4;font-size:13px;color:#536b81}
#configComunGlobal{margin:10px 0}#configComunGlobal .opciones-comunes{margin:0 0 8px}
@media(max-width:650px){.modo-elecciones{grid-template-columns:1fr}.modo-config{padding:13px}}
.anillado-conjunto{border:1px solid #b9d0e0;border-radius:10px;background:#f7fbfe;padding:12px;margin:12px 0}
.anillado-conjunto summary{cursor:pointer;font-weight:750;color:#143f62;font-size:16px}
.anillado-conjunto p{font-size:13px;color:#375872;margin:8px 0}
.anillado-filas{display:grid;gap:8px;margin:12px 0}
.anillado-fila{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end;border-top:1px solid #d8e4ed;padding-top:8px}
.anillado-fila label{font-size:13px;overflow-wrap:anywhere}
.anillado-fila select{font-size:14px;min-height:40px;padding:7px}
.anillado-orden{display:flex;gap:6px}
.anillado-orden button{font-size:13px;padding:8px;min-height:40px}
@media(max-width:450px){.anillado-fila{grid-template-columns:1fr}.anillado-orden{justify-content:flex-end}}
</style></head><body><main><h1>Una sola carga · Tamaño final</h1><p class="nota"><strong>Prueba privada de clasificación.</strong> Seleccioná PDF, JPG o PNG sin elegir de antemano entre impresiones y ploteos. Confirmá en qué tamaño querés imprimir cada archivo: el original puede ser A2, aunque quieras A4. Sin envío de originales, pedidos ni pagos. Presupuestos orientativos sin validez comercial hasta verificar los archivos. La clasificación CAD/Póster y las tarifas existentes no se modifican.</p><div id="zonaArchivos"><p><strong>1. Subí tus archivos</strong> · PDF, JPG o PNG. Podés seleccionar varios a la vez (hasta 30). JPG/PNG se agrupan en PDF de hasta 10 fotos y se preparan en tu dispositivo, sin subir el original. En el pedido comercial se admiten hasta 10 PDF.</p><label for="archivos">Elegir PDF, JPG o PNG</label><input id="archivos" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple></div><section id="modoConfiguracion" class="modo-config" aria-labelledby="modoTitulo"><h2 id="modoTitulo">2. ¿Cómo querés configurar tus archivos?</h2><p>Empezamos con opciones individuales. Si todos van a imprimirse igual, elegí «Todos iguales». Podés cambiarlo sin perder tus archivos.</p><div class="modo-elecciones"><label class="modo-tarjeta"><input type="radio" name="modoImpresionLote" value="comun"><span><strong>Todos iguales</strong><small>Una configuración para los documentos compatibles: color, caras, copias y terminación.</small></span></label><label class="modo-tarjeta"><input type="radio" name="modoImpresionLote" value="individual" checked><span><strong>Cada archivo por separado</strong><small>Predeterminado. Elegí opciones distintas para cada archivo dentro del mismo pedido.</small></span></label></div><p id="modoAviso" role="status" aria-live="polite">Carga habilitada. Podés cambiar el modo de impresión cuando quieras.</p></section><div id="configComunGlobal" hidden></div><p id="estado" role="status">Cargando…</p><h2>Resumen del presupuesto</h2><section class="archivo" id="presupuesto" aria-live="polite">Esperando archivos…</section><button id="prepararPedido" type="button" disabled>Revisar pedido (sin enviar)</button><section id="resumenPedido" aria-live="polite"></section><h2>Configuración de tus archivos</h2><div id="anilladosConjuntos" hidden></div><div id="lista"></div><p><a href="/prueba-cotizador-conjunto">Volver a los presupuestos de prueba</a></p></main><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" defer></script><script src="/prueba-carga-unica.js" defer></script><script>
document.addEventListener('DOMContentLoaded',()=>{
 const zona=document.getElementById('zonaArchivos');
 const input=document.getElementById('archivos');
 if(!zona||!input)return;
 for(const type of ['dragenter','dragover']){
  zona.addEventListener(type,event=>{
   if(!event.dataTransfer?.types?.includes('Files'))return;
   event.preventDefault();event.dataTransfer.dropEffect='copy';
   zona.classList.add('arrastrando');
  });
 }
 zona.addEventListener('dragleave',event=>{
  if(!zona.contains(event.relatedTarget))zona.classList.remove('arrastrando');
 });
 zona.addEventListener('drop',event=>{
  event.preventDefault();zona.classList.remove('arrastrando');
  const archivos=Array.from(event.dataTransfer?.files||[]);
  if(!archivos.length)return;
  if(archivos.some(file=>!/\.(pdf|jpe?g|png)$/i.test(file.name))){
   document.getElementById('estado').textContent='Sólo se admiten PDF, JPG o PNG.';
   return;
  }
  const transfer=new DataTransfer();
  archivos.forEach(file=>transfer.items.add(file));
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
});
</script></body></html>`;
}
