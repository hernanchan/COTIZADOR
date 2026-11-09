import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {escribirZipUniversal} from '../integraciones/autocotizador/recepcion/zip-universal-stream.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=x=>new TextEncoder().encode(x);
const PDF1=bytes('%PDF-1.4\nHola Saber!\n%%EOF'),PDF2=bytes('%PDF-1.7\nDos paginas\n%%EOF');
function writer(){
 const chunks=[];let closed=false,aborted=false;
 return {chunks,get closed(){return closed},get aborted(){return aborted},
  async write(v){if(closed||aborted)throw Error('closed');chunks.push(v.slice())},
  async close(){closed=true},async abort(){aborted=true},
  get output(){return Uint8Array.from(chunks.flatMap(x=>[...x]))}};
}
const entry=(name,b,wrong=false)=>({name,expectedBytes:b.byteLength,
 expectedSha256:wrong?'f'.repeat(64):sha(b),
 open:async()=>new ReadableStream({start(c){
  c.enqueue(b.subarray(0,3));c.enqueue(b.subarray(3));c.close();
 }})});
test('ZIP mixto STORE por streaming: bytes exactos, SHA y directorio válido',async()=>{
 const w=writer();let progress=0;
 const r=await escribirZipUniversal({
  entries:[entry('PDF_01.pdf',PDF1),entry('PDF_02.pdf',PDF2),
   entry('ORDEN_001_INSTRUCCIONES.pdf',bytes('%PDF-1.4\ninstrucciones'))],
  output:w,onProgress:()=>{progress++}
 });
 assert.equal(r.ok,true);assert.equal(r.files,3);
 assert.equal(w.closed,true);assert.equal(w.aborted,false);
 assert.ok(progress>=4);
 const b=w.output,d=new DataView(b.buffer);let at=0;
 for(const [i,x] of [PDF1,PDF2,bytes('%PDF-1.4\ninstrucciones')].entries()){
  assert.equal(d.getUint32(at,true),0x04034b50);
  assert.equal(d.getUint16(at+6,true),0x0808);
  assert.equal(d.getUint32(at+18,true),0);
  const namelen=d.getUint16(at+26,true);
  const name=new TextDecoder().decode(b.subarray(at+30,at+30+namelen));
  assert.equal(name,i===2?'ORDEN_001_INSTRUCCIONES.pdf':'PDF_0'+(i+1)+'.pdf');
  const start=at+30+namelen;
  assert.deepEqual(b.subarray(start,start+x.length),x);
  assert.equal(d.getUint32(start+x.length,true),0x08074b50);
  assert.equal(d.getUint32(start+x.length+8,true),x.length);
  at=start+x.length+16;
 }
 for(let i=0;i<3;i++){
  assert.equal(d.getUint32(at,true),0x02014b50);
  at+=46+d.getUint16(at+28,true);
 }
 assert.equal(d.getUint32(at,true),0x06054b50);
 assert.equal(d.getUint16(at+10,true),3);
});
test('ZIP aborta si SHA difiere, sin entregar archivo incompleto',async()=>{
 const w=writer();
 await assert.rejects(escribirZipUniversal({entries:[
  entry('PDF_01.pdf',PDF1),entry('PDF_02.pdf',PDF2,true)],output:w
 }),/ZIP_UNIVERSAL_SHA_DISTINTO/);
 assert.equal(w.closed,false);
 assert.equal(w.aborted,true);
});
test('ZIP rechaza ruta maliciosa, duplicados y tamaños > máximo antes de escribir',async()=>{
 const w=writer();
 await assert.rejects(escribirZipUniversal({entries:[
  entry('../PDF.pdf',PDF1),entry('PDF_02.pdf',PDF2)],output:w}),/NOMBRE/);
 await assert.rejects(escribirZipUniversal({entries:[
  entry('PDF_01.pdf',PDF1),entry('PDF_01.pdf',PDF2)],output:w}),/DUPLICADO/);
 const huge={name:'PDF_03.pdf',expectedBytes:200*1048576,expectedSha256:'1'.repeat(64),
  open:async()=>{throw Error('Do not open Storage')}};
 await assert.rejects(escribirZipUniversal({entries:[huge,huge],output:w,maxBytes:64*1048576}),/DUPLICADO/);
 assert.equal(w.chunks.length,0);
});
