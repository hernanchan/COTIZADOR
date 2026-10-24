import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import precios from '../precios-web.json' with {type:'json'};
import {fase4FichaCentralLotePrivada} from '../integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const orderId='WEB-LOTE-CENTRAL-20261024';
const sessions=[
 {sesion:{uploadId:'DOC-12345678-1234-4234-8234-1234567890ab',token:'1234567890123456AAAA'},
  opciones:{servicio:'stickers',seleccion:'a4',paginasSeleccionadas:'',
   copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',
   grupoAnillado:'',materialColor:'',productoFoto:'',productoGrafica:'',
   corteVariante:'gt3',corteMetros:1}},
 {sesion:{uploadId:'DOC-87654321-1234-4234-8234-1234567890ab',token:'1234567890123456BBBB'},
  opciones:{servicio:'grafica',productoGrafica:'tarjetas-0',seleccion:'a4',
   paginasSeleccionadas:'',copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
   anillado:'ninguno',grupoAnillado:'',materialColor:'',productoFoto:'',
   corteVariante:'gt3',corteMetros:1}}
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function mock(){
 const map=new Map();
 for(let i=0;i<2;i++){
  const pdf=await PDFDocument.create();
  pdf.addPage([595.28,841.89]);
  const bytes=Buffer.from(await pdf.save()),entry=sessions[i];
  const receipt={ok:true,receiptId:entry.sesion.uploadId,orderId,
   fileId:'f'+(i+1),name:i?'tarjetas.pdf':'stickers.pdf',mode:'bn',
   bytes:bytes.length,sha256:sha(bytes),pages:1};
  map.set(entry.sesion.uploadId,{bytes,receipt});
 }
 const calls=[];
 const consultarFirmado=async ({op,uploadId,token,offset})=>{
  calls.push({op,uploadId});
  const x=map.get(uploadId);
  if(!x||token!==sessions.find(s=>s.sesion.uploadId===uploadId)?.sesion.token)
   return {ok:false};
  if(op==='multiInfo')return {...x.receipt,receiptState:'pages_verified',privateChunkBytes:256*1024};
  if(op==='multiVerifiedStatus')return {...x.receipt,
   status:'verified',verified:true,storageVerified:true,
   pageVerification:'server',paymentAuthorized:false};
  if(op==='multiReadPart'){
   const chunk=x.bytes.subarray(offset,offset+256*1024);
   return {ok:true,receiptId:uploadId,offset,length:chunk.length,
    bytes:x.bytes.length,sha256:x.receipt.sha256,
    chunkSha256:sha(chunk),dataBase64:chunk.toString('base64')};
  }
  throw Error('Operación inesperada');
 };
 return {map,calls,consultarFirmado};
}
const run=(m,sesiones=sessions)=>fase4FichaCentralLotePrivada({
 sesiones,consultarFirmado:m.consultarFirmado,preciosServidor:precios});
test('dos PDFs Drive privados: SHA, páginas, costos y ficha consolidada sin pago',async()=>{
 const m=await mock(),r=await run(m);
 assert.equal(r.schema,'saber-central-recepcion-verificada-v1');
 assert.equal(r.orderId,orderId);
 assert.equal(r.importeVerificado,21000);
 assert.equal(r.recibos.length,2);
 assert.deepEqual(r.ficha.trabajos.map(x=>x.servicio),['stickers','grafica']);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.listoParaProducir,false);
 assert.equal(m.calls.filter(x=>x.op==='multiReadPart').length,2);
});
test('un lote con pedidos cruzados falla ANTES de descargar PDFs',async()=>{
 const m=await mock();
 const second=m.map.get(sessions[1].sesion.uploadId);
 second.receipt={...second.receipt,orderId:'WEB-OTRO-PEDIDO-20261024'};
 await assert.rejects(run(m),/diferentes/);
 assert.equal(m.calls.filter(x=>x.op==='multiReadPart').length,0);
});
test('Google no verificó un recibo: no se prepara carrito ni manifiesto',async()=>{
 const m=await mock(),original=m.consultarFirmado;
 m.consultarFirmado=async a=>{
  const value=await original(a);
  if(a.op==='multiVerifiedStatus'&&a.uploadId===sessions[1].sesion.uploadId)
   return {...value,verified:false};
  return value;
 };
 await assert.rejects(run(m),/recibos/);
 assert.equal(m.calls.filter(x=>x.op==='multiReadPart').length,0);
});
test('repetir sesión en el mismo lote se rechaza sin consultar segunda vez',async()=>{
 const m=await mock();
 await assert.rejects(run(m,[sessions[0],sessions[0]]),/repetida/);
 assert.equal(m.calls.filter(x=>x.op==='multiReadPart').length,0);
});
test('PDF recibido y modificado tras emitir SHA es rechazado',async()=>{
 const m=await mock(),target=m.map.get(sessions[1].sesion.uploadId);
 target.bytes=Buffer.from(target.bytes);
 target.bytes[target.bytes.length-6]^=1;
 await assert.rejects(run(m),/hash|difiere|inconsistente|PDF/i);
});
test('FASE4 conserva cupo de cinco sesiones como límite y nunca autoriza más',async()=>{
 const m=await mock();
 await assert.rejects(run(m,Array.from({length:6},()=>sessions[0])),/cupo/);
 assert.equal(m.calls.length,0);
});
