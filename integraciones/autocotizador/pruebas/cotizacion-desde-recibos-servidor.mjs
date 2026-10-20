/**
 * Cotización de documentos desde recibos CONFIRMADOS POR EL SERVIDOR.
 *
 * El navegador aporta únicamente opciones comerciales, orden y grupos.
 * Las páginas, los hashes y los recibos provienen de una consulta privada al
 * receptor autenticado, NUNCA del JSON enviado por el cliente.
 *
 * No inicia cobros, no publica tarifas ni marca pedidos pagados.
 */
import { cotizarDocumentos } from './cotizar-documentos.mjs';
import { crearManifiestoDocumentos } from './manifiesto-documentos.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const ORDER = /^WEB-[a-zA-Z0-9_-]{5,80}$/;
const RECEIPT = /^DOC-[a-f0-9-]{36}$/i;
function validDocument(f) {
  return f && typeof f === 'object' && !Array.isArray(f) &&
    typeof f.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(f.id) &&
    typeof f.nombre === 'string' && f.nombre.length > 0 && f.nombre.length <= 160 &&
    /\.pdf$/i.test(f.nombre) &&
    ['bn','color'].includes(f.modo) &&
    Number.isSafeInteger(f.orden) && f.orden >= 1 && f.orden <= 150;
}
function pickReceipt(id, orderId, r) {
  if (!r || r.fileId !== id || r.orderId !== orderId ||
      r.status !== 'verified' || r.storageVerified !== true ||
      r.pageVerification !== 'server' ||
      !Number.isSafeInteger(r.pages) || r.pages < 1 || r.pages > 20000 ||
      !Number.isSafeInteger(r.bytes) || r.bytes < 5 ||
      !SHA256.test(r.sha256 || '') ||
      !RECEIPT.test(r.receiptId || '')) {
    throw Error('Archivo sin verificación completa en servidor: ' + id);
  }
  return r;
}

/**
 * @param {object} solicitud opciones del cliente, sin precios ni páginas fiables
 * @param {Array} recibosConfiables cargados por el servidor, nunca del navegador
 * @param {object} tarifasServidor config leída por backend; no enviada por cliente
 */
export function prepararPresupuestoDocumentos({solicitud, recibosConfiables, tarifasServidor}) {
  if (!solicitud || !ORDER.test(solicitud.orderId || '')) throw Error('Pedido inválido.');
  if (!Array.isArray(solicitud.archivos) || solicitud.archivos.length < 1 ||
      solicitud.archivos.length > 150) throw Error('Lista de documentos inválida.');
  if (!Array.isArray(recibosConfiables) || recibosConfiables.length !== solicitud.archivos.length)
    throw Error('Faltan archivos confirmados en el servidor.');
  if (!tarifasServidor || tarifasServidor.schema == null ||
      !tarifasServidor.bnA4 || !tarifasServidor.colorA4 ||
      !tarifasServidor.bnA3 || !tarifasServidor.colorA3)
    throw Error('No hay tarifas de servidor válidas.');

  const receipts = new Map(), ids = new Set(), orders = new Set(), docs = [];
  for (const r of recibosConfiables) {
    if (!r || typeof r.fileId !== 'string' || receipts.has(r.fileId))
      throw Error('Recibos duplicados o inválidos.');
    receipts.set(r.fileId, r);
  }
  for (const original of solicitud.archivos) {
    if (!validDocument(original) || ids.has(original.id))
      throw Error('Documento o identificador de archivo inválido.');
    ids.add(original.id);
    if (orders.has(original.orden)) throw Error('Orden de impresión repetido.');
    orders.add(original.orden);
    const r = pickReceipt(original.id, solicitud.orderId, receipts.get(original.id));
    if (original.paginas !== undefined && original.paginas !== r.pages)
      throw Error('Cantidad de páginas del navegador distinta de la verificada: '+original.id);
    if (r.mode !== original.modo)
      throw Error('La modalidad del PDF no coincide con la recepción: '+original.id);
    if (r.name !== original.nombre)
      throw Error('El nombre del PDF no coincide con el archivo recibido: '+original.id);
    docs.push({id:original.id,nombre:r.name,paginas:r.pages,modo:r.mode,
      orden:original.orden,grupo:original.grupo});
  }
  if ([...receipts.keys()].some(k=>!ids.has(k)))throw Error('Hay recibos ajenos al pedido.');
  const settings = {
    orderId:solicitud.orderId,archivos:docs,recibos:recibosConfiables,
    formato:solicitud.formato,caras:solicitud.caras,copias:solicitud.copias,
    materialColor:solicitud.materialColor,anillado:solicitud.anillado
  };
  const manifiesto = crearManifiestoDocumentos(settings);
  const subtotal = cotizarDocumentos({...settings,precios:tarifasServidor});
  if (manifiesto.paginasPorEjemplar !== subtotal.paginasPorEjemplar ||
      manifiesto.hojasPorEjemplar !== subtotal.hojasPorEjemplar)
    throw Error('Discrepancia entre ficha de impresión y cotización.');
  if (!Number.isSafeInteger(subtotal.total) || subtotal.total < 0)
    throw Error('Importe de impresión inválido.');

  return Object.freeze({
    orderId:solicitud.orderId,
    status:'files_verified_quote_pending_payment',
    pagesVerifiedBy:'server',
    receiptIds:recibosConfiables.map(x=>x.receiptId),
    priceSource:'precios-web.json',
    priceVersion:String(tarifasServidor.generatedAt||'sin-fecha'),
    quote:subtotal,
    manifiesto,
    requiresPaymentVerification:true,
    paymentAuthorized:false
  });
}
