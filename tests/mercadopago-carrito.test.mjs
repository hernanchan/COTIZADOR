// Pruebas locales sin Mercado Pago real, sin Cloudflare y sin generar cobros.
// Ejecutar: node tests/mercadopago-carrito.test.mjs (Node 20+)
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const orders=new Map(),items=new Map(),requests=new Map(),preferences=new Map();
let currentPrice=3500,preferencesCreated=0,catalogReads=0;
const DB={
 prepare(sql){
  let args=[];
  const query={bind(...values){args=values;return query},
   async first(){
    if(sql.includes('FROM cart_requests WHERE client_order_id='))return requests.get(args[0])||null;
    if(sql.includes('FROM orders WHERE id='))return orders.get(args[0])||null;
    return null;
   },
   async all(){
    if(sql.includes('FROM orders WHERE status=\'paid\''))return {results:[...orders.values()].filter(x=>x.status==='paid'&&x.deposit_ars===x.amount_ars)};
    if(sql.includes('FROM order_items WHERE order_id='))return {results:items.get(args[0])||[]};
    return {results:[]};
   },
   async run(){
    if(sql.startsWith('INSERT OR IGNORE INTO checkout_attempts'))return {meta:{changes:1}};
    if(sql.startsWith('INSERT INTO checkout_locks'))return {meta:{changes:1}};
    if(sql.startsWith('INSERT INTO orders')){
     const [id,description,amount_ars,deposit_ars]=args;
     if(orders.has(id))throw Error('duplicate order');
     orders.set(id,{id,description,amount_ars,deposit_ars,status:'awaiting_payment',preference_id:null,created_at:new Date().toISOString().slice(0,19).replace('T',' ')});
     return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO order_items')){
     const [order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json]=args;
     const list=items.get(order_id)||[];
     list.push({line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json});
     items.set(order_id,list);return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO cart_requests')){
     const [client_order_id,request_hash,order_id]=args;
     if(requests.has(client_order_id))throw Error('duplicate key');
     requests.set(client_order_id,{request_hash,order_id});return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE orders SET preference_id=')){
     const [preference_id,id]=args,o=orders.get(id);
     if(!o||o.preference_id||o.status!=='awaiting_payment')return {meta:{changes:0}};
     o.preference_id=preference_id;return {meta:{changes:1}};
    }
    return {meta:{changes:0}};
   }
  };
  return query;
 },
 async batch(statements){return Promise.all(statements.map(x=>x.run()))}
};
const fakeFetch=async(url,options={})=>{
 const address=String(url);
 if(address.includes('docs.google.com/spreadsheets')){
  catalogReads++;
  return new Response('Activo,Código,Producto,Precio,Oferta\nSI,ABC-1,Cuaderno,'+currentPrice+',0\n',{status:200});
 }
 if(address.endsWith('/checkout/preferences')&&options.method==='POST'){
  preferencesCreated++;
  const body=JSON.parse(options.body),id='PREF-'+preferencesCreated;
  const p={id,external_reference:body.external_reference,sandbox_init_point:'https://sandbox.mercadopago.com/checkout/'+id};
  preferences.set(id,p);return new Response(JSON.stringify(p));
 }
 if(address.includes('/checkout/preferences/')){
  const p=preferences.get(address.split('/').pop());
  return new Response(JSON.stringify(p||{message:'not found'}),{status:p?200:404});
 }
 throw Error('Unexpected mock network access: '+address);
};
const sandbox={AbortSignal,Response,Request,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,fetch:fakeFetch};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
const source=await readFile(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
vm.runInContext(source.replace('export default {','globalThis.worker = {'),sandbox,{filename:'worker.js'});
const env={DB,DEMO_ADMIN_KEY:'clave-de-pruebas',MP_TEST_ACCESS_TOKEN:'TOKEN-FAKE',MP_TEST_SELLER_ID:'3770562685',
 TEST_WEBHOOK_URL:'https://localhost.invalid/webhooks/mercadopago',MP_WEBHOOK_SECRET:'SECRET-FAKE'};
const request=(path,method='GET',body)=>new Request('https://worker.example'+path,{
 method,headers:{Authorization:'Bearer '+env.DEMO_ADMIN_KEY,'Content-Type':'application/json'},
 ...(body?{body:JSON.stringify(body)}:{})
});
async function api(path,method='GET',body){
 const r=await sandbox.worker.fetch(request(path,method,body),env);
 return {status:r.status,data:await r.json()};
}
const client_order_id='10000000-1000-4000-8000-100000000001';
const intent={client_order_id,schema:'saber-cart-v1',currency:'ARS',paymentMode:'FULL',displayTotal:1,
 items:[{type:'product',code:'ABC-1',qty:2,displayUnitPrice:1}]};
const first=await api('/demo/cart-order','POST',intent);
assert.equal(first.status,201);
assert.equal(first.data.total_ars,7000); // Ignora el precio manipulado por el cliente.
assert.equal(items.get(first.data.order_id)[0].line_total_ars,7000);
assert.equal(catalogReads,1);
const checkout=await api('/demo/checkout','POST',{order_id:first.data.order_id});
assert.equal(checkout.status,200);
assert.equal(preferencesCreated,1);
currentPrice=9000;
const repeated=await api('/demo/cart-order','POST',intent);
assert.equal(repeated.status,200);
assert.equal(repeated.data.order_id,first.data.order_id);
assert.equal(repeated.data.total_ars,7000); // Intento existente sin recotizar.
assert.equal(catalogReads,1);
const checkoutRepeated=await api('/demo/checkout','POST',{order_id:first.data.order_id});
assert.equal(checkoutRepeated.status,200);
assert.equal(checkoutRepeated.data.reused,true);
assert.equal(preferencesCreated,1); // Repetir clic no crea otra preferencia.
assert.equal((await api('/demo/cart-order','POST',{...intent,items:[{type:'product',code:'ABC-1',qty:3}]})).status,409);
assert.equal((await api('/demo/cart-order','POST',{...intent,client_order_id:'10000000-1000-4000-8000-100000000002',
 items:[{type:'print',code:null,qty:1}]})).status,422); // No cobrar gráfica sin validación.
assert.equal((await api('/admin/api/orders')).data.orders.length,0); // Sin pago, nada en panel.
const cobrado=orders.get(first.data.order_id);
cobrado.status='paid';
cobrado.paid_at='2026-10-23 17:00:00';
assert.equal((await api('/admin/api/orders')).data.orders.length,1);
const ficha=(await api('/admin/api/order?id='+first.data.order_id)).data;
assert.equal(ficha.items.length,1);
assert.equal(ficha.produccion.pagoConfirmado,true);
assert.equal(ficha.produccion.desgloseCoherente,true);
assert.equal(ficha.produccion.estado,'PAGADO_PENDIENTE_PREPARACION');
assert.equal(ficha.produccion.trabajos[0].etapa,'VERIFICAR_STOCK');
assert.equal(ficha.produccion.listoParaProducir,false); // Ningún catálogo sin stock verificado.
const fila=items.get(first.data.order_id)[0];
const copia={...fila};
fila.item_type='print';fila.sku='POLAROID_A4';
fila.file_references_json=JSON.stringify(['POL-AAAAAAAAAAAAAAAAAAAAAAAA']);
fila.detail_json=JSON.stringify({sheets:2,photos:12,uploadKey:'SECRETO-NUNCA-MOSTRAR'});
const fichaFoto=(await api('/admin/api/order?id='+first.data.order_id)).data;
assert.equal(fichaFoto.produccion.trabajos[0].etapa,'VERIFICAR_PDF_POLAROIDS');
assert.equal(fichaFoto.produccion.listoParaProducir,false); // La referencia no prueba el PDF imprimible.
assert.equal(fichaFoto.produccion.trabajos[0].especificaciones.uploadKey,undefined);
assert.equal(fichaFoto.produccion.trabajos[0].referencias.length,1);
Object.assign(fila,copia);
fila.line_total_ars=999999; // Detectar un renglón alterado incluso con pago aprobado.
const inconsistente=(await api('/admin/api/order?id='+first.data.order_id)).data;
assert.equal(inconsistente.produccion.estado,'REVISAR_DESGLOSE');
assert.equal(inconsistente.produccion.listoParaProducir,false);
Object.assign(fila,copia);
const sinClave=await sandbox.worker.fetch(new Request('https://worker.example/admin/api/order?id='+first.data.order_id),env);
assert.equal(sinClave.status,401);
console.log('PASS: checkout seguro y Central pagada con revisión de stock, PDF y desglose.');
