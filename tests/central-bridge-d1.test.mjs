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
