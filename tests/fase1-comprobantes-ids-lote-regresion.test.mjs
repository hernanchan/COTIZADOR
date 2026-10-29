import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {crearComprobantePdf} from '../integraciones/autocotizador/recepcion/comprobante-pdf-servidor.mjs';
import {verificarPedidoPorComprobantes} from '../integraciones/autocotizador/recepcion/verificacion-central-comprobante.mjs';

const secret='TEST_KEY_ONLY_NOT_PRODUCTION_0123456789_abcdefghijklmnopqrstuvwxyz';
const now=1793200000000;
const orderId='WEB-REGRESION-MULTI-20261029';
const sha256=createHash('sha256').update('PDF mismo contenido').digest('hex');
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const medidas=Array.from({length:12},()=>({anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}));
const opciones={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
 copias:1,modo:'bn',caras:'double',paginasPorHoja:1,
 papelPoster:'obra80',anillado:'individual',grupoAnillado:'',
 materialColor:'estandar',productoFoto:'',productoGrafica:'',
 corteVariante:'gt3',corteMetros:1};
function item(receiptId){
 return {reciboPrivado:receiptId,sha256,paginas:12,
  estado:'REQUIERE_REVALIDACION_DE_BACKEND',
  opciones:{formato:'a4',caras:'double',copias:1,anillado:'individual',grupoAnillado:''}};
}
async function build(fileIds){
 const sesiones=[];
 for(let i=0;i<fileIds.length;i++){
  const receiptId='DOC-'+randomUUID(),fileId=fileIds[i];
  const recibo={ok:true,status:'verified',verified:true,storageVerified:true,
   pageVerification:'server',paymentAuthorized:false,
   orderId,fileId,receiptId,name:'apuntes-'+i+'.pdf',
   mode:'bn',bytes:12043,sha256,pages:12};
  const comprobanteServidor=await crearComprobantePdf({
   recibo,medidas,secret,now,subtle:webcrypto.subtle
  });
  sesiones.push({sesion:{uploadId:receiptId,token:'token-de-prueba-abcdefghijklmnop'},
   opciones,comprobanteServidor});
 }
 const manifiesto={schema:'saber-v2-manifiesto-preliminar-v1',orderId,
  items:sesiones.map(s=>item(s.sesion.uploadId)),
  registeredInD1:false,paymentAuthorized:false,checkoutEnabled:false,
  pricesRecalculatedByBackend:false,receiptsRecheckedByBackend:false};
 return {sesiones,manifiesto,secret,preciosServidor:precios,
  now,subtle:webcrypto.subtle};
}
test('dos PDF con igual SHA y distintos identificadores nuevos se verifican sin relectura',async()=>{
 const one='pdf-'+sha256.slice(0,16)+'-'+randomUUID().replace(/-/g,'');
 const two='pdf-'+sha256.slice(0,16)+'-'+randomUUID().replace(/-/g,'');
 const result=await verificarPedidoPorComprobantes(await build([one,two]));
 assert.equal(result.recibos.length,2);
 assert.notEqual(result.recibos[0].fileId,result.recibos[1].fileId);
 assert.equal(result.recibos[0].sha256,result.recibos[1].sha256);
 assert.equal(result.importeVerificado,6580);
 assert.equal(result.paymentAuthorized,false);
});
test('identificador legado continúa verificándose',async()=>{
 const result=await verificarPedidoPorComprobantes(await build(['pdf-'+sha256.slice(0,24)]));
 assert.equal(result.recibos.length,1);
 assert.equal(result.importeVerificado,3290);
});
test('se rechaza un identificador nuevo incongruente con el SHA firmado',async()=>{
 const bad='pdf-'+('f'===sha256[0]?'e':'f').repeat(16)+'-'+randomUUID().replace(/-/g,'');
 await assert.rejects(verificarPedidoPorComprobantes(await build([bad])),/comprobante firmado/);
});
test('se rechazan dos recibos con el mismo identificador de archivo',async()=>{
 const same='pdf-'+sha256.slice(0,16)+'-'+randomUUID().replace(/-/g,'');
 await assert.rejects(verificarPedidoPorComprobantes(await build([same,same])),/comprobante firmado/);
});
