import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';

const db=new DatabaseSync(':memory:');
db.exec("PRAGMA foreign_keys=ON");
db.exec(readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8'));
const DB={
 prepare(sql){
  let args=[];
  const statement={
   bind(...params){args=params;return statement},
   async first(){return db.prepare(sql).get(...args)||null},
   async all(){return {results:db.prepare(sql).all(...args)}},
   async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}
  };
  return statement;
 },
 async batch(steps){
  db.exec('BEGIN');
  try{const result=[];for(const s of steps)result.push(await s.run());db.exec('COMMIT');return result}
  catch(e){db.exec('ROLLBACK');throw e}
 }
};
const context=vm.createContext({
 Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,
 crypto:webcrypto,console,fetch:async(url)=>{
  if(!String(url).startsWith('https://docs.google.com/'))throw Error('Outbound network forbidden');
  return new Response('Activo,Código,Producto,Precio,Oferta\nSI,ABC-1,Cuaderno,3500,0\n',{status:200});
 }
});
const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
vm.runInContext(src.replace('export default {','globalThis.worker = {'),context,{filename:'worker.js'});
const env={DB,DEMO_ADMIN_KEY:'operator-test-key',MP_TEST_ACCESS_TOKEN:'FAKE',
 MP_TEST_SELLER_ID:'test-seller',TEST_WEBHOOK_URL:'https://test.example/webhook',
 MP_WEBHOOK_SECRET:'mp-demo-key',CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'CentralIntegrationForServerOnly01234567890-'};
const webId='WEB-ENSAYO-0A1B2C3D4E5F6A7B';
const r1='DOC-12345678-1234-4234-8234-1234567890ab';
const r2='DOC-87654321-1234-4234-8234-1234567890ab';
const packet={
 schema:'saber-central-recepcion-verificada-v1',orderId:webId,
 paymentAuthorized:false,filesReceived:true,listoParaProducir:false,
 importeVerificado:21000,recibos:[
  {fileId:'f1',receiptId:r1,sha256:'a'.repeat(64),bytes:900,pages:1},
  {fileId:'f2',receiptId:r2,sha256:'b'.repeat(64),bytes:1200,pages:2}
 ],ficha:{
  schema:'saber-central-ficha-produccion-v1',orderId:webId,
  pagoConfirmado:false,listoParaProducir:false,totalVerificadoSinPago:21000,
  trabajos:[
   {orden:1,idTrabajo:'stk1',servicio:'stickers',fileId:'f1',
    nombreOriginal:'etiquetas.pdf',reciboPrivado:r1,sha256:'a'.repeat(64),
    paginasOriginales:1,paginasElegidas:[1],copias:1,formatoFinal:'a4',
    material:'autoadhesivo',pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false},
   {orden:2,idTrabajo:'graf1',servicio:'grafica',fileId:'f2',
    nombreOriginal:'tarjetas.pdf',reciboPrivado:r2,sha256:'b'.repeat(64),
    paginasOriginales:2,paginasElegidas:[2],copias:1,productoId:'tarjetas-0',
    pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false}
  ]
 }
};
const base='https://saber-pagos-pruebas.example';
function signed(path,payload,{key=env.CENTRAL_BRIDGE_KEY,requestId=randomUUID(),ts=Math.floor(Date.now()/1000),origin=false}={}){
 const body=JSON.stringify(payload);
 const signature=createHmac('sha256',key).update(ts+'\n'+requestId+'\n'+body).digest('hex');
 return new Request(base+path,{method:'POST',headers:{
  'content-type':'application/json','x-saber-ts':String(ts),'x-saber-request-id':requestId,
  'x-saber-signature':signature,...origin?{Origin:'https://malicious.example'}:{}
 },body});
}
async function call(path,payload,options){
 const res=await context.worker.fetch(signed(path,payload,options),env);
 return {status:res.status,result:await res.json()};
}
async function admin(path,authorized=true){
 const res=await context.worker.fetch(new Request(base+path,{headers:authorized?{Authorization:'Bearer '+env.DEMO_ADMIN_KEY}:{}}),env);
 return {status:res.status,result:await res.json()};
}
test('diagnóstico de HMAC requiere permiso y no revela secretos',async()=>{
 const unauthorized=await admin('/demo/diagnostic',false);
 assert.equal(unauthorized.status,401);
 const authorized=await admin('/demo/diagnostic');
 assert.equal(authorized.status,200);
 assert.equal(authorized.result.centralBridge.bridgeEnabled,true);
 assert.equal(authorized.result.centralBridge.expressEnabled,false);
 assert.equal(authorized.result.centralBridge.keyPresent,true);
 assert.equal(authorized.result.centralBridge.keyMinimumLength,true);
 assert.equal(authorized.result.centralBridge.keyDifferentFromAdmin,true);
 assert.equal(authorized.result.centralBridge.keyDifferentFromWebhook,true);
 const responseBody=JSON.stringify(authorized.result);
 assert.ok(!responseBody.includes(env.CENTRAL_BRIDGE_KEY));
 assert.ok(!responseBody.includes(env.DEMO_ADMIN_KEY));
 assert.ok(!responseBody.includes(env.MP_WEBHOOK_SECRET));
});

