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

test('R2 aprobado: ZIP contiene orden de producción A4 con copias, papel, rollo y geometría, no cambia original',async()=>{
 const sandbox=vm.createContext({Blob,TextEncoder,Uint8Array,Uint32Array,DataView});
 vm.runInContext(pdf+'\n'+hoja+'\n'+zip+
  '\nglobalThis.make=generarHojaProduccionR2;globalThis.zip=crearZipSinCompresion;',sandbox);
 const ficha={schema:'saber-central-r2-production-sheet-v1',
  webOrderId:'WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE',
  receiptId:'DOC-12345678-1234-4123-8123-123456789abc',
  numeroOrden:'037',importe:4400,aprobadoPor:'Operador',aprobadoEn:'2026-11-09 15:00:00',
  nombreOriginal:'Plano A1.pdf',modoImpresion:'bn',copias:2,papelPoster:'obra80',
  rolloBase:'rollo60',paginas:[[59.4,84.1,'cad','rollo60','obra80']],
  preprensaAprobada:true,productionAuthorized:false,readyForPrinting:false};
 const note=sandbox.make(ficha);
 const raw=Buffer.from(await note.arrayBuffer()).toString('latin1');
 assert.match(raw,/^%PDF-1.4/);
 assert.match(raw,/\/MediaBox \[0 0 595 842\]/);
 const decoded=[...raw.matchAll(/<([0-9a-f]{6,})> Tj/g)]
  .map(m=>Buffer.from(m[1],'hex').toString('latin1')).join('\n');
 for(const part of ['037','Operador','Copias por página: 2','rollo60',
  '59.4','84.1','NO IMPRIMIR','4400'])
  assert.ok(decoded.includes(part),part);
 const original=new Blob(['%PDF-1.4\nOriginal sin alteraciones']);
 const output=await sandbox.zip([{name:'PDF_01.pdf',blob:original},
  {name:'ORDEN_037_INSTRUCCIONES.pdf',blob:note}],{maxBytes:210*1024*1024});
 const bytes=new Uint8Array(await output.arrayBuffer());
 const dv=new DataView(bytes.buffer),nameBytes=dv.getUint16(26,true);
 assert.deepEqual(bytes.slice(30+nameBytes,30+nameBytes+original.size),
  new Uint8Array(await original.arrayBuffer()));
 assert.throws(()=>sandbox.make({...ficha,preprensaAprobada:false}),/sin aprobación/i);
 assert.throws(()=>sandbox.make({...ficha,numeroOrden:'inventado'}),/sin aprobación/i);
});
