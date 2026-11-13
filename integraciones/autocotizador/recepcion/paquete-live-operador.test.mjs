import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {consultarPaqueteCentralLive} from './paquete-live-puente-central.mjs';
import {leerObjetoTUSLive,descargarUniversalPersonal}
 from './r2-universal-paquete-personal.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174001';
const KEY='saber-separate-bridge-live-hmac-secret-123456';
const bytes=new TextEncoder().encode('%PDF-1.7\\nHola!\\n%%EOF');
const hash=createHash('sha256').update(bytes).digest('hex');
const env={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_MP_LIVE_GATE:GO,DOCS_LIVE_STAFF_GATE:GO,
 DOCS_LIVE_PACKAGE_GATE:GO,DOCS_LIVE_TUS_GATE:GO,
 DOCS_LIVE_R2_GATE:GO,DOCS_LIVE_R2_STAGING_GATE:GO,
 CENTRAL_BRIDGE_KEY:KEY,
 DOCS_LIVE_STAFF_SECRET:'saber-staff-private-password-demo-1234',
 DOCS_LIVE_TUS_PROJECT_URL:'https://abcdefghijklmnop.storage.supabase.co/',
 DOCS_LIVE_TUS_BUCKET:'saber-tus-live',
 DOCS_LIVE_TUS_SERVICE_KEY:'LIVE_SERVICE_ROLE_NOT_REAL_LONG_ENOUGH_123456789',
 SABER_CENTRAL:{fetch:async()=>{throw Error('not mocked')}}
};
const documentReq=(fileId='small')=>new Request(
 'https://pedidos.libreriasaber.com.ar/personal/api/live-descargar',{
  method:'POST',headers:{Origin:'https://pedidos.libreriasaber.com.ar',
   'Content-Type':'application/json'},
  body:JSON.stringify({webOrderId:WEB,fileId})
 });
