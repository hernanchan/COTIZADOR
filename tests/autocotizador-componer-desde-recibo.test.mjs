import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import precios from '../precios-web.json' with {type:'json'};
import {fase4FichaCentralPrivada} from '../integraciones/autocotizador/recepcion/fase4-ficha-central-privada.mjs';
import {componerDesdeReciboVerificado} from '../integraciones/autocotizador/recepcion/componer-desde-recibo-verificado.mjs';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument,rgb}=require('pdf-lib');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const session={uploadId:'DOC-33333333-1234-4234-8234-1234567890ab',token:'token-interno-no-retornar-123456'};
const orderId='WEB-COMPUESTO-TEST-20261024';
const opts={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
 copias:2,modo:'bn',caras:'double',papelPoster:'obra80',anillado:'ninguno',
 grupoAnillado:'',materialColor:'',productoFoto:'',productoGrafica:'',
 corteVariante:'gt3',corteMetros:1};
async function mock({count=3,bigPage=false,changePdf=false}={}){
 const pdf=await PDFDocument.create();
 for(let i=0;i<count;i++){
  const p=pdf.addPage(bigPage&&i===0?[1683,1190]:[595.276,841.89]);
  p.drawText('SABER PAGINA '+(i+1),{x:45,y:750,size:20,color:rgb(0.1,0.3,0.8)});
 }
 let bytes=Buffer.from(await pdf.save());
 const receipt={ok:true,receiptId:session.uploadId,orderId,fileId:'doc1',
  name:'archivo-prueba.pdf',mode:'bn',bytes:bytes.length,sha256:sha(bytes),pages:count};
 const calls=[];
 const consultarFirmado=async({op,uploadId,token,offset})=>{
  calls.push(op);
  if(uploadId!==session.uploadId||token!==session.token)return {ok:false};
  if(op==='multiInfo')return {...receipt,receiptState:'pages_verified',privateChunkBytes:256*1024};
  if(op==='multiVerifiedStatus')return {...receipt,
   status:'verified',verified:true,storageVerified:true,
   pageVerification:'server',paymentAuthorized:false};
  if(op==='multiReadPart'){
   const source=Buffer.from(bytes);
   if(changePdf)source[source.length-8]^=1;
   const part=source.subarray(offset,offset+256*1024);
   return {ok:true,receiptId:session.uploadId,offset,length:part.length,
    bytes:source.length,sha256:receipt.sha256,
    chunkSha256:sha(part),dataBase64:part.toString('base64')};
  }
  throw Error('Operación HMAC no reconocida');
 };
 const manifiesto=await fase4FichaCentralPrivada({
  sesion:session,opciones:opts,consultarFirmado,preciosServidor:precios
 });
 calls.length=0;
 return {manifiesto,consultarFirmado,calls,originalBytes:bytes};
}
function compile(x){
 return componerDesdeReciboVerificado({
  manifiesto:x.manifiesto,
  sesion:session,
  trabajoId:x.manifiesto.ficha.trabajos[0].idTrabajo,
  consultarFirmado:x.consultarFirmado,subtle:webcrypto.subtle
 });
}
test('dos copias dobles: del PDF original verificado al PDF vectorial compuesto sin habilitar descarga',async()=>{
 const original=await mock();
 const res=await compile(original);
 assert.equal(res.ficha.schema,'saber-borrador-pdf-impresion-privado-v1');
 assert.equal(res.ficha.orderId,orderId);
 assert.equal(res.ficha.documentoRecibo,session.uploadId);
 assert.equal(res.ficha.originalSha256,sha(original.originalBytes));
 assert.equal(res.ficha.compuestoSha256,sha(res.pdfBytes));
 assert.equal(res.ficha.compuestoBytes,res.pdfBytes.length);
 const composed=await PDFDocument.load(res.pdfBytes);
 assert.equal(composed.getPageCount(),8,'3 páginas dúplex con reverso en blanco por juego');
 assert.equal(res.ficha.copias,2);
 assert.equal(res.ficha.caras,'double');
 assert.equal(res.ficha.hojasFisicas,4);
 assert.equal(res.ficha.compuestoPaginas,8);
 assert.equal(res.ficha.guardadoEnDrive,false);
 assert.equal(res.ficha.pdfImprimibleVerificado,false);
 assert.equal(res.ficha.pagoConfirmado,false);
 assert.equal(res.ficha.descargaPrivadaHabilitada,false);
 assert.equal(res.ficha.listoParaProducir,false);
 assert.equal(res.ficha.paymentAuthorized,false);
 assert.ok(original.calls.includes('multiInfo'));
 assert.ok(original.calls.includes('multiVerifiedStatus'));
 assert.ok(original.calls.includes('multiReadPart'));
 assert.doesNotMatch(JSON.stringify(res.ficha),/token|http|sessionUrl|driveFileId/);
});
test('PDF cambiado después de verificar Drive rechaza composición',async()=>{
 const m=await mock();const original=m.consultarFirmado;
 m.consultarFirmado=async p=>{
  const value=await original(p);
  if(p.op==='multiReadPart'){
   const b=Buffer.from(value.dataBase64,'base64');b[5]^=1;
   return {...value,dataBase64:b.toString('base64')};
  }
  return value;
 };
 await assert.rejects(compile(m),/hash|checksum|incorrecto/);
});
test('recibo extraño y otra referencia bloquean antes de descargar datos',async()=>{
 const m=await mock();
 const different={...m.manifiesto,orderId:'WEB-DIFERENTE-20261024'};
 await assert.rejects(componerDesdeReciboVerificado({
  manifiesto:different,sesion:session,
  trabajoId:m.manifiesto.ficha.trabajos[0].idTrabajo,
  consultarFirmado:m.consultarFirmado
 }),/ficha/);
 assert.equal(m.calls.length,0);
});
test('prohibir construir PDF de otro servicio o de una imposición no cotizada',async()=>{
 const m=await mock(),item=m.manifiesto.ficha.trabajos[0];
 const withItem=(change)=>({...m.manifiesto,ficha:{...m.manifiesto.ficha,trabajos:[{...item,...change}]}});
 for(const change of [
  {servicio:'stickers'}, {paginasPorCaraPresupuestadas:4},
  {pdfImprimibleVerificado:true}, {carasPresupuestadas:null},
  {copias:0}, {formatoFinal:'a0'}
 ]){
  await assert.rejects(componerDesdeReciboVerificado({
   manifiesto:withItem(change),sesion:session,
   trabajoId:item.idTrabajo,consultarFirmado:m.consultarFirmado
  }),/Trabajo no apto/);
 }
 assert.equal(m.calls.length,0);
});
test('no reducir un póster mayor que A3 a una impresión documental',async()=>{
 const m=await mock({bigPage:true});
 await assert.rejects(compile(m),/A3|ploteo/);
});
test('si la recepción no verifica páginas o bloquea el recibo, detener antes de imprimir',async()=>{
 const m=await mock();const base=m.consultarFirmado;
 m.consultarFirmado=async p=>{
  const reply=await base(p);
  if(p.op==='multiVerifiedStatus')return {...reply,verified:false};
  return reply;
 };
 await assert.rejects(compile(m),/recepción privada/);
 assert.equal(m.calls.filter(x=>x==='multiReadPart').length,0);
});
