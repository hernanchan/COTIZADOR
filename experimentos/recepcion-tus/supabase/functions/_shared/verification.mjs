/** Núcleo independiente y testeable de la verificación del bucket PRIVADO. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const OWNER = new RegExp('^'+UUID+'$', 'i');
const HEX = /^[a-f0-9]{64}$/;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
export function validObjectName(userId, objectName) {
  if (typeof userId !== 'string' || !OWNER.test(userId) || typeof objectName !== 'string') return false;
  const parts = objectName.split('/');
  return parts.length === 2 && parts[0] === userId &&
    new RegExp('^'+UUID+'\\.pdf$', 'i').test(parts[1]);
}
export async function verifyPrivatePdf({userId, objectName, expectedSha256, readObject, parsePages, subtle = crypto.subtle}) {
  if (!validObjectName(userId, objectName) || !HEX.test(expectedSha256 || '') ||
      typeof readObject !== 'function' || typeof parsePages !== 'function')
    throw Error('Solicitud de verificación inválida.');
  const blob = await readObject(objectName);
  if (!blob || !Number.isSafeInteger(blob.size) || blob.size < 5 || blob.size > MAX_FILE_BYTES)
    throw Error('Objeto privado ausente o fuera del límite.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0,5)) !== '%PDF-')
    throw Error('El objeto recibido no es un PDF.');
  const hash = [...new Uint8Array(await subtle.digest('SHA-256',bytes))]
    .map(x => x.toString(16).padStart(2,'0')).join('');
  if (hash !== expectedSha256) throw Error('SHA-256 del objeto privado inconsistente.');
  const pages = await parsePages(bytes);
  if (!Number.isSafeInteger(pages) || pages < 1 || pages > 2000)
    throw Error('No se pudo verificar la cantidad de páginas.');
  return Object.freeze({verified:true,bytes:bytes.length,pages,sha256:hash});
}