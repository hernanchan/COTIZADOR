/**
 * Recepción pública de POLAROIDS — BORRADOR SIN IMPLEMENTAR.
 * PROYECTO INDEPENDIENTE del piloto privado para no exponer funciones del panel.
 *
 * Propiedades secretas (NUNCA en GitHub):
 * PUBLIC_ENABLED=no                   (apagado por defecto)
 * RECEIPT_FOLDER_ID=<folder ID privado>
 * TURNSTILE_SECRET=<clave privada Cloudflare>
 * TURNSTILE_HOSTNAME=<host exacto de Pages>
 *
 * El script solo se habilitará con revisión, aprobación expresa
 * y prueba controlada de accesos anónimos. Sin secretos = sin recepción.
 */
const PUBLIC_MAX_BYTES=5*1024*1024;
const PUBLIC_MAX_SHEETS=10;     // 1 a 10 hojas A4, 6 Polaroids por hoja
const PUBLIC_MAX_ORDERS_DAY=8;
const PUBLIC_MAX_FILES_DAY=240; // fotos diarias, en originales + recortes
const PUBLIC_MAX_DAILY_MB=250;
const PUBLIC_TTL_MS=24*60*60*1000;

/**
 * Bridge de comunicación iframe. Solo se usa si PUBLIC_ENABLED=yes y
 * TURNSTILE_HOSTNAME es un hostname exacto bajo nuestro control.
 * El puente nunca devuelve URL de Drive ni expone funciones de administración.
 */
/**
 * API sin iframe, para navegadores que bloquean X-Frame-Options de Apps Script.
 * GET status es estrictamente read-only. Usa JSONP sin datos sensibles.
 * POST se autentica al iniciar con Turnstile y en cada operación con uploadKey.
 */
function jsonpStatus_(e){
 const q=e&&e.parameter||{};
 const callback=String(q.callback||'');
 if(!/^saberStatus_[a-f0-9]{32}$/.test(callback))
  return ContentService.createTextOutput('Callback inválido.');
 let result;
 try{
  const c=privateConfig_();
  if(q.api==='ping'){
   result={ok:true,apiVersion:'v2-noframe'};
   return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  reference_(String(q.reference||''));
  const key=String(q.uploadKey||'');
  const raw=c.p.getProperty('PUBLIC_ORDER_'+q.reference);
  if(!raw){
   result={ok:true,found:false};
  }else{
   const st=orderState_(c.p,q.reference,key);
   const total=st.photoCount||st.sheets*6;
   result={ok:true,found:true,status:st.status,received:Object.keys(st.photos).length,
     photos:total,sheets:st.sheets};
  }
 }catch(ex){
  result={ok:false,error:'La consulta de recepción no pudo validarse.'};
 }
 return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');')
  .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e){
 let result='OK';
 try{
  if(!e||!e.postData||!e.postData.contents||
     e.postData.contents.length>18*1024*1024)
   throw new Error('Solicitud demasiado grande.');
  const req=JSON.parse(e.postData.contents);
  if(!req||typeof req!=='object')throw new Error('Solicitud inválida.');
  const data=req.payload;
  if(req.op==='start')startPublicOrder(data);
  else if(req.op==='photo')uploadPublicPhoto(data);
  else if(req.op==='finish')finishPublicOrder(data.reference,data.uploadKey);
  else throw new Error('Operación no admitida.');
 }catch(ex){result='ERROR';}
 // El navegador no lee esta respuesta cross-origin; confirma con GET status.
 return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
}
function doGet(e){
 if(e&&e.parameter&&['status','ping'].includes(e.parameter.api))
  return jsonpStatus_(e);

 const p=PropertiesService.getScriptProperties();
 if(p.getProperty('PUBLIC_ENABLED')!=='yes')
   return HtmlService.createHtmlOutput('Recepción de clientes deshabilitada.');
 const nonce=String(e&&e.parameter&&e.parameter.bridgeNonce||'');
 if(!/^[a-f0-9]{32}$/.test(nonce))
   return HtmlService.createHtmlOutput('Falta identificador seguro del editor.');
 const c=privateConfig_();
 const tpl=HtmlService.createTemplateFromFile('Bridge');
 tpl.parentOrigin='https://'+c.hostname;
 tpl.bridgeNonce=nonce;
 return tpl.evaluate()
   .setTitle('Librería Saber — Recepción protegida de Polaroids')
   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function privateConfig_(){
 const p=PropertiesService.getScriptProperties();
 if(p.getProperty('PUBLIC_ENABLED')!=='yes')
   throw new Error('La recepción pública no está habilitada.');
 const id=p.getProperty('RECEIPT_FOLDER_ID'),
       secret=p.getProperty('TURNSTILE_SECRET'),
       hostname=p.getProperty('TURNSTILE_HOSTNAME');
 if(!id||!secret||!hostname||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(hostname))
   throw new Error('La recepción pública no está configurada.');
 const root=DriveApp.getFolderById(id);
 if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)
   throw new Error('La carpeta de trabajo debe ser privada.');
 return {p,root,secret,hostname};
}
function reference_(str){
 if(typeof str!=='string'||!/^POL-[A-F0-9]{24}$/.test(str))
   throw new Error('Referencia de pedido inválida.');
 return str;
}
function secretHash_(secret){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/i.test(secret))
   throw new Error('Clave privada de carga inválida.');
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,secret)
   .map(n=>(n&255).toString(16).padStart(2,'0')).join('');
}
function orderState_(p,ref,key){
 reference_(ref);
 const raw=p.getProperty('PUBLIC_ORDER_'+ref);
 if(!raw)throw new Error('Pedido de prueba no encontrado.');
 const st=JSON.parse(raw);
 if(st.secretHash!==secretHash_(key))throw new Error('Clave privada de carga incorrecta.');
 if(Date.now()-st.created>PUBLIC_TTL_MS)
   throw new Error('La recepción caducó, iniciá otra solicitud.');
 return st;
}
function verifyChallenge_(token,secret,hostname){
 if(typeof token!=='string'||token.length<10||token.length>2048)
   throw new Error('Falta validar la seguridad del formulario.');
 const res=UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'post',
   payload:{secret,response:token},
   contentType:'application/x-www-form-urlencoded',
   muteHttpExceptions:true
 });
 if(res.getResponseCode()!==200)throw new Error('No se pudo verificar el desafío.');
 const out=JSON.parse(res.getContentText());
 if(out.success!==true||out.hostname!==hostname||out.action!=='polaroids')
   throw new Error('No se pudo validar el desafío antiabuso.');
}
function usageDay_(p){
 const day=Utilities.formatDate(new Date(),'Etc/UTC','yyyyMMdd');
 const k='PUBLIC_USAGE_'+day;
 const prev=JSON.parse(p.getProperty(k)||'{"orders":0,"files":0,"bytes":0}');
 return {key:k,value:prev};
}