test('diagnóstico distingue clave corta y reutilizada sin exponerla',async()=>{
 const originalKey=env.CENTRAL_BRIDGE_KEY;
 const originalFlag=env.CENTRAL_BRIDGE_ENABLED;
 try{
  env.CENTRAL_BRIDGE_ENABLED='';
  env.CENTRAL_BRIDGE_KEY=env.DEMO_ADMIN_KEY;
  const result=await admin('/demo/diagnostic');
  assert.equal(result.status,200);
  assert.equal(result.result.centralBridge.bridgeEnabled,false);
  assert.equal(result.result.centralBridge.keyPresent,true);
  assert.equal(result.result.centralBridge.keyMinimumLength,false);
  assert.equal(result.result.centralBridge.keyDifferentFromAdmin,false);
  assert.equal(result.result.centralBridge.keyDifferentFromWebhook,true);
 }finally{
  env.CENTRAL_BRIDGE_ENABLED=originalFlag;
  env.CENTRAL_BRIDGE_KEY=originalKey;
 }
});

test('no se aceptan sincronizaciones sin habilitación explícita, con otro HMAC o desde navegador',async()=>{
 const old=env.CENTRAL_BRIDGE_ENABLED;env.CENTRAL_BRIDGE_ENABLED='';
 assert.equal((await call('/internal/central/stage',packet)).status,503);
 env.CENTRAL_BRIDGE_ENABLED=old;
 assert.equal((await call('/internal/central/stage',packet,{key:'invalid-key'})).status,401);
 assert.equal((await call('/internal/central/stage',packet,{origin:true})).status,403);
 assert.equal((await call('/internal/central/stage',packet,{ts:Math.floor(Date.now()/1000)-601})).status,401);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_manifests').get().n,0);
});
test('almacenar el paquete verificado sin guardar secretos, pagos ni URLs',async()=>{
 const first=await call('/internal/central/stage',packet);
 assert.equal(first.status,201,JSON.stringify(first.result));
 assert.equal(first.result.paymentAuthorized,false);
 const saved=db.prepare('SELECT * FROM central_document_manifests').get();
 assert.equal(saved.web_order_id,webId);assert.equal(saved.amount_ars,21000);
 assert.equal(saved.commercial_order_id,null);
 assert.equal(saved.file_count,2);
 assert.equal(saved.status,'verified_waiting_order');
 assert.equal(saved.manifest_json.includes('token'),false);
 assert.equal(saved.manifest_json.includes('https:'),false);
 const pending=await admin('/admin/api/central/pending');
 assert.equal(pending.status,200);
 assert.equal(pending.result.manifests.length,1);
 assert.equal((await admin('/admin/api/central/pending',false)).status,401);
 const repeated=await call('/internal/central/stage',packet);
 assert.equal(repeated.status,200);
 assert.equal(repeated.result.idempotent,true);
 assert.equal((await call('/internal/central/stage',{...packet,importeVerificado:50000})).status,422);
 assert.equal((await call('/internal/central/stage',{...packet,ficha:{...packet.ficha,trabajos:[packet.ficha.trabajos[0],packet.ficha.trabajos[0]]}})).status,422);
});
const commercialOrderId=randomUUID();
function commercialOrder({validReferences=true,docTotal=21000}={}){
 db.prepare('INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)')
  .run(commercialOrderId,'Pedido mixto de prueba',25000,25000);
 db.prepare('INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,file_references_json) VALUES(?,?,?,?,?,?,?,?,?)')
  .run(commercialOrderId,1,'print','DOCS_VERIFIED','Documentos recibidos',1,docTotal,docTotal,
   JSON.stringify(validReferences?[r1,r2]:[r1]));
 db.prepare('INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars) VALUES(?,?,?,?,?,?,?,?)')
  .run(commercialOrderId,2,'product','SKU-1','Cuaderno',1,25000-docTotal,25000-docTotal);
}
test('no vincular documentos hasta que pedido y referencias coincidan',async()=>{
 const missing=await call('/internal/central/link',{webOrderId:webId,commercialOrderId});
 assert.equal(missing.status,404);
 commercialOrder({validReferences:false});
 assert.equal((await call('/internal/central/link',{webOrderId:webId,commercialOrderId})).status,409);
 db.prepare('UPDATE order_items SET file_references_json=? WHERE order_id=? AND line_number=1')
  .run(JSON.stringify([r1,r2]),commercialOrderId);
 const linked=await call('/internal/central/link',{webOrderId:webId,commercialOrderId});
 assert.equal(linked.status,200,JSON.stringify(linked.result));
 assert.equal(linked.result.linked,true);
 assert.equal(linked.result.paymentAuthorized,false);
 assert.equal(db.prepare('SELECT commercial_order_id FROM central_document_manifests').get().commercial_order_id,commercialOrderId);
 const again=await call('/internal/central/link',{webOrderId:webId,commercialOrderId});
 assert.equal(again.status,200);assert.equal(again.result.idempotent,true);
 assert.equal((await admin('/admin/api/central/pending')).result.manifests.length,0);
 assert.equal((await admin('/admin/api/order?id='+commercialOrderId)).status,404);
});
test('la Central sólo muestra la ficha ligada después del pago aprobado',async()=>{
 db.prepare("UPDATE orders SET status='paid',paid_at=datetime('now') WHERE id=?").run(commercialOrderId);
 const response=await admin('/admin/api/order?id='+commercialOrderId);
 assert.equal(response.status,200,JSON.stringify(response.result));
 const production=response.result.produccion;
 assert.equal(production.pagoConfirmado,true);
 assert.equal(production.documentosVerificados.webOrderId,webId);
 assert.equal(production.documentosVerificados.trabajos.length,2);
 assert.equal(production.documentosVerificados.trabajos[1].paginasElegidas[0],2);
 assert.equal(production.documentosVerificados.listoParaProducir,false);
 assert.equal(production.listoParaProducir,false);
 assert.equal((await admin('/admin/api/order?id='+commercialOrderId,false)).status,401);
 // La devolución de Mercado Pago debe retirar el pedido del panel.
 db.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'revoked',datetime('now'))").run(commercialOrderId);
 assert.equal((await admin('/admin/api/order?id='+commercialOrderId)).status,404);
});

