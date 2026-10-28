/**
 * Recibo criptográfico de una sola verificación COMPLETA del PDF descargado
 * del Drive privado. El navegador solo transporta este objeto: NO lo crea,
 * NO puede cambiar medidas, páginas, SHA, precio ni pedido.
 * Sólo prueba privada sin pagos; no incluye sesiones GAS ni enlaces Drive.
 */
const HEX=/^[a-f0-9]{64}$/;
const DOC=/^DOC-[a-f0-9-]{36}$/i;
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const TTL_MS=15*60*1000;
const LABEL='SABER-PDF-VERIFICADO-CLOUDFLARE-V1\n';
const toHex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const fromHex=hex=>Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
function comprobarCuerpo(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).sort().join(',')!=='bytes,fileId,issuedAt,mode,name,orderId,pageMetrics,pages,receiptId,schema,sha256'||
   p.schema!=='saber-pdf-verificado-servidor-v1'||!DOC.test(p.receiptId||'')||
   !ORDER.test(p.orderId||'')||!FILE.test(p.fileId||'')||
   typeof p.name!=='string'||p.name.length<5||p.name.length>200||!/\.pdf$/i.test(p.name)||
   !['bn','color'].includes(p.mode)||!HEX.test(p.sha256||'')||
   !Number.isSafeInteger(p.bytes)||p.bytes<5||p.bytes>20*1024*1024||
   !Number.isSafeInteger(p.pages)||p.pages<1||p.pages>2000||
   !Number.isSafeInteger(p.issuedAt)||p.issuedAt<0||
   !Array.isArray(p.pageMetrics)||p.pageMetrics.length!==p.pages)return false;
 return p.pageMetrics.every(m=>m&&typeof m==='object'&&!Array.isArray(m)&&
   Object.keys(m).sort().join(',')==='altoCm,anchoCm,modo'&&
   Number.isFinite(m.anchoCm)&&Number.isFinite(m.altoCm)&&
   m.anchoCm>0&&m.altoCm>0&&m.anchoCm<=2000&&m.altoCm<=2000&&
   m.modo==='sin-clasificar');
}
async function claveSecreta(secret,subtle){
 if(typeof secret!=='string'||secret.length<32)
  throw Error('Clave privada para comprobante no configurada.');
 return subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function crearComprobantePdf({recibo,medidas,secret,now=Date.now(),subtle=crypto.subtle}){
 if(!recibo||recibo.ok!==true||recibo.status!=='verified'||
   recibo.verified!==true||recibo.storageVerified!==true||
   recibo.pageVerification!=='server'||recibo.paymentAuthorized!==false)
  throw Error('No se puede sellar un PDF no verificado.');
 const cuerpo={
  schema:'saber-pdf-verificado-servidor-v1',
  orderId:recibo.orderId,fileId:recibo.fileId,receiptId:recibo.receiptId,
  name:recibo.name,mode:recibo.mode,bytes:recibo.bytes,sha256:recibo.sha256,
  pages:recibo.pages,
  pageMetrics:medidas?.map(m=>({anchoCm:m.anchoCm,altoCm:m.altoCm,modo:m.modo})),
  issuedAt:now
 };
 if(!comprobarCuerpo(cuerpo))throw Error('Medidas o recibo incompletos: no se sella el PDF.');
 const key=await claveSecreta(secret,subtle);
 const body=new TextEncoder().encode(LABEL+JSON.stringify(cuerpo));
 const mac=toHex(new Uint8Array(await subtle.sign('HMAC',key,body)));
 return Object.freeze({payload:cuerpo,mac});
}
export async function comprobarComprobantePdf({
 comprobante,secret,now=Date.now(),subtle=crypto.subtle
}){
 if(!comprobante||typeof comprobante!=='object'||Array.isArray(comprobante)||
    Object.keys(comprobante).sort().join(',')!=='mac,payload'||!HEX.test(comprobante.mac||'')||
    !comprobarCuerpo(comprobante.payload))
  throw Error('Comprobante PDF inválido.');
 const p=comprobante.payload;
 if(now<p.issuedAt-60000||now-p.issuedAt>TTL_MS)
  throw Error('Comprobante vencido; se debe volver a comprobar el PDF en servidor.');
 const key=await claveSecreta(secret,subtle);
 const body=new TextEncoder().encode(LABEL+JSON.stringify(p));
 if(!(await subtle.verify('HMAC',key,fromHex(comprobante.mac),body)))
  throw Error('Comprobante PDF alterado.');
 return p;
}