function pruneOrderStates_(p) {
 // Evitar llenar la cuota de 500 KB de PropertiesService con trabajos viejos.
 // Solo retira el estado técnico, no borra carpetas ni fotos de clientes.
 const now=Date.now(), props=p.getProperties();
 Object.keys(props).forEach(k=>{
   if(!k.startsWith('PUBLIC_ORDER_'))return;
   try{
     const st=JSON.parse(props[k]);
     if(!Number.isFinite(st.created)||now-st.created>14*24*60*60*1000)
       p.deleteProperty(k);
   }catch(e){p.deleteProperty(k);}
 });
}

function makeRandomHex_(bytes){
 // UUID se genera mediante el servicio de Google; nunca Math.random para claves.
 let text='';
 while(text.length<bytes*2)text+=Utilities.getUuid().replace(/-/g,'');
 return text.slice(0,bytes*2).toLowerCase();
}
function startPublicOrder(input){
 const c=privateConfig_();
 const sheetCount=Number(input&&input.sheets),photoCount=Number(input&&input.photos);
 const clientRef=String(input&&input.reference||''),clientKey=String(input&&input.uploadKey||'');
 reference_(clientRef);
 if(!/^[a-f0-9]{64}$/.test(clientKey))throw new Error('Clave de pedido inválida.');
 if(!Number.isInteger(photoCount)||photoCount<1||photoCount>PUBLIC_MAX_SHEETS*6||
    !Number.isInteger(sheetCount)||sheetCount!==Math.ceil(photoCount/6))
   throw new Error('Podés enviar entre 1 y 60 fotos, en hasta diez hojas A4.');
 const existing=c.p.getProperty('PUBLIC_ORDER_'+clientRef);
 if(existing){
  const st=orderState_(c.p,clientRef,clientKey);
  if(st.sheets!==sheetCount||st.photoCount!==photoCount)
   throw new Error('Los datos no coinciden con el pedido existente.');
  return {reference:clientRef,uploadKey:clientKey,maxFiles:photoCount,
    sheets:sheetCount,photos:photoCount,alreadyReceived:true};
 }
 verifyChallenge_(input.turnstileToken,c.secret,c.hostname);
 const lock=LockService.getScriptLock();lock.waitLock(12000);
 try {
   pruneOrderStates_(c.p);
   const day=usageDay_(c.p);
   if(day.value.orders>=PUBLIC_MAX_ORDERS_DAY)
     throw new Error('Cupo diario de recepción completo. Contactanos por WhatsApp.');
   const ref=clientRef,key=clientKey;
   if(c.p.getProperty('PUBLIC_ORDER_'+ref)){
    const st=orderState_(c.p,ref,key);
    if(st.sheets!==sheetCount||st.photoCount!==photoCount)
     throw new Error('Datos inconsistentes en pedido repetido.');
    return {reference:ref,uploadKey:key,maxFiles:photoCount,sheets:sheetCount,
      photos:photoCount,alreadyReceived:true};
   }
   const folder=c.root.createFolder('PEDIDO_'+ref);
   // Las carpetas hijas de un directorio privado deben continuar restringidas.
   if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE) {
     folder.setTrashed(true);
     throw new Error('El directorio creado no es privado; se rechazó la recepción.');
   }
   const st={created:Date.now(),folderId:folder.getId(),secretHash:secretHash_(key),
     photos:{},status:'receiving',sheets:sheetCount,photoCount:photoCount};
   c.p.setProperty('PUBLIC_ORDER_'+ref,JSON.stringify(st));
   day.value.orders++;
   c.p.setProperty(day.key,JSON.stringify(day.value));
   // Clave solo al mismo navegador. No se incorpora a WhatsApp.
   return {reference:ref,uploadKey:key,maxFiles:photoCount,sheets:sheetCount,photos:photoCount};
 }finally{lock.releaseLock();}
}
function checkedJpeg_(bytes) {
 const dim=jpegDimensions_(bytes);
 if(dim.width!==886||dim.height!==886)
   throw new Error('El recorte no mide 886 × 886 píxeles.');
}
function rawFile_(encoded,limit,name){
 if(typeof encoded!=='string'||!encoded.length||
    encoded.length>Math.ceil(limit/3)*4+4||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
   throw new Error(name+' es inválido o excede el tamaño permitido.');
 const bytes=Utilities.base64Decode(encoded);
 if(!bytes.length||bytes.length>limit)throw new Error(name+' excede 5 MB.');
 return bytes;
}
function verifyCrop_(crop){
 if(!crop||![crop.x,crop.y,crop.s,crop.sourceWidth,crop.sourceHeight]
   .every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('Encuadre inválido.');
 if(crop.sourceWidth<100||crop.sourceHeight<100||crop.s<=0||
    crop.x<0||crop.y<0||crop.x+crop.s>crop.sourceWidth+.01||
    crop.y+crop.s>crop.sourceHeight+.01)throw new Error('Encuadre fuera de límites.');
}
function uploadPublicPhoto(data){
 const c=privateConfig_();
 if(!data||!Number.isInteger(data.index)||data.index<0||data.index>=PUBLIC_MAX_SHEETS*6)
   throw new Error('Posición de foto incorrecta.');
 const original=rawFile_(data.original,PUBLIC_MAX_BYTES,'Original');
 const crop=rawFile_(data.printJpeg,PUBLIC_MAX_BYTES,'Recorte');
 const first=n=>original[n]&255;
 const jpg=original.length>3&&first(0)===255&&first(1)===216&&first(2)===255;
 const png=original.length>8&&[137,80,78,71,13,10,26,10].every((n,i)=>first(i)===n);
 if(!jpg&&!png)throw new Error('Solo fotografías JPG o PNG.');
 checkedJpeg_(crop);verifyCrop_(data.crop);
 const lock=LockService.getScriptLock();lock.waitLock(12000);
 try {
   const st=orderState_(c.p,data.reference,data.uploadKey);
   if(st.status!=='receiving')throw new Error('La carga ya fue finalizada.');
   if(data.index>=st.photoCount)
     throw new Error('Esta fotografía no pertenece al pedido.');
   // Reintento idempotente ante caída de red: no crear duplicados ni cobrar cuota.
   if(Object.prototype.hasOwnProperty.call(st.photos,data.index))
     return {received:Object.keys(st.photos).length,reference:data.reference,
       alreadyReceived:true};
   const day=usageDay_(c.p),sum=original.length+crop.length;
   if(day.value.files>=PUBLIC_MAX_FILES_DAY||
      day.value.bytes+sum>PUBLIC_MAX_DAILY_MB*1024*1024)
     throw new Error('Límite de recepción del día alcanzado.');
   const folder=DriveApp.getFolderById(st.folderId);
   const ext=jpg?'jpg':'png',number=data.index+1;
   const originalFile=folder.createFile(Utilities.newBlob(original,
     jpg?'image/jpeg':'image/png','FOTO_'+number+'.'+ext));
   const printFile=folder.createFile(Utilities.newBlob(crop,
     'image/jpeg','RECORTE_'+number+'_300DPI.jpg'));
   st.photos[data.index]={originalId:originalFile.getId(),
     croppedId:printFile.getId(),crop:data.crop};
   c.p.setProperty('PUBLIC_ORDER_'+data.reference,JSON.stringify(st));
   day.value.files++;day.value.bytes+=sum;
   c.p.setProperty(day.key,JSON.stringify(day.value));
   return {received:Object.keys(st.photos).length,reference:data.reference};
 }finally{lock.releaseLock();}
}
function finishPublicOrder(reference,uploadKey){
 const c=privateConfig_();
 const lock=LockService.getScriptLock();lock.waitLock(12000);
 try{
   const st=orderState_(c.p,reference,uploadKey);
   const expected=st.photoCount;
   if(st.status==='received')
     return {reference,received:true,sheets:st.sheets,photos:expected,alreadyReceived:true,
       message:'Las fotografías ya estaban recibidas.'};
   if(st.status!=='receiving')throw new Error('El pedido no está abierto.');
   if(Array.from({length:expected},(_,i)=>i).some(i=>!st.photos[i]))
     throw new Error('Faltan fotografías por recibir.');
   const folder=DriveApp.getFolderById(st.folderId);
   // Se crea un PDF por hoja para no superar la memoria de Apps Script
   // con 60 originales y un PDF grande. Retomar un cierre parcial no duplica PDFs.
   for(let sheet=0;sheet<st.sheets;sheet++){
     const name=st.sheets===1?'POLAROIDS_A4_'+expected+'_FOTOS_IMPRIMIR.pdf':
       'POLAROIDS_A4_HOJA_'+String(sheet+1).padStart(2,'0')+
       '_DE_'+String(st.sheets).padStart(2,'0')+'.pdf';
     const existing=folder.getFilesByName(name);
     if(existing.hasNext())continue;
     const jpgs=Array.from({length:Math.min(6,expected-sheet*6)},(_,i)=>
       DriveApp.getFileById(st.photos[sheet*6+i].croppedId).getBlob().getBytes());
     const pdf=crearPdfImprenta_(jpgs);
     pdf.setName(name);
     folder.createFile(pdf);
   }
   const metadataName='encuadres.json';
   if(!folder.getFilesByName(metadataName).hasNext()){
     folder.createFile(metadataName,JSON.stringify({
       reference,format:'85x90_6up_A4_v1.1',sheets:st.sheets,photosCount:expected,
       photos:Array.from({length:expected},(_,i)=>({
         sheet:Math.floor(i/6)+1,position:i%6+1,crop:st.photos[i].crop
       }))
     }),'application/json');
   }
   st.status='received';st.receivedAt=Date.now();
   c.p.setProperty('PUBLIC_ORDER_'+reference,JSON.stringify(st));
   return {reference,received:true,sheets:st.sheets,photos:expected,
     message:'Se recibieron todas las fotografías.'};
 }finally{lock.releaseLock();}
}

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
  if(!Array.isArray(jpgs)||jpgs.length<1||jpgs.length>6)
    throw new Error('Se requieren entre uno y seis recortes por hoja.');
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
  for(let i=0;i<jpgs.length;i++){
    const x=25+(i%2)*85;
    const y=297-(13.5+Math.floor(i/2)*90+4+75);
    content+=a(75)+' 0 0 '+a(75)+' '+a(x)+' '+a(y)+' cm /I'+(i+1)+' Do\n';
    // Matriz y estado independientes por fotografía.
    if(i!==jpgs.length-1)content+='Q\nq\n';
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
  ascii('xref\n0 '+(5+jpgs.length)+'\n0000000000 65535 f \n');
  for(let i=1;i<5+jpgs.length;i++)ascii(String(xref[i]).padStart(10,'0')+' 00000 n \n');
  ascii('trailer\n<< /Size '+(5+jpgs.length)+' /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF\n');
  return Utilities.newBlob(bytes,'application/pdf','POLAROIDS_A4_6_FOTOS_IMPRIMIR.pdf');
}