test('el panel privado muestra recepciones separadas de pagados sin exponer secretos',async()=>{
 const res=await context.worker.fetch(new Request(base+'/admin'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/Recepciones de PDF verificadas sin pedido comercial/);
 assert.match(html,/Consultar recepciones pendientes/);
 assert.match(html,/PDF originales verificados/);
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(js));
 assert.ok(!html.includes(env.CENTRAL_BRIDGE_KEY));
});

test('el mismo recibo de Drive no puede reservarse para otra orden',async()=>{
 const other=JSON.parse(JSON.stringify(packet));
 other.orderId='WEB-ENSAYO-SEGUNDO000000';
 other.ficha.orderId=other.orderId;
 const r=await call('/internal/central/stage',other);
 assert.equal(r.status,409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_manifests').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_receipts').get().n,2);
});
test('crear orden mixta: recalcular catálogo, vincular D1 y bloquear checkout',async()=>{
 const other=JSON.parse(JSON.stringify(packet));
 other.orderId='WEB-ENSAYO-SEGUNDO000000';
 other.ficha.orderId=other.orderId;
 other.recibos[0].receiptId='DOC-aaaabbbb-1234-4234-8234-1234567890ab';
 other.recibos[1].receiptId='DOC-ccccdddd-1234-4234-8234-1234567890ab';
 other.ficha.trabajos[0].reciboPrivado=other.recibos[0].receiptId;
 other.ficha.trabajos[1].reciboPrivado=other.recibos[1].receiptId;
 assert.equal((await call('/internal/central/stage',other)).status,201);
 const payload={clientOrderId:randomUUID(),webOrderId:other.orderId,
  items:[{code:'ABC-1',qty:2}]};
 // No permitir crear pedidos desde la interfaz cliente hasta aprobar el ensayo privado.
 assert.equal((await call('/internal/central/prepare-order',payload)).status,503);
 env.CENTRAL_PREPARE_ENABLED='PRIVATE_TEST_ONLY';
 const created=await call('/internal/central/prepare-order',payload);
 assert.equal(created.status,201,JSON.stringify(created.result));
 assert.equal(created.result.amount_ars,28000);
 assert.equal(created.result.documentos_ars,21000);
 assert.equal(created.result.productos_ars,7000);
 assert.equal(created.result.checkoutEnabled,false);
 assert.equal(created.result.paymentAuthorized,false);
 const commercial=created.result.commercial_order_id;
 const rows=db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY line_number').all(commercial);
 assert.equal(rows.length,2);
 assert.equal(rows[0].sku,'DOCS_VERIFIED');
 assert.deepEqual(JSON.parse(rows[0].file_references_json),
  [other.recibos[0].receiptId,other.recibos[1].receiptId]);
 assert.equal(rows[1].unit_price_ars,3500);
 assert.equal(rows[1].quantity,2);
 assert.equal(db.prepare('SELECT amount_ars FROM orders WHERE id=?').get(commercial).amount_ars,28000);
 assert.equal(db.prepare('SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?')
  .get(other.orderId).commercial_order_id,commercial);
 const retried=await call('/internal/central/prepare-order',payload);
 assert.equal(retried.status,200);
 assert.equal(retried.result.idempotent,true);
 assert.equal(retried.result.commercial_order_id,commercial);
 assert.equal((await call('/internal/central/prepare-order',{...payload,items:[{code:'ABC-1',qty:3}]})).status,409);
 assert.equal((await call('/internal/central/prepare-order',{...payload,clientOrderId:randomUUID()})).status,409);
 const pay=await context.worker.fetch(new Request(base+'/demo/checkout',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.DEMO_ADMIN_KEY},
  body:JSON.stringify({order_id:commercial})
 }),env);
 assert.equal(pay.status,503);
 assert.equal(db.prepare('SELECT preference_id FROM orders WHERE id=?').get(commercial).preference_id,null);
 assert.equal((await admin('/admin/api/orders')).result.orders.length,0);
});

test('Central conserva pedidos impagos aparte y no libera producción hasta cobro',async()=>{
 const x=await admin('/admin/api/central/unpaid');
 assert.equal(x.status,200);
 const pending=x.result.orders;
 assert.ok(pending.some(p=>p.web_order_id==='WEB-ENSAYO-SEGUNDO000000'&&p.status==='awaiting_payment'));
 assert.ok(pending.some(p=>p.web_order_id===webId&&p.status==='paid'));
 assert.equal((await admin('/admin/api/central/unpaid',false)).status,401);
 const target=pending.find(p=>p.web_order_id==='WEB-ENSAYO-SEGUNDO000000');
 assert.equal((await admin('/admin/api/order?id='+target.commercial_order_id)).status,404);
 db.prepare("UPDATE orders SET status='paid',paid_at=datetime('now') WHERE id=?").run(target.commercial_order_id);
 const paid=(await admin('/admin/api/orders')).result.orders;
 assert.ok(paid.some(p=>p.id===target.commercial_order_id));
 const detail=(await admin('/admin/api/order?id='+target.commercial_order_id)).result;
 assert.equal(detail.produccion.documentosVerificados.trabajos.length,2);
 assert.equal(detail.produccion.listoParaProducir,false);
 const remaining=(await admin('/admin/api/central/unpaid')).result.orders;
 assert.ok(!remaining.some(p=>p.commercial_order_id===target.commercial_order_id));
});


