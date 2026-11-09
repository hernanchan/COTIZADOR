import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const dir='../integraciones/autocotizador/recepcion/';
const file=name=>readFileSync(new URL(dir+name,import.meta.url),'utf8');
const pdf=file('pdf-orden-tus-cliente.txt');
const hoja=file('pdf-hoja-r2-preprensa.txt');
const zip=file('zip-tus-cliente.txt');
test('R2 ZIP conserva bytes originales y hoja PDF A4 sin autorización',async()=>{
 const sandbox=vm.createContext({Blob,TextEncoder,Uint8Array,Uint32Array,DataView});
 vm.runInContext(pdf+'\n'+hoja+'\n'+zip+
  '\nglobalThis.make=generarHojaPreprensaR2;globalThis.zip=crearZipSinCompresion;',sandbox);
 const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
 const receipt='DOC-12345678-1234-4123-8123-123456789abc';
 const note=sandbox.make(web,receipt,62915011);
 const raw=Buffer.from(await note.arrayBuffer()).toString('latin1');
 assert.match(raw,/^%PDF-1.4/);
 assert.match(raw,/\/MediaBox \[0 0 595 842\]/);
 const decoded=[...raw.matchAll(/<([0-9a-f]{6,})> Tj/g)]
  .map(x=>Buffer.from(x[1],'hex').toString('latin1')).join('\n');
 assert.match(decoded,/BLOQUEADO/);
 const original=new Blob(['%PDF-1.4\nOriginal R2 intacto']);
 const output=await sandbox.zip([
  {name:'PDF_01.pdf',blob:original},
  {name:'PREPRENSA_R2_NO_IMPRIMIR.pdf',blob:note}
 ],{maxBytes:210*1024*1024});
 assert.equal(output.type,'application/zip');
 const bytes=new Uint8Array(await output.arrayBuffer());
 const dv=new DataView(bytes.buffer);
 assert.equal(dv.getUint32(0,true),0x04034b50);
 const nameBytes=dv.getUint16(26,true);
 const start=30+nameBytes;
 assert.deepEqual(bytes.slice(start,start+original.size),
  new Uint8Array(await original.arrayBuffer()));
 assert.equal(dv.getUint32(start+original.size,true),0x04034b50);
 assert.throws(()=>sandbox.make('WEB-OTRO',receipt,62915011),/inválidos/);
});
