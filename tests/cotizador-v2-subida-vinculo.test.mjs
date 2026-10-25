import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {subirYVincularPdfCotizadorV2} from '../integraciones/autocotizador/recepcion/subir-vincular-pdf-v2-privado.mjs';
import {verificarVinculoCotizadorV2} from '../integraciones/autocotizador/recepcion/verificar-vinculo-cotizador-v2.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const id='12345678-1234-4234-8234-1234567890ab';
const uploadId='DOC-33333333-1234-4234-8234-1234567890ab';
const orderId='WEB-ENSAYO-12345678901234567890123456789012';
const origin='https://saber-polaroids-express-pruebas.test';
const token='12345678901234567890';
const bytes=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(550000,32)]);
const sha256=sha(bytes);
const ref={schema:'saber-pdf-local-pendiente-v1',
 localRef:id,sha256,nombre:'archivo.pdf',paginas:3,
 bytes:bytes.length,estado:'PENDIENTE_DE_ENVIO',recibido:false,
 verificadoServidor:false};
const file={name:'archivo.pdf',size:bytes.length,
 arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
function backend({resume=false,wrongServer=false,wrongQuote=false}={}){
 const ops=[],blocks=[],progress=[],accepted=resume?[0]:[];
 const fetcher=async(url,options)=>{
  assert.ok(url.startsWith(origin+'/api/ensayo-'),'Sólo destino mismo origen');
  assert.equal(options.redirect,'error');
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.method,'POST');
  const body=JSON.parse(options.body),name=new URL(url).pathname;
  ops.push({name,op:body.op});
  let ret;
  if(name.endsWith('/api/ensayo-pdf-ampliado')){
   if(body.op==='start'){
    assert.equal(body.meta.orderId,orderId);
    assert.equal(body.meta.fileId,'pdf-'+sha256.slice(0,24));
    assert.equal(body.meta.sha256,sha256);
    assert.equal(body.meta.mode,'bn');
    ret={uploadId,token,orderId,paymentAuthorized:false};
   }else if(body.op==='status'){
    ret={uploadId,acceptedParts:accepted,receivedBytes:resume?524288:0};
   }else if(body.op==='part'){
    assert.equal(body.token,token);
    assert.equal(body.sha256,sha(Buffer.from(body.dataBase64,'base64')));
    blocks.push(body.index);ret={accepted:true,index:body.index};
   }else if(body.op==='finish'){
    assert.equal(body.bytes,bytes.length);
    assert.equal(body.parts,2);
    ret={received:true,receiptId:uploadId,sha256,bytes:bytes.length};
   }
  }else{
   assert.equal(name,'/api/ensayo-vincular-pdf-v2');
   assert.equal(body.expectedOrderId,orderId);
   assert.equal(body.expectedMode,'bn');
   assert.equal(body.sesion.uploadId,uploadId);
   const original={
    ok:true,status:'verified',verified:true,storageVerified:true,
    pageVerification:'server',paymentAuthorized:false,
    receiptId:uploadId,orderId,fileId:'pdf-'+sha256.slice(0,24),
    name:'pdf-'+sha256.slice(0,24)+'__archivo.pdf',
    mode:'bn',bytes:bytes.length,sha256,pages:3
   };
   const verified=verificarVinculoCotizadorV2({
    referencia:body.referencia,recibo:wrongServer?
     {...original,sha256:'b'.repeat(64)}:original,
    sessionId:uploadId,expectedOrderId:orderId,expectedMode:'bn'
   });
   ret=body.opciones?{...verified,checkoutEnabled:false,
    cotizacionServidor:{estado:'PRELIMINAR_VERIFICADA_SIN_PEDIDO',
     totalArs:wrongQuote?-1:2100,priceVersion:'ensayo-v1',
     paginasOriginales:3,formato:body.opciones.formato,
     caras:body.opciones.caras,copias:body.opciones.copias,
     anillado:body.opciones.anillado,materialColor:body.opciones.materialColor,paymentAuthorized:false}}:verified;
  }
  return Response.json({ok:true,...ret});
 };
 const args={archivo:file,referencia:ref,orderId,modo:'bn',
  turnstileToken:'turnstile-secret-not-real',origin,fetcher,
  subtle:webcrypto.subtle,onProgress:p=>progress.push(p)};
 return {ops,blocks,progress,args};
}
test('transferencia 2 bloques PDF -> Google verificado -> enlace local sin token ni pago',async()=>{
 const t=backend();
 const done=await subirYVincularPdfCotizadorV2(t.args);
 assert.deepEqual(t.blocks,[0,1]);
 assert.equal(t.ops[0].op,'start');
 assert.equal(t.ops[1].op,'status');
 assert.equal(t.ops.at(-2).op,'finish');
 assert.equal(t.ops.at(-1).name,'/api/ensayo-vincular-pdf-v2');
 assert.equal(done.sha256,sha256);
 assert.equal(done.receiptId,uploadId);
 assert.equal(done.localRef,id);
 assert.equal(done.reciboGoogleVerificado,true);
 assert.equal(done.precioRecalculado,false);
 assert.equal(done.paymentAuthorized,false);
 assert.equal(done.listoParaProducir,false);
 assert.equal(Object.isFrozen(done),true);
 assert.deepEqual(t.progress.map(x=>x.phase),[
  'inicio','transferencia','transferencia','verificacion','confirmado'
 ]);
 assert.doesNotMatch(JSON.stringify(done),/token|dataBase64|driveFileId/);
});
test('reanudación: no retransmitir bloque aceptado por Google',async()=>{
 const t=backend({resume:true});
 const r=await subirYVincularPdfCotizadorV2(t.args);
 assert.deepEqual(t.blocks,[1]);
 assert.equal(r.reciboGoogleVerificado,true);
});
test('si vuelve a elegir otro PDF con mismo nombre y bytes, no comienza recepción',async()=>{
 const t=backend();
 const changed=Uint8Array.from(bytes);changed[42]=65;
 const file={...t.args.archivo,arrayBuffer:async()=>changed.buffer};
 await assert.rejects(subirYVincularPdfCotizadorV2({
  ...t.args,archivo:file
 }),/distinto/);
 assert.equal(t.ops.length,0);
});
test('no enviar a HTTP o destinos distintos y no aceptar referencia sin identidad',async()=>{
 const t=backend();
 for(const props of [
  {origin:'http://dominio.inseguro.test'},
  {origin:'https://ejemplo.test/otra-ruta'},
  {referencia:{...ref,recibido:true}},
  {referencia:{...ref,sha256:'invalid'}},
  {modo:'poster'},
  {orderId:'otro-pedido'},
  {turnstileToken:'corto'}
 ]){
  await assert.rejects(subirYVincularPdfCotizadorV2({...t.args,...props}));
 }
 assert.equal(t.ops.length,0);
});
test('jamás confirmar recepción si el servidor devuelve enlace o PDF incongruente',async()=>{
 const t=backend();
 const rpc=t.args.fetcher;
 const corrupt=async(url,options)=>{
  const res=await rpc(url,options);
  const data=await res.json();
  if(url.endsWith('/api/ensayo-vincular-pdf-v2'))
   return Response.json({...data,sha256:'c'.repeat(64)});
  return Response.json(data);
 };
 await assert.rejects(subirYVincularPdfCotizadorV2({...t.args,fetcher:corrupt}),/no confirmó/);
});

