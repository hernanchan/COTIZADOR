/**
 * Fase 4. Ensayo completo contra Worker compilado, con Google/Turnstile simulados.
 * Ejecutar después de npm run build:unificado. NO hace envíos reales.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID,webcrypto} from 'node:crypto';
import {PDFDocument,degrees} from 'pdf-lib';
import {leerMedidasPloteo} from './medidas-local-pdf.mjs';
import {clasificarCoberturaPloteo} from './clasificar-cobertura-ploteo.mjs';
import worker from './dist/saber-documentos-cotizador-fase4.mjs';

globalThis.crypto ??= webcrypto;
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const relayKey='FAKE_key_only_for_mock_0123456789_abcdefghijklmnopqrstuvwxyz';
const env={DOCS_RELAY_KEY:relayKey,DOCS_ALLOWED_ORIGIN:origin,
 DOCS_SCRIPT_URL:'https://script.google.com/macros/s/FAKE_PHASE4/exec',
 DOCS_TURNSTILE_SECRET:'fake-turnstile-secret',DOCS_TURNSTILE_SITE_KEY:'0x4AAAA-test-0123456789',
 DOCS_PING_ENABLED:'false',DOCS_UPLOAD_ENABLED:'false'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sessions=new Map(), orders=new Map();
let pending,googleCalls=0,turnstileSuccess=true;
function auth(p){const s=sessions.get(p.uploadId);
 if(!s||p.token!==s.token)throw Error('Sesión sin autorización');
 return s;}
function receipt(s) {
 return {ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',orderId:s.orderId,fileId:s.fileId,name:s.name,
 mode:s.mode,bytes:s.bytes,sha256:s.sha256,receiptId:s.uploadId,
 pages:s.pages,paymentAuthorized:false};
}
function dispatch(p){
 if(p.op==='multiStart'){
  const m=p.meta;
  assert.match(m.orderId,/^WEB-ENSAYO-[A-F0-9]{16}$/);
  let s=orders.get(m.orderId);
  if(s){
   if(s.sha256!==m.sha256)throw Error('Idempotencia violada');
  }else{
   s={uploadId:'DOC-'+randomUUID(),token:'token-for-test-abcdefghijklmnopqrstuvwxyz',orderId:m.orderId,
      fileId:m.fileId,name:m.fileId+'__'+m.name,mode:m.mode,bytes:m.bytes,
      sha256:m.sha256,parts:m.parts,received:[],pageVerification:null,pages:null};
   orders.set(m.orderId,s);sessions.set(s.uploadId,s);
  }
  return {ok:true,uploadId:s.uploadId,token:s.token,orderId:s.orderId};
 }
 const s=auth(p);
 if(p.op==='multiStatus')return {ok:true,acceptedParts:s.received.map((_,i)=>i),receivedBytes:s.received.reduce((x,b)=>x+b.length,0),verified:false};
 if(p.op==='multiPart'){
  const bytes=Buffer.from(p.dataBase64,'base64');
  if(sha(bytes)!==p.sha256)throw Error('SHA of chunk not valid');
  s.received[p.index]=bytes;
  return {ok:true,accepted:true,index:p.index};
 }
 if(p.op==='multiFinish'){
  const bytes=Buffer.concat(s.received);
  if(bytes.length!==p.bytes||sha(bytes)!==p.sha256)throw Error('File SHA not valid');
  s.stored=bytes;s.receiptState='bytes_checked';
  return {ok:true,received:true,verified:false,receiptId:s.uploadId};
 }
 if(p.op==='multiInfo'){
  if(!s.stored)throw Error('PDF not uploaded yet');
  return {ok:true,receiptId:s.uploadId,orderId:s.orderId,fileId:s.fileId,name:s.name,mode:s.mode,
     bytes:s.bytes,sha256:s.sha256,privateChunkBytes:256*1024,pageVerification:s.pageVerification,pages:s.pages,receiptState:s.pageVerification==='server'?'pages_verified':'bytes_checked'};
 }
 if(p.op==='multiReadPart'){
  if(p.receiptId!==s.uploadId)throw Error('Wrong read ID');
  const chunk=s.stored.subarray(p.offset,p.offset+256*1024);
  return {ok:true,receiptId:s.uploadId,offset:p.offset,length:chunk.length,
   bytes:s.bytes,sha256:s.sha256,chunkSha256:sha(chunk),dataBase64:chunk.toString('base64')};
 }
 if(p.op==='multiCommitPages'){
  if(p.sha256!==s.sha256||p.pages<1)throw Error('Wrong page proof');
  s.pageVerification='server';s.pages=p.pages;
  return receipt(s);
 }
 if(p.op==='multiVerifiedStatus'){
  if(s.pages==null)throw Error('Pages not verified');
  return receipt(s);
 }
 throw Error('Unexpected operation '+p.op);
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,init={})=>{
 const uri=new URL(url);
 if(uri.hostname==='challenges.cloudflare.com'){
  return Response.json({success:turnstileSuccess,action:'documentos',hostname:new URL(origin).hostname});
 }
 if(uri.hostname==='script.google.com'){
  const envBody=JSON.parse(init.body);
  const check=createHmac('sha256',relayKey).update(envBody.timestamp+'\n'+envBody.payloadJson).digest('hex');
  assert.equal(envBody.signature,check,'HMAC envelope must match');
  googleCalls++;pending=JSON.parse(envBody.payloadJson);
  return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?mock'}});
 }
 if(uri.hostname==='script.googleusercontent.com'){
  try{return Response.json(dispatch(pending))}catch(e){return Response.json({ok:false,error:'mock refused'})}
 }
 throw Error('Unexpected outbound destination '+url);
};
const req=(path,data,originHeader=origin)=>new Request(origin+path,{
 method:'POST',headers:{'Content-Type':'application/json',Origin:originHeader,'Sec-Fetch-Site':'same-origin'},
 body:JSON.stringify(data)
});
test('Fase4 real PDF -> HMAC Google mock -> páginas pdf-lib -> precio B/N, pagos cerrados',async()=>{
 const doc=await PDFDocument.create();
 for(let i=0;i<6;i++)doc.addPage([595,842]);
 const bytes=await doc.save();
 const input=Uint8Array.from(bytes),finger=sha(input),partSize=524288,parts=Math.ceil(bytes.length/partSize);
 const meta={orderId:'WEB-ENSAYO-0123456789ABCDEF',fileId:'documento',name:'prueba seis paginas.pdf',
  mode:'bn',bytes:input.length,sha256:finger,partBytes:partSize,parts};
 const page=await worker.fetch(new Request(origin+'/prueba-cotizador-pdf'),env);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('Subir PDF y calcular presupuesto'));
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(js));
 const start=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta,turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal(start.status,200);
 const session=await start.json();assert.equal(session.ok,true);
 const repeated=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta,turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal((await repeated.json()).uploadId,session.uploadId,'idempotent start');
 const status=await worker.fetch(req('/api/ensayo-pdf',{op:'status',uploadId:session.uploadId,token:session.token}),env);
 assert.deepEqual((await status.json()).acceptedParts,[]);
 for(let i=0;i<parts;i++){
  const chunk=input.subarray(i*partSize,Math.min((i+1)*partSize,input.length));
  const r=await worker.fetch(req('/api/ensayo-pdf',{op:'part',uploadId:session.uploadId,token:session.token,
   index:i,bytes:chunk.length,sha256:sha(chunk),dataBase64:Buffer.from(chunk).toString('base64')}),env);
  assert.equal(r.status,200);
 }
 const finish=await worker.fetch(req('/api/ensayo-pdf',{op:'finish',uploadId:session.uploadId,token:session.token,
   sha256:finger,bytes:input.length,parts}),env);
 assert.equal((await finish.json()).received,true);
 const quote=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:session.uploadId,token:session.token,
   formato:'a4',caras:'simple',copias:1,anillado:'ninguno'}),env);
 assert.equal(quote.status,200);
 const q=await quote.json();
 assert.equal(q.pages,6);assert.equal(q.total,600);
 assert.equal(q.paymentAuthorized,false);
 assert.equal(q.receiptId,session.uploadId);
 assert.ok(q.tiemposServidor.totalMs>=0);
 for(const k of ['consultaGoogleMs','lecturaPrivadaMs','analisisPdfMs','confirmacionGoogleMs'])
   assert.ok(Number.isFinite(q.tiemposServidor[k])&&q.tiemposServidor[k]>=0, k);
 const googleCallsAntesDeRecotizar=googleCalls;
 const doubleQuote=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:session.uploadId,token:session.token,
  formato:'a4',caras:'double',copias:2,anillado:'juntos'}),env);
 assert.equal((await doubleQuote.json()).total,5620);
 assert.equal(googleCalls,googleCallsAntesDeRecotizar+1,'PDF ya verificado: sólo una llamada Google');
});
test('FASE 4 multifichero: pantalla privada, precio servidor y protección contra recibos repetidos',async()=>{
 const htmlResp=await worker.fetch(new Request(origin+'/prueba-cotizador-lote'),env);
 assert.equal(htmlResp.status,200);
 const html=await htmlResp.text();
 assert.ok(html.includes('Presupuesto conjunto de varios PDF'));
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(js));
 const r=orders.get('WEB-ENSAYO-0123456789ABCDEF');
 assert.ok(r,'el PDF de la prueba anterior debe estar disponible');
 const single={uploadId:r.uploadId,token:r.token};
 const one=await worker.fetch(req('/api/ensayo-cotizar-lote',{
   sesiones:[single],formato:'a4',caras:'simple',copias:2,anillado:'ninguno'
 }),env);
 assert.equal(one.status,200);
 const q=await one.json();
 assert.equal(q.cantidadBN,12);
 assert.equal(q.precioUnitarioBN,84);
 assert.equal(q.total,1008);
 assert.equal(q.paymentAuthorized,false);
 assert.ok(q.tiempoServidorMs>=0);
 assert.equal(q.tiemposPorArchivo.length,1);
 assert.ok(q.tiemposPorArchivo[0].totalMs>=0);
 assert.ok(q.tiemposPorArchivo[0].estadoPrevioMs>=0);
 const repeat=await worker.fetch(req('/api/ensayo-cotizar-lote',{
   sesiones:[single,single],formato:'a4',caras:'simple',copias:1,anillado:'ninguno'
 }),env);
 assert.equal(repeat.status,400);
 const tamper=await worker.fetch(req('/api/ensayo-cotizar-lote',{
   sesiones:[single],formato:'a4',caras:'simple',copias:1,anillado:'ninguno',pages:9999
 }),env);
 assert.equal(tamper.status,400);
 const others=await worker.fetch(req('/api/ensayo-cotizar-lote',{
   sesiones:[single],formato:'a4',caras:'simple',copias:1,anillado:'ninguno'
 },'https://otro.example'),env);
 assert.equal(others.status,403);
});

test('Fase4 niega fraude de páginas, solicitudes cruzadas y apertura accidental de uploads',async()=>{
 const count=googleCalls;
 const invalid=await worker.fetch(req('/api/ensayo-cotizar',{uploadId:'DOC-'+randomUUID(),
  token:'good-token-12345678901234',formato:'a4',caras:'simple',copias:1,anillado:'ninguno',pages:99999}),env);
 assert.equal(invalid.status,400);assert.equal(googleCalls,count);
 const wrongOrigin=await worker.fetch(req('/api/ensayo-pdf',{op:'start'},'https://other.example'),env);
 assert.equal(wrongOrigin.status,403);
 turnstileSuccess=false;
 const tokenError=await worker.fetch(req('/api/ensayo-pdf',{op:'start',meta:{
  orderId:'WEB-ENSAYO-ABCDEF0123456789',fileId:'documento',name:'sample.pdf',mode:'bn',
  bytes:123,sha256:'a'.repeat(64),partBytes:524288,parts:1
 },turnstileToken:'turnstile-valid-simulation'}),env);
 assert.equal(tokenError.status,403);
 turnstileSuccess=true;
 const root=await worker.fetch(req('/',{op:'start'}),{...env,DOCS_UPLOAD_ENABLED:'true'});
 assert.equal(root.status,503);
});


test('precio rápido de 10 PDF sin Google Drive, sin autorización de pago',async()=>{
 const before=googleCalls;
 const page=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido'),env);
 assert.equal(page.status,200);
 assert.match(await page.text(),/sin esperar la subida|Los PDF se leen en este dispositivo/);
 const js=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido.js'),env);
 assert.equal(js.status,200);
 assert.match(await js.text(),/No pudimos leer|preliminar|PDF/i);
 const archivos=Array.from({length:10},(_,i)=>({
  id:'pdf'+(i+1),nombre:'notas'+i+'.pdf',paginas:i+1,modo:'bn',orden:i+1
 }));
 const q=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos,formato:'a4',caras:'simple',copias:1,anillado:'ninguno'
 }),env);
 assert.equal(q.status,200,'Respuesta preliminar: '+JSON.stringify(await q.clone().json()));
 const data=await q.json();
 assert.equal(data.ok,true);
 assert.equal(data.resumen.paginas,55);
 assert.equal(data.resumen.bnCantidad,55);
 assert.equal(data.estado,'PRELIMINAR_SIN_VERIFICAR');
 assert.equal(data.paymentAuthorized,false);
 assert.equal(googleCalls,before,'no se contacta con Google ni se guardan PDF');
 const invalid=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos:[{...archivos[0],paginas:0}],formato:'a4',caras:'simple',copias:1,anillado:'ninguno'
 }),env);
 assert.equal(invalid.status,400);
 assert.equal(googleCalls,before);
});


test('descuento compartido sólo por formato/tipo/papel con copias distintas',async()=>{
 const archivos=[
  {id:'pdf1',nombre:'a.pdf',paginas:10,modo:'bn',formato:'a4',caras:'simple',copias:2,anillado:'ninguno',materialColor:'obra70',orden:1},
  {id:'pdf2',nombre:'b.pdf',paginas:10,modo:'bn',formato:'a4',caras:'double',copias:1,anillado:'ninguno',materialColor:'obra70',orden:2},
  {id:'pdf3',nombre:'c.pdf',paginas:10,modo:'color',formato:'a4',caras:'simple',copias:1,anillado:'ninguno',materialColor:'obra70',orden:3}
 ];
 const antes=googleCalls;
 const result=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos,formato:'a4',caras:'simple',copias:1,anillado:'ninguno'
 }),env);
 assert.equal(result.status,200,'Respuesta: '+JSON.stringify(await result.clone().json()));
 const data=await result.json();
 assert.equal(data.resumen.detalles.length,3);
 assert.equal(data.resumen.grupos.length,2);
 assert.equal(data.resumen.grupos[0].cantidad,30);
 assert.equal(data.resumen.grupos[1].cantidad,10);
 assert.equal(data.resumen.detalles[0].precioUnitario,84);
 assert.equal(data.resumen.detalles[1].precioUnitario,80);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(googleCalls,antes);
});

test('dos PDF juntos forman un anillado por juego, no uno por archivo',async()=>{
 const antes=googleCalls;
 const archivos=[
 {id:'pdf1',nombre:'capitulo1.pdf',paginas:9,modo:'bn',formato:'a4',caras:'double',copias:3,anillado:'grupo',grupoAnillado:'1',materialColor:'obra70',orden:1},
 {id:'pdf2',nombre:'capitulo2.pdf',paginas:6,modo:'color',formato:'a4',caras:'simple',copias:3,anillado:'grupo',grupoAnillado:'1',materialColor:'obra70',orden:2}
 ];
 const r=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos,formato:'a4',caras:'simple',copias:3,anillado:'ninguno'
 }),env);
 assert.equal(r.status,200,'Respuesta: '+JSON.stringify(await r.clone().json()));
 const p=await r.json();
 assert.equal(p.resumen.detalleArmados.length,1);
 assert.equal(p.resumen.detalleArmados[0].hojasPorJuego,11);
 assert.equal(p.resumen.detalleArmados[0].juegos,3);
 assert.equal(p.resumen.detalleArmados[0].subtotal,6990);
 assert.equal(p.resumen.grupos.length,2,'descuentos de B/N y color separados');
 assert.equal(p.paymentAuthorized,false);
 assert.equal(googleCalls,antes);
});
test('grupos incompatibles no reciben precio engañoso',async()=>{
 const base={nombre:'a.pdf',paginas:5,modo:'bn',formato:'a4',caras:'simple',copias:2,anillado:'grupo',grupoAnillado:'2',materialColor:'obra70'};
 const docs=[{...base,id:'pdf1',orden:1},{...base,id:'pdf2',orden:2,formato:'a3'}];
 const r=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos:docs,formato:'a4',caras:'simple',copias:2,anillado:'ninguno'
 }),env);
 assert.equal(r.status,400);
 assert.equal((await r.json()).paymentAuthorized,false);
});


test('resumen de cliente y ficha técnica en páginas separadas, conserva importes',async()=>{
 const page=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido'),env);
 const html=await page.text();
 assert.match(html,/id="resumen"/);
 assert.match(html,/panel-resumen/);
 const script=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido.js'),env);
 const js=await script.text();
 assert.match(js,/Instrucciones para impresi/);
 assert.match(js,/Tu presupuesto/);
 assert.match(js,/Copiar instrucciones de impresi/);
 assert.match(js,/PENDIENTE: verificar originales/);
 const docs=[
  {id:'pdf1',nombre:'parte1.pdf',paginas:10,modo:'bn',formato:'a4',caras:'simple',copias:2,anillado:'grupo',grupoAnillado:'1',materialColor:'obra70',orden:1},
  {id:'pdf2',nombre:'parte2.pdf',paginas:10,modo:'bn',formato:'a4',caras:'double',copias:2,anillado:'grupo',grupoAnillado:'1',materialColor:'obra70',orden:2}
 ];
 const r=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  archivos:docs,formato:'a4',caras:'simple',copias:2,anillado:'ninguno'
 }),env);
 assert.equal(r.status,200);
 const q=(await r.json()).resumen;
 assert.equal(q.detalleArmados.length,1);
 assert.equal(q.subtotalImpresiones+q.anillados,q.total);
 assert.ok(q.detalleArmados[0].archivos.join(',')==='pdf1,pdf2');
});


test('la pantalla rápida descarta respuestas antiguas y ofrece orden con hojas por juego',async()=>{
 const pagina=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido'),env);
 const html=await pagina.text();
 assert.match(html,/Aplicar configuración a todos/);
 const response=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido.js'),env);
 assert.equal(response.status,200);
 const js=await response.text();
 assert.match(js,/AbortController/,'descarta solicitudes anteriores');
 assert.match(js,/hoja\(s\) por juego/,'la producción debe recibir las hojas por ejemplar');
 assert.match(js,/grupoAnillado/,'la configuración masiva no debe perder grupo');
 assert.match(js,/signal:/,'la solicitud admite cancelación');
});


test('precio sticky visible y sin tiempos técnicos en la vista comercial',async()=>{
 const page=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido'),env);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,/id="resumenRapido"/);
 assert.match(html,/id="importeArriba"/);
 assert.match(html,/position:sticky/);
 assert.match(html,/top:0/);
 assert.match(html,/id="resumen"/);
 const script=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido.js'),env);
 assert.equal(script.status,200);
 const js=await script.text();
 assert.match(js,/estadoBarra|importeArriba/);
 assert.doesNotMatch(js,/Presupuesto listo en /);
 assert.doesNotMatch(js,/Lectura local terminada en /);
 assert.match(js,/Por calcular|A cotizar/);
 assert.match(js,/Calculando/);
 assert.match(js,/No se pudo cotizar/);
});


test('catálogo A3 color conserva identificadores comerciales correctos y cotiza',async()=>{
 const m=await worker.fetch(new Request(origin+'/api/ensayo-materiales-rapido'),env);
 assert.equal(m.status,200);
 const {materials}=await m.json();
 assert.ok(materials.a3.some(x=>x.id==='a3_color_obra80'));
 assert.ok(materials.a4.some(x=>x.id==='obra70'));
 assert.ok(!materials.a3.some(x=>x.id==='obra70'));
 assert.ok(materials.a4.length>3,'incluye variedad actual de papeles A4');
 assert.ok(materials.a3.length>3,'incluye variedad actual de papeles A3');
 const config={archivos:[{id:'pdf1',nombre:'color-a3.pdf',paginas:3,modo:'color',formato:'a3',caras:'simple',copias:1,anillado:'ninguno',grupoAnillado:null,materialColor:'a3_color_obra80',orden:1}],formato:'a4',caras:'simple',copias:1,anillado:'ninguno'};
 const r=await worker.fetch(req('/api/ensayo-presupuesto-rapido',config),env);
 assert.equal(r.status,200,'A3 color: '+JSON.stringify(await r.clone().json()));
 const q=await r.json();
 assert.equal(q.paymentAuthorized,false);
 assert.ok(q.resumen.total>0);
 assert.equal(q.resumen.detalles[0].materialColor,'a3_color_obra80');
 const wrong=await worker.fetch(req('/api/ensayo-presupuesto-rapido',{
  ...config,archivos:[{...config.archivos[0],materialColor:'obra70'}]
 }),env);
 assert.equal(wrong.status,400,'A3 con ID A4 debe rechazarse');
});


test('ploteos independientes CAD y póster con tarifas oficiales de rollo',async()=>{
 const inicial=googleCalls;
 const home=await worker.fetch(new Request(origin+'/prueba-cotizador-rapido'),env);
 assert.match(await home.text(),/prueba-ploteos-rapido/);
 const page=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido'),env);
 assert.equal(page.status,200);
 assert.match(await page.text(),/Ploteos/);
 const js=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido.js'),env);
 assert.equal(js.status,200);
 assert.match(await js.text(),/ensayo-ploteos-rapido/);
 const catalogo=await worker.fetch(new Request(origin+'/api/ensayo-materiales-ploteo'),env);
 assert.equal(catalogo.status,200);
 const materiales=await catalogo.json();
 assert.ok(materiales.supports.some(x=>x.id==='rollo42'&&x.widthCm===42));
 const trabajos=[
  {id:'pl1',nombre:'plano.pdf',modo:'cad',material:'rollo42',anchoCm:29.7,altoCm:42,copias:2},
  {id:'pl2',nombre:'poster.pdf',modo:'poster',material:'rollo60',anchoCm:59.4,altoCm:84.1,copias:1}
 ];
 const quote=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos}),env);
 assert.equal(quote.status,200,'Precio: '+JSON.stringify(await quote.clone().json()));
 const q=await quote.json();
 assert.equal(q.paymentAuthorized,false);
 assert.equal(q.estado,'PRELIMINAR_SIN_VERIFICAR');
 assert.equal(q.resumen.detalles.length,2);
 assert.equal(q.resumen.detalles[0].subtotal,3100);
 assert.equal(q.resumen.detalles[1].subtotal,7700);
 assert.equal(q.resumen.total,10800);
 assert.equal(googleCalls,inicial,'ploteos no deben contactar a Google');
});
test('ploteo demasiado ancho y datos adulterados no generan precio',async()=>{
 const doc={id:'pl1',nombre:'plano.pdf',modo:'cad',material:'rollo42',anchoCm:60,altoCm:90,copias:1};
 const r=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[doc]}),env);
 assert.equal(r.status,400);
 assert.equal((await r.json()).paymentAuthorized,false);
 const r2=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{...doc,anchoCm:20,altoCm:30,copias:0}]}),env);
 assert.equal(r2.status,400);
});


test('lector local detecta tamaño real, rotación y varias páginas sin subir archivo',async()=>{
 const pdf=await PDFDocument.create();
 const a=pdf.addPage([1190.55,1683.78]); // A2 aproximado: 42 × 59.4 cm
 a.setRotation(degrees(90));
 pdf.addPage([2383.94,3370.39]); // A0: 84.1 × 118.9 cm
 const bytes=await pdf.save();
 const f={name:'plano.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 const info=await leerMedidasPloteo(f);
 assert.equal(info.total,2);
 assert.ok(Math.abs(info.paginas[0].anchoCm-59.4)<0.1);
 assert.ok(Math.abs(info.paginas[0].altoCm-42)<0.1);
 assert.ok(Math.abs(info.paginas[1].anchoCm-84.1)<0.2);
 assert.equal(info.aptoParaCobro,false);
 const js=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido.js'),env);
 const src=await js.text();
 assert.match(src,/Detectando tama/);
 assert.doesNotMatch(src,/Ancho final \(cm\)/);
});
test('ploteos multipágina suman metros reales y rechazan rollos estrechos',async()=>{
 const base={id:'pl1',nombre:'dos-planos.pdf',modo:'cad',material:'rollo90',copias:2,
 paginas:[{numero:1,anchoCm:42,altoCm:59.4},{numero:2,anchoCm:84.1,altoCm:118.9}]};
 const ok=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[base]}),env);
 assert.equal(ok.status,200,'ploteos: '+JSON.stringify(await ok.clone().json()));
 const data=await ok.json();
 assert.equal(data.resumen.detalles[0].paginasTotales,2);
 assert.ok(Math.abs(data.resumen.detalles[0].metrosLineales-1.783)<0.001);
 assert.ok(data.resumen.total>0);
 assert.equal(data.paymentAuthorized,false);
 const bad=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{...base,material:'rollo60'}]}),env);
 assert.equal(bad.status,400);
 assert.equal((await bad.json()).paymentAuthorized,false);
});


test('detección automática cobertura: plano lineal y póster denso sin intervención de cliente',()=>{
 const imagen=(ancho,alto,paint)=>{
  const data=new Uint8ClampedArray(ancho*alto*4);
  for(let i=0;i<ancho*alto;i++){data[i*4]=255;data[i*4+1]=255;data[i*4+2]=255;data[i*4+3]=255;}
  paint(data,ancho,alto);return data;
 };
 const cad=imagen(100,100,(data,w,h)=>{
  for(let y=10;y<90;y+=10)for(let x=10;x<90;x++)for(let c=0;c<3;c++)data[(y*w+x)*4+c]=0;
 });
 const poster=imagen(100,100,(data,w,h)=>{
  for(let y=0;y<100;y++)for(let x=0;x<100;x++){
   const i=(y*w+x)*4;data[i]=20;data[i+1]=130;data[i+2]=210;
  }
 });
 const gris=imagen(100,100,(data,w,h)=>{
  for(let y=0;y<100;y++)for(let x=0;x<22;x++){
   const i=(y*w+x)*4;data[i]=135;data[i+1]=135;data[i+2]=135;
  }
 });
 assert.equal(clasificarCoberturaPloteo(cad).modo,'cad');
 assert.equal(clasificarCoberturaPloteo(poster).modo,'poster');
 assert.equal(clasificarCoberturaPloteo(new Uint8ClampedArray(Array.from({length:100*100},()=>[255,255,255,255]).flat())).modo,'revision');
 assert.equal(clasificarCoberturaPloteo(gris).modo,'revision');
});
test('PDF mixto se cobra por clasificación de cada página, sin selector CAD/Póster',async()=>{
 const material='rollo42';
 const pdf={id:'pl1',nombre:'mixto.pdf',modo:'cad',material,copias:1,
  paginas:[{numero:1,anchoCm:42,altoCm:60,modo:'cad'},
          {numero:2,anchoCm:42,altoCm:60,modo:'poster'}]};
 const res=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[pdf]}),env);
 assert.equal(res.status,200,'mixto: '+JSON.stringify(await res.clone().json()));
 const r=await res.json();
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.resumen.detalles[0].paginas[0].modo,'cad');
 assert.equal(r.resumen.detalles[0].paginas[1].modo,'poster');
 assert.equal(r.resumen.total,6100);
 const page=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido'),env);
 const html=await page.text();
 assert.match(html,/pdf\.min\.js/);
 assert.match(html,/asigna automáticamente los rollos/);
 const js=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido.js'),env);
 const body=await js.text();
 assert.match(body,/clasificaci|Clasificaci/i);
 assert.doesNotMatch(body,/Tipo de ploteo/);
 const uncertain=await worker.fetch(req('/api/ensayo-ploteos-rapido',{
  trabajos:[{...pdf,paginas:[{numero:1,anchoCm:42,altoCm:60,modo:'revision'}]}]
 }),env);
 assert.equal(uncertain.status,400,'no debe cotizar un resultado dudoso');
});


test('rollo automático no es editable por el cliente ni manipulable vía API',async()=>{
 const page=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido'),env);
 const html=await page.text();
 assert.match(html,/detectamos tamaños|Detectamos tamaños/);
 assert.doesNotMatch(html,/Solamente elegí el rollo/);
 const js=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido.js'),env);
 const body=await js.text();
 assert.match(body,/Rollo obra asignado autom/);
 assert.doesNotMatch(body,/Rollo para imprimir/);
 const base={id:'pl1',nombre:'plano.pdf',modo:'cad',copias:1,
  paginas:[{numero:1,anchoCm:42,altoCm:59.4,modo:'cad'}]};
 const valido=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{...base,material:'rollo42'}]}),env);
 assert.equal(valido.status,200);
 const resultado=await valido.json();
 assert.equal(resultado.resumen.detalles[0].material,'rollo42');
 for(const incorrecto of ['rollo60','rollo90','rec60']){
  const r=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{...base,material:incorrecto}]}),env);
  assert.equal(r.status,400,'Material distinto al asignado: '+incorrecto);
  assert.equal((await r.json()).paymentAuthorized,false);
 }
 const ancho=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{...base,material:'rollo90',
  paginas:[{numero:1,anchoCm:84.1,altoCm:118.9,modo:'poster'}]}]}),env);
 assert.equal(ancho.status,200,'A0 en rollo 90');
});


test('líneas rojas densas se cotizan CAD, sin confundirlas con bloques de tinta',()=>{
 const ancho=360,alto=180;
 const bitmap=()=>{const data=new Uint8ClampedArray(ancho*alto*4);
  for(let i=0;i<data.length;i+=4){data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=255}
  return data;
 };
 const rojo=(data,x,y)=>{const i=(y*ancho+x)*4;data[i]=240;data[i+1]=18;data[i+2]=26};
 const lineas=bitmap();
 // Fachadas y cotas densas: múltiples líneas cruzadas pero sin superficies plenas.
 for(let y=12;y<alto-10;y+=7)for(let x=8;x<ancho-8;x++)rojo(lineas,x,y);
 for(let x=15;x<ancho-8;x+=14)for(let y=10;y<alto-10;y++)rojo(lineas,x,y);
 const res=clasificarCoberturaPloteo(lineas,{ancho,alto});
 assert.equal(res.modo,'cad','CAD con líneas rojas de alta densidad: '+JSON.stringify(res));
 const pleno=bitmap();
 for(let y=25;y<150;y++)for(let x=30;x<260;x++)rojo(pleno,x,y);
 const poster=clasificarCoberturaPloteo(pleno,{ancho,alto});
 assert.equal(poster.modo,'poster','bloque de color sólido debe ser Póster: '+JSON.stringify(poster));
});


test('cliente puede cambiar obra 80 a recubierto sólo en páginas Póster',async()=>{
 const src=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido.js'),env);
 assert.equal(src.status,200);
 const js=await src.text();
 assert.match(js,/Papel para p/);
 assert.match(js,/Recubierto 130 g/);
 assert.match(js,/papelPoster/);
 assert.doesNotMatch(js,/Rollo para imprimir/);
 const plantilla=await worker.fetch(new Request(origin+'/prueba-ploteos-rapido'),env);
 const html=await plantilla.text();
 assert.match(html,/obra 80 g o recubierto 130 g/);
 const base={id:'pl1',nombre:'mixto.pdf',modo:'cad',material:'rollo42',copias:1,
  paginas:[{numero:1,anchoCm:42,altoCm:60,modo:'cad'},
          {numero:2,anchoCm:42,altoCm:60,modo:'poster'}]};
 const quote=async papelPoster=>{
  const t=papelPoster===null?base:{...base,papelPoster};
  const res=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[t]}),env);
  return {status:res.status,data:await res.json()};
 };
 const obra=await quote('obra80');
 const rec=await quote('recubierto');
 assert.equal(obra.status,200);
 assert.equal(rec.status,200);
 assert.equal(obra.data.paymentAuthorized,false);
 assert.equal(rec.data.paymentAuthorized,false);
 assert.equal(obra.data.resumen.total,6100);
 assert.equal(rec.data.resumen.total,13400);
 assert.equal(obra.data.resumen.detalles[0].paginas[0].material,'rollo42');
 assert.equal(rec.data.resumen.detalles[0].paginas[0].material,'rollo42','CAD no debe cambiar papel');
 assert.equal(rec.data.resumen.detalles[0].paginas[1].material,'rec60');
 assert.equal(rec.data.resumen.detalles[0].paginas[1].modo,'poster');
 assert.deepEqual(rec.data.resumen.detalles[0].paginas.map(p=>p.papel),['obra80','recubierto']);
 const anterior=await quote(null);
 assert.equal(anterior.status,200,'conservar compatibilidad de ensayos anteriores');
 assert.equal(anterior.data.resumen.total,6100);
 const invalido=await quote('fotografico');
 assert.equal(invalido.status,400);
});
test('recubierto A0 usa rollo rec90; trabajos exclusivamente CAD no admiten recubierto',async()=>{
 const poster={id:'pl1',nombre:'poster-a0.pdf',modo:'poster',material:'rollo90',copias:1,
  paginas:[{numero:1,anchoCm:84.1,altoCm:118.9,modo:'poster'}],papelPoster:'recubierto'};
 const res=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[poster]}),env);
 assert.equal(res.status,200,'rec90: '+JSON.stringify(await res.clone().json()));
 assert.equal((await res.json()).resumen.detalles[0].paginas[0].material,'rec90');
 const cad=await worker.fetch(req('/api/ensayo-ploteos-rapido',{trabajos:[{
  ...poster,modo:'cad',paginas:[{...poster.paginas[0],modo:'cad'}]}]}),env);
 assert.equal(cad.status,400,'no ofrecer recubierto para archivos sólo CAD');
 assert.equal((await cad.json()).paymentAuthorized,false);
});

test('Central privada: sin clave rechaza; con HMAC GAS valida PDF real pero no cobra',async()=>{
 const sesion=orders.get('WEB-ENSAYO-0123456789ABCDEF');
 assert.ok(sesion?.pages===6,'el PDF original fue verificado en la prueba anterior');
 const body={sesion:{uploadId:sesion.uploadId,token:sesion.token},opciones:{
  nombre:'nombre declarado y falso.pdf',modo:'color',paginas:[{numero:1,anchoCm:99,altoCm:99,modo:'poster'}],
  paginasSeleccionadas:'',seleccion:'a4',servicio:'stickers',copias:1,
  caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',
  materialColor:'',productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1
 }};
 const workerEnv={...env,DOCS_CENTRAL_ADMIN_KEY:'admin-independent-secret-0123456789ABCDEFGHIJKLMNOP'};
 const privateReq=(key)=>new Request(origin+'/api/ensayo-ficha-central',{method:'POST',
  headers:{Origin:origin,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json',
   ...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(body)});
 const noConfig=await worker.fetch(privateReq(),env);
 assert.equal(noConfig.status,503);
 const anonymous=await worker.fetch(privateReq(),workerEnv);
 assert.equal(anonymous.status,401);
 const earlier=googleCalls;
 const preview=await worker.fetch(privateReq(workerEnv.DOCS_CENTRAL_ADMIN_KEY),workerEnv);
 assert.equal(preview.status,200,'Ficha: '+JSON.stringify(await preview.clone().json()));
 const x=await preview.json();
 assert.equal(x.ok,true);
 assert.equal(x.ficha.trabajos.length,1);
 assert.equal(x.ficha.trabajos[0].nombreOriginal,sesion.name);
 assert.equal(x.ficha.trabajos[0].paginasOriginales,6);
 assert.equal(x.ficha.trabajos[0].servicio,'stickers');
 assert.equal(x.ficha.trabajos[0].modo,null);
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.listoParaProducir,false);
 assert.equal(x.ficha.pagoConfirmado,false);
 assert.ok(googleCalls>earlier,'lecturas firmadas HMAC desde Google');
 const invalid=await worker.fetch(privateReq('otro-secreto'),workerEnv);
 assert.equal(invalid.status,401);
});