test('Documentos: sender real usa Service Binding hasta Central D1 local',async()=>{
 const {enviarCentralFirmada}=await import('../integraciones/autocotizador/recepcion/enviar-central-firmada.mjs');
 const p=JSON.parse(JSON.stringify(packet));
 p.orderId='WEB-BINDING-ENSAYO-20261024';
 p.ficha.orderId=p.orderId;
 p.recibos[0].receiptId='DOC-aaaaaaaa-1234-4234-8234-1234567890ab';
 p.recibos[1].receiptId='DOC-bbbbbbbb-1234-4234-8234-1234567890ab';
 p.ficha.trabajos[0].reciboPrivado=p.recibos[0].receiptId;
 p.ficha.trabajos[1].reciboPrivado=p.recibos[1].receiptId;
 let internalCalls=0;
 const service={async fetch(request){
  internalCalls++;
  assert.equal(request.url,'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage');
  assert.equal(request.headers.get('Origin'),null);
  return context.worker.fetch(request,env);
 }};
 const options={verificacion:p,url:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
  clave:env.CENTRAL_BRIDGE_KEY,habilitado:'PRIVATE_TEST_ONLY',
  service,subtle:webcrypto.subtle,nuevoId:randomUUID};
 const first=await enviarCentralFirmada(options);
 assert.equal(first.guardado,true);
 assert.equal(first.paymentAuthorized,false);
 assert.equal(first.webOrderId,p.orderId);
 assert.equal(first.existia,false);
 const again=await enviarCentralFirmada(options);
 assert.equal(again.guardado,true);
 assert.equal(again.existia,true);
 assert.equal(internalCalls,2);
 const row=db.prepare('SELECT amount_ars,commercial_order_id FROM central_document_manifests WHERE web_order_id=?')
   .get(p.orderId);
 assert.equal(row.amount_ars,21000);
 assert.equal(row.commercial_order_id,null);
 const count=db.prepare('SELECT COUNT(*) n FROM central_document_receipts WHERE web_order_id=?')
   .get(p.orderId).n;
 assert.equal(count,2);
 assert.equal((await admin('/admin/api/central/pending')).status,200);
 assert.ok((await admin('/admin/api/central/pending')).result.manifests.some(x=>x.web_order_id===p.orderId));
});


test('Central: unifica Documentos, Polaroids Express y catálogo en un único pedido sin cobro',async()=>{
 const flags={CENTRAL_PREPARE_ENABLED:env.CENTRAL_PREPARE_ENABLED,
  CENTRAL_EXPRESS_PREPARE_ENABLED:env.CENTRAL_EXPRESS_PREPARE_ENABLED,
  CENTRAL_EXPRESS_ENABLED:env.CENTRAL_EXPRESS_ENABLED,
  CENTRAL_MIXED_PREPARE_ENABLED:env.CENTRAL_MIXED_PREPARE_ENABLED};
 const doc=JSON.parse(JSON.stringify(packet));
 doc.orderId='WEB-MIXTO-ENSAYO-20261024';
 doc.ficha.orderId=doc.orderId;
 doc.recibos[0].receiptId='DOC-cccccccc-1234-4234-8234-1234567890ab';
 doc.recibos[1].receiptId='DOC-dddddddd-1234-4234-8234-1234567890ab';
 doc.ficha.trabajos[0].reciboPrivado=doc.recibos[0].receiptId;
 doc.ficha.trabajos[1].reciboPrivado=doc.recibos[1].receiptId;
 const pol={schema:'saber-polaroids-express-central-v1',
  referencia:'POL-'+'E'.repeat(24),fotos:6,hojas:1,
  sha256:'f'.repeat(64),bytes:127000,importeArs:3000,
  pdfPrivadoVerificado:true,pagoConfirmado:false,listoParaProducir:false};
 const clientOrderId=randomUUID();
 const payload={clientOrderId,webOrderId:doc.orderId,polaroidReference:pol.referencia,
  items:[{code:'ABC-1',qty:2}]};
 try{
  // Las tres guardas impiden el alta de un carrito mixto aunque exista HMAC.
  assert.equal((await call('/internal/central/prepare-mixed-order',payload)).status,503);
  Object.assign(env,{CENTRAL_EXPRESS_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_EXPRESS_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_MIXED_PREPARE_ENABLED:'PRIVATE_TEST_ONLY'});
  assert.equal((await call('/internal/central/prepare-mixed-order',payload)).status,404);
  assert.equal((await call('/internal/central/stage',doc)).status,201);
  assert.equal((await call('/internal/central/polaroid-stage',pol)).status,201);
  assert.equal((await call('/internal/central/prepare-mixed-order',
   {...payload,items:[{code:'ABC-1',qty:1},{code:'ABC-1',qty:2}]})).status,422);
  const created=await call('/internal/central/prepare-mixed-order',payload);
  assert.equal(created.status,201,JSON.stringify(created.result));
  assert.equal(created.result.created,true);
  assert.equal(created.result.amount_ars,31000);
  assert.equal(created.result.documentos_ars,21000);
  assert.equal(created.result.polaroids_ars,3000);
  assert.equal(created.result.productos_ars,7000);
  assert.equal(created.result.checkoutEnabled,false);
  assert.equal(created.result.paymentAuthorized,false);
  const id=created.result.commercial_order_id;
  const lines=db.prepare('SELECT sku,item_type,quantity,line_total_ars,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number').all(id);
  assert.deepEqual(lines.map(x=>x.sku),['DOCS_VERIFIED','POLAROID_EXPRESS_A4','ABC-1']);
  assert.equal(lines.reduce((sum,line)=>sum+line.line_total_ars,0),31000);
  assert.deepEqual(JSON.parse(lines[0].file_references_json),doc.recibos.map(x=>x.receiptId));
  assert.deepEqual(JSON.parse(lines[1].file_references_json),[pol.referencia]);
  assert.equal(db.prepare('SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?').get(doc.orderId).commercial_order_id,id);
  assert.equal(db.prepare('SELECT commercial_order_id FROM central_polaroids_express WHERE reference=?').get(pol.referencia).commercial_order_id,id);
  assert.equal(db.prepare('SELECT status,preference_id FROM orders WHERE id=?').get(id).status,'awaiting_payment');
  assert.equal(db.prepare('SELECT preference_id FROM orders WHERE id=?').get(id).preference_id,null);
  const again=await call('/internal/central/prepare-mixed-order',payload);
  assert.equal(again.status,200,JSON.stringify(again.result));
  assert.equal(again.result.idempotent,true);
  assert.equal(again.result.commercial_order_id,id);
  assert.equal((await call('/internal/central/prepare-mixed-order',
   {...payload,items:[{code:'ABC-1',qty:3}]})).status,409);
  assert.equal((await call('/internal/central/prepare-mixed-order',
   {...payload,clientOrderId:randomUUID()})).status,409);
  // Cambiar el texto del pedido tampoco debe permitir el cobro.
  db.prepare("UPDATE orders SET description='Carrito integrado de pruebas' WHERE id=?").run(id);
  const payment=await context.worker.fetch(new Request(base+'/demo/checkout',{
   method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,
    'Content-Type':'application/json'},body:JSON.stringify({order_id:id})}),env);
  assert.equal(payment.status,503);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM cart_requests WHERE order_id=?').get(id).n,1);
 }finally{for(const key of Object.keys(flags)){
  if(flags[key]===undefined)delete env[key];else env[key]=flags[key];
 }}
});