const response=(kind,fileId='small',extra={})=>({
 ok:true,schema:'saber-central-r2-universal-package-'+kind+'-v1',
 webOrderId:WEB,productionAuthorized:false,
 ...(kind==='file'?{fileId}:{}),...extra
});
test('puente de paquete firma solo metadatos y consulta Central productiva',async()=>{
 const requests=[];
 const service={fetch:async req=>{
  requests.push(req);
  return Response.json(response('manifest',undefined,{
   totalArchivos:1,preprensaPendiente:true
  }));
 }};
 const data=await consultarPaqueteCentralLive(env,'manifest',{webOrderId:WEB},{
  service,subtle:webcrypto.subtle,now:()=>1794320000,
  nonce:()=>UUID});
 assert.equal(data.totalArchivos,1);
 assert.equal(requests.length,1);
 const req=requests[0],body=await req.text();
 assert.equal(req.url,'https://pagos.libreriasaber.com.ar/internal/central/live/package-manifest');
 assert.equal(req.headers.has('Origin'),false);
 assert.equal(req.headers.get('x-saber-signature'),
  createHmac('sha256',KEY).update(['1794320000',UUID,body].join(String.fromCharCode(10))).digest('hex'));
 assert.deepEqual(JSON.parse(body),{
  schema:'saber-central-r2-universal-package-manifest-v1',webOrderId:WEB});
});
test('puente LIVE bloquea sandbox, gates cerrados y respuesta de otra orden',async()=>{
 for(const patch of [{DOCS_LIVE_PACKAGE_GATE:'NO_GO'},
  {DOCS_LIVE_STAFF_GATE:'NO_GO'},{SABER_ENTORNO:'preparacion'},
  {CENTRAL_BRIDGE_KEY:env.DOCS_LIVE_STAFF_SECRET},
  {DOCS_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY'}]){
  let calls=0;
  await assert.rejects(consultarPaqueteCentralLive({...env,...patch},'file',{
   webOrderId:WEB,fileId:'small'},{
   service:{fetch:async()=>{calls++;return Response.json(response('file'))}},
   subtle:webcrypto.subtle
  }),/LIVE_PACKAGE_CENTRAL_OFF/);
  assert.equal(calls,0);
 }
 await assert.rejects(consultarPaqueteCentralLive(env,'file',
  {webOrderId:WEB,fileId:'../../small'},{
    service:{fetch:async()=>Response.json(response('file'))},
    subtle:webcrypto.subtle}),/LIVE_PACKAGE_INPUT/);
 await assert.rejects(consultarPaqueteCentralLive(env,'file',{
  webOrderId:WEB,fileId:'small'},{
   service:{fetch:async()=>Response.json(response('file','large'))},
   subtle:webcrypto.subtle,now:()=>1794320000,nonce:()=>UUID
  }),/LIVE_PACKAGE_CENTRAL_NOT_OWNED/);
});
test('TUS staff descarga sólo del bucket productivo separado de LAB',async()=>{
 const captures=[];
 const original='v2/'+WEB+'/'+UUID+'.pdf';
 const data=await leerObjetoTUSLive(env,original,{fetcher:async(url,options)=>{
  captures.push({url,options});return new Response(bytes,{
   headers:{'Content-Length':String(bytes.length)}
  });
 }});
 assert.deepEqual(data,bytes);
 assert.equal(captures.length,1);
 assert.ok(captures[0].url.startsWith(
  'https://abcdefghijklmnop.storage.supabase.co/storage/v1/object/saber-tus-live/'));
 assert.equal(captures[0].options.headers.apikey,env.DOCS_LIVE_TUS_SERVICE_KEY);
 let called=0;
 await assert.rejects(leerObjetoTUSLive({
  ...env,DOCS_LIVE_TUS_BUCKET:'saber-tus-lab'},original,{
   fetcher:async()=>{called++;return new Response(bytes)}
 }),/STORAGE_OFF/);
 assert.equal(called,0);
});
test('ZIP personal LIVE: descarga TUS verificada desde D1, no acepta cookie comprador',async()=>{
 const d=response('file','small',{
  transporte:'tus',preprensaPendiente:true,
  objectKey:'v2/'+WEB+'/'+UUID+'.pdf',receiptId:'DOC-'+UUID,
  bytes:bytes.length,sha256:hash
 });
 const r=await descargarUniversalPersonal(documentReq(),env,{
  authorized:true,lookup:async()=>d,readTUS:async()=>bytes,subtle:webcrypto.subtle});
 assert.equal(r.status,200,await r.clone().text());
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);
 const other=await descargarUniversalPersonal(documentReq(),env,{
  authorized:true,lookup:async()=>d,readTUS:async()=>new Uint8Array(bytes.length),
  subtle:webcrypto.subtle});
 assert.equal(other.status,409);
 const noAuth=await descargarUniversalPersonal(documentReq(),env,{
  authorized:false,lookup:async()=>d,readTUS:async()=>bytes,
  subtle:webcrypto.subtle});
 assert.equal(noAuth.status,403);
});
test('ruta staff LIVE selecciona API de ZIP, pero deja Sandbox sin cambios',async()=>{
 const source=await readFile(new URL('./paquete-universal-cliente.mjs',import.meta.url),'utf8');
 assert.match(source,/location\.pathname==='\/personal\/paquete'/);
 assert.match(source,/\/personal\/api\/live-descargar/);
 assert.match(source,/\/personal\/api\/live-paquete/);
 assert.match(source,/\/prueba-v2\/api\/ensayo-universal-descargar-personal/);
 const worker=await readFile(new URL('./worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(worker,/function staffLiveAuthorized\(request,env\)/);
 assert.match(worker,/page==='\/personal\/paquete'/);
 assert.match(worker,/DOCS_LIVE_STAFF_SECRET/);
 assert.match(worker,/WWW-Authenticate/);
});

test('vista de personal: un solo ZIP, sin pasos técnicos ni inspección de transportes',async()=>{
 const page=await readFile(new URL('./pantalla-paquete-universal-personal.mjs',import.meta.url),'utf8');
 const board=await readFile(new URL('./pagina-central-personal-live.mjs',import.meta.url),'utf8');
 const flow=await readFile(new URL('./flujo-presupuesto-live-cliente.mjs',import.meta.url),'utf8');
 const pack=await readFile(new URL('./paquete-universal-cliente.mjs',import.meta.url),'utf8');
 assert.match(page,/Descargar ZIP completo/);
 assert.doesNotMatch(page,/r2Inspeccion|staffR2Js|Consultar original pendiente|Medidas originales y tamaño de impresión/);
 assert.match(board,/o\.zipEnabled===true&&o\.pendingCount===0/);
 assert.match(board,/Descargar ZIP \+ instrucciones/);
 assert.doesNotMatch(board,/Inspeccionar PDF R2 almacenado/);
 assert.doesNotMatch(board,/TUS '\+o\.tusCount/);
 assert.match(flow,/transport:m\.bytes<=40\*MIB\?'tus':'r2'/);
 assert.match(pack,/ORDEN_'\+ficha\.numeroOrden\+'_INSTRUCCIONES\.pdf/);
});
test('original PDF mixto y salida A4: sin copiar medidas ni inspección técnica antes del ZIP',async()=>{
 const page=await readFile(new URL('./pantalla-paquete-universal-personal.mjs',import.meta.url),'utf8');
 const pack=await readFile(new URL('./paquete-universal-cliente.mjs',import.meta.url),'utf8');
 const central=await readFile(new URL('../../mercadopago/pruebas/r2-universal-package-central.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(page,/r2Medidas|r2Uniforme|r2Aprobar/);
 assert.match(pack,/PAPEL A4: ajustar proporcionalmente CADA página al A4/);
 assert.match(pack,/Originales Legal u otros tamaños también van en A4/);
 assert.doesNotMatch(central,/R2_PHYSICAL_INSPECTION_REQUIRED/);
 assert.match(central,/preprensaPendiente:true/);
});

test('ambas rutas de ZIP bloquean descarga sin instrucciones y resumen 112 páginas',async()=>{
 const pack=await readFile(new URL('./paquete-universal-cliente.mjs',import.meta.url),'utf8');
 const stream=await readFile(new URL('./zip-universal-stream.mjs',import.meta.url),'utf8');
 assert.match(pack,/validarZIPDeProduccion\(entries,ficha,instruccion\)/);
 assert.equal(pack.match(/validarZIPDeProduccion\(entries,ficha,instruccion\);/g)?.length,2);
 assert.match(pack,/resumirPaginasElegidas\(t\.paginasElegidas\)/);
 assert.match(stream,/ZIP_UNIVERSAL_INSTRUCCIONES_OBLIGATORIAS/);
 assert.match(stream,/ZIP_UNIVERSAL_ORIGINAL_FALTANTE/);
});
