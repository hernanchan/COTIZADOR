/** Ensayo local de 30 PDF: recibos HMAC simulados → Drive SHA real →
 * cotización comercial conjunta → ficha Central → PDF vectorial N-up.
 * Sin red, D1 remota, Cloudflare, pagos ni archivos de clientes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import precios from '../precios-web.json' with {type:'json'};
import {fase4FichaCentralLotePrivada} from '../integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs';
import {componerDesdeReciboVerificado} from '../integraciones/autocotizador/recepcion/componer-desde-recibo-verificado.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const sha=x=>createHash('sha256').update(x).digest('hex');
const orderId='WEB-LOTE-NUP-INTEGRACION-20261027';
const n=30;
async function preparar(){
 const items=[],db=new Map(),calls=[];
 for(let i=0;i<n;i++){
  const pdf=await PDFDocument.create();
  for(let p=0;p<5;p++)pdf.addPage([595.28,841.89]);
  const bytes=Buffer.from(await pdf.save());
  const uploadId='DOC-'+String(i+1).padStart(8,'0')+'-1234-4234-8234-1234567890ab';
  const token='prueba-segura-token-'+String(i).padStart(3,'0')+'-abcdef';
  const fileId='documento'+(i+1),name='apunte-'+(i+1)+'.pdf';
  const item={sesion:{uploadId,token},opciones:{
   servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
   copias:1,modo:'bn',caras:i%2?'double':'simple',
   papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',
   materialColor:'',paginasPorHoja:[1,2,4,9][i%4],
   productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1
  }};
  items.push(item);
  db.set(uploadId,{bytes,token,receipt:{ok:true,receiptId:uploadId,
   orderId,fileId,name,mode:'bn',bytes:bytes.length,sha256:sha(bytes),pages:5}});
 }
 const consultarFirmado=async({op,uploadId,token,offset})=>{
  calls.push({op,uploadId});
  const row=db.get(uploadId);
  if(!row||token!==row.token)return {ok:false};
  const r=row.receipt;
  if(op==='multiInfo')return {...r,receiptState:'pages_verified',privateChunkBytes:256*1024};
  if(op==='multiVerifiedStatus')return {...r,status:'verified',verified:true,
   storageVerified:true,pageVerification:'server',paymentAuthorized:false};
  if(op==='multiReadPart'){
   const part=row.bytes.subarray(offset,offset+256*1024);
   return {ok:true,receiptId:uploadId,offset,length:part.length,
    bytes:row.bytes.length,sha256:r.sha256,chunkSha256:sha(part),
    dataBase64:part.toString('base64')};
  }
  throw Error('Operación inesperada');
 };
 return {items,db,calls,consultarFirmado};
}
test('30 PDF en un solo pedido: N-up, SHA, tarifas y ficha; 3 PDF compuestos con orden intacto',async()=>{
 const m=await preparar();
 const result=await fase4FichaCentralLotePrivada({sesiones:m.items,
  consultarFirmado:m.consultarFirmado,preciosServidor:precios,
  maxFiles:30,maxFileBytes:20*1024*1024});
 assert.equal(result.filesReceived,true);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(result.listoParaProducir,false);
 assert.equal(result.recibos.length,30);
 assert.equal(result.ficha.trabajos.length,30);
 assert.equal(result.cotizacion.plan.length,30);
 assert.equal(result.cotizacion.detalleImpresiones.length,30);
 const originals=result.cotizacion.detalleImpresiones;
 const caras=originals.reduce((sum,a)=>sum+a.carasPorJuego,0);
 assert.equal(caras,30/4*0+originals.reduce((sum,a)=>sum+a.cantidad,0));
 assert.ok(result.importeVerificado>0);
 assert.equal(result.importeVerificado,result.cotizacion.total);
 assert.deepEqual(result.ficha.trabajos.map(x=>x.paginasPorCaraPresupuestadas),
  m.items.map(x=>x.opciones.paginasPorHoja));
 for(const idx of [0,2,3,17,29]){
  const item=m.items[idx],ficha=result.ficha.trabajos[idx];
  const out=await componerDesdeReciboVerificado({
   manifiesto:result,sesion:item.sesion,trabajoId:ficha.idTrabajo,
   consultarFirmado:m.consultarFirmado,maxFileBytes:20*1024*1024,
   subtle:webcrypto.subtle
  });
  const pdf=await PDFDocument.load(out.pdfBytes);
  const expected=Math.ceil(5/item.opciones.paginasPorHoja);
  const faces=expected+(item.opciones.caras==='double'&&expected%2?1:0);
  assert.equal(pdf.getPageCount(),faces);
  assert.equal(out.ficha.paginasPorCara,item.opciones.paginasPorHoja);
  assert.equal(out.ficha.hojasFisicas,item.opciones.caras==='double'?faces/2:faces);
  assert.equal(out.ficha.guardadoEnDrive,false);
  assert.equal(out.ficha.paymentAuthorized,false);
 }
 assert.equal(m.calls.filter(x=>x.op==='multiReadPart').length,35);
});
test('si uno de 30 archivos no coincide con SHA, abortar sin emitir ficha completa',async()=>{
 const m=await preparar(),target=m.db.get(m.items[17].sesion.uploadId);
 const bytes=Buffer.from(target.bytes);bytes[bytes.length-10]^=1;target.bytes=bytes;
 await assert.rejects(fase4FichaCentralLotePrivada({sesiones:m.items,
  consultarFirmado:m.consultarFirmado,preciosServidor:precios,
  maxFiles:30,maxFileBytes:20*1024*1024}),/hash|PDF|difiere|inconsistente/i);
});
