/**
 * Contrato de recepción TUS por documento — prueba privada V1.
 *
 * No contiene claves ni conoce la web comercial. El Worker de ensayo
 * firma autorizaciones limitadas a un archivo/orden; Supabase almacena bytes
 * privados que siempre se verifican DE NUEVO antes del precio o D1.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const MAX_FILE=20*1024*1024;
const MAX_BATCH=60*1024*1024;
export const TUS_LIMITS=Object.freeze({maxFileBytes:MAX_FILE,maxBatchBytes:MAX_BATCH,maxFiles:10});
const b64url=u8=>{
 let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode(...u8.subarray(i,i+8192));
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const from64url=s=>{
 if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Comprobante TUS inválido.');
 const decoded=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
};
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>isRecord(x)&&Object.keys(x).sort().join(',')===allowed.slice().sort().join(',');
export function validarMetasTUS({orderId,metas}){
 if(!ORDER.test(orderId||'')||!Array.isArray(metas)||metas.length<1||metas.length>10)
  throw Error('Tanda TUS no autorizada.');
 const ids=new Set();let bytesTotal=0;
 const accepted=metas.map(m=>{
  if(!keys(m,['fileId','name','mode','bytes','sha256','pages'])||
   !FILE.test(m.fileId||'')||ids.has(m.fileId)||
   typeof m.name!=='string'||m.name.length<1||m.name.length>120||!/\.pdf$/i.test(m.name)||
   !['bn','color'].includes(m.mode)||
   !Number.isSafeInteger(m.bytes)||m.bytes<5||m.bytes>MAX_FILE||
   !SHA.test(m.sha256||'')||!Number.isSafeInteger(m.pages)||m.pages<1||m.pages>2000)
   throw Error('Metadatos del PDF o modo no admitidos para TUS.');
  ids.add(m.fileId);bytesTotal+=m.bytes;
  return Object.freeze({fileId:m.fileId,name:m.name,mode:m.mode,
   bytes:m.bytes,sha256:m.sha256,pages:m.pages});
 });
 if(bytesTotal>MAX_BATCH)throw Error('La tanda supera el límite de 60 MiB.');
 return Object.freeze({orderId,metas:Object.freeze(accepted),bytesTotal});
}
async function macBytes(value,secret,subtle){
 if(typeof secret!=='string'||secret.length<32)
  throw Error('Clave privada TUS no configurada.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}
export async function firmarReciboTUS(claim,{secret,subtle=crypto.subtle}={}){
 validarClaimTUS(claim);
 const text=JSON.stringify(claim),encoded=b64url(new TextEncoder().encode(text));
 const proof=b64url(await macBytes('saber-tus-v1\n'+encoded,secret,subtle));
 return encoded+'.'+proof;
}
export function validarClaimTUS(c){
 if(!keys(c,['v','orderId','fileId','receiptId','name','mode','bytes','sha256','pages','objectName','issuedAt','expiresAt'])||
    c.v!==1||!ORDER.test(c.orderId||'')||!FILE.test(c.fileId||'')||
    !RECEIPT.test(c.receiptId||'')||
    typeof c.name!=='string'||c.name.length<1||c.name.length>120||!/\.pdf$/i.test(c.name)||
    !['bn','color'].includes(c.mode)||!SHA.test(c.sha256||'')||
    !Number.isSafeInteger(c.bytes)||c.bytes<5||c.bytes>MAX_FILE||
    !Number.isSafeInteger(c.pages)||c.pages<1||c.pages>2000||
    !Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||
    c.expiresAt-c.issuedAt<1||c.expiresAt-c.issuedAt>3600||
    typeof c.objectName!=='string'||
    c.objectName!==('v2/'+c.orderId+'/'+c.receiptId.slice(4)+'.pdf'))
  throw Error('Comprobante de un PDF TUS inválido.');
 return c;
}
export async function leerReciboTUS(token,{secret,ahora=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle}={}){
 if(typeof token!=='string'||token.length>2048||token.length<40||
    token.split('.').length!==2)throw Error('Comprobante de sesión TUS inválido.');
 const [encoded,expected]=token.split('.');
 let c;
 try{c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(from64url(encoded)));}
 catch{throw Error('Comprobante de sesión TUS ilegible.');}
 validarClaimTUS(c);
 // Re-serializar con orden estable: rechaza duplicación de claves, extrañas
 // o codificaciones que no coincidan con los datos realmente firmados.
 if(b64url(new TextEncoder().encode(JSON.stringify(c)))!==encoded)
  throw Error('Comprobante de sesión TUS no canónico.');
 const actual=b64url(await macBytes('saber-tus-v1\n'+encoded,secret,subtle));
 const a=actual,b=expected;let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 if(diff!==0)throw Error('Firma del comprobante TUS incorrecta.');
 const now=ahora();
 if(!Number.isSafeInteger(now)||now<c.issuedAt-60||now>c.expiresAt)
  throw Error('Comprobante TUS vencido.');
 return Object.freeze(c);
}
export async function crearTandaTUS({
 orderId,metas,secret,firmarSubida,uuid=()=>crypto.randomUUID(),
 ahora=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle,
}={}){
 const valid=validarMetasTUS({orderId,metas});
 if(typeof firmarSubida!=='function'||typeof uuid!=='function')
  throw Error('Almacenamiento TUS privado ausente.');
 const issuedAt=ahora();
 if(!Number.isSafeInteger(issuedAt))
  throw Error('Sesión de pedido inválida.');
 const sessions=[];
 for(const m of valid.metas){
  const receiptUUID=uuid();
  if(!UUID.test(receiptUUID))
   throw Error('Identificador de archivo incorrecto.');
  const receiptId='DOC-'+receiptUUID;
  // Ruta determinista a partir de un recibo guardado en D1. El bucket es privado.
  const objectName='v2/'+orderId+'/'+receiptUUID+'.pdf';
  const claim={v:1,orderId,fileId:m.fileId,receiptId,name:m.name,mode:m.mode,
   bytes:m.bytes,sha256:m.sha256,pages:m.pages,objectName,
   issuedAt,expiresAt:issuedAt+1800};
  const signature=await firmarSubida(objectName);
  if(typeof signature!=='string'||signature.length<12||signature.length>512)
   throw Error('El almacenamiento no autorizó el PDF.');
  const proof=await firmarReciboTUS(claim,{secret,subtle});
  sessions.push(Object.freeze({
   receiptId,fileId:m.fileId,objectName,signature,proof,
   bytes:m.bytes,pages:m.pages,
  }));
 }
 return Object.freeze({orderId,totalFiles:sessions.length,
  totalBytes:valid.bytesTotal,sessions:Object.freeze(sessions),
  checkoutEnabled:false,paymentAuthorized:false});
}
export async function validarLoteFirmadoTUS({
 orderId,entries,secret,ahora,subtle=crypto.subtle
}={}){
 if(!ORDER.test(orderId||'')||!Array.isArray(entries)||entries.length<1||entries.length>10)
  throw Error('Pedido TUS incompleto.');
 const ids=new Set(),receipts=new Set(),objects=new Set(),rows=[];let totalBytes=0;
 for(const e of entries){
  if(!keys(e,['proof','opciones'])||!isRecord(e.opciones))
   throw Error('Documento TUS sin opciones.');
  const c=await leerReciboTUS(e.proof,{secret,ahora,subtle});
  if(c.orderId!==orderId||ids.has(c.fileId)||receipts.has(c.receiptId)||objects.has(c.objectName))
   throw Error('PDF repetido o perteneciente a otro pedido.');
  ids.add(c.fileId);receipts.add(c.receiptId);objects.add(c.objectName);
  totalBytes+=c.bytes;
  rows.push(Object.freeze({...c,opciones:e.opciones}));
 }
 if(totalBytes>MAX_BATCH)throw Error('La recepción supera 60 MiB.');
 return Object.freeze(rows);
}
