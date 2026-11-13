import test from 'node:test';
import assert from 'node:assert/strict';
import {crearFlujoPresupuestoLive} from './flujo-presupuesto-live-cliente.mjs';
const origin='https://pedidos.libreriasaber.com.ar';
const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const draftId='123e4567-e89b-42d3-a456-426614174000';
const commercialOrderId='123e4567-e89b-42d3-a456-426614174001';
const file={name:'apunte.pdf',size:15,slice:()=>({arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer})};
const archivos=[{nombre:'apunte.pdf',modo:'bn',paginas:[{numero:1,anchoCm:21,altoCm:29.7}]}];
const sha='f'.repeat(64),quoteHash='a'.repeat(64);
const draft={ok:true,webOrderId,fileCount:1,draftId,quoteHash,totalArs:5000,
 paymentAuthorized:false,checkoutEnabled:false};
const order={ok:true,webOrderId,commercialOrderId,numeroOrden:'018',
 totalArs:5000,fileCount:1,checkoutEnabled:false,paymentAuthorized:false,
 uploadAuthorized:false,productionAuthorized:false};
const checkout={ok:true,webOrderId,commercialOrderId,amountArs:5000,fileCount:1,
 uploadAuthorized:false,productionAuthorized:false,
 checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc'};
function fixture({originOverride=origin,draftOverride={},orderOverride={},localSaveFails=false}={}){
 const calls=[],store=new Map(),state=[],originals=new Map();
 const fetcher=async(path,opts)=>{
  calls.push({path,opts});
  if(path.endsWith('/borrador'))return Response.json({...draft,...draftOverride});
  if(path.endsWith('/orden'))return Response.json({...order,...orderOverride});
  if(path.endsWith('/checkout')){
   const request=JSON.parse(opts.body);
   return Response.json(request.action==='start'?checkout:{
    ...checkout,estado:'pagado_esperando_archivos',uploadAuthorized:true
   });
  }
  throw Error('RUTA_NO_ESPERADA');
 };
 const build=()=>crearFlujoPresupuestoLive({
  origin:originOverride,files:[file],archivos,webOrderId,telefono:'351 5554444',
  nombre:'Ana Pérez',direccion:'Poeta Lugones 123, Córdoba',
  fetcher,hasher:async()=>sha,uuid:()=>draftId,
  storage:{setItem:(key,val)=>store.set(key,val)},
  custodiarOriginales:async({files,metas,webOrderId})=>{
   if(localSaveFails)throw Error('ALMACENAMIENTO_LOCAL_SIN_ESPACIO');
   originals.set(webOrderId,files.map((file,i)=>({file,sha256:metas[i].sha256})));
   return {ok:true,savedFiles:files.length};
  },
  recuperarOriginales:async({webOrderId,metas})=>{
   const saved=originals.get(webOrderId);
   if(!saved||saved.length!==metas.length)throw Error('ORIGINAL_LOCAL_DISTINTO_O_AUSENTE');
   return saved.map((row,i)=>{if(row.sha256!==metas[i].sha256)throw Error('ORIGINAL_MODIFICADO');return row.file;});
  },
  onState:v=>state.push(v)
 });
 return {calls,store,state,build};
}
test('LIVE presupuestar y crear orden sin transmitir originales',async()=>{
 const f=fixture(),flow=f.build();
 const r=await flow.preparar();
 assert.equal(r.amountArs,5000);
 assert.equal(r.numeroOrden,'018');
 assert.deepEqual(f.calls.map(c=>c.path),[
  '/api/pedido/live/borrador','/api/pedido/live/orden']);
 for(const c of f.calls){
  assert.equal(c.opts.credentials,'same-origin');
  assert.equal(c.opts.body.includes('%PDF-'),false);
  assert.equal(c.opts.body.includes('apunte.pdf'),c.path.endsWith('/borrador'));
 }
 const orderCall=f.calls.find(c=>c.path.endsWith('/orden'));
 const contact=JSON.parse(orderCall.opts.body);
 assert.equal(contact.nombre,'Ana Pérez');
 assert.equal(contact.telefono,'351 5554444');
 assert.equal(contact.direccion,'Poeta Lugones 123, Córdoba');
 assert.equal(flow.estado,'presupuestado');
 // Regresión: pedido confirmado recuperable ANTES de pulsar pagar.
 assert.deepEqual([...f.store.keys()],['saber-live-archivos-v1','saber-live-pedido-v1']);
  assert.deepEqual(JSON.parse(f.store.get('saber-live-pedido-v1')),{webOrderId,commercialOrderId});
 const saved=JSON.parse(f.store.get('saber-live-archivos-v1'));
 assert.equal(saved.webOrderId,webOrderId);
 assert.equal(saved.commercialOrderId,commercialOrderId);
 assert.equal(saved.metas.length,1);
 assert.equal(saved.metas[0].sha256,sha);
 assert.equal(f.calls.some(c=>c.path.endsWith('/checkout')),false);
});
test('checkout solo después de orden productiva y conservación antes del retorno',async()=>{
 const f=fixture(),flow=f.build();
 await assert.rejects(flow.iniciarPago(),/SIN_ORDEN/);
 await flow.preparar();
 assert.equal(f.store.has('saber-live-archivos-v1'),true);
 const url=await flow.iniciarPago();
 assert.match(url,/mercadopago.com.ar/);
 assert.equal(f.store.has('saber-live-pedido-v1'),true);
 assert.equal(f.calls.length,3);
 assert.equal(flow.estado,'esperando_pago');
 assert.equal(await flow.consultarPago(),'pagado');
 assert.equal(flow.estado,'pagado');
 assert.equal(f.calls.length,4);
});
test('falla cerrado ante cambio de precio o identidad y no llega a cobrar',async()=>{
 for(const option of [{draftOverride:{totalArs:-1}},
  {orderOverride:{totalArs:1}},{orderOverride:{webOrderId:'WEB-ENSAYO-'+'B'.repeat(32)}}]){
  const f=fixture(option),flow=f.build();
  await assert.rejects(flow.preparar());
  assert.equal(flow.estado,'error');
  assert.equal(f.calls.some(c=>c.path.endsWith('/checkout')),false);
  assert.equal(f.store.size,0);
 }
});
test('no ejecuta solicitudes LIVE desde sandbox',()=>{
 const f=fixture({originOverride:'https://saber-documentos-pruebas.workers.dev'});
 assert.throws(f.build,/LIVE_FLUJO_IDENTIDAD_INVALIDA/);
 assert.equal(f.calls.length,0);
});

test('flujo LIVE no crea borrador ni orden si faltan datos obligatorios',()=>{
 for(const patch of [
  {nombre:''},{nombre:'A'},{nombre:'<script>'},
  {direccion:'x'.repeat(181)},{telefono:'1234'}
 ]){
  const f=fixture();
  const props={files:[file],archivos,webOrderId,telefono:'351 5554444',nombre:'Ana Pérez',
   direccion:'',fetcher:async()=>{throw Error('NO_DEBE_ENVIAR')},origin,
   hasher:async()=>sha,storage:{setItem(){}},...patch};
  assert.throws(()=>crearFlujoPresupuestoLive(props),/LIVE_FLUJO_IDENTIDAD_INVALIDA/);
  assert.equal(f.calls.length,0);
 }
});

test('prohíbe pagar si no se pudieron custodiar los originales y conserva D1 sin cobro',async()=>{
 const fixtureFail=fixture({localSaveFails:true});
 const flow=fixtureFail.build();
 await assert.rejects(flow.preparar(),/ALMACENAMIENTO_LOCAL_SIN_ESPACIO/);
 assert.equal(fixtureFail.calls.filter(c=>c.path.endsWith('/checkout')).length,0);
 assert.equal(fixtureFail.store.has('saber-live-archivos-v1'),false);
});

test('pago por transferencia conserva referencia y manifest ANTES de abrir Mercado Pago',async()=>{
 const f=fixture(),flow=f.build();
 await flow.preparar();
 assert.deepEqual(JSON.parse(f.store.get('saber-live-pedido-v1')),{webOrderId,commercialOrderId});
 const manifest=JSON.parse(f.store.get('saber-live-archivos-v1'));
 assert.equal(manifest.metas[0].transport,'tus');
 assert.equal(manifest.metas[0].sha256,sha);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/checkout')).length,0);
});
