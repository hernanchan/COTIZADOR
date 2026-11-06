/**
 * Lectura parcial, privada y acotada de originales R2 grandes.
 *
 * Adaptador para motores PDF de lectura aleatoria/rangos.
 * NO declara páginas verificadas ni autoriza precio/pagos.
 *
 * Verifica el vínculo D1 -> (objeto, tamaño, ETag) antes de entregar bytes.
 * Cada lectura de R2 es condicional al ETag de D1 y respeta un presupuesto
 * acumulado (bytes solicitados + número de rangos) para limitar memoria/costo.
 *
 * No se expone ninguna ruta HTTP; exclusivo de uso interno.
 */
const MAX_FILE_BYTES=256*1024*1024;
const MAX_READ_BYTES=2*1024*1024;
const MAX_TOTAL_READ_BYTES=64*1024*1024;
const MAX_REQUESTS=128;
const MIN_FILE_BYTES=40*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^r2-v1\/(WEB-[A-Za-z0-9_-]{5,80})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const ID=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const R2_RANGE_LIMITS=Object.freeze({
 maxFileBytes:MAX_FILE_BYTES,maxReadBytes:MAX_READ_BYTES,
 maxTotalReadBytes:MAX_TOTAL_READ_BYTES,maxRequests:MAX_REQUESTS
});
export function verificarReferenciaR2ParaRangos(entry){
 if(!entry||typeof entry!=='object'||
  typeof entry.webOrderId!=='string'||typeof entry.receiptId!=='string'||
  !ID.test(entry.receiptId)||!SHA.test(entry.sha256||'')||
  !Number.isSafeInteger(entry.bytes)||entry.bytes<=MIN_FILE_BYTES||
  entry.bytes>MAX_FILE_BYTES||
  typeof entry.etag!=='string'||
  !/^[a-zA-Z0-9:"_-]{8,256}$/.test(entry.etag)||
  entry.status!=='awaiting_pdf_analysis'||
  entry.contenidoPdfVerificado!==false||entry.registeredInD1!==false||
  entry.paymentAuthorized!==false)throw Error('R2_RANGE_REFERENCIA_NO_ADMITIDA');
 const m=KEY.exec(entry.objectKey||'');
 if(!m||m[1]!==entry.webOrderId||
   ('DOC-'+m[2]).toLowerCase()!==entry.receiptId.toLowerCase())
  throw Error('R2_RANGE_OBJETO_AJENO');
 return entry;
}
async function leerExacto(stream,expected){
 if(!(stream instanceof ReadableStream))throw Error('R2_RANGE_STREAM_NO_DISPONIBLE');
 const reader=stream.getReader();
 let received=0;
 const result=new Uint8Array(expected);
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array)||value.byteLength===0||
    received+value.byteLength>expected)throw Error('R2_RANGE_EXCESO_DE_BYTES');
   result.set(value,received);received+=value.byteLength;
  }
 }catch(error){
  try{await reader.cancel('R2_RANGE_LECTURA_INTERRUPCION')}catch{}
  throw error;
 }finally{reader.releaseLock()}
 if(received!==expected)throw Error('R2_RANGE_LECTURA_INCOMPLETA');
 return result;
}
/** Un reader por solicitud (no compartir entre órdenes ni sesiones). */
export async function abrirRangosR2Privados({bucket,entry}={}){
 verificarReferenciaR2ParaRangos(entry);
 if(typeof bucket?.head!=='function'||typeof bucket?.get!=='function')
  throw Error('R2_RANGE_BUCKET_NO_CONFIGURADO');
 const head=await bucket.head(entry.objectKey);
 if(!head||head.size!==entry.bytes||head.etag!==entry.etag)
  throw Error('R2_RANGE_OBJETO_DISTINTO_DE_D1');
 let calls=0,requested=0;
 return Object.freeze({
  bytes:entry.bytes,
  maxReadBytes:MAX_READ_BYTES,
  get budget(){return MAX_TOTAL_READ_BYTES-requested},
  get requests(){return calls},
  async leer(offset,length){
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||
    offset<0||length<1||length>MAX_READ_BYTES||
    offset+length>entry.bytes)throw Error('R2_RANGE_FUERA_DE_RANGO');
   if(calls>=MAX_REQUESTS||requested+length>MAX_TOTAL_READ_BYTES)
    throw Error('R2_RANGE_PRESUPUESTO_AGOTADO');
   // Contabilizar antes de la operación, incluso si R2 falla o se interrumpe.
   calls++;requested+=length;
   const object=await bucket.get(entry.objectKey,{
    onlyIf:{etagMatches:entry.etag},range:{offset,length}
   });
   if(!object||object.etag!==entry.etag||object.size!==entry.bytes)
    throw Error('R2_RANGE_OBJETO_CAMBIO');
   return leerExacto(object.body,length);
  },
  async leerInicio(length=65536){
   return this.leer(0,length);
  },
  async leerFinal(length=65536){
   if(!Number.isSafeInteger(length)||length<1||length>entry.bytes)
    throw Error('R2_RANGE_COLA_INVALIDA');
   return this.leer(entry.bytes-length,length);
  }
 });
}
