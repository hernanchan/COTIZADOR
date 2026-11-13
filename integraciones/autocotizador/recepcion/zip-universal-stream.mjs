/**
 * ZIP32 STORE streaming for universal mixed PDF production.
 * Writes directly to File System Access without buffering up to ten 200-MiB
 * originals in the operator browser. No compression of PDF bytes.
 */
import {Sha256Incremental} from './sha256-pdf-local-fragmentos.mjs';
const MAGIC=new TextEncoder().encode('%PDF-');
const ZIP_MAX=2200*1048576;
const TABLE=(()=>{
 const t=new Uint32Array(256);
 for(let n=0;n<256;n++){
  let x=n;
  for(let k=0;k<8;k++)x=(x&1)?0xedb88320^(x>>>1):(x>>>1);
  t[n]=x>>>0;
 }
 return t;
})();
const number16=(v,off,n)=>v.setUint16(off,n,true);
const number32=(v,off,n)=>v.setUint32(off,n>>>0,true);
function safeName(name){
 if(typeof name!=='string'||!name||name.length>180||
    name.includes('..')||/[\/\\\x00-\x1f\x7f]/.test(name))
  throw Error('ZIP_UNIVERSAL_NOMBRE_INVALIDO');
 return new TextEncoder().encode(name);
}
const validOriginal=x=>x&&
 typeof x.open==='function'&&
 Number.isSafeInteger(x.expectedBytes)&&x.expectedBytes>=5&&
 x.expectedBytes<=200*1048576&&
 (x.expectedSha256===null||/^[a-f0-9]{64}$/.test(x.expectedSha256));
export async function escribirZipUniversal({entries,output,onProgress=()=>{},
 maxBytes=ZIP_MAX}={}){
 if(!Array.isArray(entries)||entries.length<2||entries.length>11||
    !output||typeof output.write!=='function'||typeof output.close!=='function'||
    typeof onProgress!=='function'||!Number.isSafeInteger(maxBytes)||
    maxBytes<1024*1024||maxBytes>ZIP_MAX)
  throw Error('ZIP_UNIVERSAL_CONFIGURACION');
 // Paquete de producción: 1-10 originales correlativos y SIEMPRE una hoja
 // de instrucciones, última entrada. Sin ella, no se genera ningún ZIP.
 const originals=entries.length-1;
 for(let i=0;i<originals;i++){
  if(entries[i]?.name!=='PDF_'+String(i+1).padStart(2,'0')+'.pdf'||
     !/^[a-f0-9]{64}$/.test(entries[i]?.expectedSha256||''))
   throw Error('ZIP_UNIVERSAL_ORIGINAL_FALTANTE');
 }
 if(!/^ORDEN_[0-9]{3,}_INSTRUCCIONES\.pdf$/.test(entries[originals]?.name||'')||
    entries[originals]?.expectedSha256!==null||
    entries[originals]?.expectedBytes<400)
  throw Error('ZIP_UNIVERSAL_INSTRUCCIONES_OBLIGATORIAS');
 const names=new Set();let totalExpected=0;
 const safeEntries=entries.map((x)=>{
  if(!validOriginal(x))throw Error('ZIP_UNIVERSAL_ENTRADA');
  const name=safeName(x.name);
  if(names.has(x.name))throw Error('ZIP_UNIVERSAL_DUPLICADO');
  names.add(x.name);totalExpected+=x.expectedBytes;
  return {...x,name};
 });
 if(totalExpected>maxBytes||totalExpected+entries.length*500>0xffffffff)
  throw Error('ZIP_UNIVERSAL_EXCEDE_LIMITE');
 let offset=0,done=0,complete=false;
 const central=[];
 const write=async data=>{
  await output.write(data);
  offset+=data.byteLength;
  if(offset>0xffffffff)throw Error('ZIP_UNIVERSAL_ZIP64_REQUERIDO');
 };
 try{
  for(let i=0;i<safeEntries.length;i++){
   const x=safeEntries[i],localOffset=offset;
   const local=new Uint8Array(30+x.name.byteLength),v=new DataView(local.buffer);
   number32(v,0,0x04034b50);number16(v,4,20);number16(v,6,0x0808);
   number16(v,8,0);number16(v,10,0);number16(v,12,0x0021);
   number16(v,26,x.name.byteLength);number16(v,28,0);
   local.set(x.name,30);await write(local);
   const stream=await x.open();
   if(!(stream instanceof ReadableStream))throw Error('ZIP_UNIVERSAL_ORIGINAL_AUSENTE');
   const reader=stream.getReader(),hasher=new Sha256Incremental();
   let crc=0xffffffff,read=0,first=new Uint8Array(5),firstCount=0;
   try{
    while(true){
     const {done:finished,value}=await reader.read();
     if(finished)break;
     if(!(value instanceof Uint8Array)||value.byteLength<1||
        read+value.byteLength>x.expectedBytes)
      throw Error('ZIP_UNIVERSAL_TRANSFERENCIA_INVALIDA');
     if(firstCount<5){
      const length=Math.min(5-firstCount,value.length);
      first.set(value.subarray(0,length),firstCount);firstCount+=length;
     }
     hasher.update(value);
     for(const b of value)crc=TABLE[(crc^b)&255]^(crc>>>8);
     await write(value);
     read+=value.length;
     onProgress({file:i+1,count:entries.length,bytes:done+read,totalBytes:totalExpected});
    }
   }finally{reader.releaseLock()}
   if(read!==x.expectedBytes||firstCount!==5||
      first.some((b,k)=>b!==MAGIC[k]))
    throw Error('ZIP_UNIVERSAL_PDF_INCOMPLETO');
   if(x.expectedSha256&&hasher.digestHex()!==x.expectedSha256)
    throw Error('ZIP_UNIVERSAL_SHA_DISTINTO');
   const finalCRC=(crc^0xffffffff)>>>0;
   const desc=new Uint8Array(16),dv=new DataView(desc.buffer);
   number32(dv,0,0x08074b50);number32(dv,4,finalCRC);
   number32(dv,8,read);number32(dv,12,read);await write(desc);
   const c=new Uint8Array(46+x.name.byteLength),cv=new DataView(c.buffer);
   number32(cv,0,0x02014b50);number16(cv,4,20);number16(cv,6,20);
   number16(cv,8,0x0808);number16(cv,10,0);number16(cv,12,0);
   number16(cv,14,0x0021);number32(cv,16,finalCRC);
   number32(cv,20,read);number32(cv,24,read);
   number16(cv,28,x.name.byteLength);number16(cv,30,0);number16(cv,32,0);
   number16(cv,34,0);number16(cv,36,0);number32(cv,38,0);
   number32(cv,42,localOffset);c.set(x.name,46);central.push(c);
   done+=read;
  }
  const centralOffset=offset;
  for(const c of central)await write(c);
  const end=new Uint8Array(22),v=new DataView(end.buffer);
  number32(v,0,0x06054b50);number16(v,4,0);number16(v,6,0);
  number16(v,8,entries.length);number16(v,10,entries.length);
  number32(v,12,offset-centralOffset);number32(v,16,centralOffset);
  number16(v,20,0);await write(end);
  await output.close();complete=true;
  return {ok:true,files:entries.length,originalBytes:done,zipBytes:offset};
 }catch(err){
  if(!complete&&typeof output.abort==='function')
   await output.abort().catch(()=>{});
  throw err;
 }
}
