/**
 * Prueba punta a punta del Worker compilado. Google Apps Script, Google Drive,
 * Turnstile y Central D1 se SIMULAN EN MEMORIA; NO hay envíos reales ni pagos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID,webcrypto} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {prepararManifiestoDocumentalV2} from './preparar-manifiesto-v2-documental.mjs';
import worker from './dist/saber-documentos-cotizador-fase4.mjs';

globalThis.crypto ??= webcrypto;
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const relayKey='TEST_RELAY_NOT_REAL_0123456789_abcdefghijklmnopqrstuvwxyz';
const bridgeKey='TEST_BRIDGE_NOT_REAL_0123456789_abcdefghij';
const adminKey='TEST_ADMIN_NOT_REAL_0123456789_abcdefghij';
const hash=b=>createHash('sha256').update(b).digest('hex');
const uploads=new Map();
let expectedGoogle=null,googleCalls=[],stageCount=0,preparedCount=0;
let expectedCentral={total:3290,receipts:1};
const now=Math.floor(Date.now()/1000);
const env={
 DOCS_RELAY_KEY:relayKey,
 DOCS_ALLOWED_ORIGIN:origin,
 DOCS_SCRIPT_URL:'https://script.google.com/macros/s/FAKE_PHASE4/exec',
 DOCS_TURNSTILE_SECRET:'TEST_TURNSTILE_SECRET',
 DOCS_TURNSTILE_SITE_KEY:'0x4AAAA-test-0123456789',
 DOCS_EXTENDED_RECEIVER_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_RECEIPT_LINK_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_ADMIN_KEY:adminKey,
 CENTRAL_BRIDGE_KEY:bridgeKey,
 CENTRAL_TEST_URL:'https://saber-pagos-pruebas.test.workers.dev/internal/central/stage',
 SABER_CENTRAL:{fetch:async request=>{
  assert.equal(request.method,'POST');
  const body=await request.text();
  const ts=request.headers.get('x-saber-ts');
  const id=request.headers.get('x-saber-request-id');
  const mac=createHmac('sha256',bridgeKey).update(ts+'\n'+id+'\n'+body).digest('hex');
  assert.equal(request.headers.get('x-saber-signature'),mac);
  assert.ok(Math.abs(Number(ts)-now)<300);
  const data=JSON.parse(body);
  const path=new URL(request.url).pathname;
  if(path==='/internal/central/stage'){
   stageCount++;
   assert.equal(data.schema,'saber-central-recepcion-verificada-v1');
   assert.equal(data.importeVerificado,expectedCentral.total);
   assert.equal(data.recibos.length,expectedCentral.receipts);
   assert.equal(data.ficha.trabajos.length,expectedCentral.receipts);
   assert.ok(data.ficha.trabajos.every(t=>t.tipoAnillado==='individual'));
   assert.ok(data.ficha.trabajos.every(t=>t.paginasOriginales===12));
   assert.equal(data.paymentAuthorized,false);
   assert.equal(data.listoParaProducir,false);
   return Response.json({saved:true,web_order_id:data.orderId,idempotent:false,
    paymentAuthorized:false},{status:201});
  }
  if(path==='/internal/central/prepare-order'){
   preparedCount++;
   assert.equal(data.items.length,0);
   assert.match(data.webOrderId,/^WEB-/);
   return Response.json({created:true,commercial_order_id:randomUUID(),
    amount_ars:expectedCentral.total,state:'awaiting_payment',checkoutEnabled:false,
    paymentAuthorized:false},{status:201});
  }
  throw Error('Central mock: unexpected route '+path);
 }}
};
function receipt(s){
 return {ok:true,status:'verified',verified:true,storageVerified:true,
  pageVerification:'server',paymentAuthorized:false,receiptId:s.uploadId,
  orderId:s.orderId,fileId:s.fileId,name:s.fileId+'__'+s.name,
  mode:s.mode,bytes:s.bytes,sha256:s.sha256,pages:s.pages};
}
function dispatch(p){
 googleCalls.push(p.op);
 if(p.op==='multiStartBatch'){
  const sessions=[];
  for(const m of p.metas){
   const key=m.orderId+':'+m.fileId;
   let item=uploads.get(key),newSession=false;
   if(!item){
    newSession=true;
    item={...m,uploadId:'DOC-'+randomUUID(),
     token:'TOKEN_BATCH_TEST_0123456789_abcdefghijklmnop',partsStored:[]};
    uploads.set(key,item);uploads.set(item.uploadId,item);
   }else if(item.sha256!==m.sha256||item.bytes!==m.bytes){
    return {ok:false,error:'Identificador de ensayo en uso'};
   }
   sessions.push({fileId:m.fileId,orderId:m.orderId,
    uploadId:item.uploadId,token:item.token,newSession});
  }
  return {ok:true,orderId:p.metas[0].orderId,
   sessions,paymentAuthorized:false};
 }
 if(p.op==='multiStart'){
  const m=p.meta;
  const existing=uploads.get(m.orderId);
  if(existing)return {ok:true,uploadId:existing.uploadId,token:existing.token};
  const s={...m,uploadId:'DOC-'+randomUUID(),
   token:'TOKEN_TEST_ONLY_0123456789_abcdefghijklmnop',partsStored:[]};
  uploads.set(m.orderId,s);uploads.set(s.uploadId,s);
  return {ok:true,uploadId:s.uploadId,token:s.token};
 }
 const s=uploads.get(p.uploadId);
 if(!s||p.token!==s.token)throw Error('Mock unauthorized');
 if(p.op==='multiStatus')
  return {ok:true,acceptedParts:s.partsStored.map((v,i)=>v?i:null).filter(x=>x!==null)};
 if(p.op==='multiPart'){
  const chunk=Buffer.from(p.dataBase64,'base64');
  if(hash(chunk)!==p.sha256||p.index>=s.parts||chunk.byteLength!==p.bytes)
   throw Error('Mock bad part');
  s.partsStored[p.index]=chunk;
  return {ok:true,accepted:true,index:p.index};
 }
 if(p.op==='multiFinish'){
  const data=Buffer.concat(s.partsStored);
  if(data.length!==s.bytes||hash(data)!==s.sha256)throw Error('Mock SHA mismatch');
  s.data=data;
  return {ok:true,received:true,verified:false,receiptId:s.uploadId};
 }
 if(p.op==='multiVerifiedStatus')
  return s.pagesVerified?receipt(s):{ok:true,status:'bytes_checked',verified:false};
 if(p.op==='multiInfo'){
  if(!s.data)throw Error('Mock not uploaded');
  return {ok:true,receiptId:s.uploadId,orderId:s.orderId,fileId:s.fileId,
   name:s.fileId+'__'+s.name,mode:s.mode,bytes:s.bytes,sha256:s.sha256,
   privateChunkBytes:256*1024,pageVerification:s.pagesVerified?'server':null,
   pages:s.pagesVerified||null,receiptState:s.pagesVerified?'pages_verified':'bytes_checked'};
 }
 if(p.op==='multiReadPart'){
  const offset=p.offset;
  const chunk=s.data.subarray(offset,offset+256*1024);
  return {ok:true,receiptId:s.uploadId,offset,length:chunk.length,bytes:s.bytes,
   sha256:s.sha256,chunkSha256:hash(chunk),dataBase64:chunk.toString('base64')};
 }
 if(p.op==='multiCommitPages'){
  if(p.sha256!==s.sha256||p.pages<1)throw Error('Mock bad pages');
  s.pages=p.pages;s.pagesVerified=p.pages;
  return receipt(s);
 }
 throw Error('Mock unexpected op '+p.op);
}
const oldFetch=globalThis.fetch;
let turnstileCount=0;
const simulatedFetch=async (url,options={})=>{
 const uri=new URL(url);
 if(uri.hostname==='challenges.cloudflare.com'){
  turnstileCount++;
  return Response.json({success:true,action:'documentos',hostname:new URL(origin).hostname});
 }
 if(uri.hostname==='script.google.com'){
  const envelope=JSON.parse(options.body);
  const digest=createHmac('sha256',relayKey)
   .update(envelope.timestamp+'\n'+envelope.payloadJson).digest('hex');
  assert.equal(envelope.signature,digest);
  expectedGoogle=JSON.parse(envelope.payloadJson);
  return new Response(null,{status:302,
   headers:{Location:'https://script.googleusercontent.com/macros/echo?fake'}});
 }
 if(uri.hostname==='script.googleusercontent.com'){
  try{return Response.json(dispatch(expectedGoogle))}
  catch(err){return Response.json({ok:false,error:err.message})}
 }
 throw Error('Unexpected external request '+url);
};
globalThis.fetch=simulatedFetch;
const call=(path,data,additional={})=>worker.fetch(new Request(origin+path,{
 method:'POST',headers:{'Content-Type':'application/json',
  Origin:origin,'Sec-Fetch-Site':'same-origin',...additional},
 body:JSON.stringify(data)
}),env);


test('Worker inicia 3 sesiones PDF con un solo Turnstile y un solo POST Google, rechaza mezclas',async()=>{
 const orderId='WEB-ENSAYO-LOTE-ABCDEFGHIJ';
 const metas=Array.from({length:3},(_,i)=>{
  const sha256=hash(Buffer.from('archivo original '+i));
  return {orderId,fileId:'pdf-'+sha256.slice(0,24),
   name:'archivo'+i+'.pdf',mode:'bn',bytes:500+i,
   sha256,partBytes:524288,parts:1};
 });
 const beforeVerify=turnstileCount;
 const beforeGAS=googleCalls.length;
 const start=await call('/api/ensayo-pdf-iniciar-lote',{
  metas,turnstileToken:'TOKEN_TURNSTILE_TANDA_VERIFICADO'
 });
 assert.equal(start.status,200,JSON.stringify(await start.clone().json()));
 const v=await start.json();
 assert.equal(v.ok,true);
 assert.equal(v.paymentAuthorized,false);
 assert.equal(v.maxParallelUploads,2);
 assert.equal(v.sessions.length,3);
 assert.equal(turnstileCount-beforeVerify,1,'Un solo desafío para toda la tanda');
 assert.deepEqual(googleCalls.slice(beforeGAS),['multiStartBatch'],
  'Un solo POST a GAS en vez de uno por archivo');
 assert.equal(new Set(v.sessions.map(s=>s.uploadId)).size,3);
 assert.ok(v.sessions.every(s=>s.newSession===true));
 const again=await call('/api/ensayo-pdf-iniciar-lote',{
  metas,turnstileToken:'TOKEN_TURNSTILE_TANDA_SEGUNDO'
 });
 assert.equal(again.status,200);
 const twice=await again.json();
 assert.ok(twice.sessions.every(s=>s.newSession===false));
 assert.deepEqual(twice.sessions.map(s=>s.uploadId),v.sessions.map(s=>s.uploadId));
 const beforeBad=googleCalls.length;
 const bad=await call('/api/ensayo-pdf-iniciar-lote',{
  metas:[metas[0],{...metas[1],orderId:'WEB-OTRO-PEDIDO'}],
  turnstileToken:'TOKEN_INVALID_BATCH'
 });
 assert.equal(bad.status,400);
 assert.equal(googleCalls.length,beforeBad);
 const duplicate=await call('/api/ensayo-pdf-iniciar-lote',{
  metas:[metas[0],metas[0]],turnstileToken:'TOKEN_BATCH_DUPLICADO'
 });
 assert.equal(duplicate.status,400);
 assert.equal(googleCalls.length,beforeBad);
 const extra=await call('/api/ensayo-pdf-iniciar-lote',{
  metas:[{...metas[0],bytes:21*1024*1024}],
  turnstileToken:'TOKEN_BATCH_EXCESO_TAMANO'
 });
 assert.equal(extra.status,400);
 assert.equal(stageCount,0,'Sólo crear sesiones nunca registra pedido en D1');
 assert.equal(preparedCount,0);
});

test('Worker enlaza 12p y registra en Central sin segunda lectura de Drive; sello inválido se rechaza',async()=>{
 try{
  const pdf=await PDFDocument.create();
  for(let i=0;i<12;i++)pdf.addPage([595.28,841.89]);
  const bytes=Buffer.from(await pdf.save());
  const sha256=hash(bytes),fileId='pdf-'+sha256.slice(0,24);
  const orderId='WEB-ENSAYO-ABCDEF0123456789';
  const name='poliza-prueba.pdf';
  const meta={orderId,fileId,name,mode:'bn',bytes:bytes.length,sha256,
   partBytes:524288,parts:Math.ceil(bytes.length/524288)};
  const initial=await call('/api/ensayo-pdf-ampliado',{
   op:'start',meta,turnstileToken:'TEST_TURNSTILE_TOKEN_01234567'
  });
  assert.equal(initial.status,200,JSON.stringify(await initial.clone().json()));
  const session=await initial.json();
  assert.equal(session.ok,true);
  for(let i=0;i<meta.parts;i++){
   const part=bytes.subarray(i*524288,Math.min(bytes.length,(i+1)*524288));
   const r=await call('/api/ensayo-pdf-ampliado',{
    op:'part',uploadId:session.uploadId,token:session.token,index:i,
    bytes:part.length,sha256:hash(part),dataBase64:part.toString('base64')
   });
   assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
  }
  const finished=await call('/api/ensayo-pdf-ampliado',{
   op:'finish',uploadId:session.uploadId,token:session.token,
   sha256,bytes:bytes.length,parts:meta.parts
  });
  assert.equal(finished.status,200,JSON.stringify(await finished.clone().json()));
  const referencia={schema:'saber-pdf-local-pendiente-v1',
   localRef:randomUUID(),sha256,bytes:bytes.length,paginas:12,
   nombre:name,estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false};
  const opciones={formato:'a4',caras:'double',copias:1,
   anillado:'individual',materialColor:'obra70',paginasPorHoja:1};
  const linkedResponse=await call('/api/ensayo-vincular-pdf-v2',{
   expectedOrderId:orderId,expectedMode:'bn',referencia,
   sesion:{uploadId:session.uploadId,token:session.token},opciones
  });
  assert.equal(linkedResponse.status,200,JSON.stringify(await linkedResponse.clone().json()));
  const linked=await linkedResponse.json();
  assert.equal(linked.cotizacionServidor.totalArs,3290);
  assert.equal(linked.comprobanteServidor?.payload?.pages,12);
  assert.equal(linked.comprobanteServidor?.payload?.sha256,sha256);
  assert.match(linked.comprobanteServidor.mac,/^[a-f0-9]{64}$/);
  const readsAfterLink=googleCalls.filter(x=>x==='multiReadPart').length;
  assert.ok(readsAfterLink>0,'Se lee y verifica el PDF original al enlazar');
  const manifiesto=prepararManifiestoDocumentalV2({
   orderId,trabajos:[{vinculo:linked}]
  });
  const cfg={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',copias:1,
   modo:'bn',caras:'double',paginasPorHoja:1,papelPoster:'obra80',
   anillado:'individual',grupoAnillado:'',materialColor:'obra70',
   productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1};
  const base={clientOrderId:randomUUID(),items:[],manifiesto,
   sesiones:[{sesion:{uploadId:session.uploadId,token:session.token},
    comprobanteServidor:linked.comprobanteServidor,opciones:cfg}]};
  const googleBeforeOrder=googleCalls.length;
  const saved=await call('/api/ensayo-preparar-documentos-v2-lote',base,
   {Authorization:'Bearer '+adminKey});
  assert.equal(saved.status,200,JSON.stringify(await saved.clone().json()));
  const final=await saved.json();
  assert.equal(final.totalArs,3290);
  assert.equal(final.paymentAuthorized,false);
  assert.equal(final.checkoutEnabled,false);
  assert.equal(final.listoParaProducir,false);
  assert.equal(googleCalls.length,googleBeforeOrder,'D1 no debe volver a consultar Google ni descargar el PDF');
  assert.equal(googleCalls.filter(x=>x==='multiReadPart').length,readsAfterLink);
  assert.equal(stageCount,1);
  assert.equal(preparedCount,1);
  const corrupt=structuredClone(base);
  corrupt.sesiones[0].comprobanteServidor.payload.pages=11;
  const failed=await call('/api/ensayo-preparar-documentos-v2-lote',
   corrupt,{Authorization:'Bearer '+adminKey});
  assert.equal(failed.status,422);
  assert.equal(stageCount,1,'No se manda a Central un comprobante alterado');
  assert.equal(preparedCount,1);
 }finally{
  globalThis.fetch=oldFetch;
 }
});

test('dos PDF con sesiones de una sola tanda se verifican por SHA y registran UN pedido D1',async()=>{
 globalThis.fetch=simulatedFetch;
 stageCount=0;preparedCount=0;
 try{
  const orderId='WEB-ENSAYO-LOTE-PDF-DOBLE';
  const docs=[];
  for(let i=0;i<2;i++){
   const pdf=await PDFDocument.create();
   pdf.setTitle('Pedido múltiple PDF '+i);
   for(let p=0;p<12;p++)pdf.addPage([595.28,841.89]);
   const bytes=Buffer.from(await pdf.save());
   const sha256=hash(bytes);
   docs.push({bytes,sha256,meta:{
    orderId,fileId:'pdf-'+sha256.slice(0,24),name:'prueba-'+i+'.pdf',
    mode:'bn',bytes:bytes.length,sha256,
    partBytes:524288,parts:Math.ceil(bytes.length/524288)
   }});
  }
  assert.notEqual(docs[0].sha256,docs[1].sha256);
  const response=await call('/api/ensayo-pdf-iniciar-lote',{
   turnstileToken:'TURNTSTILE_DOBLE_01234567',metas:docs.map(d=>d.meta)
  });
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  const batch=await response.json();
  assert.equal(batch.sessions.length,2);
  const links=[];
  const options={formato:'a4',caras:'double',copias:1,
   anillado:'individual',materialColor:'obra70',paginasPorHoja:1};
  for(let i=0;i<2;i++){
   const d=docs[i],ss=batch.sessions[i];
   for(let p=0;p<d.meta.parts;p++){
    const part=d.bytes.subarray(p*524288,Math.min(d.bytes.length,(p+1)*524288));
    const r=await call('/api/ensayo-pdf-ampliado',{
     op:'part',uploadId:ss.uploadId,token:ss.token,index:p,
     bytes:part.length,sha256:hash(part),dataBase64:part.toString('base64')
    });
    assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
   }
   const finished=await call('/api/ensayo-pdf-ampliado',{
    op:'finish',uploadId:ss.uploadId,token:ss.token,
    sha256:d.sha256,bytes:d.bytes.length,parts:d.meta.parts
   });
   assert.equal(finished.status,200,JSON.stringify(await finished.clone().json()));
   const ref={schema:'saber-pdf-local-pendiente-v1',
    localRef:randomUUID(),sha256:d.sha256,bytes:d.bytes.length,paginas:12,
    nombre:d.meta.name,estado:'PENDIENTE_DE_ENVIO',
    recibido:false,verificadoServidor:false};
   const linked=await call('/api/ensayo-vincular-pdf-v2',{
    referencia:ref,expectedOrderId:orderId,expectedMode:'bn',
    sesion:{uploadId:ss.uploadId,token:ss.token},opciones:options
   });
   assert.equal(linked.status,200,JSON.stringify(await linked.clone().json()));
   const data=await linked.json();
   assert.equal(data.cotizacionServidor.totalArs,3290);
   assert.equal(data.paymentAuthorized,false);
   assert.equal(data.comprobanteServidor.payload.sha256,d.sha256);
   links.push({linked:data,session:ss});
  }
  expectedCentral={total:6580,receipts:2};
  const manifest=prepararManifiestoDocumentalV2({
   orderId,trabajos:links.map(d=>({vinculo:d.linked}))
  });
  const cfg={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
   copias:1,modo:'bn',caras:'double',paginasPorHoja:1,
   papelPoster:'obra80',anillado:'individual',grupoAnillado:'',
   materialColor:'obra70',productoFoto:'',productoGrafica:'',
   corteVariante:'gt3',corteMetros:1};
  const payload={clientOrderId:randomUUID(),items:[],manifiesto:manifest,
   sesiones:links.map(d=>({
    sesion:{uploadId:d.session.uploadId,token:d.session.token},
    comprobanteServidor:d.linked.comprobanteServidor,opciones:cfg
   }))};
  const beforeCentral=googleCalls.length;
  const registered=await call('/api/ensayo-preparar-documentos-v2-lote',payload,
   {Authorization:'Bearer '+adminKey});
  assert.equal(registered.status,200,JSON.stringify(await registered.clone().json()));
  const result=await registered.json();
  assert.equal(result.totalArs,6580);
  assert.equal(result.paymentAuthorized,false);
  assert.equal(result.listoParaProducir,false);
  assert.equal(result.checkoutEnabled,false);
  assert.equal(stageCount,1,'No se registran dos pedidos D1 por dos PDFs');
  assert.equal(preparedCount,1,'Se prepara un solo pedido comercial SIN cobro');
  assert.equal(googleCalls.length,beforeCentral,'Ninguna descarga Google adicional al registrar');
 }finally{
  expectedCentral={total:3290,receipts:1};
  globalThis.fetch=oldFetch;
 }
});
