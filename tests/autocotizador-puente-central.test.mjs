import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument} from '../integraciones/autocotizador/recepcion/node_modules/pdf-lib/dist/pdf-lib.esm.js';
import precios from '../precios-web.json' with {type:'json'};
import {conectarRecepcionConCentral} from '../integraciones/autocotizador/recepcion/puente-recepcion-central.mjs';
const orderId='WEB-ENSAYO-1234567890ABCDEF';
const configuraciones=[
 {fileId:'f1',nombre:'stickers.pdf',servicio:'stickers',seleccion:'a4',paginasSeleccionadas:'',
  copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',
  grupoAnillado:'',materialColor:'',productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1},
 {fileId:'f2',nombre:'tarjetas.pdf',servicio:'grafica',productoGrafica:'tarjetas-0',seleccion:'a4',
  paginasSeleccionadas:'',copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
  anillado:'ninguno',grupoAnillado:'',materialColor:'',productoFoto:'',corteVariante:'gt3',corteMetros:1}
];
async function data(){
 const blobs=new Map(),recibos=[];
 for(let i=0;i<2;i++){
  const pdf=await PDFDocument.create();
  pdf.addPage([595.28,841.89]);
  const bytes=await pdf.save();
  const fileId='f'+(i+1),name=configuraciones[i].nombre;
  const sha256=createHash('sha256').update(bytes).digest('hex');
  blobs.set(fileId,bytes);
  recibos.push({orderId,fileId,name,mode:'bn',status:'verified',verified:true,
   storageVerified:true,pageVerification:'server',
   receiptId:'DOC-'+(i===0?'12345678':'87654321')+'-1234-4234-8234-1234567890ab',
   bytes:bytes.length,sha256,pages:1});
 }
 return {blobs,recibos};
}
const run=({blobs,recibos})=>conectarRecepcionConCentral({
 orderId,configuraciones,preciosServidor:precios,
 consultarRecibosPrivados:async()=>recibos,
 descargarPdfPrivado:async({fileId})=>blobs.get(fileId)
});
test('dos originales Drive: SHA, medidas, presupuesto y ficha sin liberar producción',async()=>{
 const d=await run(await data());
 assert.equal(d.importeVerificado,21000);
 assert.deepEqual(d.ficha.trabajos.map(x=>x.servicio),['stickers','grafica']);
 assert.equal(d.ficha.trabajos[1].productoId,'tarjetas-0');
 assert.ok(Math.abs(d.cotizacion.plan[0].origen[0].anchoCm-21)<0.01);
 assert.equal(d.recibos.length,2);
 assert.equal(d.filesReceived,true);
 assert.equal(d.paymentAuthorized,false);
 assert.equal(d.ficha.listoParaProducir,false);
});
test('no aceptar recibos privados faltantes, no confirmados ni cruzados',async()=>{
 const original=await data();
 await assert.rejects(run({...original,recibos:original.recibos.slice(0,1)}));
 for(const mutation of [{verified:false},{storageVerified:false},{pageVerification:'client'},
  {orderId:'WEB-ENSAYO-0000000000000000'},{pages:2}]){
  const recibos=original.recibos.map((r,i)=>i?{...r,...mutation}:r);
  await assert.rejects(run({...original,recibos}));
 }
 await assert.rejects(run({...original,recibos:[original.recibos[0],
  {...original.recibos[1],receiptId:original.recibos[0].receiptId}]}));
});
test('falla si se modifica el PDF almacenado o no es realmente descargable',async()=>{
 const x=await data();const alterados=new Map(x.blobs);
 alterados.set('f1',Uint8Array.from([...x.blobs.get('f1').subarray(0,-1),0]));
 await assert.rejects(run({...x,blobs:alterados}),/difiere|estructura|PDF/i);
 const vacios=new Map(x.blobs);vacios.delete('f1');
 await assert.rejects(run({...x,blobs:vacios}));
});
test('un PDF de dimensión A0 requiere clasificar CAD/póster antes de cobrar',async()=>{
 const original=await data();
 const large=await PDFDocument.create();large.addPage([2383,3370]);
 const bytes=await large.save();const blobs=new Map(original.blobs);
 blobs.set('f1',bytes);
 const recibos=original.recibos.map((r,i)=>i?r:{...r,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 // Stickers sobre A0 no se acepta como plancha A4.
 // La ficha queda pendiente si el cotizador exige corregir destino comercial.
 const d=await run({blobs,recibos});
 assert.equal(d.paymentAuthorized,false);
 assert.equal(d.ficha.listoParaProducir,false);
});