test('opciones válidas transmitidas junto al recibo: presupuesto de servidor sin pago',async()=>{
 const t=backend();
 const opciones={formato:'a4',caras:'simple',copias:2,anillado:'ninguno',materialColor:'obra70'};
 const done=await subirYVincularPdfCotizadorV2({...t.args,opciones});
 assert.equal(done.cotizacionServidor.totalArs,2100);
 assert.equal(done.cotizacionServidor.copias,2);
 assert.equal(done.paymentAuthorized,false);
 assert.equal(done.precioRecalculado,false);
 assert.doesNotMatch(JSON.stringify(done),/token|dataBase64|driveFileId/);
});
test('el presupuesto inválido del servidor no habilita el pedido',async()=>{
 const t=backend({wrongQuote:true});
 await assert.rejects(subirYVincularPdfCotizadorV2({...t.args,
  opciones:{formato:'a4',caras:'simple',copias:2,anillado:'ninguno',materialColor:'obra70'}
 }),/presupuesto documental/);
});
test('opciones imposibles de presupuesto se rechazan sin subir archivos',async()=>{
 const t=backend();
 await assert.rejects(subirYVincularPdfCotizadorV2({...t.args,
  opciones:{formato:'a0',caras:'simple',copias:1,anillado:'ninguno',materialColor:'obra70'}
 }),/Opciones/);
 assert.equal(t.ops.length,0);
});

test('presupuesto de color A3 conserva material propio, nunca usa el de A4',async()=>{
 const t=backend();
 const opts={formato:'a3',caras:'simple',copias:1,anillado:'ninguno',
  materialColor:'a3_color_obra80'};
 const done=await subirYVincularPdfCotizadorV2({...t.args,opciones:opts});
 assert.equal(done.cotizacionServidor.materialColor,'a3_color_obra80');
 assert.equal(done.cotizacionServidor.formato,'a3');
 assert.equal(done.paymentAuthorized,false);
});
