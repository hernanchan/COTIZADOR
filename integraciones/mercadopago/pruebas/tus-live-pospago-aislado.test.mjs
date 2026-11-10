import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {verificarPedidoUniversalCobrable} from './r2-universal-checkout-central.mjs';
import {autorizarTUSUniversalCentral,recibirTUSUniversalCentral}
 from './r2-universal-tus-central.mjs';
const LIVE='GO_COMERCIAL_CONFIRMADO';
const WEB='WEB-ENSAYO-'+'A'.repeat(32),ORDER='123e4567-e89b-42d3-a456-426614174000';
const payload={schema:'saber-central-r2-universal-tus-gate-v1',action:'start',
 orderId:WEB,fileId:'pdf_0',name:'Apunte.pdf',sha256:'a'.repeat(64),
 bytes:2000,pages:1};
const base={
 SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:LIVE,CENTRAL_LIVE_BRIDGE_ENABLED:LIVE,
 CENTRAL_LIVE_POSTPAY_GATE:LIVE,CENTRAL_LIVE_TUS_GATE:LIVE,
 CENTRAL_LIVE_ORDER_GATE:LIVE,CENTRAL_LIVE_PRICING_GATE:LIVE
};
const signed=async r=>({payload:await r.json()});
const req=(data=payload)=>new Request('https://pagos.libreriasaber.com.ar/internal/central/live/tus-gate',
 {method:'POST',body:JSON.stringify(data)});
test('sin autorización comercial nunca lee D1 ni emite permiso de subida',async()=>{
 for(const patch of [{CENTRAL_LIVE_TUS_GATE:'NO_GO'},
  {CENTRAL_LIVE_POSTPAY_GATE:'NO_GO'},{MP_LIVE_GATE:'NO_GO'},
  {SABER_ENTORNO:'preparacion'},{CENTRAL_DB_ENV:'pruebas'},
  {CENTRAL_R2_UNIVERSAL_TUS_ENABLED:'PRIVATE_TEST_ONLY'}]){
  let calls=0,reads=0;
  const env={...base,...patch,DB:{prepare(){reads++;throw Error('DO_NOT_READ')}}};
  const res=await autorizarTUSUniversalCentral(req(),env,{
   readSigned:async r=>{calls++;return signed(r)},
   subtle:webcrypto.subtle});
  assert.equal(res.status,503,JSON.stringify(patch));
  assert.equal(reads,0);
  assert.equal(calls,0);
 }
});
test('LIVE puede validar pedido, pero sin vínculo D1 o pago no autoriza TUS',async()=>{
 let calls=0;
 const env={...base,DB:{prepare(sql){calls++;
  if(!sql.includes('SELECT commercial_order_id'))throw Error('No debería leer ni insertar original');
  return {bind(){return this},first:async()=>null};
 }}};
 const resp=await autorizarTUSUniversalCentral(req(),env,{
  readSigned:signed,subtle:webcrypto.subtle});
 assert.equal(resp.status,402);
 assert.equal((await resp.json()).ok,false);
 assert.equal(calls,1);
});
test('validador D1 LIVE no requiere Sandbox y falla cerrado si no encuentra esquema',async()=>{
 let calls=0;
 const env={...base,DB:{prepare(){calls++;throw Error('tabla ausente')}}};
 const ok=await verificarPedidoUniversalCobrable(env,ORDER,{webOrderId:WEB,
  subtle:webcrypto.subtle});
 assert.equal(ok.ok,false);
 assert.equal(ok.reason,'UNIVERSAL_TABLAS_NO_DISPONIBLES');
 assert.equal(calls,1);
 const mixed=await verificarPedidoUniversalCobrable({
  ...env,DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY'
 },ORDER,{webOrderId:WEB,subtle:webcrypto.subtle});
 assert.equal(mixed.reason,'UNIVERSAL_PAGO_DESHABILITADO');
 assert.equal(calls,1);
});
test('recibo LIVE no ejecuta CREATE TABLE; tabla debe estar migrada',async()=>{
 const sql=[];
 const env={...base,DB:{prepare(q){
  sql.push(q);
  if(q.includes('SELECT commercial_order_id'))
   return {bind(){return this},first:async()=>null};
  throw Error('Unexpected SQL');
 },batch(){throw Error('NO_WRITE')}}};
 const doc={schema:'saber-central-r2-universal-tus-received-v1',
  orderId:WEB,fileId:'pdf_0',receiptId:'DOC-'+ORDER,
  objectName:'v2/'+WEB+'/'+ORDER+'.pdf',
  name:'Apunte.pdf',sha256:'a'.repeat(64),bytes:2000,pages:1,
  metrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]};
 const resp=await recibirTUSUniversalCentral(req(doc),env,{
  readSigned:signed,subtle:webcrypto.subtle});
 assert.equal(resp.status,409);
 assert.equal(sql.some(q=>/CREATE\s+TABLE/i.test(q)),false);
});
