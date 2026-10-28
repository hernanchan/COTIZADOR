/** Lectura de PDF privado por fragmentos del receptor GAS FASE 4.
 * `consultarFirmado` sólo puede usar HMAC backend, nunca fetch directo del cliente.
 * No revela tokens, claves de subida ni URLs de Google.
 */
const HEX=/^[a-f0-9]{64}$/;
const RECIBO=/^DOC-[a-f0-9-]{36}$/i;
const bytesHex=data=>Array.from(data,n=>n.toString(16).padStart(2,'0')).join('');
export async function leerPdfFase4Privado({
 session,receiptId,bytes,sha256,consultarFirmado,
 chunkBytes=256*1024,maxFileBytes=1024*1024,subtle=crypto.subtle
}){
 if(!session||!RECIBO.test(session.uploadId||'')||
    typeof session.token!=='string'||session.token.length<16||session.token.length>256||
    session.uploadId!==receiptId||!RECIBO.test(receiptId||'')||
    ![1024*1024,20*1024*1024].includes(maxFileBytes)||
    !Number.isSafeInteger(bytes)||bytes<5||bytes>maxFileBytes||
    !HEX.test(sha256||'')||chunkBytes!==256*1024||
    typeof consultarFirmado!=='function')
  throw Error('Lectura privada no autorizada.');
 const full=new Uint8Array(bytes);
 // Las lecturas de fragmentos son autenticadas e independientes y GAS las
 // ejecuta sin el lock de escritura. Tres en paralelo como máximo evita
 // una espera serial por cada ida a Google, sin saturar las cuotas.
 // Cada fragmento valida offset, longitud, recibo y SHA antes de copiarse.
 const offsets=Array.from({length:Math.ceil(bytes/chunkBytes)},(_,i)=>i*chunkBytes);
 let siguiente=0;
 async function lector(){
  while(siguiente<offsets.length){
   const offset=offsets[siguiente++];
   const part=await consultarFirmado({op:'multiReadPart',
    uploadId:session.uploadId,token:session.token,receiptId,offset});
   const length=Math.min(chunkBytes,bytes-offset);
   if(!part||part.ok!==true||part.receiptId!==receiptId||
      part.offset!==offset||part.length!==length||part.bytes!==bytes||
      part.sha256!==sha256||!HEX.test(part.chunkSha256||'')||
      typeof part.dataBase64!=='string'||part.dataBase64.length>380000)
    throw Error('El receptor no confirmó el fragmento esperado.');
   let raw;
   try{raw=atob(part.dataBase64)}catch(_){throw Error('Fragmento de Google no legible.');}
   if(raw.length!==length)throw Error('Tamaño de fragmento inconsistente.');
   const fragment=Uint8Array.from(raw,ch=>ch.charCodeAt(0));
   const checksum=bytesHex(new Uint8Array(await subtle.digest('SHA-256',fragment)));
   if(checksum!==part.chunkSha256)throw Error('El fragmento tiene hash incorrecto.');
   full.set(fragment,offset);
  }
 }
 await Promise.all(Array.from({length:Math.min(3,offsets.length)},()=>lector()));
 const actual=bytesHex(new Uint8Array(await subtle.digest('SHA-256',full)));
 if(actual!==sha256)throw Error('El PDF reconstruido difiere del recibo.');
 return full;
}
