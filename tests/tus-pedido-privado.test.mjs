import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {
 TUS_LIMITS,validarMetasTUS,crearTandaTUS,leerReciboTUS,validarLoteFirmadoTUS
} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from '../integraciones/autocotizador/recepcion/tus-pedido-puente.mjs';
import {
 tusPrivadoConfigurado,iniciarTandaTUSPrivada,finalizarPedidoTUSPrivado,
 manifiestoServidorTUS,descargarPdfTUSPersonal
} from '../integraciones/autocotizador/recepcion/tus-pedido-worker.mjs';
import {conciliarManifiestoV2ConServidor} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';
const subtle=webcrypto.subtle;
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const SECRET='saber_testing_unicamente_una_clave_de_ensayo_de_mas_de_32';
const sha1='1'.repeat(64),sha2='2'.repeat(64);
const meta=(i,bytes=2048,pages=2)=>({
 fileId:'pdf-'+String(i).padStart(3,'0'),
 name:'Documento'+i+'.pdf',mode:'bn',bytes,sha256:i===1?sha1:sha2,pages
});
const mint=(metas=[meta(1),meta(2)])=>crearTandaTUS({
 orderId:ORDER,metas,secret:SECRET,subtle,
 uuid:()=>randomUUID(),ahora:()=>1800000000,
 firmarSubida:async()=>('STORAGE_PRIVATE_SIGNED_UPLOAD_TOKEN_'+randomUUID()),
});
const correctOpts={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
 copias:1,modo:'bn',caras:'simple',paginasPorHoja:1,papelPoster:'obra80',
 anillado:'ninguno',grupoAnillado:'',materialColor:'obra70',
 productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1};