test('Pedido integral E2E: PDF auténticos de Drive simulado → HMAC → Central D1 → Express + tienda',async()=>{
 const {createHash}=await import('node:crypto');
 const {createRequire}=await import('node:module');
 const {fase4FichaCentralLotePrivada}=await import('../integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs');
 const {enviarCentralFirmada}=await import('../integraciones/autocotizador/recepcion/enviar-central-firmada.mjs');
 const {prepararMixtoCentralFirmado}=await import('../integraciones/autocotizador/recepcion/preparar-mixto-central.mjs');
 const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
 const require=createRequire(new URL('../integraciones/autocotizador/recepcion/package.json',import.meta.url));
 const {PDFDocument}=require('pdf-lib');
 const docId='WEB-INTEGRAL-E2E-20261024';
 const polReference='POL-'+'D'.repeat(24);
 const sessions=[
  {sesion:{uploadId:'DOC-11111111-1234-4234-8234-1234567890ab',token:'valid-e2e-document-token-000001'},
   opciones:{servicio:'stickers',seleccion:'a4',paginasSeleccionadas:'',
    copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',
    grupoAnillado:'',materialColor:'',productoFoto:'',productoGrafica:'',
    corteVariante:'gt3',corteMetros:1}},
  {sesion:{uploadId:'DOC-22222222-1234-4234-8234-1234567890ab',token:'valid-e2e-document-token-000002'},
   opciones:{servicio:'grafica',productoGrafica:'tarjetas-0',seleccion:'a4',
    paginasSeleccionadas:'',copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
    anillado:'ninguno',grupoAnillado:'',materialColor:'',productoFoto:'',
    corteVariante:'gt3',corteMetros:1}}
 ];
 const docs=new Map(),steps=[];
 for(let i=0;i<2;i++){
  const pdf=await PDFDocument.create();
  pdf.addPage([595.28,841.89]);
  const bytes=Buffer.from(await pdf.save());
  const s=sessions[i].sesion;
  const receipt={ok:true,receiptId:s.uploadId,orderId:docId,fileId:'f'+(i+1),
   name:i===0?'stickers.pdf':'tarjetas.pdf',mode:'bn',
   bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),pages:1};
  docs.set(s.uploadId,{receipt,bytes,token:s.token});
 }
 const consultarFirmado=async({op,uploadId,token,offset})=>{
  steps.push(op);
  const d=docs.get(uploadId);
  if(!d||d.token!==token)return {ok:false};
  if(op==='multiInfo')return {...d.receipt,
   receiptState:'pages_verified',privateChunkBytes:256*1024};
  if(op==='multiVerifiedStatus')return {...d.receipt,status:'verified',
   verified:true,storageVerified:true,pageVerification:'server',
   paymentAuthorized:false};
  if(op==='multiReadPart'){
   const bytes=d.bytes.subarray(offset,offset+256*1024);
   return {ok:true,receiptId:uploadId,offset,length:bytes.length,
    bytes:d.bytes.length,sha256:d.receipt.sha256,
    chunkSha256:createHash('sha256').update(bytes).digest('hex'),
    dataBase64:bytes.toString('base64')};
  }
  throw Error('Operación GAS no permitida');
 };
 const docsManifest=await fase4FichaCentralLotePrivada({
  sesiones:sessions,consultarFirmado,preciosServidor:precios
 });
 assert.equal(docsManifest.orderId,docId);
 assert.equal(docsManifest.importeVerificado,21000);
 assert.equal(docsManifest.recibos.length,2);
 assert.deepEqual(docsManifest.ficha.trabajos.map(x=>x.servicio),['stickers','grafica']);
 assert.equal(steps.filter(x=>x==='multiReadPart').length,2);
 assert.equal(docsManifest.paymentAuthorized,false);
 assert.equal(docsManifest.listoParaProducir,false);
 let internalCalls=0,publicCalls=0;
 const internal={async fetch(req){
  internalCalls++;
  assert.equal(req.headers.get('Origin'),null,'No sale desde navegador');
  assert.equal(new URL(req.url).hostname,'saber-pagos-pruebas.libreriasaber.workers.dev');
  return context.worker.fetch(req,env);
 }};
 const before=db.prepare('SELECT COUNT(*) n FROM central_document_manifests').get().n;
 const signedOptions={
  verificacion:docsManifest,
  url:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
  clave:env.CENTRAL_BRIDGE_KEY,habilitado:'PRIVATE_TEST_ONLY',
  service:internal,subtle:webcrypto.subtle,nuevoId:randomUUID,
  fetcher:async()=>{publicCalls++;throw Error('Prohibido fetch público')}
 };
 const first=await enviarCentralFirmada(signedOptions);
 assert.equal(first.guardado,true);
 assert.equal(first.existia,false);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_manifests').get().n,before+1);
 const again=await enviarCentralFirmada(signedOptions);
 assert.equal(again.existia,true);
 assert.equal(publicCalls,0);
 const pol={schema:'saber-polaroids-express-central-v1',referencia:polReference,
  fotos:6,hojas:1,sha256:'e'.repeat(64),bytes:123456,importeArs:3000,
  pdfPrivadoVerificado:true,pagoConfirmado:false,listoParaProducir:false};
 const oldFlags={
  CENTRAL_EXPRESS_ENABLED:env.CENTRAL_EXPRESS_ENABLED,
  CENTRAL_PREPARE_ENABLED:env.CENTRAL_PREPARE_ENABLED,
  CENTRAL_EXPRESS_PREPARE_ENABLED:env.CENTRAL_EXPRESS_PREPARE_ENABLED,
  CENTRAL_MIXED_PREPARE_ENABLED:env.CENTRAL_MIXED_PREPARE_ENABLED
 };
 try{
  Object.assign(env,{CENTRAL_EXPRESS_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_EXPRESS_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
   CENTRAL_MIXED_PREPARE_ENABLED:'PRIVATE_TEST_ONLY'});
  assert.equal((await call('/internal/central/polaroid-stage',pol)).status,201);
  const clientOrderId=randomUUID();
  const mixedEnv={...env,
   DOCS_MIXED_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
   DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
   DOCS_CENTRAL_ADMIN_KEY:'admin-not-hmac',
   DOCS_RELAY_KEY:'gas-hmac-not-central',
   CENTRAL_TEST_URL:signedOptions.url,
   SABER_CENTRAL:internal
  };
  const prepare=()=>prepararMixtoCentralFirmado({env:mixedEnv,
   webOrderId:docId,polaroidReference:polReference,clientOrderId,
   items:[{code:'ABC-1',qty:2}],subtle:webcrypto.subtle,requestId:randomUUID});
  const made=await prepare();
  assert.equal(made.created,true);
  assert.equal(made.amountArs,31000);
  assert.equal(made.paymentAuthorized,false);
  assert.equal(made.checkoutEnabled,false);
  const order=made.commercialOrderId;
  const lineItems=db.prepare('SELECT item_type,sku,line_total_ars FROM order_items WHERE order_id=? ORDER BY line_number').all(order);
  assert.deepEqual(lineItems.map(x=>x.sku),
   ['DOCS_VERIFIED','POLAROID_EXPRESS_A4','ABC-1']);
  assert.equal(lineItems.reduce((n,x)=>n+x.line_total_ars,0),31000);
  const stored=db.prepare('SELECT status,amount_ars,preference_id,paid_at FROM orders WHERE id=?').get(order);
  assert.equal(stored.status,'awaiting_payment');
  assert.equal(stored.amount_ars,31000);
  assert.equal(stored.preference_id,null);
  assert.equal(stored.paid_at,null);
  assert.equal((await prepare()).commercialOrderId,order,'Reintento sin nueva compra');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM cart_requests WHERE order_id=?').get(order).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders WHERE id=?').get(order).n,1);
  const paid=await context.worker.fetch(new Request(base+'/demo/checkout',{
   method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,
   'Content-Type':'application/json'},body:JSON.stringify({order_id:order})}),env);
  assert.equal(paid.status,503,'Los PDF NO pueden pasar a cobro');
  assert.equal(publicCalls,0);
  assert.ok(internalCalls>=4);
 }finally{
  for(const [key,value] of Object.entries(oldFlags)){
   if(value===undefined)delete env[key];
   else env[key]=value;
  }
 }
});


