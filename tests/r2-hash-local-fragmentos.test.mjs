import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {Sha256Incremental,sha256PdfLocalPorFragmentos}
 from '../integraciones/autocotizador/recepcion/sha256-pdf-local-fragmentos.mjs';
const hex=s=>createHash('sha256').update(s).digest('hex');
test('SHA256 FIPS: vacío, abc y 1 millón de caracteres',()=>{
 for(const data of [
  Buffer.alloc(0),Buffer.from('abc'),Buffer.alloc(1000000,0x61),
  randomBytes(873)
 ]){
  const h=new Sha256Incremental();
  for(let i=0;i<data.length;i+=13)h.update(data.subarray(i,i+13));
  assert.equal(h.digestHex(),hex(data));
  assert.throws(()=>h.digestHex(),/HASH_PDF_FINALIZADO/);
 }
 assert.equal(hex(Buffer.from('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('PDF 150 MiB sintético: 150 lecturas de 1 MiB, no arrayBuffer completo y hash correcto',async()=>{
 const piece=Buffer.alloc(1024*1024);
 for(let i=0;i<piece.length;i++)piece[i]=(i*7+i>>>3)&255;
 const expected=createHash('sha256');
 for(let i=0;i<150;i++)expected.update(piece);
 const size=150*piece.length;
 let slices=0,completeCalled=false,last=0;
 const file={name:'A1.pdf',size,
  async arrayBuffer(){completeCalled=true;throw Error('PROHIBIDO_LEER_150_MIB_COMPLETOS')},
  slice(start,end){
   assert.equal(end-start,piece.length);
   assert.ok(start>=0&&end<=size);
   slices++;
   return {size:piece.length,async arrayBuffer(){
    return piece.buffer.slice(piece.byteOffset,piece.byteOffset+piece.byteLength);
   }};
  }};
 const actual=await sha256PdfLocalPorFragmentos(file,{
  onProgress:p=>{last=p.porcentaje;assert.ok(p.bytesProcesados<=size)}
 });
 assert.equal(actual,expected.digest('hex'));
 assert.equal(slices,150);
 assert.equal(last,100);
 assert.equal(completeCalled,false);
 console.log('SHA256_LOCAL_150_MIB_150_FRAGMENTOS_SIN_R2_OK');
});
test('cancelación y tamaño mayor a 200 MiB se rechazan',async()=>{
 const piece=Buffer.alloc(5);
 const file={size:5,slice:()=>({size:5,arrayBuffer:async()=>piece})};
 await assert.rejects(sha256PdfLocalPorFragmentos(file,{
  signal:{aborted:true}
 }),/HASH_PDF_CANCELADO/);
 await assert.rejects(sha256PdfLocalPorFragmentos({
  ...file,size:201*1024*1024
 }),/HASH_PDF_ARCHIVO_NO_VALIDO/);
});
