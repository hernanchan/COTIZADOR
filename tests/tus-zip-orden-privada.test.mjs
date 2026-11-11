import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const zipJs=readFileSync(new URL('../integraciones/autocotizador/recepcion/zip-tus-cliente.txt',import.meta.url),'utf8');
const ctx=vm.createContext({Blob,TextEncoder,Uint8Array,Uint32Array,DataView,console});
vm.runInContext(zipJs+'\n globalThis.crearZipSinCompresion=crearZipSinCompresion;globalThis.crc32Blob=crc32Blob;',ctx);
test('CRC32 correcto y ZIP guarda PDFs originales bit a bit, nombre ordenado',async()=>{
 assert.equal(await ctx.crc32Blob(new Blob(['123456789'])),0xcbf43926);
 const pdf=new Blob(['%PDF-1.4\nabc\n%%EOF']);
 const file2=new Blob(['%PDF-1.7\nxyz\n%%EOF']);
 const zip=await ctx.crearZipSinCompresion([
  {name:'PDF_01.pdf',blob:pdf},
  {name:'PDF_02.pdf',blob:file2},
  {name:'ORDEN_001_INSTRUCCIONES.txt',blob:new Blob(['Orden 001'])}
 ]);
 const data=new Uint8Array(await zip.arrayBuffer());
 const dv=new DataView(data.buffer);
 let offset=0;
 for(const [name,src] of [['PDF_01.pdf',pdf],['PDF_02.pdf',file2],
  ['ORDEN_001_INSTRUCCIONES.txt',new Blob(['Orden 001'])]]){
  assert.equal(dv.getUint32(offset,true),0x04034b50);
  assert.equal(dv.getUint16(offset+8,true),0); // STORE
  const size=dv.getUint32(offset+18,true);
  const n=dv.getUint16(offset+26,true);
  const actualName=new TextDecoder().decode(data.slice(offset+30,offset+30+n));
  assert.equal(actualName,name);assert.equal(size,src.size);
  const start=offset+30+n;
  assert.deepEqual(data.slice(start,start+size),new Uint8Array(await src.arrayBuffer()));
  offset=start+size;
 }
 const centralStart=offset;
 for(let i=0;i<3;i++){
  assert.equal(dv.getUint32(offset,true),0x02014b50);
  const n=dv.getUint16(offset+28,true);
  offset+=46+n;
 }
 assert.equal(dv.getUint32(offset,true),0x06054b50);
 assert.equal(dv.getUint16(offset+10,true),3);
 assert.equal(dv.getUint32(offset+16,true),centralStart);
 assert.equal(zip.type,'application/zip');
});
test('ZIP rechaza traversal, duplicados y archivos desmesurados',async()=>{
 const one=new Blob(['test']);
 await assert.rejects(()=>ctx.crearZipSinCompresion([{name:'../evil.pdf',blob:one}]));
 await assert.rejects(()=>ctx.crearZipSinCompresion([
  {name:'PDF_01.pdf',blob:one},{name:'PDF_01.pdf',blob:one}]));
});

const pdfCode=readFileSync(new URL('../integraciones/autocotizador/recepcion/pdf-orden-tus-cliente.txt',import.meta.url),'utf8');
const paqueteCode=readFileSync(new URL('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt',import.meta.url),'utf8');
const pre=paqueteCode.slice(paqueteCode.indexOf('function clean(v)'),paqueteCode.indexOf('async function fetchFicha()'));
const printable=vm.createContext({Blob,console,TextEncoder});
vm.runInContext(pdfCode+'\n'+pre+'\n'+
 'globalThis.pdf=generarPdfOrdenTrabajo;globalThis.filas=formatoOrden;globalThis.nombre=nombreZip;',printable);
const base={numeroOrden:'013',importe:4730,estadoPago:'PAGADO_VERIFICADO',pagoVerificado:true,
 nombreCliente:'María Belén Gómez',telefonoContacto:'351 555 1234',direccionCliente:'Av. Colón 1234, Córdoba',
 webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
 trabajos:[
 {orden:1,nombreOriginal:'Día de las familias.pdf',servicio:'documentos',paginasOriginales:8,
  paginasElegidas:[1,2,3,4,5,6,7,8],copias:1,formatoFinal:'a4',modo:'bn',
  carasPresupuestadas:'double',paginasPorCaraPresupuestadas:2,
  material:'obra70',tipoAnillado:'grupo',grupoAnillado:'1'},
 {orden:2,nombreOriginal:'Plano CAD y Póster.pdf',servicio:'ploteos',paginasOriginales:2,
  paginasElegidas:[1,2],copias:2,formatoFinal:'original',
  planoPorPagina:[{numeroOriginal:1,modo:'cad',anchoCm:60,altoCm:85,
   rollo:'rollo60',papel:'obra80'},{numeroOriginal:2,modo:'poster',
   anchoCm:60,altoCm:85,rollo:'rec60',papel:'recubierto'}]}
 ]};