test('Pedido integral sin Polaroids: PDF verificados y tienda en una compra sin pago',async()=>{
 const {prepararDocumentosCentralFirmado}=await import('../integraciones/autocotizador/recepcion/preparar-documentos-central.mjs');
 const former=env.CENTRAL_PREPARE_ENABLED;env.CENTRAL_PREPARE_ENABLED='PRIVATE_TEST_ONLY';
 const service={fetch:req=>context.worker.fetch(req,env)};
 try{
  for(const [i,items,expected] of [
   [1,[],21000],
   [2,[{code:'ABC-1',qty:2}],28000]
  ]){
   const doc=JSON.parse(JSON.stringify(packet));
   doc.orderId='WEB-ORDEN-DOCUMENTOS-UNICA-20261024-'+i;
   doc.ficha.orderId=doc.orderId;
   doc.recibos[0].receiptId='DOC-3333333'+i+'-1234-4234-8234-1234567890ab';
   doc.recibos[1].receiptId='DOC-4444444'+i+'-1234-4234-8234-1234567890ab';
   doc.ficha.trabajos[0].reciboPrivado=doc.recibos[0].receiptId;
   doc.ficha.trabajos[1].reciboPrivado=doc.recibos[1].receiptId;
   assert.equal((await call('/internal/central/stage',doc)).status,201);
   const clientOrderId=randomUUID();
   const args={webOrderId:doc.orderId,clientOrderId,items,subtle:webcrypto.subtle,
    requestId:randomUUID,env:{
     ...env,DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
     DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
     DOCS_CENTRAL_ADMIN_KEY:'admin-key-separate-from-bridge',
     DOCS_RELAY_KEY:'google-key-separate-from-bridge',
     CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
     SABER_CENTRAL:service
    }};
   const prepared=await prepararDocumentosCentralFirmado(args);
   assert.equal(prepared.created,true);
   assert.equal(prepared.amountArs,expected);
   assert.equal(prepared.checkoutEnabled,false);
   assert.equal(prepared.paymentAuthorized,false);
   const order=prepared.commercialOrderId;
   const lines=db.prepare('SELECT sku,line_total_ars FROM order_items WHERE order_id=? ORDER BY line_number').all(order);
   assert.deepEqual(lines.map(x=>x.sku),
    items.length?['DOCS_VERIFIED','ABC-1']:['DOCS_VERIFIED']);
   assert.equal(lines.reduce((n,x)=>n+x.line_total_ars,0),expected);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM central_polaroids_express WHERE commercial_order_id=?').get(order).n,0);
   assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(order).status,'awaiting_payment');
   const retried=await prepararDocumentosCentralFirmado(args);
   assert.equal(retried.idempotent,true);
   assert.equal(retried.commercialOrderId,order);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE id=?').get(order).n,1);
   const attempt=await context.worker.fetch(new Request(base+'/demo/checkout',{
    method:'POST',headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,
     'Content-Type':'application/json'},body:JSON.stringify({order_id:order})}),env);
   assert.equal(attempt.status,503);
  }
 }finally{
  if(former===undefined)delete env.CENTRAL_PREPARE_ENABLED;
  else env.CENTRAL_PREPARE_ENABLED=former;
 }
});


