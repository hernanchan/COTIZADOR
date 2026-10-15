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
  // El navegador prepara una copia JPEG cuadrada de 886 x 886 px
  // desde el encuadre seleccionado; el PDF se construye solo en el servidor.
  const printData=payload.printData;
  if(typeof printData!=='string'||!printData.length||
     printData.length>Math.ceil(PILOT_MAX_BYTES/3)*4+4||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(printData))
    throw new Error('Falta el recorte de impresión.');
  const printBytes=Utilities.base64Decode(printData);
  if(!printBytes.length||printBytes.length>PILOT_MAX_BYTES)
    throw new Error('El recorte de impresión supera 5 MB.');
  const resolution=jpegDimensions_(printBytes);
  if(resolution.width!==886||resolution.height!==886)
    throw new Error('El recorte debe medir 886 × 886 píxeles (300 dpi).');
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
    const printName='RECORTE_'+(i+1)+'_300DPI.jpg';
    const printFile=folder.createFile(Utilities.newBlob(printBytes,'image/jpeg',printName));
    state.photos[i]={fileId:file.getId(),printFileId:printFile.getId(),name,bytes:bytes.length,crop};
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
    if ([0,1,2,3,4,5].some(i=>!state.photos[i]||!state.photos[i].printFileId))
      throw new Error('No llegaron las seis fotos con sus recortes de imprenta.');
    const folder=DriveApp.getFolderById(state.folderId);
    // La composición PDF se genera en Apps Script, no se devuelve al navegador.
    const jpgs=[0,1,2,3,4,5].map(i=>
      DriveApp.getFileById(state.photos[i].printFileId).getBlob().getBytes());
    const pdfBlob=crearPdfImprenta_(jpgs);
    const pdfFile=folder.createFile(pdfBlob);
    state.status='complete';
    state.pdfFileId=pdfFile.getId();
    cfg.setProperty('PILOT_SHEET_'+ticket,JSON.stringify(state));
    folder.createFile('encuadres.json',JSON.stringify({
      format:'85x90_6up_A4_v1.1', photoPixels:886,
      photos:[0,1,2,3,4,5].map(i=>state.photos[i].crop)
    },null,2),'application/json');
    return {ok:true,received:6,reference:ticket,
      message:'Se guardaron las 6 fotos, sus encuadres y el PDF A4 privado de imprenta.'};
  } finally { lock.releaseLock(); }
}


/**
 * Extrae el tamaño de JPG (SOF0..SOF15 excepto DHT, JPG-LS y otros).
 * Los RECORTE_*.jpg provienen de canvas.toBlob('image/jpeg').
 */
function jpegDimensions_(bytes) {
  const u=i=>bytes[i]&255;
  if(bytes.length<20||u(0)!==255||u(1)!==216)
    throw new Error('El recorte de impresión no es un JPEG válido.');
  let i=2;
  while(i<bytes.length-9) {
    if(u(i)!==255)throw new Error('Cabecera JPEG inválida.');
    while(u(i)===255)i++;
    const m=u(i++);
    if(m===217||m===218)break; // EOI / SOS
    if(m===1||(m>=208&&m<=215))continue;
    if(i+1>=bytes.length)break;
    const len=u(i)*256+u(i+1);
    if(len<2||i+len>bytes.length)break;
    if([192,193,194,195,198,199,201,202,203,205,206,207].indexOf(m)>=0){
      if(len<7)break;
      return {height:u(i+3)*256+u(i+4),width:u(i+5)*256+u(i+6)};
    }
    i+=len;
  }
  throw new Error('No se pudo determinar la resolución del JPEG.');
}

/**
 * Un PDF REAL de imprenta. A4 vertical: 210 × 297 mm.
 * Seis piezas finales 85 × 90 mm en 2 columnas × 3 filas.
 * Fotografía 75 × 75 mm: laterales 5, superior 4, inferior 11 mm.
 * Marcas finas solo fuera de las piezas, aptas para guillotina.
 * JPEG de 886 px en 75 mm = 300,06 ppp.
 * SIN biblioteca remota; solo Drive privado y Apps Script.
 */
function crearPdfImprenta_(jpgs) {
  if(!Array.isArray(jpgs)||jpgs.length!==6)
    throw new Error('Se requieren exactamente seis recortes.');
  for(const bytes of jpgs) {
    const dim=jpegDimensions_(bytes);
    if(dim.width!==886||dim.height!==886)
      throw new Error('Uno de los recortes no tiene resolución de 300 dpi.');
  }
  const mm=72/25.4, a=n=>(n*mm).toFixed(4);
  const xref=[];
  const bytes=[];
  const ascii=t=>{for(let i=0;i<t.length;i++)bytes.push(t.charCodeAt(i)&255)};
  const raw=t=>{for(let i=0;i<t.length;i++)bytes.push(t[i]&255)};
  const object=(n,fn)=>{
    xref[n]=bytes.length;
    ascii(n+' 0 obj\n');
    fn();
    ascii('\nendobj\n');
  };
  let content='q\n';
  // En PDF el origen es abajo a la izquierda.
  for(let i=0;i<6;i++){
    const x=25+(i%2)*85;
    const y=297-(13.5+Math.floor(i/2)*90+4+75);
    content+=a(75)+' 0 0 '+a(75)+' '+a(x)+' '+a(y)+' cm /I'+(i+1)+' Do\n';
    // Matriz y estado independientes por fotografía.
    if(i!==5)content+='Q\nq\n';
  }
  content+='Q\n';
  content+='q\n0 G\n0.20 w\n';
  const line=(x1,y1,x2,y2)=>{
    content+=a(x1)+' '+a(297-y1)+' m '+a(x2)+' '+a(297-y2)+' l S\n';
  };
  for(const x of [20,105,190]){
    line(x,10, x,12.7);
    line(x,284.3, x,287);
  }
  for(const y of [13.5,103.5,193.5,283.5]){
    line(16.5,y,19.2,y);
    line(190.8,y,193.5,y);
  }
  content+='Q\n';
  ascii('%PDF-1.4\n');
  raw([37,255,255,255,255,10]);
  object(1,()=>ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2,()=>ascii('<< /Type /Pages /Count 1 /Kids [3 0 R] >>'));
  object(3,()=>ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+a(210)+' '+a(297)+']'+
    ' /Resources << /XObject << '+jpgs.map((_,i)=>'/I'+(i+1)+' '+(i+5)+' 0 R').join(' ')+
    ' >> >> /Contents 4 0 R >>'));
  object(4,()=>{
    ascii('<< /Length '+content.length+' >>\nstream\n');
    ascii(content);
    ascii('\nendstream');
  });
  jpgs.forEach((data,i)=>object(i+5,()=>{
    ascii('<< /Type /XObject /Subtype /Image /Width 886 /Height 886'+
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+data.length+
      ' >>\nstream\n');
    raw(data);
    ascii('\nendstream');
  }));
  const offset=bytes.length;
  ascii('xref\n0 11\n0000000000 65535 f \n');
  for(let i=1;i<=10;i++)ascii(String(xref[i]).padStart(10,'0')+' 00000 n \n');
  ascii('trailer\n<< /Size 11 /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF\n');
  return Utilities.newBlob(bytes,'application/pdf','POLAROIDS_A4_6_FOTOS_IMPRIMIR.pdf');
}