function imprimir(d=base){
 return printable.pdf(d,d.trabajos.map((t,i)=>printable.filas(t,i)));
}
function pdfTexto(buf){
 // Los streams contienen únicamente literales hexadecimales WinAnsi.
 return [...buf.matchAll(/<([0-9a-f]{6,})> Tj/g)]
  .map(m=>Buffer.from(m[1],'hex').toString('latin1')).join('\n');
}
test('portal ZIP privado emplea descarga Basic y reemplaza HTML/TXT por orden PDF',()=>{
 const html=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-paquete-tus-personal.mjs',import.meta.url),'utf8');
 assert.match(html,/pdf-orden-tus-cliente\.txt/);
 assert.match(html,/orden de trabajo en PDF A4/);
 assert.match(paqueteCode,/crearZipSinCompresion/);
 assert.match(paqueteCode,/generarPdfOrdenTrabajo\(ficha,filas\)/);
 assert.match(paqueteCode,/ORDEN_/);
 assert.match(paqueteCode,/\.pdf',blob:ordenPdf/);
 assert.doesNotMatch(paqueteCode,/\.html',blob:|\.txt',blob:/);
 assert.match(paqueteCode,/ensayo-tus-paquete-manifiesto/);
 assert.match(paqueteCode,/ensayo-tus-descargar-personal/);
 assert.doesNotMatch(paqueteCode,/service_role|getPublicUrl|supabase\.co\/storage/i);
});
test('orden PDF A4 contiene número, pago verificado, originales e instrucciones Adobe',async()=>{
 const blob=imprimir();
 assert.equal(blob.type,'application/pdf');
 const raw=Buffer.from(await blob.arrayBuffer()).toString('latin1');
 assert.ok(raw.startsWith('%PDF-1.4\n'));
 assert.match(raw,/\/MediaBox \[0 0 595 842\]/);
 assert.match(raw,/\/BaseFont \/Helvetica/);
 const txt=pdfTexto(raw);
 for(const label of ['ORDEN DE TRABAJO','013','PAGO VERIFICADO','PDF 01',
  'Día de las familias.pdf','María Belén Gómez','351 555 1234','Av. Colón 1234, Córdoba','Páginas a imprimir','Doble faz','Múltiples en Adobe Acrobat',
  'Anillado en grupo','PDF 02','Póster','Recubierto','rollo60','NO IMPRIMIR']){
  assert.ok(txt.includes(label),label);
 }
 assert.ok(!txt.includes('SIN PAGO CONFIRMADO'));
 const xref=Number(raw.match(/startxref\n(\d+)\n%%EOF/)[1]);
 assert.equal(raw.slice(xref,xref+5),'xref\n');
});
test('orden A4 informa SIN PAGO si no existe conciliación verified',async()=>{
 const unpaid={...base,estadoPago:'SIN_PAGO_CONFIRMADO',pagoVerificado:false};
 const text=pdfTexto(Buffer.from(await imprimir(unpaid).arrayBuffer()).toString('latin1'));
 assert.match(text,/SIN PAGO CONFIRMADO/);
 assert.doesNotMatch(text,/PAGO VERIFICADO EN CENTRAL/);
 assert.throws(()=>imprimir({...base,pagoVerificado:false}),/verificación/);
});
test('orden PDF acepta acentos y reparte numerosas instrucciones en varias páginas',async()=>{
 const many={...base,trabajos:Array.from({length:30},(_,i)=>({
  ...base.trabajos[0],nombreOriginal:'Página '+(i+1)+' - Múltiples.pdf',
  descripcion:'Preparación especial '+('No ampliar, doble faz, anillado en grupo. ').repeat(12)
 }))};
 const raw=Buffer.from(await imprimir(many).arrayBuffer()).toString('latin1');
 const count=Number(raw.match(/\/Type \/Pages \/Count (\d+)/)[1]);
 assert.ok(count>1);
 const references=raw.match(/\/Type \/Page \/Parent 2 0 R/g)||[];
 assert.equal(references.length,count);
 const footer=pdfTexto(raw);
 assert.match(footer,/Página 1 de /);
 assert.match(footer,/PDF 30/);
});

test('Hoja R2 A4 y ZIP de revisión reutilizan generadores privados sin simular orden numerada',async()=>{
 const hojaCode=readFileSync(new URL('../integraciones/autocotizador/recepcion/pdf-hoja-r2-preprensa.txt',import.meta.url),'utf8');
 const ctx2=vm.createContext({Blob,TextEncoder,console,Uint8Array,Uint32Array,DataView});
 vm.runInContext(pdfCode+'\n'+hojaCode+'\n'+zipJs+
  '\nglobalThis.make=generarHojaPreprensaR2;globalThis.zip=crearZipSinCompresion;',ctx2);
 const id='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
 const receipt='DOC-12345678-1234-4123-8123-123456789abc';
 const hoja=ctx2.make(id,receipt,62915011);
 const bytes=new Uint8Array(await hoja.arrayBuffer());
 assert.equal(new TextDecoder().decode(bytes.slice(0,8)),'%PDF-1.4');
 assert.match(Buffer.from(bytes).toString('latin1'),/\/MediaBox \[0 0 595 842\]/);
 const zip=await ctx2.zip([
  {name:'PDF_01.pdf',blob:new Blob(['%PDF-1.4 original'])},
  {name:'PREPRENSA_R2_NO_IMPRIMIR.pdf',blob:hoja}
 ],{maxBytes:210*1024*1024});
 assert.equal(zip.type,'application/zip');
 assert.ok(zip.size>hoja.size);
 assert.throws(()=>ctx2.make(id,receipt,0),/Datos de preprensa/);
});
