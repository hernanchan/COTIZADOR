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

function subirFotoPrueba(form) {
  const cfg = PropertiesService.getScriptProperties();
  // Configuración apagada por defecto. Nunca admitir cargas anónimas.
  if (cfg.getProperty('TEST_ENABLED') !== 'yes') {
    throw new Error('Piloto deshabilitado.');
  }
  const owner = (cfg.getProperty('TEST_OWNER_EMAIL') || '').toLowerCase().trim();
  const active = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!owner || !active || owner !== active) {
    throw new Error('El piloto solo admite la cuenta propietaria autorizada.');
  }
  const folderId = cfg.getProperty('TEST_FOLDER_ID');
  if (!folderId) throw new Error('Falta configurar TEST_FOLDER_ID.');
  if (!form || !form.foto) throw new Error('Seleccioná un JPG o PNG.');
  const blob = form.foto;
  const bytes = blob.getBytes();
  if (!bytes || !bytes.length || bytes.length > PILOT_MAX_BYTES) {
    throw new Error('Elegí una imagen de hasta 5 MB.');
  }
  const first = n => bytes[n] & 255;
  const jpeg = bytes.length >= 3 && first(0) === 255 && first(1) === 216 && first(2) === 255;
  const png = bytes.length >= 8 &&
    [137,80,78,71,13,10,26,10].every((n,i) => first(i) === n);
  if (!jpeg && !png) throw new Error('Formato no admitido. Solamente JPG o PNG.');
  const folder = DriveApp.getFolderById(folderId);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('La carpeta debe tener acceso restringido, no compartido por enlace.');
  }
  const name = 'POLAROID_TEST_' + Utilities.getUuid() + (jpeg ? '.jpg' : '.png');
  const file = folder.createFile(blob.setName(name).setContentType(jpeg ? 'image/jpeg' : 'image/png'));
  // No devolver ID, enlace de Drive, contenido ni tokens al navegador.
  return { ok: true, bytes: bytes.length, message: 'La fotografía de prueba quedó guardada en la carpeta privada.' };
}
