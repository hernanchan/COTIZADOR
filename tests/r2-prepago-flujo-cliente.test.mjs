import test from 'node:test';
import assert from 'node:assert/strict';
import {crearFlujoR2PagoAntesDeCarga}
 from '../integraciones/autocotizador/recepcion/r2-prepago-flujo-cliente.mjs';
const ID='WEB-ENSAYO-'+'A'.repeat(32);
const CID='12345678-1234-4123-8123-123456789abc';
const SHA='b'.repeat(64);
const size=150*1024*1024;
const file={name:'PANEL-A1.pdf',size,slice(){throw Error('READ_ONLY_IN_TEST')}};
const archivos=[{nombre:file.name,paginas:[{numero:1,anchoCm:59.4,
 altoCm:84.1,modo:'cad'}],servicio:'auto',modo:'bn'}];
function tester({stagedForCentral=true}={}){
 const requests=[],states=[];let paid=false,revoked=false,uploads=0;
 const fetcher=async(route,opts)=>{
  const input=JSON.parse(opts.body);
  requests.push({route,input});
  if(route==='/prueba-v2/api/ensayo-r2-prepago'){
   assert.equal(input.bytes,size);
   assert.equal(input.sha256,SHA);
   assert.equal(input.archivos.length,1);
   return Response.json({ok:true,webOrderId:ID,commercialOrderId:CID,
    amountArs:18000,quoteState:'PRELIMINAR_SIN_ARCHIVO',
    paymentAuthorized:false,uploadAuthorized:false,filesUploaded:false});
  }
  assert.equal(route,'/prueba-v2/api/ensayo-r2-prepago-checkout');
  assert.equal(input.commercialOrderId,CID);
  if(input.action==='start')return Response.json({
   ok:true,webOrderId:ID,commercialOrderId:CID,
   amountArs:18000,estado:'pendiente',uploadAuthorized:false,
   filesUploaded:false,checkoutUrl:'https://www.mercadopago.com.ar/checkout?pref=TEST'
  });
  return Response.json({ok:true,webOrderId:ID,commercialOrderId:CID,
   amountArs:18000,estado:revoked?'revocado':paid?'pagado_esperando_archivo':'pendiente',
   uploadAuthorized:paid&&!revoked,filesUploaded:false});
 };
 const uploader=async args=>{
  uploads++;
  assert.equal(args.orderId,ID);
  assert.equal(args.requireCentralStaging,true);
  assert.equal(args.file,file);
  assert.deepEqual(args.meta,{fileId:'planoA1',name:file.name,mode:'bn',
   bytes:size,sha256:SHA,pages:1});
  return {sha256Verificado:true,sha256:SHA,bytes:size,
   contenidoPdfVerificado:false,stagedForCentral};
 };
 const flow=crearFlujoR2PagoAntesDeCarga({file,archivos,webOrderId:ID,
  fetcher,uploader,hasher:async()=>SHA,onState:s=>states.push(s),storage:null});
 return {flow,requests,states,fetcher,uploader,get uploads(){return uploads},
  set paid(v){paid=v},set revoked(v){revoked=v}};
}
test('cotizar y abandonar: no se llama a R2 antes de pagar',async()=>{
 const t=tester();
 assert.equal(t.flow.phase,'seleccionado');
 await assert.rejects(t.flow.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 await t.flow.preparar();
 assert.equal(t.flow.amountArs,18000);
 await assert.rejects(t.flow.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 assert.equal(t.requests.length,1);
 assert.equal(t.uploads,0);
});
test('estado pendiente sin R2, pago confirmado permite subir exactamente una vez',async()=>{
 const t=tester();
 await t.flow.preparar();
 const checkout=await t.flow.iniciarPagoSandbox();
 assert.ok(checkout.startsWith('https://www.mercadopago.com.ar/'));
 assert.equal(await t.flow.consultarPago(),'pendiente');
 assert.equal(t.uploads,0);
 t.paid=true;
 assert.equal(await t.flow.consultarPago(),'pagado');
 const uploaded=await t.flow.subirDespuesDePagar();
 assert.equal(uploaded.stagedForCentral,true);
 assert.equal(t.uploads,1);
 assert.equal(t.flow.phase,'carga_verificada');
 await assert.rejects(t.flow.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 assert.equal(t.uploads,1);
});
test('pago revocado impide la subida aun con intención existente',async()=>{
 const t=tester();
 await t.flow.preparar();await t.flow.iniciarPagoSandbox();
 t.revoked=true;
 assert.equal(await t.flow.consultarPago(),'revocado');
 await assert.rejects(t.flow.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 assert.equal(t.uploads,0);
});
test('rechazar pedido ajeno o enlace MP apócrifo sin usar R2',async()=>{
 const t=tester();
 await t.flow.preparar();
 const original=t.requests.length;
 await assert.rejects(t.flow.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 assert.equal(t.requests.length,original);
 assert.equal(t.uploads,0);
});


test('recuperar PDF reelecto: mismo SHA antes de consultar pago; sin doble cobro',async()=>{
 const t=tester();
 const recovered=crearFlujoR2PagoAntesDeCarga({file,archivos,webOrderId:ID,
  fetcher:t.fetcher,uploader:t.uploader,hasher:async()=>SHA,storage:null,
  restaurarPago:{commercialOrderId:CID,amountArs:18000,sha256:SHA}});
 assert.equal(recovered.phase,'archivo_pendiente_de_comparar');
 assert.equal(t.requests.length,0);
 await assert.rejects(recovered.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
 await recovered.validarRestauracion();
 assert.equal(recovered.phase,'esperando_pago');
 assert.equal(t.requests.length,0);
 assert.equal(await recovered.consultarPago(),'pendiente');
 assert.equal(t.uploads,0);
 t.paid=true;
 assert.equal(await recovered.consultarPago(),'pagado');
 await recovered.subirDespuesDePagar();
 assert.equal(t.uploads,1);
 assert.equal(recovered.phase,'carga_verificada');
 assert.equal(t.requests.filter(x=>x.input.action==='start').length,0);
});

test('recuperar PDF diferente: rechaza SHA sin solicitar pago ni R2',async()=>{
 const t=tester();
 const recovered=crearFlujoR2PagoAntesDeCarga({file,archivos,webOrderId:ID,
  fetcher:t.fetcher,uploader:t.uploader,storage:null,
  hasher:async()=> 'f'.repeat(64),
  restaurarPago:{commercialOrderId:CID,amountArs:18000,sha256:SHA}});
 await assert.rejects(recovered.validarRestauracion(),/PDF_DIFERENTE_AL_COTIZADO/);
 assert.equal(recovered.phase,'archivo_no_coincide');
 assert.equal(t.uploads,0);
 assert.equal(t.requests.length,0);
 await assert.rejects(recovered.subirDespuesDePagar(),/R2_BLOQUEADO_SIN_PAGO/);
});

test('recuperación alterada: jamás habilita R2',()=>{
 const t=tester();
 assert.throws(()=>crearFlujoR2PagoAntesDeCarga({file,archivos,webOrderId:ID,
  fetcher:t.fetcher,uploader:t.uploader,hasher:async()=>SHA,
  restaurarPago:{commercialOrderId:CID,amountArs:0,sha256:SHA}}),
 /PREPAGO_RECUPERACION_NO_VALIDA/);
 assert.equal(t.uploads,0);
});

test('un PDF íntegro sin confirmación Central no se anuncia recibido',async()=>{
 const t=tester({stagedForCentral:false});
 await t.flow.preparar();
 await t.flow.iniciarPagoSandbox();
 t.paid=true;
 assert.equal(await t.flow.consultarPago(),'pagado');
 await assert.rejects(t.flow.subirDespuesDePagar(),/PREPAGO_CARGA_NO_VERIFICADA/);
 assert.equal(t.flow.phase,'pagado_esperando_subida');
 assert.equal(t.uploads,1);
 assert.equal(t.requests.filter(x=>x.input.action==='start').length,1);
});