const entries=s=>s.sessions.map(item=>({proof:item.proof,opciones:{...correctOpts}}));
const decoder=(session)=>JSON.parse(Buffer.from(session.proof.split('.')[0],'base64url').toString('utf8'));
const env={
 DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_RECEIPT_KEY:SECRET,
 DOCS_TUS_SUPABASE_SERVICE_KEY:'a_secret_backend_key_not_to_be_exported_to_browser_'+'0'.repeat(50),
 DOCS_TUS_PUBLISHABLE_KEY:'sb_publishable_public_example_for_tests_only_xxxxxxxxxxx',
 CENTRAL_BRIDGE_KEY:'different_central_bridge_secret_aaaaaaaaaaaaaaaa',
 DOCS_CENTRAL_ADMIN_KEY:'different_central_admin_secret_bbbbbbbbbbbbb',
 DOCS_RELAY_KEY:'different_google_relay_key_cccccccccccccccccc',
};
test('metadatos estrictos y límites sin permitir archivos suplantados',()=>{
 assert.deepEqual(TUS_LIMITS,{maxFileBytes:20971520,maxBatchBytes:62914560,maxFiles:10});
 assert.equal(validarMetasTUS({orderId:ORDER,metas:[meta(1)]}).metas.length,1);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:[meta(1),meta(1)]}),/Metadatos/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:[{...meta(1),bytes:20971521}]}),/Metadatos/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:[{...meta(1),mode:'exe'}]}),/Metadatos/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:[{...meta(1),price:1}]}),/Metadatos/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:[]}),/Tanda/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:Array.from({length:11},(_,i)=>meta(i+1))}),/Tanda/);
 assert.throws(()=>validarMetasTUS({orderId:ORDER,metas:Array.from({length:4},(_,i)=>meta(i+1,20*1024*1024))}),/60 MiB/);
});
test('firma de cada PDF une orderId, nombre Unicode, SHA, páginas y ruta de descarga D1',async()=>{
 const sessions=await mint([{...meta(1),name:'Diseño-áéíóú Ñ.pdf'}]);
 assert.equal(sessions.sessions.length,1);
 const c=await leerReciboTUS(sessions.sessions[0].proof,{secret:SECRET,subtle,ahora:()=>1800000050});
 assert.equal(c.name,'Diseño-áéíóú Ñ.pdf');
 assert.equal(c.objectName,'v2/'+ORDER+'/'+c.receiptId.slice(4)+'.pdf');
 assert.equal(c.sha256,sha1);
 assert.equal(sessions.sessions[0].signature.includes('STORAGE_'),true);
 assert.ok(!sessions.sessions[0].proof.includes('STORAGE_PRIVATE'));
});
test('rechaza firma alterada, orden ajena, sesión vencida o duplicación',async()=>{
 const s=await mint();
 const token=s.sessions[0].proof;
 const bad=token.slice(0,-1)+(token.endsWith('A')?'B':'A');
 await assert.rejects(leerReciboTUS(bad,{secret:SECRET,subtle,ahora:()=>1800000001}),/Firma/);
 await assert.rejects(leerReciboTUS(token,{secret:'x'.repeat(32),subtle,ahora:()=>1800000001}),/Firma/);
 await assert.rejects(leerReciboTUS(token,{secret:SECRET,subtle,ahora:()=>1800005000}),/vencido/);
 await assert.rejects(validarLoteFirmadoTUS({orderId:'WEB-OTRA-12345',entries:entries(s),secret:SECRET,subtle,ahora:()=>1800000001}),/otro pedido/);
 await assert.rejects(validarLoteFirmadoTUS({orderId:ORDER,entries:[entries(s)[0],entries(s)[0]],secret:SECRET,subtle,ahora:()=>1800000001}),/repetido/);
});
test('comprobantes firmados dan único conjunto coherente a la Central',async()=>{
 const s=await mint();
 const claims=await validarLoteFirmadoTUS({orderId:ORDER,entries:entries(s),secret:SECRET,subtle,ahora:()=>1800000001});
 assert.equal(claims.length,2);
 assert.equal(new Set(claims.map(c=>c.receiptId)).size,2);
 assert.equal(new Set(claims.map(c=>c.objectName)).size,2);
});
test('sin autorización y sin flag TUS no se emite ninguna firma',async()=>{
 let n=0;const req=new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/api/ensayo-tus-iniciar',{
  method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev','Content-Type':'application/json'},
  body:JSON.stringify({orderId:ORDER,metas:[meta(1)]})
 });
 const fetcher=async()=>{n++;return Response.json({token:'dummy'})};
 const noAuth=await iniciarTandaTUSPrivada(req,env,{authorized:false,fetcher});
 assert.equal(noAuth.status,403);
 assert.equal(n,0);
 const off=await iniciarTandaTUSPrivada(req,{...env,DOCS_TUS_PRIVATE_ENABLED:'false'},{authorized:true,fetcher});
 assert.equal(off.status,403);
 assert.equal(n,0);
 assert.equal(tusPrivadoConfigurado(env),true);
 assert.equal(tusPrivadoConfigurado({...env,DOCS_TUS_RECEIPT_KEY:env.CENTRAL_BRIDGE_KEY}),false);
});
test('no se descarga PDF privado desde Endpoint sin operador autenticado',async()=>{
 let calls=0;
 const request=new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/api/ensayo-tus-descargar',{
  method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev','Content-Type':'application/json'},
  body:JSON.stringify({orderId:ORDER,receiptId:'DOC-'+randomUUID()})
 });
 const r=await descargarPdfTUSPersonal(request,env,{authorized:false,fetcher:async()=>{calls++;}});
 assert.equal(r.status,403);assert.equal(calls,0);
});
test('puente completo real: PDF de 2 páginas desde Storage, SHA, cotización oficial y ficha D1',async()=>{
 const file=await PDFDocument.create();
 file.addPage([595.28,841.89]);file.addPage([595.28,841.89]);
 const bytes=new Uint8Array(await file.save());
 const hash=Buffer.from(await subtle.digest('SHA-256',bytes)).toString('hex');
 const s=await mint([{...meta(1),name:'Ensayo_A4.pdf',bytes:bytes.length,sha256:hash,pages:2}]);
 const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 const claims=entries(s);
 const checked=await verificarTandaTUSYRecalcular({
  orderId:ORDER,entries:claims,secret:SECRET,preciosServidor:precios,subtle,
  ahora:()=>1800000001,
  leerObjetoPrivado:async(name,c)=>{
   assert.equal(name,s.sessions[0].objectName);
   assert.equal(c.bytes,bytes.length);
   return bytes;
  }
 });
 assert.equal(checked.verificacion.schema,'saber-central-recepcion-verificada-v1');
 assert.equal(checked.verificacion.filesReceived,true);
 assert.equal(checked.verificacion.recibos[0].pages,2);
 assert.equal(checked.verificacion.importeVerificado>0,true);
 assert.equal(checked.verificacion.paymentAuthorized,false);
 assert.equal(checked.verificacion.ficha.trabajos.length,1);
 const manifest=manifiestoServidorTUS(checked);
 const reconciliation=conciliarManifiestoV2ConServidor({manifiesto:manifest,verificacion:checked.verificacion});
 assert.equal(reconciliation.importeServidor,checked.verificacion.importeVerificado);
});
test('nunca llega a cotizar o guardar D1 si el segundo PDF falta o su SHA difiere',async()=>{
 const pdf=await PDFDocument.create();
 pdf.addPage([595,842]);
 const bytes=new Uint8Array(await pdf.save());
 const hash=Buffer.from(await subtle.digest('SHA-256',bytes)).toString('hex');
 const s=await mint([1,2].map(i=>({...meta(i),name:'Lote_'+i+'.pdf',bytes:bytes.length,sha256:hash,pages:1})));
 const options=entries(s);
 let readCount=0;
 const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 await assert.rejects(verificarTandaTUSYRecalcular({
  orderId:ORDER,entries:options,secret:SECRET,subtle,ahora:()=>1800000001,
  preciosServidor:prices,leerObjetoPrivado:async()=>{
   readCount++;
   if(readCount===2)throw Error('Segundo PDF no disponible');
   return bytes;
  }
 }),/Segundo PDF/);
 assert.equal(readCount,2);
});


