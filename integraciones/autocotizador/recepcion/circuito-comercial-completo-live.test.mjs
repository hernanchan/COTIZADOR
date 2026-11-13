/**
 * Una prueba de circuito completo por las CUATRO rutas comerciales.
 * No usa cuentas reales ni dinero: simula mismo pedido y transmisión completa
 * desde su confirmación hasta la visibilidad en Central, incluyendo R2 staged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {crearFlujoPresupuestoLive} from './flujo-presupuesto-live-cliente.mjs';
import {enviarPDFsTUSPagadosLive} from './recepcion-tus-live-cliente.mjs';
import {enviarPDFsR2PagadosLive} from './recepcion-r2-live-cliente.mjs';
import {leerPedidoPostpagoLive} from './recepcion-tus-live-cliente.mjs';
import {listarRecepcionUniversalLive} from '../../mercadopago/pruebas/central-recepcion-live.mjs';

const HOST='https://pedidos.libreriasaber.com.ar';
const WEB='WEB-ENSAYO-'+'B'.repeat(32);
const ORDER='123e4567-e89b-42d3-a456-426614174005';
const DRAFT='123e4567-e89b-42d3-a456-426614174006';
const RECEIPT='123e4567-e89b-42d3-a456-426614174007';
const SHA='a'.repeat(64);
const QHASH='b'.repeat(64);
const UUID='123e4567-e89b-42d3-a456-426614174008';
const MIB=1048576,GO='GO_COMERCIAL_CONFIRMADO';
function fileOf(bytes){
 const f=Object.assign(new Blob(['%PDF-',new Uint8Array(bytes-5)],{type:'application/pdf'}),
  {name:'apunte.pdf'});
 assert.equal(f.size,bytes);
 return f;
}
function fakeUppy(){
 class Uppy {
  constructor(){this.files=[]}
  use(){return this}
  on(){return this}
  addFile(file){this.files.push(file);return 'file_'+this.files.length}
  setFileMeta(){}
  async upload(){return {failed:[],successful:this.files}}
  close(){}
 }
 return {Uppy,Tus:class {}};
}
const storage=()=>{
 const m=new Map();
 return {m,setItem:(key,value)=>m.set(key,value),getItem:key=>m.get(key)||null};
};
async function runCase(method,bytes){
 const isR2=bytes>40*MIB;
 const src=fileOf(bytes),store=storage(),calls=[];
 let paid=false,notified=false,localFile=null;
 let m;
 const meta=()=>JSON.parse(store.getItem('saber-live-archivos-v1')).metas[0];
 const fetcher=async(path,request)=>{
  const data=JSON.parse(request.body);
  calls.push({path,action:data?.action||null});
  if(path.endsWith('/borrador'))return Response.json({
   ok:true,webOrderId:WEB,draftId:DRAFT,quoteHash:QHASH,
   fileCount:1,totalArs:600,checkoutEnabled:false,paymentAuthorized:false});
  if(path.endsWith('/orden'))return Response.json({
   ok:true,webOrderId:WEB,commercialOrderId:ORDER,numeroOrden:'010',
   totalArs:600,fileCount:1,checkoutEnabled:false,paymentAuthorized:false,
   uploadAuthorized:false,productionAuthorized:false});
  if(path.endsWith('/checkout')){
   if(data.action==='start')return Response.json({ok:true,webOrderId:WEB,
    commercialOrderId:ORDER,amountArs:600,fileCount:1,estado:'pendiente',
    uploadAuthorized:false,productionAuthorized:false,
    checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc'});
   return Response.json({ok:true,webOrderId:WEB,commercialOrderId:ORDER,
    amountArs:600,fileCount:1,estado:paid?'pagado_esperando_archivos':'pendiente',
    uploadAuthorized:paid,productionAuthorized:false,
    pendingFiles:1,receivedFileIds:[]});
  }
  if(path.endsWith('/transfer')){
   if(data.action==='notify')notified=true;
   return Response.json({ok:true,webOrderId:WEB,commercialOrderId:ORDER,
    amountArs:600,estado:paid?'pagado_esperando_archivos':notified?
    'transferencia_informada':'transferencia_pendiente',
    paymentVerified:paid,uploadAuthorized:paid,productionAuthorized:false,
    customerNotified:notified,alias:'LIBRERIASABER.MP'});
  }
  if(path.endsWith('/tus/iniciar'))return Response.json({ok:true,orderId:WEB,
   bucket:'saber-tus-produccion',projectRef:'abcdefghijklmnopqrst',
   publishableKey:'pk_'+('z'.repeat(35)),productionAuthorized:false,
   paymentAuthorized:false,sessions:[{fileId:meta().fileId,bytes,pages:1,
    signature:'s'.repeat(45),proof:'p'.repeat(60),
    objectName:'v2/'+WEB+'/'+RECEIPT+'.pdf'}]});
  if(path.endsWith('/tus/confirmar'))return Response.json({
   ok:true,webOrderId:WEB,savedFiles:1,productionAuthorized:false,
   receipts:[{fileId:meta().fileId,saved:true}]});
  throw Error('RUTA_INESPERADA_'+path);
 };
 const flow=crearFlujoPresupuestoLive({
  files:[src],archivos:[{nombre:src.name,modo:'bn',
   paginas:[{numero:1,anchoCm:21,altoCm:29.7}]}],
  webOrderId:WEB,telefono:'351 5554444',nombre:'Persona de prueba',
  origin:HOST,fetcher,hasher:async()=>SHA,
  uuid:()=>UUID,storage:store,
  custodiarOriginales:async({files,metas})=>{
   assert.equal(metas[0].bytes,bytes);
   localFile=files[0];return {ok:true,savedFiles:1};
  },
  recuperarOriginales:async()=>{assert.ok(localFile);return [localFile]}
 });
 const order=await flow.preparar();
 assert.equal(order.numeroOrden,'010');
 assert.deepEqual(JSON.parse(store.getItem('saber-live-pedido-v1')),
  {webOrderId:WEB,commercialOrderId:ORDER},
  'La transferencia y Mercado Pago deben conservar el MISMO pedido ANTES de pagar');
 assert.equal(store.getItem('saber-live-numero-v1'),'010');
 assert.equal(meta().transport,isR2?'r2':'tus');
 assert.equal(leerPedidoPostpagoLive(store).metas[0].transport,isR2?'r2':'tus');
 if(method==='mercadopago'){
  assert.match(await flow.iniciarPago(),/mercadopago.com.ar/);
 }else{
  const base={webOrderId:WEB,commercialOrderId:ORDER};
  const ask=async action=>(await fetcher('/api/pedido/live/transfer',
   {body:JSON.stringify({...base,action})})).json();
  assert.equal((await ask('start')).estado,'transferencia_pendiente');
  const reported=await ask('notify');
  assert.equal(reported.customerNotified,true);
  assert.equal(reported.paymentVerified,false);
  assert.equal(paid,false);
 }
 const send=()=>isR2?enviarPDFsR2PagadosLive({
  selectedFiles:[src],storage:store,origin:HOST,fetcher,hasher:async()=>SHA,
  uploader:async ({file,orderId,mode,requireCentralStaging,meta})=>{
   assert.equal(paid,true);
   assert.equal(orderId,WEB);assert.equal(mode,'live');
   assert.equal(requireCentralStaging,true);
   assert.equal(meta.fileId,JSON.parse(store.getItem('saber-live-archivos-v1')).metas[0].fileId);
   return {sha256Verificado:true,sha256:SHA,bytes:file.size,
    stagedForCentral:true,contenidoPdfVerificado:false,registeredInD1:false};
  }
 }):enviarPDFsTUSPagadosLive({
  selectedFiles:[src],storage:store,origin:HOST,fetcher,hasher:async()=>SHA,
  loadUploader:async()=>fakeUppy()
 });
 await assert.rejects(send(),/PAGO_O_AVISO_NO_CONCILIADO/,
  'Canal pospago sin pago bloqueado; recepción bancaria anticipada exige permiso distinto');
 paid=true; // Aprobación simulada del proveedor o conciliación bancaría por personal
 const delivered=await send();
 assert.equal(delivered.ok,true);
 assert.equal(isR2?delivered.stagedFiles:delivered.savedFiles,1);
 const originState={received:isR2?0:1,staged:isR2?1:0};
 const board=async()=>{
  const row={order_id:ORDER,web_order_id:WEB,work_number:10,
   file_count:1,total_ars:600,paid_at:'2026-11-13 02:00:00',
   received_count:originState.received,pending_count:1-originState.received,
   tus_count:isR2?0:1,r2_count:isR2?1:0,staged_r2_count:originState.staged,
   staged_r2_ids:originState.staged?meta().fileId:null,
   estado_produccion:'pendiente',version_produccion:0};
  const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
   CENTRAL_LIVE_BOARD_GATE:GO,MP_LIVE_GATE:GO,CENTRAL_LIVE_BRIDGE_ENABLED:GO,
   DB:{prepare(sql){return {all:async()=>({results:sql.includes('sqlite_master')?
    method==='transferencia'?[{name:'central_live_bank_accreditations'}]:[]:[row]}),
     first:async()=>null}}}};
  const result=await listarRecepcionUniversalLive(new Request(
   'https://pagos.libreriasaber.com.ar/admin/api/central/live-recepcion'
  ),env,{authorized:true});
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.orders.length,1);
  assert.equal(data.orders[0].numeroOrden,'010');
  assert.equal(data.orders[0].zipEnabled,originState.received===1);
  return data.orders[0];
 };
 let shown=await board();
 assert.equal(shown.pendingCount,isR2?1:0);
 if(isR2){
  assert.equal(shown.stagedR2Count,1);
  assert.deepEqual(shown.stagedR2FileIds,[meta().fileId]);
  originState.received=1;originState.staged=0; // operador inspeccionó PDF real (simulado)
  shown=await board();
  assert.equal(shown.pendingCount,0);
  assert.equal(shown.zipEnabled,true);
 }
 return {method,transport:isR2?'R2':'TUS',number:order.numeroOrden};
}
test('RECORRIDO COMERCIAL INTEGRAL: MP y transferencia, PDF menor/mayor de 40 MiB',async()=>{
 for(const method of ['mercadopago','transferencia']){
  for(const bytes of [35*1024,40*MIB+1024]){
   const result=await runCase(method,bytes);
   assert.equal(result.number,'010');
  }
 }
});
