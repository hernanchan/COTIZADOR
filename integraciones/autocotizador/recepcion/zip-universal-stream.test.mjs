import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {escribirZipUniversal} from './zip-universal-stream.mjs';

const encoder=new TextEncoder();
const original=encoder.encode('%PDF-1.7\n% Saber PDF original\n%%EOF\n');
const instructions=encoder.encode('%PDF-1.4\n'+
 'ORDEN 012 - INSTRUCCIONES - A4 ajustar todas las paginas, no recortar.\n'.repeat(8)+
 '%%EOF\n');
const hash=createHash('sha256').update(original).digest('hex');
const makeEntry=(name,data,sha)=>({
 name,expectedBytes:data.byteLength,expectedSha256:sha,
 open:async()=>new Blob([data],{type:'application/pdf'}).stream()
});
const entries=()=>[
 makeEntry('PDF_01.pdf',original,hash),
 makeEntry('ORDEN_012_INSTRUCCIONES.pdf',instructions,null)
];
function output(){
 const chunks=[];let closed=false,aborted=false;
 return {chunks,
  write:async data=>{chunks.push(Buffer.from(data));},
  close:async()=>{closed=true;},
  abort:async()=>{aborted=true;},
  get closed(){return closed},
  get aborted(){return aborted}
 };
}
test('ZIP de producción contiene original y hoja A4 de instrucciones, ambas PDF',async()=>{
 const sink=output(),events=[];
 const info=await escribirZipUniversal({entries:entries(),output:sink,
  onProgress:p=>events.push(p)});
 const buf=Buffer.concat(sink.chunks);
 assert.equal(info.ok,true);assert.equal(info.files,2);
 assert.equal(sink.closed,true);
 assert.equal(sink.aborted,false);
 assert.equal(buf.readUInt32LE(0),0x04034b50);
 assert.equal(buf.readUInt32LE(buf.length-22),0x06054b50);
 assert.equal(buf.readUInt16LE(buf.length-12),2);
 assert.ok(buf.includes(Buffer.from('PDF_01.pdf')));
 assert.ok(buf.includes(Buffer.from('ORDEN_012_INSTRUCCIONES.pdf')));
 assert.ok(buf.includes(Buffer.from('PAPEL A4'))===false);
 assert.ok(buf.includes(Buffer.from('A4 ajustar todas las paginas')));
 assert.ok(events.length>0);
});
test('no produce ZIP cuando faltan instrucciones o el original carece de SHA',async()=>{
 for(const malformed of [
  [entries()[0]],
  [entries()[0],{...entries()[1],name:'PDF_02.pdf'}],
  [entries()[1],entries()[0]],
  [{...entries()[0],expectedSha256:null},entries()[1]],
  [entries()[0],{...entries()[1],expectedBytes:150}]
 ]){
  const sink=output();
  await assert.rejects(escribirZipUniversal({entries:malformed,output:sink}),/ZIP_UNIVERSAL/);
  assert.equal(sink.chunks.length,0);
  assert.equal(sink.closed,false);
 }
});
test('falla y aborta cuando un PDF original tiene bytes distintos',async()=>{
 const sink=output();
 const input=entries();
 input[0]={...input[0],expectedSha256:'f'.repeat(64)};
 await assert.rejects(escribirZipUniversal({entries:input,output:sink}),/ZIP_UNIVERSAL_SHA_DISTINTO/);
 assert.equal(sink.closed,false);
 assert.equal(sink.aborted,true);
});