test('dos PDFs A4/A3 atraviesan PDF real, recotización servidor y manifiesto coherente',async()=>{
 const bytes=[];
 for(const dims of [[595.28,841.89],[841.89,1190.55]]){
  const pdf=await PDFDocument.create();
  pdf.addPage(dims);pdf.addPage(dims);
  bytes.push(new Uint8Array(await pdf.save()));
 }
 const hashes=await Promise.all(bytes.map(async b=>Buffer.from(await subtle.digest('SHA-256',b)).toString('hex')));
 const specs=bytes.map((b,i)=>({...meta(i+1),name:'Documento_'+(i+1)+'.pdf',bytes:b.length,sha256:hashes[i],pages:2}));
 const signed=await mint(specs);
 const cfg=entries(signed);
 cfg[1].opciones.seleccion='a3';
 const byPath=new Map(signed.sessions.map((s,i)=>[s.objectName,bytes[i]]));
 const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 const v=await verificarTandaTUSYRecalcular({
  orderId:ORDER,entries:cfg,secret:SECRET,subtle,ahora:()=>1800000001,
  preciosServidor:prices,leerObjetoPrivado:async p=>byPath.get(p)
 });
 assert.equal(v.claims.length,2);
 assert.equal(v.verificacion.recibos.length,2);
 assert.equal(v.verificacion.ficha.trabajos.length,2);
 assert.ok(v.verificacion.importeVerificado>0);
 const m=manifiestoServidorTUS(v);
 const result=conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v.verificacion});
 assert.equal(result.cantidadArchivos,2);
 assert.equal(result.importeServidor,v.verificacion.importeVerificado);
 assert.equal(result.paymentAuthorized,false);
});

