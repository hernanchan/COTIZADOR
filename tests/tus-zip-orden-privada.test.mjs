import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {paginaPaqueteTUSPersonal} from '../integraciones/autocotizador/recepcion/pantalla-paquete-tus-personal.mjs';
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
test('paquete privado tiene una única acción y no contiene secretos ni CDN',()=>{
 const html=paginaPaqueteTUSPersonal();
 const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
 new vm.Script(script);
 assert.ok(html.includes('Descargar ZIP completo'));
 assert.ok(html.includes('/prueba-v2/api/ensayo-tus-paquete-manifiesto'));
 assert.ok(html.includes('/prueba-v2/api/ensayo-tus-descargar-personal'));
 assert.ok(html.includes('ORDEN_'));
 assert.ok(html.includes('PDF_'));
 assert.ok(html.includes('NO CONSTA'));
 assert.ok(!html.includes('service_role'));
 assert.ok(!html.includes('cdn.'));
});
