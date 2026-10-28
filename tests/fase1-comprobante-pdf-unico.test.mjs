import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {crearComprobantePdf,comprobarComprobantePdf} from
 '../integraciones/autocotizador/recepcion/comprobante-pdf-servidor.mjs';
import {verificarPedidoPorComprobantes} from
 '../integraciones/autocotizador/recepcion/verificacion-central-comprobante.mjs';
import {conciliarManifiestoV2ConServidor} from
 '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';
const secret='SECRET_TEST_EXCLUSIVO_NO_REAL_0123456789_abcdefghijklmnopqrstuvwxyz';
const now=1793200000000;
const orderId='WEB-ENSAYO-0123456789ABCDEF';
const receiptId='DOC-'+randomUUID();
const sha256=createHash('sha256').update('documento de prueba 12 paginas').digest('hex');
const fileId='pdf-'+sha256.slice(0,24);
const name=fileId+'__prueba.pdf';
const medidas=Array.from({length:12},()=>({anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}));
const recibo={ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',paymentAuthorized:false,
 orderId,fileId,receiptId,name,mode:'bn',bytes:12043,sha256,pages:12};
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const opciones={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
 copias:1,modo:'bn',caras:'double',paginasPorHoja:1,
 papelPoster:'obra80',anillado:'individual',grupoAnillado:'',
 materialColor:'estandar',productoFoto:'',productoGrafica:'',
 corteVariante:'gt3',corteMetros:1};
const manifiesto={schema:'saber-v2-manifiesto-preliminar-v1',orderId,items:[{
 reciboPrivado:receiptId,sha256,paginas:12,
 estado:'REQUIERE_REVALIDACION_DE_BACKEND',
 subtotalReferencia:1, // El navegador puede mentir; jamás se cobra esto.
 opciones:{formato:'a4',caras:'double',copias:1,anillado:'individual',grupoAnillado:''}
 }],registeredInD1:false,paymentAuthorized:false,checkoutEnabled:false,
 pricesRecalculatedByBackend:false,receiptsRecheckedByBackend:false};
const make=async()=>crearComprobantePdf({recibo,medidas,secret,now,subtle:webcrypto.subtle});
const args=comp=>({sesiones:[{sesion:{uploadId:receiptId,token:'token-test-abcdefghijklmnopqrstuvwxyz'},
 comprobanteServidor:comp,opciones}],manifiesto,secret,preciosServidor:precios,
 now,subtle:webcrypto.subtle});
test('un PDF comprobado una vez se cotiza en Central sin descarga de Drive, precio servidor y anillado',async()=>{
 const comp=await make();
 const v=await verificarPedidoPorComprobantes(args(comp));
 assert.equal(v.schema,'saber-central-recepcion-verificada-v1');
 assert.equal(v.importeVerificado,3290);
 assert.equal(v.ficha.totalVerificadoSinPago,3290);
 assert.equal(v.ficha.trabajos[0].tipoAnillado,'individual');
 assert.equal(v.ficha.trabajos[0].paginasOriginales,12);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(v.listoParaProducir,false);
 assert.equal(v.pagoConfirmado,false);
 assert.equal(conciliarManifiestoV2ConServidor({manifiesto,verificacion:v}).importeServidor,3290);
});
test('HMAC no permite cambiar medidas, páginas, huella ni nombre después de sellar',async()=>{
 const good=await make();
 for(const key of ['bytes','pages','sha256','name']){
  const changed=structuredClone(good);
  changed.payload[key]=key==='bytes'?changed.payload.bytes+1:
   key==='pages'?11:key==='sha256'?'f'.repeat(64):'otro.pdf';
  await assert.rejects(comprobarComprobantePdf({
   comprobante:changed,secret,now,subtle:webcrypto.subtle
  }),/Comprobante/);
 }
 const altered=structuredClone(good);altered.payload.pageMetrics[0].anchoCm=90;
 await assert.rejects(verificarPedidoPorComprobantes(args(altered)),/Comprobante/);
});
test('comprobante no sirve para otro pedido, otro PDF ni otro receptor',async()=>{
 const proof=await make();
 await assert.rejects(verificarPedidoPorComprobantes({
  ...args(proof),manifiesto:{...manifiesto,orderId:'WEB-ENSAYO-OTRO_PEDIDO'}
 }),/comprobante firmado/);
 await assert.rejects(verificarPedidoPorComprobantes({
  ...args(proof),manifiesto:{...manifiesto,items:[{...manifiesto.items[0],sha256:'f'.repeat(64)}]}
 }),/comprobante firmado/);
 await assert.rejects(verificarPedidoPorComprobantes({
  ...args(proof),sesiones:[{...args(proof).sesiones[0],
   sesion:{uploadId:'DOC-'+randomUUID(),token:'token-test-abcdefghijklmnopqrstuvwxyz'}}]
 }),/Sesión|comprobante firmado/);
});
test('comprobante expira a los 15 minutos y no puede renovarse desde el navegador',async()=>{
 const good=await make();
 await assert.rejects(comprobarComprobantePdf({
  comprobante:good,secret,now:now+16*60000,subtle:webcrypto.subtle
 }),/vencido/);
 await assert.rejects(verificarPedidoPorComprobantes({
  ...args(good),now:now+16*60000
 }),/vencido/);
});
test('comprobante sólo puede emitirse con recibo confirmado por GAS/Drive',async()=>{
 await assert.rejects(crearComprobantePdf({
  recibo:{...recibo,storageVerified:false},medidas,secret,now,subtle:webcrypto.subtle
 }),/no verificado/);
 await assert.rejects(crearComprobantePdf({
  recibo,medidas:medidas.slice(0,11),secret,now,subtle:webcrypto.subtle
 }),/Medidas/);
});
test('la ruta optimizada no puede aceptar JSON local sin HMAC ni pasar a pagos',async()=>{
 const proof=await make();
 const unsigned=structuredClone(proof);delete unsigned.mac;
 await assert.rejects(verificarPedidoPorComprobantes(args(unsigned)),/Comprobante/);
 const invalid=structuredClone(proof);invalid.mac='0'.repeat(64);
 await assert.rejects(verificarPedidoPorComprobantes(args(invalid)),/Comprobante/);
 const incorrecto=await crearComprobantePdf({
  recibo,medidas,secret:'otro-secreto-privado-de-prueba-1234567890',
  now,subtle:webcrypto.subtle
 });
 await assert.rejects(verificarPedidoPorComprobantes(args(incorrecto)),/Comprobante/);
});
