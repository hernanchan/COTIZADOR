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
const PUBLIC_MAX_SHEETS=1;     // MVP seguro: una hoja, 6 Polaroids
const PUBLIC_MAX_ORDERS_DAY=8;
const PUBLIC_MAX_FILES_DAY=48; // 6 fotos/orden, con originales y recortes
const PUBLIC_MAX_DAILY_MB=250;
const PUBLIC_TTL_MS=24*60*60*1000;

/**
 * Bridge de comunicación iframe. Solo se usa si PUBLIC_ENABLED=yes y
 * TURNSTILE_HOSTNAME es un hostname exacto bajo nuestro control.
 * El puente nunca devuelve URL de Drive ni expone funciones de administración.
 */
function doGet(e){
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
 if(!input||Number(input.sheets)!==PUBLIC_MAX_SHEETS)
   throw new Error('La versión piloto admite una hoja de seis Polaroids.');
 verifyChallenge_(input.turnstileToken,c.secret,c.hostname);
 const lock=LockService.getScriptLock();lock.waitLock(12000);
 try {
   pruneOrderStates_(c.p);
   const day=usageDay_(c.p);
   if(day.value.orders>=PUBLIC_MAX_ORDERS_DAY)
     throw new Error('Cupo diario de recepción completo. Contactanos por WhatsApp.');
   const ref='POL-'+makeRandomHex_(12).toUpperCase();
   const key=makeRandomHex_(32);
   const folder=c.root.createFolder('PEDIDO_'+ref);
   // Las carpetas hijas de un directorio privado deben continuar restringidas.
   if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE) {
     folder.setTrashed(true);
     throw new Error('El directorio creado no es privado; se rechazó la recepción.');
   }
   const st={created:Date.now(),folderId:folder.getId(),secretHash:secretHash_(key),
     photos:{},status:'receiving',sheets:1};
   c.p.setProperty('PUBLIC_ORDER_'+ref,JSON.stringify(st));
   day.value.orders++;
   c.p.setProperty(day.key,JSON.stringify(day.value));
   // Clave solo al mismo navegador. No se incorpora a WhatsApp.
   return {reference:ref,uploadKey:key,maxFiles:6};
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
 if(!data||!Number.isInteger(data.index)||data.index<0||data.index>=6)
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
   if(Object.prototype.hasOwnProperty.call(st.photos,data.index))
     throw new Error('La foto ya está recibida.');
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
   if(st.status!=='receiving')throw new Error('El pedido ya está cerrado.');
   if([0,1,2,3,4,5].some(i=>!st.photos[i]))
     throw new Error('Faltan fotografías por recibir.');
   const bytes=[0,1,2,3,4,5].map(i=>
     DriveApp.getFileById(st.photos[i].croppedId).getBlob().getBytes());
   const folder=DriveApp.getFolderById(st.folderId);
   folder.createFile(crearPdfImprenta_(bytes));
   folder.createFile('encuadres.json',JSON.stringify({
     format:'85x90_6up_A4_v1.1',
     photos:[0,1,2,3,4,5].map(i=>st.photos[i].crop)
   }),'application/json');
   st.status='received';st.receivedAt=Date.now();
   c.p.setProperty('PUBLIC_ORDER_'+reference,JSON.stringify(st));
   return {reference,received:true,sheets:1,photos:6,
     message:'Se recibieron las seis fotografías.'};
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

