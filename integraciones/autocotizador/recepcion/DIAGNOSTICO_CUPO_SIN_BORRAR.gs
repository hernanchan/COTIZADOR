/**
 * Librería Saber - diagnóstico manual, solo lectura.
 * Agregar temporalmente al Apps Script receptor de DOCUMENTOS de pruebas
 * y ejecutar diagnosticarCupoDocumentosSaber desde el editor.
 * No modifica Script Properties, Drive ni los recibos.
 * No publicar una implementación web para usarlo.
 */
function diagnosticarCupoDocumentosSaber() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var key = 'DOCS_MULTI_INDEX_LOTE_20261024';
  var now = Date.now(), ttl = 6 * 86400000;
  var result = {
    indice: 'DOCS_MULTI_INDEX_LOTE_20261024',
    limiteGlobal: 120,
    limitePorPedido: 30,
    limiteBytesPorPedido: 60 * 1024 * 1024,
    vigenciaDias: 6,
    entradas: 0,
    vigentes: 0,
    vencidas: 0,
    sinEstado: 0,
    estadoInvalido: 0,
    pedidosDistintos: 0,
    indiceLegible: false,
    posibleCausa: 'NO_DETERMINADA'
  };
  var ids;
  try { ids = JSON.parse(props[key] || '[]'); }
  catch (_) { result.posibleCausa = 'INDICE_JSON_INVALIDO'; Logger.log(JSON.stringify(result)); return result; }
  if (!Array.isArray(ids)) {
    result.posibleCausa = 'INDICE_NO_ES_ARRAY';
    Logger.log(JSON.stringify(result)); return result;
  }
  result.indiceLegible = true;
  result.entradas = ids.length;
  var pedidos = {}, distintos = {};
  ids.forEach(function(id) {
    if (typeof id !== 'string' || !/^DOC-[a-f0-9-]{36}$/i.test(id)) {
      result.estadoInvalido++; return;
    }
    if (distintos[id]) { result.estadoInvalido++; return; }
    distintos[id] = true;
    var raw = props['FILE_' + id];
    if (!raw) { result.sinEstado++; return; }
    var state;
    try { state = JSON.parse(raw); }
    catch (_) { result.estadoInvalido++; return; }
    if (state.uploadId !== id || !Number.isFinite(state.createdAt) ||
        typeof state.orderId !== 'string') {
      result.estadoInvalido++; return;
    }
    if (now - state.createdAt > ttl) result.vencidas++;
    else { result.vigentes++; pedidos[state.orderId] = true; }
  });
  result.pedidosDistintos = Object.keys(pedidos).length;
  if (result.estadoInvalido || result.sinEstado)
    result.posibleCausa = 'INDICE_INCONSISTENTE';
  else if (result.entradas > result.limiteGlobal)
    result.posibleCausa = 'INDICE_SUPERA_LIMITE_ANTES_DE_DEPURAR';
  else if (result.vigentes >= result.limiteGlobal)
    result.posibleCausa = 'CUPO_GLOBAL_LLENO';
  else if (result.vencidas)
    result.posibleCausa = 'HAY_SESIONES_VENCIDAS';
  else
    result.posibleCausa = 'CUPO_DISPONIBLE_BUSCAR_OTRA_CAUSA';
  Logger.log(JSON.stringify(result));
  return result;
}
