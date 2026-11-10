import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {crearFlujoUniversalPDF} from '../integraciones/autocotizador/recepcion/flujo-universal-pdf-cliente.mjs';
import {enviarTUSUniversalPagado} from '../integraciones/autocotizador/recepcion/tus-universal-directo-cliente.mjs';

const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ID='12345678-1234-4123-8123-123456789abc';
const SHA1='1'.repeat(64),SHA2='2'.repeat(64);
const MiB=1048576;
const file=(name,size)=>({name,size,
 slice:()=>({size:5,arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer})});
const files=[file('Apuntes.pdf',2*MiB),file('PanelA4.pdf',100*MiB)];
const arch=(name)=>({nombre:name,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'});
const archivos=files.map(f=>arch(f.name));
function setup(){
 const calls=[],state={paid:false};
 const fetcher=async(path,init)=>{
  const p=JSON.parse(init.body);
  calls.push({path,body:p});
  if(path.endsWith('/ensayo-r2-borrador-universal')){
   assert.equal(p.archivos.length,2);
   assert.equal(p.manifiestos.length,2);
   assert.equal(p.manifiestos[0].bytes,2*MiB);
   assert.equal(p.manifiestos[1].bytes,100*MiB);
   assert.equal(p.manifiestos[0].sha256,SHA1);
   return Response.json({ok:true,webOrderId:ORDER,draftId:ID,
    quoteHash:'a'.repeat(64),totalArs:12500,fileCount:2,
    paymentAuthorized:false,checkoutEnabled:false,filesUploaded:false});
  }
  if(path.endsWith('/ensayo-r2-orden-universal')){
   assert.equal(p.draftId,ID);
   assert.equal(p.quoteHash,'a'.repeat(64));
   assert.equal(p.telefono,'3515551234');
   return Response.json({ok:true,webOrderId:ORDER,
    commercialOrderId:ID,numeroOrden:'093',totalArs:12500,
    fileCount:2,checkoutEnabled:false,uploadAuthorized:false,
    productionAuthorized:false});
  }
  if(path.endsWith('/ensayo-r2-checkout-universal')){
   assert.equal(p.webOrderId,ORDER);
   assert.equal(p.commercialOrderId,ID);
   if(p.action==='start')
    return Response.json({ok:true,webOrderId:ORDER,commercialOrderId:ID,
     amountArs:12500,fileCount:2,estado:'pendiente',uploadAuthorized:false,
     checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?p=test'});
   return Response.json({ok:true,webOrderId:ORDER,commercialOrderId:ID,
    amountArs:12500,fileCount:2,
    estado:state.paid?'pagado_esperando_archivos':'pendiente',
    uploadAuthorized:state.paid,productionAuthorized:false,pendingFiles:2,receivedFileIds:[]});
  }
  throw Error('unexpected API '+path);
 };
 let r2=0,tus=0;
 const flow=crearFlujoUniversalPDF({
  files,archivos,webOrderId:ORDER,telefono:'3515551234',
  fetcher,uuid:()=>ID,
  hasher:async f=>f.size>40*MiB?SHA2:SHA1,
  uploadTus:async args=>{
   assert.equal(state.paid,true);
   tus++;
   assert.equal(args.trabajos.length,1);
   assert.equal(args.trabajos[0].meta.bytes,2*MiB);
   return {ok:true,savedFiles:1,fileIds:args.trabajos.map(x=>x.meta.fileId)};
  },
  uploadR2:async args=>{
   assert.equal(state.paid,true);r2++;
   assert.equal(args.meta.bytes,100*MiB);
   assert.equal(args.meta.pages,1);
   assert.equal(args.meta.mode,'bn');
   assert.equal(args.orderId,ORDER);
   return {sha256Verificado:true,sha256:SHA2,bytes:100*MiB,stagedForCentral:true};
  }
 });
 return {flow,state,calls,get r2(){return r2},get tus(){return tus}};
}
test('multi PDF, big A4 via R2, solo un precio D1 y ninguna carga antes del pago',async()=>{
 const x=setup();
 assert.equal(x.flow.phase,'seleccionado');
 const quote=await x.flow.preparar();
 assert.equal(quote.numeroOrden,'093');
 assert.equal(quote.totalArs,12500);
 assert.deepEqual(x.calls.map(x=>x.path),[
  '/prueba-v2/api/ensayo-r2-borrador-universal',
  '/prueba-v2/api/ensayo-r2-orden-universal'
 ]);
 assert.equal(x.r2,0);assert.equal(x.tus,0);
 await assert.rejects(x.flow.subirArchivosPagados(),/UNIVERSAL_SUBIDA_BLOQUEADA/);
 assert.equal(x.calls.length,2);
 const url=await x.flow.iniciarPagoSandbox();
 assert.match(url,/mercadopago\.com\.ar/);
 assert.equal((await x.flow.consultarPago()),'pendiente');
 assert.equal(x.r2,0);assert.equal(x.tus,0);
 x.state.paid=true;
 assert.equal((await x.flow.consultarPago()),'pagado');
 const done=await x.flow.subirArchivosPagados();
 assert.equal(done.ok,true);
 assert.equal(done.fileCount,2);
 assert.equal(done.productionAuthorized,false);
 assert.equal(x.r2,1);assert.equal(x.tus,1);
 assert.equal(x.calls.filter(x=>x.path.endsWith('borrador-universal')).length,1);
 assert.equal(x.calls.filter(x=>x.path.endsWith('orden-universal')).length,1);
});
test('origen de importe adulterado no genera checkout ni subida',async()=>{
 const x=setup();
 const original=x.calls;
 const badFetcher=async(path,init)=>{
  if(path.endsWith('ensayo-r2-orden-universal'))
   return Response.json({ok:true,webOrderId:ORDER,commercialOrderId:ID,
    numeroOrden:'093',totalArs:12,fileCount:2,checkoutEnabled:false,
    uploadAuthorized:false,productionAuthorized:false});
  return (await setupMock(path,init));
 };
 async function setupMock(path,init){
  const p=JSON.parse(init.body);
  if(path.endsWith('ensayo-r2-borrador-universal'))
   return Response.json({ok:true,webOrderId:ORDER,draftId:ID,quoteHash:'a'.repeat(64),
    totalArs:12500,fileCount:2,paymentAuthorized:false,
    checkoutEnabled:false,filesUploaded:false});
  throw Error('unexpected');
 }
 const flow=crearFlujoUniversalPDF({files,archivos,webOrderId:ORDER,telefono:'3515551234',
  fetcher:badFetcher,uuid:()=>ID,
  hasher:async f=>f.size>40*MiB?SHA2:SHA1,
  uploadR2:async()=>{throw Error('MUST_NOT_UPLOAD')},
  uploadTus:async()=>{throw Error('MUST_NOT_UPLOAD')}});
 await assert.rejects(flow.preparar(),/UNIVERSAL_ORDEN_COMERCIAL_DISTINTA/);
 await assert.rejects(flow.iniciarPagoSandbox(),/UNIVERSAL_PAGO_NO_PREPARADO/);
});
test('rechaza lote grande sin R2 o TUS >60MiB',()=>{
 const only=[file('Solo.pdf',2*MiB)];
 assert.throws(()=>crearFlujoUniversalPDF({files:only,archivos:[arch('Solo.pdf')],
  webOrderId:ORDER,telefono:'3515551234'}),/UNIVERSAL_CUPO_RECEPCION_INVALIDO/);
 const all=[file('1.pdf',35*MiB),file('2.pdf',30*MiB),file('3.pdf',90*MiB)];
 assert.throws(()=>crearFlujoUniversalPDF({files:all,
  archivos:all.map(x=>arch(x.name)),webOrderId:ORDER,telefono:'3515551234'}),/UNIVERSAL_CUPO_RECEPCION_INVALIDO/);
});
test('Uppy TUS universal no llama registro comercial viejo',async()=>{
 const original=file('Tema.pdf',2*MiB),paths=[];
 const meta={fileId:'uno',name:original.name,mode:'bn',bytes:original.size,
  sha256:SHA1,pages:1};
 class FakeUppy{
  constructor(){this.files=[];}
  use(){return this;}
  on(){}
  addFile(x){this.files.push(x);return String(this.files.length);}
  setFileMeta(){}
  async upload(){return {successful:this.files,failed:[]}}
  close(){}
 }
 const fetcher=async(path,req)=>{
  paths.push(path);
  if(path.endsWith('iniciar'))return Response.json({ok:true,orderId:ORDER,
   projectRef:'abcdefghijklmnopqrstuvwx',bucket:'saber-tus-lab',
   publishableKey:'local-publishable-key',
   sessions:[{fileId:'uno',bytes:original.size,pages:1,signature:'signed-tus-token',
    proof:'signed-claim',objectName:'v2/'+ORDER+'/'+ID+'.pdf'}]});
  if(path.endsWith('confirmar'))return Response.json({ok:true,
   webOrderId:ORDER,savedFiles:1,productionAuthorized:false,
   receipts:[{fileId:'uno',saved:true}]});
  throw Error('Unexpected '+path);
 };
 const res=await enviarTUSUniversalPagado({
  orderId:ORDER,trabajos:[{file:original,meta}],fetcher,
  loadUploader:async()=>({Uppy:FakeUppy,Tus:class Tus{}})
 });
 assert.deepEqual(res.fileIds,['uno']);
 assert.equal(paths.length,2);
 assert.ok(paths.every(x=>x.includes('ensayo-tus-universal-')));
 assert.ok(!paths.some(x=>x.includes('ensayo-tus-registrar')));
});
test('UI esconde transporte universal si no hay flags',()=>{
 const html=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
 assert.match(html,/const UNIVERSAL_R2_UI_ENABLED=\$\{universalEnabled===true\}/);
 assert.match(html,/SABER_SMART_UNIVERSAL_PDF/);
 assert.match(html,/prepararPedidoUniversal/);
 const server=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(server,/function universalUiConfigurado\(env\)/);
 assert.match(server,/DOCS_R2_UNIVERSAL_TUS_ENABLED/);
});
