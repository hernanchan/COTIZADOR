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
