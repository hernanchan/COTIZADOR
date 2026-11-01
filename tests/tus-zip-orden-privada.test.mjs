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
test('paquete privado usa rutas Basic y compone TXT + HTML sin exponer secretos',()=>{
 const page=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-paquete-tus-personal.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt',import.meta.url),'utf8');
 new vm.Script(client);
 assert.ok(page.includes('Descargar ZIP completo'));
 assert.ok(client.includes('/prueba-v2/api/ensayo-tus-paquete-manifiesto'));
 assert.ok(client.includes('/prueba-v2/api/ensayo-tus-descargar-personal'));
 assert.ok(client.includes('ORDEN_'));
 assert.ok(client.includes('PDF_'));
 assert.ok(client.includes('NO CONSTA'));
 assert.ok(!page.includes('service_role'));
 assert.ok(!client.includes('cdn.'));
});


test('orden numerada: relaciona PDF_01/PDF_02 con nombres originales y parámetros concretos de Adobe',()=>{
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt',import.meta.url),'utf8');
 const start=client.indexOf('function clean(v)'),end=client.indexOf('async function fetchFicha()',start);
 assert.ok(start>=0&&end>start);
 const functions=vm.runInNewContext(client.slice(start,end)+
  '\n({formatoOrden,textoOrden,htmlOrden,nombreZip})');
 const ordered={numeroOrden:'007',webOrderId:'WEB-ENSAYO-12345678901234567890123456789012',
  importe:2432,estadoPago:'SIN_PAGO_CONFIRMADO',trabajos:[
   {servicio:'documentos',nombreOriginal:'CARATULAS DIARIA.pdf',paginasOriginales:14,
    paginasElegidas:Array.from({length:14},(_,i)=>i+1),formatoFinal:'personalizado_a4',
    medidasOriginalesCm:Array.from({length:14},(_,i)=>({pagina:i+1,anchoCm:14,altoCm:20})),
    tarifaAplicada:'a4',modo:'bn',carasPresupuestadas:'double',
    paginasPorCaraPresupuestadas:2,copias:2,material:'estandar',tipoAnillado:'individual'},
   {servicio:'documentos',nombreOriginal:'Cartel A4.pdf',paginasOriginales:5,
    paginasElegidas:[1,3,5],formatoFinal:'a4',modo:'color',
    carasPresupuestadas:'simple',paginasPorCaraPresupuestadas:1,
    copias:1,material:'obra70',tipoAnillado:'ninguno'}
  ]};
 const txt=functions.textoOrden(ordered),html=functions.htmlOrden(ordered);
 assert.equal(functions.nombreZip(0),'PDF_01.pdf');
 assert.equal(functions.nombreZip(1),'PDF_02.pdf');
 for(const [zip,original] of [['PDF_01.pdf','CARATULAS DIARIA.pdf'],['PDF_02.pdf','Cartel A4.pdf']]){
  assert.ok(txt.includes(zip+' — '+original));
  assert.ok(html.includes(zip+' · '+original));
 }
 for(const expected of ['14 × 20 cm','Múltiples en Adobe Acrobat: 2 páginas','Doble faz',
  'Cantidad de copias: 2','Anillado individual','Páginas a imprimir: 1, 3, 5',
  'Sin anillado','NO IMPRIMIR NI ENTREGAR','Papel obra 70 g','Tamaño real']){
  assert.ok(txt.includes(expected),expected);
 }
 assert.ok(html.includes('size:A4'));
 assert.ok(html.includes('NO IMPRIMIR NI ENTREGAR'));
 assert.ok(!txt.includes('Referencia técnica:'),'No incluir UUID largo en la orden visible');
 assert.ok(!txt.includes('NO CONSTA — verificar'),'Orden nueva completa sin supuestos ni campos opcionales vacíos');
});
test('anexo en Adobe advierte cuando faltan datos y escapa nombres hostiles de archivos',()=>{
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt',import.meta.url),'utf8');
 const start=client.indexOf('function clean(v)'),end=client.indexOf('async function fetchFicha()',start);
 const render=vm.runInNewContext(client.slice(start,end)+'\n({textoOrden,htmlOrden})');
 const receipt={numeroOrden:'001',estadoPago:'SIN_PAGO_CONFIRMADO',importe:200,trabajos:[
  {servicio:'documentos',nombreOriginal:'<archivo>&\r\nOtra orden.pdf',
   paginasOriginales:3,paginasElegidas:[1,2,3],formatoFinal:'a5',
   carasPresupuestadas:'simple',paginasPorCaraPresupuestadas:1,
   copias:1,modo:'color',material:'obra70'}
 ]};
 const txt=render.textoOrden(receipt);
 const html=render.htmlOrden(receipt);
 assert.ok(txt.includes('Anillado después de imprimir: NO CONSTA — verificar'));
 assert.ok(txt.includes('SIN ampliar'));
 assert.ok(!txt.includes('\r\nOtra orden.pdf'),'Control characters in original names must be normalized');
 assert.ok(html.includes('&lt;archivo&gt;&amp;'));
 assert.ok(!html.includes('<archivo>'));
 assert.ok(html.includes('NO CONSTA'));
});