test('endpoint privado registra D1 SOLO luego de verificar ambos PDF; monto calculado en servidor',async()=>{
 const buffers=[];
 for(const dimensions of [[595.28,841.89],[595.28,841.89]]){
  const file=await PDFDocument.create();
  file.addPage(dimensions);
  buffers.push(new Uint8Array(await file.save()));
 }
 const hashes=await Promise.all(buffers.map(async b=>Buffer.from(await subtle.digest('SHA-256',b)).toString('hex')));
 const metas=buffers.map((b,i)=>({...meta(i+1),name:'Doc_'+(i+1)+'.pdf',bytes:b.length,sha256:hashes[i],pages:1}));
 const signed=await mint(metas),entriesList=entries(signed);
 const data=new Map(signed.sessions.map((s,i)=>[s.objectName,buffers[i]]));
 const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 let writes=0,prepared=0,serverPrice=null;
 const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 const req=()=>new Request(origin+'/api/ensayo-tus-registrar',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({orderId:ORDER,clientOrderId:randomUUID(),entries:entriesList})
 });
 const downloader=async url=>{
  const found=[...data.entries()].find(([name])=>url.endsWith('/'+name));
  if(!found)return new Response('NOT_FOUND',{status:404});
  return new Response(found[1],{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 const register=async ({manifiesto,verificacion})=>{
  const result=conciliarManifiestoV2ConServidor({manifiesto,verificacion});
  assert.equal(result.cantidadArchivos,2);
  writes++;serverPrice=result.importeServidor;
  return {orderId:ORDER,archivos:2,registeredInD1:true};
 };
 const prepare=async()=>{prepared++;return {
  commercialOrderId:randomUUID(),amountArs:serverPrice,
  idempotent:false,paymentAuthorized:false
 }};
 const answer=await finalizarPedidoTUSPrivado(req(),env,{authorized:true,fetcher:downloader,
  preciosServidor:prices,ahora:()=>1800000001,registrar:register,preparar:prepare});
 assert.equal(answer.status,200);
 const body=await answer.json();
 assert.equal(body.ok,true);assert.equal(body.archivosVerificados,2);
 assert.equal(body.totalArs,serverPrice);
 assert.equal(body.paymentAuthorized,false);assert.equal(body.checkoutEnabled,false);
 assert.equal(writes,1);assert.equal(prepared,1);
 data.delete(signed.sessions[1].objectName);
 const bad=await finalizarPedidoTUSPrivado(req(),env,{authorized:true,fetcher:downloader,
  preciosServidor:prices,ahora:()=>1800000001,registrar:register,preparar:prepare});
 assert.equal(bad.status,422);
 assert.equal(writes,1);assert.equal(prepared,1);
});


test('ploteo CAD A0 real usa medidas del servidor y rollo automático, no valores inventados',async()=>{
 const pdf=await PDFDocument.create();
 pdf.addPage([2383.94,3370.39]);
 const bytes=new Uint8Array(await pdf.save());
 const sha256=Buffer.from(await subtle.digest('SHA-256',bytes)).toString('hex');
 const signed=await mint([{...meta(1),name:'Plano_A0_CAD.pdf',bytes:bytes.length,sha256,pages:1}]);
 const inputs=entries(signed);
 inputs[0].opciones.seleccion='original';
 inputs[0].opciones.clasificacionCliente=[{numero:1,anchoCm:84.1,altoCm:118.9,modo:'cad'}];
 inputs[0].opciones.anillado='ninguno';
 inputs[0].opciones.papelPoster='obra80';
 const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 const checked=await verificarTandaTUSYRecalcular({
  orderId:ORDER,entries:inputs,secret:SECRET,subtle,ahora:()=>1800000001,
  preciosServidor:precios,leerObjetoPrivado:async()=>bytes
 });
 const t=checked.verificacion.ficha.trabajos;
 assert.equal(t.length,1);
 assert.equal(t[0].servicio,'ploteos');
 assert.equal(t[0].planoPorPagina?.[0]?.modo,'cad');
 assert.ok(/^rollo\d+$/.test(t[0].planoPorPagina?.[0]?.rollo));
 assert.ok(checked.verificacion.importeVerificado>0);
 const m=manifiestoServidorTUS(checked);
 const conciliated=conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:checked.verificacion});
 assert.equal(conciliated.cantidadArchivos,1);
});
test('modos de falla en la firma no crean pedido y nunca exponen secretos',async()=>{
 const u='https://saber-documentos-pruebas.libreriasaber.workers.dev';
 let tries=0;
 const malformed=new Request(u+'/api/ensayo-tus-iniciar',{method:'POST',
 headers:{Origin:u,'Content-Type':'application/json'},
 body:JSON.stringify({orderId:ORDER,metas:[{...meta(1),priceArs:1}]})});
 const response=await iniciarTandaTUSPrivada(malformed,env,{authorized:true,
  fetcher:async()=>{tries++;return Response.json({token:'fake'})}});
 assert.equal(response.status,403);
 assert.equal(tries,0);
 const json=await response.json();
 assert.equal(JSON.stringify(json).includes('key'),false);
 assert.equal(json.paymentAuthorized,false);
});
