/**
 * SHA-256 incremental en navegador: permite identificar PDF de 150 MiB sin
 * file.arrayBuffer() completo ni subir nada a R2. Usa bloques de 1 MiB máximo.
 * Algoritmo SHA-256 FIPS 180-4, verificado contra node:crypto en CI.
 */
const K=new Uint32Array([
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
export class Sha256Incremental{
 constructor(){
  this.h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
   0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  this.block=new Uint8Array(64);
  this.words=new Uint32Array(64);
  this.used=0;this.bytes=0;this.finished=false;
 }
 compress(){
  const b=this.block,w=this.words,h=this.h;
  for(let n=0;n<16;n++){const i=n*4;
   w[n]=((b[i]<<24)|(b[i+1]<<16)|(b[i+2]<<8)|b[i+3])>>>0;
  }
  for(let n=16;n<64;n++){
   const x=w[n-15],y=w[n-2];
   const s0=rotr(x,7)^rotr(x,18)^(x>>>3);
   const s1=rotr(y,17)^rotr(y,19)^(y>>>10);
   w[n]=(w[n-16]+s0+w[n-7]+s1)>>>0;
  }
  let [a,b1,c,d,e,f,g,h1]=h;
  for(let n=0;n<64;n++){
   const s1=rotr(e,6)^rotr(e,11)^rotr(e,25);
   const choose=(e&f)^(~e&g);
   const t1=(h1+s1+choose+K[n]+w[n])>>>0;
   const s0=rotr(a,2)^rotr(a,13)^rotr(a,22);
   const majority=(a&b1)^(a&c)^(b1&c);
   const t2=(s0+majority)>>>0;
   h1=g;g=f;f=e;e=(d+t1)>>>0;
   d=c;c=b1;b1=a;a=(t1+t2)>>>0;
  }
  h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b1)>>>0;
  h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;
  h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;
  h[6]=(h[6]+g)>>>0;h[7]=(h[7]+h1)>>>0;
 }
 update(input){
  if(this.finished||!(input instanceof Uint8Array)||
    !Number.isSafeInteger(this.bytes+input.byteLength)||
    this.bytes+input.byteLength>256*1024*1024)
   throw Error('HASH_PDF_DATOS_NO_ADMITIDOS');
  this.bytes+=input.byteLength;
  for(let i=0;i<input.byteLength;){
   const length=Math.min(64-this.used,input.byteLength-i);
   this.block.set(input.subarray(i,i+length),this.used);
   this.used+=length;i+=length;
   if(this.used===64){this.compress();this.used=0;}
  }
  return this;
 }
 digestHex(){
  if(this.finished)throw Error('HASH_PDF_FINALIZADO');
  const bits=this.bytes*8;
  const tail=new Uint8Array(this.used+1+((56-(this.used+1)%64+64)%64)+8);
  tail[0]=0x80;
  const offset=tail.length-8;
  const high=Math.floor(bits/4294967296),low=bits>>>0;
  tail[offset]=(high>>>24)&255;tail[offset+1]=(high>>>16)&255;
  tail[offset+2]=(high>>>8)&255;tail[offset+3]=high&255;
  tail[offset+4]=(low>>>24)&255;tail[offset+5]=(low>>>16)&255;
  tail[offset+6]=(low>>>8)&255;tail[offset+7]=low&255;
  // Copiar el padding en el bloque interno, sin incrementar bytes originales.
  this.finished=true;
  const pending=this.block.slice(0,this.used);
  this.used=0;
  const append=data=>{
   for(let i=0;i<data.length;){
    const length=Math.min(64-this.used,data.length-i);
    this.block.set(data.subarray(i,i+length),this.used);
    this.used+=length;i+=length;
    if(this.used===64){this.compress();this.used=0;}
   }
  };
  append(pending);append(tail);
  if(this.used!==0)throw Error('HASH_PDF_FINALIZACION_INCORRECTA');
  return Array.from(this.h,n=>n.toString(16).padStart(8,'0')).join('');
 }
}
export async function sha256PdfLocalPorFragmentos(file,{
 chunkBytes=1024*1024,onProgress=()=>{},signal
}={}){
 const max=200*1024*1024;
 if(!file||typeof file.slice!=='function'||
    !Number.isSafeInteger(file.size)||file.size<5||file.size>max||
    !Number.isSafeInteger(chunkBytes)||chunkBytes<65536||
    chunkBytes>1024*1024||typeof onProgress!=='function')
  throw Error('HASH_PDF_ARCHIVO_NO_VALIDO');
 const hasher=new Sha256Incremental();
 for(let offset=0;offset<file.size;offset+=chunkBytes){
  if(signal?.aborted)throw Error('HASH_PDF_CANCELADO');
  const length=Math.min(chunkBytes,file.size-offset);
  const part=file.slice(offset,offset+length);
  if(part.size!==length||typeof part.arrayBuffer!=='function')
   throw Error('HASH_PDF_FRAGMENTO_INVALIDO');
  const data=new Uint8Array(await part.arrayBuffer());
  if(data.byteLength!==length)throw Error('HASH_PDF_FRAGMENTO_INCOMPLETO');
  hasher.update(data);
  onProgress({bytesProcesados:offset+length,totalBytes:file.size,
   porcentaje:Math.floor((offset+length)*100/file.size)});
 }
 return hasher.digestHex();
}
