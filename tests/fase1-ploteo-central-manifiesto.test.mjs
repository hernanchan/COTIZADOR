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
const orderId='WEB-FASE1-PLOTEO-D1-ENSAYO';
const receiptId='DOC-12345678-1234-4234-8234-1234567890ab';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const pdf=await PDFDocument.create();
 pdf.addPage([2383.94,3370.39]); // A0
 const bytes=await pdf.save();
 const info={orderId,fileId:'p1',receiptId,name:'PLANOS.pdf',mode:'bn',
  pages:1,bytes:bytes.length,sha256:sha(bytes),
  status:'verified',verified:true,storageVerified:true,
  pageVerification:'server',paymentAuthorized:false};
 const config={fileId:'p1',nombre:'PLANOS.pdf',servicio:'auto',
  seleccion:'original',paginasSeleccionadas:'',copias:2,modo:'bn',
  caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',
  materialColor:'',productoFoto:'',productoGrafica:'',
  corteVariante:'gt3',corteMetros:1,
  clasificacionCliente:[{numero:1,anchoCm:84.1,altoCm:118.9,modo:'cad'}]};
 const verify=()=>conectarRecepcionConCentral({
  orderId,configuraciones:[config],preciosServidor:precios,
  consultarRecibosPrivados:async()=>[info],
  descargarPdfPrivado:async()=>bytes
 });
 return {info,config,bytes,verify};
}
test('receptor protegido recalcula ploteo A0 y prepara ficha CAD por pagina',async()=>{
 const f=await fixture();
 const v=await f.verify();
 assert.equal(v.importeVerificado>0,true);
 assert.equal(v.ficha.trabajos[0].servicio,'ploteos');
 assert.equal(v.ficha.trabajos[0].planoPorPagina[0].modo,'cad');
 assert.match(v.ficha.trabajos[0].planoPorPagina[0].rollo,/^rollo\d+$/);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(v.ficha.listoParaProducir,false);
 const localRef=randomUUID();
 const link={schema:'saber-v2-pdf-conciliado-privado-v1',orderId,
  localRef,receiptId,sha256:f.info.sha256,pages:1,
  estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
  reciboGoogleVerificado:true,precioRecalculado:false,
  paymentAuthorized:false,listoParaProducir:false};
 const detail=v.cotizacion.detallePloteos[0];
 const plotQuote={estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
  totalArs:v.importeVerificado,priceVersion:'test-private',
  paginasOriginales:1,copias:2,papelPoster:'obra80',
  paginas:detail.paginas.map((p,i)=>({
   numero:i+1,anchoCm:p.anchoCm,altoCm:p.altoCm,
   modo:p.modo,rollo:p.material,papel:p.papel})),
  paymentAuthorized:false,checkoutEnabled:false};
 const m=prepararManifiestoDocumentalV2({
  orderId,trabajos:[{vinculo:link,ploteoVerificado:plotQuote}]
 });
 const c=conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v});
 assert.equal(c.importeServidor,v.importeVerificado);
 assert.equal(c.registeredInD1,false);
 assert.equal(c.paymentAuthorized,false);
});
test('un recibo del PDF distinto no puede entrar en el manifiesto',async()=>{
 const f=await fixture();
 const v=await f.verify();
 const invalid={schema:'saber-v2-manifiesto-preliminar-v1',orderId,
  items:[{reciboPrivado:receiptId,sha256:'b'.repeat(64),paginas:1,
   opciones:{servicio:'ploteos',copias:2,papelPoster:'obra80'},
   estado:'REQUIERE_REVALIDACION_DE_BACKEND'}],
  registeredInD1:false,paymentAuthorized:false,checkoutEnabled:false,
  pricesRecalculatedByBackend:false,receiptsRecheckedByBackend:false};
 assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:invalid,verificacion:v}));
});
