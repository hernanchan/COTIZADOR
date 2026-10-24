import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {EXPRESS,verificarHojasExpress,generarPdfExpress,guardarPedidoPdfExpress}
 from '../integraciones/polaroids/express/motor-pdf.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const pdfLib=require('pdf-lib');
// JPEG auténtico de prueba, 886x886, comprimido además con zlib para no ocupar el repo.
const jpg=new Uint8Array(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const hojas=n=>Array.from({length:Math.ceil(n/6)},(_,i)=>Array.from(
 {length:Math.min(6,n-i*6)},()=>jpg));
test('limita a 24 fotografías y conserva múltiplos por hoja',()=>{
 assert.equal(EXPRESS.maxFotos,24);assert.equal(EXPRESS.porHoja,6);
 assert.deepEqual(verificarHojasExpress(hojas(24)),{fotos:24,hojas:4,precioOrientativo:12000});
 assert.deepEqual(verificarHojasExpress(hojas(19)),{fotos:19,hojas:4,precioOrientativo:12000});
 assert.throws(()=>verificarHojasExpress(hojas(25)),/hojas|24/i);
 assert.throws(()=>verificarHojasExpress([Array(5).fill(jpg),Array(6).fill(jpg)]));
 assert.throws(()=>verificarHojasExpress([]));
});
test('crea PDF real A4 con 6 polaroids por página y marcas de corte',async()=>{
 assert.ok(jpg.length<10000);
 const {pdfBytes,fotos,hojas:pages}=await generarPdfExpress({hojas:hojas(24),pdfLib});
 assert.equal(fotos,24);assert.equal(pages,4);
 assert.equal(String.fromCharCode(...pdfBytes.slice(0,5)),'%PDF-');
 assert.ok(pdfBytes.byteLength<EXPRESS.maxPdfBytes);
 const pdf=await pdfLib.PDFDocument.load(pdfBytes);
 assert.equal(pdf.getPageCount(),4);
 for(const p of pdf.getPages()){
  assert.ok(Math.abs(p.getWidth()-210*72/25.4)<.1);
  assert.ok(Math.abs(p.getHeight()-297*72/25.4)<.1);
 }
 const partial=await generarPdfExpress({hojas:hojas(7),pdfLib});
 assert.equal((await pdfLib.PDFDocument.load(partial.pdfBytes)).getPageCount(),2);
});
test('solo el PDF se envía a almacenamiento privado; el navegador recibe recibo sin PDF',async()=>{
 let received=null;
 const reply=await guardarPedidoPdfExpress({
  referencia:'POL-'+('A'.repeat(24)),hojas:hojas(12),pdfLib,subtle:webcrypto.subtle,
  guardarPdfPrivado:async data=>{
   received=data;
   assert.match(data.archivo,/^POL-[A-F0-9]{24}_IMPRIMIR\.pdf$/);
   assert.ok(data.contenidoPdf instanceof Uint8Array);
   assert.ok(data.contenidoPdf.length>100);
   assert.equal(data.paginas,2);
   assert.equal(data.fotos,12);
   assert.equal('originales' in data,false);
   assert.equal('recortes' in data,false);
   assert.equal('encuadres' in data,false);
   return {ok:true,verified:true,referencia:data.referencia,
    sha256:data.sha256,bytes:data.bytes,paginas:data.paginas};
  }
 });
 assert.equal(reply.ok,true);
 assert.equal(reply.pdfPrivadoVerificado,true);
 assert.equal(reply.permiteDescargaCliente,false);
 assert.equal('pdfBytes' in reply,false);
 assert.equal('contenidoPdf' in reply,false);
 assert.equal('url' in reply,false);
 assert.ok(received.contenidoPdf.length<EXPRESS.maxPdfBytes);
});
test('rechaza recibo sin confirmar y recortes JPEG inválidos',async()=>{
 await assert.rejects(guardarPedidoPdfExpress({
  referencia:'POL-'+('B'.repeat(24)),hojas:hojas(6),pdfLib,subtle:webcrypto.subtle,
  guardarPdfPrivado:async x=>({ok:true,verified:false,referencia:x.referencia,
   sha256:x.sha256,bytes:x.bytes,paginas:x.paginas})
 }),/confirmó/i);
 assert.throws(()=>verificarHojasExpress([[new Uint8Array(500)]]));
 const resized=new Uint8Array(jpg);
 // Modificar ancho de la cabecera SOF del JPEG manteniendo formato.
 for(let i=0;i<resized.length-9;i++){
  if(resized[i]===0xff&&[0xc0,0xc1,0xc2].includes(resized[i+1])){
   resized[i+7]=0x01;resized[i+8]=0x00;break;
  }
 }
 await assert.rejects(generarPdfExpress({hojas:[[resized]],pdfLib}),/886/);
});

test('guillotina: 14 marcas exteriores, sin marcos alrededor de las fotos',async()=>{
 const drawings=[];
 const hooked={
  ...pdfLib,
  PDFDocument:{
   create:async()=>{
    const document=await pdfLib.PDFDocument.create();
    const addPage=document.addPage.bind(document);
    document.addPage=(...args)=>{
     const page=addPage(...args);
     for(const method of ['drawLine','drawRectangle','drawImage']){
      const original=page[method].bind(page);
      page[method]=(...params)=>{
       drawings.push({method,args:params[0]});
       return original(...params);
      };
     }
     return page;
    }
    return document;
   }
  }
 };
 await generarPdfExpress({hojas:hojas(6),pdfLib:hooked});
 assert.equal(drawings.filter(x=>x.method==='drawImage').length,6);
 assert.equal(drawings.filter(x=>x.method==='drawLine').length,14);
 assert.equal(drawings.filter(x=>x.method==='drawRectangle').length,0,
  'No deben existir bordes cerrados que obliguen a recortar cada Polaroid');
 const pt=n=>n*72/25.4;
 const marks=drawings.filter(x=>x.method==='drawLine');
 assert.ok(marks.every(({args})=>{
  const x1=args.start.x/pt(1),x2=args.end.x/pt(1);
  const y1=297-args.start.y/pt(1),y2=297-args.end.y/pt(1);
  return (Math.abs(x1-x2)<0.001&&(y1<13.5&&y2<13.5||y1>283.5&&y2>283.5))||
   (Math.abs(y1-y2)<0.001&&(x1<20&&x2<20||x1>190&&x2>190));
 }), 'Todas las marcas deben quedar fuera de la zona de corte');
});
