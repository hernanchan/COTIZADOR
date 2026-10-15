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


/**
 * PILOTO: una hoja de seis fotografías, desde editor con recortes.
 * Solo propietaria/o, nunca sitio público; no conectar a cotizador ni carrito.
 * Cada foto se envía por separado para evitar superar límites de Apps Script.
 */
function contextoHoja_() {
  const cfg = PropertiesService.getScriptProperties();
  if (cfg.getProperty('TEST_ENABLED') !== 'yes') throw new Error('Piloto desactivado.');
  const owner=(cfg.getProperty('TEST_OWNER_EMAIL')||'').trim().toLowerCase();
  const current=(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if (!owner || !current || owner!==current) throw new Error('Acceso reservado a la cuenta autorizada.');
  const folderId=cfg.getProperty('TEST_FOLDER_ID');
  if (!folderId) throw new Error('No se configuró la carpeta de recepción.');
  const folder=DriveApp.getFolderById(folderId);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('La carpeta de recepción debe ser privada.');
  return {cfg,folder};
}
function estadoHoja_(cfg,ticket) {
  if (typeof ticket!=='string' || !/^[a-f0-9]{32}$/i.test(ticket)) throw new Error('Referencia de prueba inválida.');
  const raw=cfg.getProperty('PILOT_SHEET_'+ticket);
  if (!raw) throw new Error('No se encontró el borrador; iniciá otra prueba.');
  const state=JSON.parse(raw);
  if (Date.now()-state.created > 24*60*60*1000) throw new Error('Borrador caducado.');
  return state;
}
function comenzarHojaPrueba() {
  const {cfg,folder}=contextoHoja_();
  const ticket=Utilities.getUuid().replace(/-/g,'').toLowerCase();
  const dir=folder.createFolder('PRUEBA_6_POLAROIDS_'+ticket);
  const state={created:Date.now(),folderId:dir.getId(),photos:{},status:'draft'};
  cfg.setProperty('PILOT_SHEET_'+ticket,JSON.stringify(state));
  return {ticket};
}
function subirFotoDeHoja(payload) {
  const {cfg}=contextoHoja_();
  if (!payload || typeof payload!=='object') throw new Error('No llegaron los datos.');
  const ticket=payload.ticket, i=Number(payload.index);
  if (!Number.isInteger(i)||i<0||i>5) throw new Error('Número de fotografía inválido.');
  const base64=payload.data;
  if (typeof base64!=='string'||!base64.length||base64.length>Math.ceil(PILOT_MAX_BYTES/3)*4+4||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Archivo demasiado grande o inválido.');
  const bytes=Utilities.base64Decode(base64);
  if (!bytes.length||bytes.length>PILOT_MAX_BYTES) throw new Error('Máximo 5 MB por fotografía.');
  const n=j=>bytes[j]&255;
  const jpeg=bytes.length>3&&n(0)===255&&n(1)===216&&n(2)===255;
  const png=bytes.length>8&&[137,80,78,71,13,10,26,10].every((v,j)=>n(j)===v);
  if (!jpeg&&!png) throw new Error('Solo JPG o PNG.');
  const crop=payload.crop;
  if (!crop || ![crop.x,crop.y,crop.s,crop.sourceWidth,crop.sourceHeight].every(v=>Number.isFinite(v)) ||
      crop.sourceWidth<100 || crop.sourceHeight<100 || crop.s<=0 ||
      crop.x<0 || crop.y<0 || crop.x+crop.s>crop.sourceWidth+0.01 ||
      crop.y+crop.s>crop.sourceHeight+0.01) throw new Error('Recorte fuera de los límites de la imagen.');

  // Evitar duplicados concurrentes; las seis cargas se solicitan en secuencia.
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const state=estadoHoja_(cfg,ticket);
    if (state.status!=='draft') throw new Error('Hoja ya cerrada.');
    if (state.photos[i]) throw new Error('Esa foto ya se había recibido.');
    const folder=DriveApp.getFolderById(state.folderId);
    const name='FOTO_'+(i+1)+(jpeg?'.jpg':'.png');
    const blob=Utilities.newBlob(bytes,jpeg?'image/jpeg':'image/png',name);
    const file=folder.createFile(blob);
    state.photos[i]={fileId:file.getId(),name,bytes:bytes.length,crop};
    cfg.setProperty('PILOT_SHEET_'+ticket,JSON.stringify(state));
    return {ok:true,received:Object.keys(state.photos).length};
  } finally { lock.releaseLock(); }
}
function finalizarHojaPrueba(ticket) {
  const {cfg}=contextoHoja_();
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const state=estadoHoja_(cfg,ticket);
    if (state.status!=='draft') throw new Error('Hoja ya terminada.');
    if ([0,1,2,3,4,5].some(i=>!state.photos[i])) throw new Error('No llegaron las seis fotos.');
    const folder=DriveApp.getFolderById(state.folderId);
    folder.createFile('encuadres.json',JSON.stringify({
      format:'85x90_6up_A4_v1.1', photos:[0,1,2,3,4,5].map(i=>state.photos[i].crop)
    },null,2),'application/json');
    state.status='complete';
    cfg.setProperty('PILOT_SHEET_'+ticket,JSON.stringify(state));
    return {ok:true,received:6,reference:ticket,message:'Las seis fotografías y sus encuadres quedaron en Drive privado.'};
  } finally { lock.releaseLock(); }
}
