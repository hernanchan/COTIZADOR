/**
 * PILOTO PRIVADO: una imagen de prueba en carpeta privada de Google Drive.
 * NO desplegar como "Cualquiera"; ejecutar SOLAMENTE como propietario.
 * TEST_ENABLED debe ser "yes"; TEST_OWNER_EMAIL y TEST_FOLDER_ID se
 * configuran en Propiedades del script, nunca en el código del repositorio.
 */
const PILOT_MAX_BYTES = 5 * 1024 * 1024;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Polaroids Saber — Piloto privado de Drive');
}

/**
 * Recepción del piloto a través de un objeto serializable, sin <form> como parámetro.
 * HTMLService puede fallar en la transferencia nativa de archivos de un formulario.
 * Para el piloto, enviar una imagen JPG/PNG de preferencia menor a 1 MB.
 */
function subirFotoBase64(payload) {
  const cfg = PropertiesService.getScriptProperties();
  if (cfg.getProperty('TEST_ENABLED') !== 'yes') throw new Error('Piloto deshabilitado.');

  const owner = (cfg.getProperty('TEST_OWNER_EMAIL') || '').toLowerCase().trim();
  const active = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!owner || !active || owner !== active) {
    throw new Error('Solo se admite la cuenta propietaria autorizada.');
  }
  const folderId = cfg.getProperty('TEST_FOLDER_ID');
  if (!folderId) throw new Error('Falta configurar TEST_FOLDER_ID.');

  if (!payload || typeof payload.data !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data)) {
    throw new Error('Fotografía de prueba inválida.');
  }
  // Comprobar el tamaño ANTES de decodificar, para evitar consumos excesivos.
  if (payload.data.length > Math.ceil(PILOT_MAX_BYTES / 3) * 4 + 4) {
    throw new Error('La imagen supera el máximo de 5 MB.');
  }

  const bytes = Utilities.base64Decode(payload.data);
  if (!bytes.length || bytes.length > PILOT_MAX_BYTES) {
    throw new Error('Elegí una imagen JPG o PNG de hasta 5 MB.');
  }
  const first = n => bytes[n] & 255;
  const jpeg = bytes.length >= 3 && first(0) === 255 && first(1) === 216 && first(2) === 255;
  const png = bytes.length >= 8 &&
    [137,80,78,71,13,10,26,10].every((n,i) => first(i) === n);
  if (!jpeg && !png) throw new Error('Formato no admitido. Usá JPG o PNG.');

  const folder = DriveApp.getFolderById(folderId);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('La carpeta debe ser privada, sin acceso por enlace.');
  }

  const name = 'POLAROID_TEST_' + Utilities.getUuid() + (jpeg ? '.jpg' : '.png');
  const blob = Utilities.newBlob(bytes, jpeg ? 'image/jpeg' : 'image/png', name);
  folder.createFile(blob);
  // No exponer enlace, ID ni contenido de archivo al navegador.
  return {ok:true, bytes:bytes.length, message:'La fotografía de prueba quedó guardada en la carpeta privada.'};
}