test('Borrador PDF compuesto: HMAC → D1, vínculo exacto, copia/dúplex y pagos bloqueados',async()=>{
 const {registrarPdfCompuestoCentralFirmado}=await import('../integraciones/autocotizador/recepcion/registrar-pdf-compuesto-central.mjs');
 const doc=JSON.parse(JSON.stringify(packet));
 doc.orderId='WEB-CENTRAL-IMPRESION-20261024';
 doc.ficha.orderId=doc.orderId;
 doc.recibos[0].receiptId='DOC-55555555-1234-4234-8234-1234567890ab';
 doc.recibos[1].receiptId='DOC-66666666-1234-4234-8234-1234567890ab';
 doc.ficha.trabajos[0]={
  ...doc.ficha.trabajos[0],idTrabajo:'pdf1',servicio:'documentos',
  reciboPrivado:doc.recibos[0].receiptId,
  carasPresupuestadas:'double',paginasPorCaraPresupuestadas:1,
  copias:3,paginasElegidas:[1]
 };
 doc.ficha.trabajos[1].reciboPrivado=doc.recibos[1].receiptId;
 const draft={
  schema:'saber-pdf-compuesto-drive-privado-v1',
  orderId:doc.orderId,fileId:'f1',
  originalReceiptId:doc.recibos[0].receiptId,
  borradorReceiptId:'DOC-77777777-1234-4234-8234-1234567890ab',
  sha256:'c'.repeat(64),bytes:8000,pages:6,
  estado:'BORRADOR_VERIFICADO_EN_DRIVE_PAGO_PENDIENTE',
  guardadoEnDrive:true,pdfImprimibleVerificado:false,
  descargaPrivadaHabilitada:false,paymentAuthorized:false,
  listoParaProducir:false
 };
 const savedFlag=env.CENTRAL_PRINT_DRAFT_STAGE_ENABLED;
 const savedPrepare=env.CENTRAL_PREPARE_ENABLED;
 const adapterEnv={
  ...env,DOCS_PRINT_DRAFT_CENTRAL_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_RELAY_KEY:'separate-gas-bridge-secret',
  DOCS_CENTRAL_ADMIN_KEY:'separate-admin-long-key',
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage',
  SABER_CENTRAL:{fetch:req=>context.worker.fetch(req,env)}
 };
 const args={guardado:draft,env:adapterEnv,subtle:webcrypto.subtle,
  nuevoId:randomUUID};
 try{
  // Neither a missing flag nor missing original manifest may create D1 rows.
  await assert.rejects(registrarPdfCompuestoCentralFirmado(args),/no aceptó/);
  env.CENTRAL_PRINT_DRAFT_STAGE_ENABLED='PRIVATE_TEST_ONLY';
  await assert.rejects(registrarPdfCompuestoCentralFirmado(args),/no aceptó/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_print_drafts').get().n,0);
  assert.equal((await call('/internal/central/stage',doc)).status,201);
  // Direct forged call without HMAC or using a browser origin is rejected.
  assert.equal((await call('/internal/central/stage-print-draft',{
   schema:'saber-central-borrador-drive-v1'
  },{key:'wrong-key'})).status,401);
  const payload={
   schema:'saber-central-borrador-drive-v1',orderId:draft.orderId,
   fileId:draft.fileId,originalReceiptId:draft.originalReceiptId,
   receiptId:draft.borradorReceiptId,sha256:draft.sha256,
   bytes:draft.bytes,pages:draft.pages,estado:draft.estado,
   guardadoEnDrive:true,pdfImprimibleVerificado:false,
   descargaPrivadaHabilitada:false,paymentAuthorized:false,
   listoParaProducir:false
  };
  assert.equal((await call('/internal/central/stage-print-draft',payload,{origin:true})).status,403);
  assert.equal((await call('/internal/central/stage-print-draft',{...payload,pages:5})).status,409);
  assert.equal((await call('/internal/central/stage-print-draft',{...payload,fileId:'f2'})).status,409);
  assert.equal((await call('/internal/central/stage-print-draft',{...payload,orderId:'WEB-OTRO-PEDIDO-20261024'})).status,409);
  assert.equal((await call('/internal/central/stage-print-draft',{...payload,paymentAuthorized:true})).status,422);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_print_drafts').get().n,0);
  const created=await registrarPdfCompuestoCentralFirmado(args);
  assert.equal(created.registered,true);
  assert.equal(created.idempotent,false);
  assert.equal(created.orderId,doc.orderId);
  assert.equal(created.paymentAuthorized,false);
  assert.equal(created.productionAuthorized,false);
  const row=db.prepare('SELECT * FROM central_document_print_drafts WHERE web_order_id=?').get(doc.orderId);
  assert.equal(row.receipt_id,draft.borradorReceiptId);
  assert.equal(row.original_receipt_id,doc.recibos[0].receiptId);
  assert.equal(row.file_id,'f1');
  assert.equal(row.pages,6);
  assert.equal(row.status,'stored_private_unpaid');
  const retry=await registrarPdfCompuestoCentralFirmado(args);
  assert.equal(retry.idempotent,true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_print_drafts WHERE web_order_id=?').get(doc.orderId).n,1);
  const other={...draft,borradorReceiptId:'DOC-88888888-1234-4234-8234-1234567890ab'};
  await assert.rejects(registrarPdfCompuestoCentralFirmado({...args,guardado:other}),/no aceptó/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_print_drafts WHERE web_order_id=?').get(doc.orderId).n,1);
  const noKey={...adapterEnv,DOCS_PRINT_DRAFT_CENTRAL_ENABLED:''};
  await assert.rejects(registrarPdfCompuestoCentralFirmado({...args,env:noKey}),/deshabilitado/);
  const noBinding={...adapterEnv,SABER_CENTRAL:null};
  await assert.rejects(registrarPdfCompuestoCentralFirmado({...args,env:noBinding}),/deshabilitado/);
  assert.equal(db.prepare('SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?').get(doc.orderId).commercial_order_id,null);
  // Vincular luego al pedido comercial: borrador y original siguen el mismo order_id.
  env.CENTRAL_PREPARE_ENABLED='PRIVATE_TEST_ONLY';
  const clientOrderId=randomUUID();
  const draftOrder=await call('/internal/central/prepare-order',{
   webOrderId:doc.orderId,clientOrderId,items:[]
  });
  assert.equal(draftOrder.status,201);
  const commercialOrderId=draftOrder.result.commercial_order_id;
  const linked=db.prepare('SELECT d.receipt_id,m.commercial_order_id,o.status,o.preference_id FROM central_document_print_drafts d JOIN central_document_manifests m ON m.web_order_id=d.web_order_id JOIN orders o ON o.id=m.commercial_order_id WHERE d.receipt_id=?').get(draft.borradorReceiptId);
  assert.equal(linked.commercial_order_id,commercialOrderId);
  assert.equal(linked.status,'awaiting_payment');
  assert.equal(linked.preference_id,null);
  assert.equal((await call('/internal/central/stage-print-draft',payload)).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM central_document_print_drafts WHERE web_order_id=?').get(doc.orderId).n,1);
 }finally{
  if(savedFlag===undefined)delete env.CENTRAL_PRINT_DRAFT_STAGE_ENABLED;
  else env.CENTRAL_PRINT_DRAFT_STAGE_ENABLED=savedFlag;
  if(savedPrepare===undefined)delete env.CENTRAL_PREPARE_ENABLED;
  else env.CENTRAL_PREPARE_ENABLED=savedPrepare;
 }
});
