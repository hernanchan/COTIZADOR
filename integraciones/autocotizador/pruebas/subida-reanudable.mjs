/**
 * Librería Saber · Subida reanudable de PDF (contrato de cliente en desarrollo).
 *
 * No contiene una URL de recepción ni activa ninguna subida por sí solo.
 * La implementación de "gateway" debe autenticar orden y subida, verificar hashes
 * de cada fragmento, conservar confirmaciones y validar íntegramente el PDF final.
 */
export const PDF_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_PART_BYTES = 512 * 1024;
const HEX = n => n.toString(16).padStart(2, '0');
export function hexDigest(bytes) {
  return Array.from(bytes, HEX).join('');
}
export async function sha256(bytes, subtle = globalThis.crypto?.subtle) {
  if (!subtle?.digest) throw Error('Este navegador no permite comprobar la integridad (SHA-256).');
  return hexDigest(new Uint8Array(await subtle.digest('SHA-256', bytes)));
}
export function base64Bytes(bytes, encoder = globalThis.btoa) {
  if (typeof encoder !== 'function') throw Error('No está disponible el codificador de archivos.');
  // Cada bloque intermedio es múltiplo de tres; evita crear cadenas gigantes.
  let result = '';
  for (let p = 0; p < bytes.length; p += 12288) {
    const part = bytes.subarray(p, p + 12288);
    result += encoder(String.fromCharCode(...part));
  }
  return result;
}
function validatedParts(value, total) {
  if (!Array.isArray(value)) throw Error('Respuesta de recepción inválida.');
  const accepted = new Set();
  for (const n of value) {
    if (!Number.isSafeInteger(n) || n < 0 || n >= total) throw Error('Índice de fragmento inválido.');
    accepted.add(n);
  }
  return accepted;
}
function cancelled(signal) {
  if (signal?.aborted) throw new DOMException('Carga interrumpida.', 'AbortError');
}
function checkSession(response) {
  if (!response || typeof response.uploadId !== 'string' ||
      !/^[a-zA-Z0-9_-]{12,128}$/.test(response.uploadId) ||
      typeof response.token !== 'string' || response.token.length < 16)
    throw Error('La sesión de recepción no es válida.');
}
function retryDelay(attempt) {
  return Math.min(2000, 250 * 2 ** attempt);
}
export async function uploadPdfResumable({
  file, orderId, fileId, mode, gateway, onProgress = () => {},
  signal, subtle = globalThis.crypto?.subtle,
  encoder = globalThis.btoa,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  if (!file || typeof file.slice !== 'function' ||
      !Number.isSafeInteger(file.size) || file.size < 5 ||
      file.size > PDF_UPLOAD_MAX_BYTES || !/\.pdf$/i.test(file.name||''))
    throw Error('Seleccioná un PDF válido de hasta 20 MB.');
  if (typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]{6,100}$/.test(orderId))
    throw Error('Referencia de pedido inválida.');
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(fileId))
    throw Error('Identificador del archivo inválido.');
  if (!['bn','color','cad','poster'].includes(mode))
    throw Error('Modalidad de impresión inválida.');
  if (!gateway || ['start','status','part','finish'].some(k => typeof gateway[k] !== 'function'))
    throw Error('Falta el servicio de recepción protegida.');
  cancelled(signal);
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!new TextDecoder().decode(header).includes('%PDF-'))
    throw Error('El archivo no contiene un encabezado PDF válido.');
  const wholeSha = await sha256(await file.arrayBuffer(), subtle);
  const parts = Math.ceil(file.size / PDF_PART_BYTES);
  cancelled(signal);
  // Una petición start repetida debe devolver la MISMA sesión para igual
  // (pedido, SHA, tamaño, modalidad). Si el archivo cambia, el servidor debe
  // abrir una sesión nueva sin mezclar fragmentos anteriores.
  const meta = {orderId, fileId, name:file.name, bytes:file.size,
    sha256:wholeSha, mode, parts, partBytes:PDF_PART_BYTES, mime:'application/pdf'};
  const session = await gateway.start(meta);
  checkSession(session);
  const ctx = {uploadId:session.uploadId, token:session.token};
  let accepted = validatedParts((await gateway.status(ctx))?.acceptedParts, parts);
  let finishedBytes = 0;
  for (const i of accepted) finishedBytes += Math.min(PDF_PART_BYTES, file.size-i*PDF_PART_BYTES);
  onProgress({finishedBytes, totalBytes:file.size, confirmedParts:accepted.size, totalParts:parts});
  for(let index=0;index<parts;index++){
    cancelled(signal);
    if(accepted.has(index))continue;
    const start = index * PDF_PART_BYTES;
    const fragment = new Uint8Array(await file.slice(start,Math.min(file.size,start+PDF_PART_BYTES)).arrayBuffer());
    const checksum = await sha256(fragment, subtle);
    const payload = {...ctx,index,parts,bytes:fragment.length,
      sha256:checksum,dataBase64:base64Bytes(fragment,encoder)};
    let confirmed = false;
    for(let attempt=0;attempt<4&&!confirmed;attempt++){
      cancelled(signal);
      try {
        const result = await gateway.part(payload);
        if (result?.accepted !== true) throw Error('El servidor no confirmó el fragmento.');
        confirmed = true;
      } catch(e) {
        // El servidor pudo guardar el fragmento aunque se haya perdido la respuesta.
        const status = await gateway.status(ctx).catch(() => null);
        const reported = status?.acceptedParts;
        if (Array.isArray(reported) && validatedParts(reported,parts).has(index)) confirmed=true;
        else if (attempt===3) throw Error('No se pudo confirmar el fragmento '+(index+1)+': '+(e?.message||'sin conexión'));
        else await wait(retryDelay(attempt));
      }
    }
    accepted.add(index);
    finishedBytes += fragment.length;
    onProgress({finishedBytes, totalBytes:file.size, confirmedParts:accepted.size,totalParts:parts});
  }
  cancelled(signal);
  const completed = await gateway.finish({...ctx,sha256:wholeSha,bytes:file.size,parts});
  if (completed?.verified !== true || completed.sha256 !== wholeSha ||
      completed.bytes !== file.size || !Number.isSafeInteger(completed.pdfPages) || completed.pdfPages < 1)
    throw Error('El servidor todavía no verificó el PDF completo. No se puede cobrar.');
  return Object.freeze({orderId, fileId, uploadId:session.uploadId,
    name:file.name, sha256:wholeSha, bytes:file.size, pages:completed.pdfPages,
    receiptId:completed.receiptId||null,status:'verified'});
}
