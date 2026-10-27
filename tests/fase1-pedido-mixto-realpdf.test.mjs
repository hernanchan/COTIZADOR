import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
import precios from '../precios-web.json' with {type:'json'};
import {conectarRecepcionConCentral} from '../integraciones/autocotizador/recepcion/puente-recepcion-central.mjs';
import {prepararManifiestoDocumentalV2} from '../integraciones/autocotizador/recepcion/preparar-manifiesto-v2-documental.mjs';
import {conciliarManifiestoV2ConServidor} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';

const orderId='WEB-FASE1-MIXTO-ENSAYO123';
const names=['IMPRESIONES-1.pdf','IMPRESIONES-2.pdf','PLANO-A0.pdf'];
const receiptIds=['DOC-12345678-1234-4234-8234-1234567890ab',
 'DOC-22345678-1234-4234-8234-1234567890ab',
 'DOC-32345678-1234-4234-8234-1234567890ab'];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const bytes=[],receipts=[],configuraciones=[];
 for(let i=0;i<3;i++){
  const pdf=await PDFDocument.create();
  pdf.setTitle(names[i]);
  pdf.addPage(i===2?[2383.94,3370.39]:[595.28,841.89]);
  const data=await pdf.save();
  bytes.push(data);
  receipts.push({orderId,fileId:'f'+i,receiptId:receiptIds[i],
   name:names[i],mode:'bn',pages:1,bytes:data.length,sha256:hash(data),
   status:'verified',verified:true,storageVerified:true,
   pageVerification:'server',paymentAuthorized:false});
  configuraciones.push({fileId:'f'+i,nombre:names[i],servicio:'auto',
   seleccion:i===2?'original':'a4',paginasSeleccionadas:'',copias:1,
   modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',
   grupoAnillado:'',materialColor:'',productoFoto:'',productoGrafica:'',
   corteVariante:'gt3',corteMetros:1,
   ...(i===2?{clasificacionCliente:[{
    numero:1,anchoCm:84.1,altoCm:118.9,modo:'cad'
   }]}:{})});
 }
 return {bytes,receipts,configuraciones};
}
const verify=f=>conectarRecepcionConCentral({
 orderId,configuraciones:f.configuraciones,preciosServidor:precios,
 consultarRecibosPrivados:async()=>f.receipts,
 descargarPdfPrivado:async({fileId})=>f.bytes[Number(fileId.slice(1))]
});
test('dos A4 y un A0 reales producen una sola ficha, tres recibos y precio del servidor',async()=>{
 const f=await fixture();
 const v=await verify(f);
 assert.equal(v.filesReceived,true);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(v.ficha.listoParaProducir,false);
 assert.deepEqual(v.ficha.trabajos.map(t=>t.servicio),['documentos','documentos','ploteos']);
 assert.equal(v.recibos.length,3);
 assert.equal(v.ficha.trabajos[2].planoPorPagina[0].modo,'cad');
 assert.match(v.ficha.trabajos[2].planoPorPagina[0].rollo,/^rollo\d+$/);
 const trabajos=v.ficha.trabajos.map((t,i)=>{
  const vinculo={
   schema:'saber-v2-pdf-conciliado-privado-v1',orderId,
   localRef:randomUUID(),receiptId:receiptIds[i],
   sha256:f.receipts[i].sha256,pages:1,
   estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
   reciboGoogleVerificado:true,precioRecalculado:false,
   paymentAuthorized:false,listoParaProducir:false
  };
  if(i===2){
   const detalles=v.cotizacion.detallePloteos[0];
   return {vinculo,ploteoVerificado:{
    estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',totalArs:detalles.subtotal,
    priceVersion:'test-mixed',paginasOriginales:1,copias:1,papelPoster:'obra80',
    paginas:detalles.paginas.map(p=>({
     numero:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm,modo:p.modo,
     rollo:p.material,papel:p.papel})),
    paymentAuthorized:false,checkoutEnabled:false
   }};
  }
  const d=v.cotizacion.detalleImpresiones.find(x=>x.nombre===names[i]);
  assert.ok(d);
  return {vinculo:{...vinculo,cotizacionServidor:{
   estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
   totalArs:d.subtotal,priceVersion:'test-mixed',
   paginasOriginales:1,formato:'a4',caras:'simple',copias:1,
   anillado:'ninguno',materialColor:'estandar',paymentAuthorized:false
  }}};
 });
 const m=prepararManifiestoDocumentalV2({orderId,trabajos});
 const c=conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v});
 assert.equal(m.items.length,3);
 assert.equal(c.cantidadArchivos,3);
 assert.equal(c.importeServidor,v.importeVerificado);
 assert.equal(c.registeredInD1,false);
 assert.equal(c.checkoutEnabled,false);
});
test('si uno de los tres archivos difiere del SHA verificado, se rechaza el pedido completo',async()=>{
 const f=await fixture();
 f.bytes[2]=Uint8Array.from([...f.bytes[2].subarray(0,-1),0]);
 await assert.rejects(verify(f));
});
