import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {validarPreRecepcionR2,stageR2PendienteCentral}
 from '../integraciones/mercadopago/pruebas/r2-grandes-central-pendientes.mjs';
import {prepararPreRecepcionR2,enviarPreRecepcionR2Central}
 from '../integraciones/autocotizador/recepcion/r2-grandes-enviar-central.mjs';

const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const UUID='12345678-1234-4123-8123-123456789abc';
const KEY='r2-v1/'+ORDER+'/'+UUID+'.pdf';
const secret='saber-central-r2-hmac-prueba-solamente-20261106-cadena-larga';
const claim={orderId:ORDER,fileId:'P200',key:KEY,name:'PDF de 200 MB.pdf',
 bytes:200*1024*1024,pages:47,sha256:'a'.repeat(64)};
const verified={storageReady:true,sha256Verificado:true,
 contenidoPdfVerificado:false,objectKey:KEY,etag:'etag-1234abcdef',
 bytes:claim.bytes,sha256:claim.sha256};
const p=prepararPreRecepcionR2(claim,verified);
function fixture(){
 const storage=new Map();let writes=0;
 const env={CENTRAL_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',
  DB:{prepare(sql){
   const op=sql.startsWith('CREATE')?'create':
    sql.startsWith('SELECT')?'select':'insert';
   return {run:async()=>({success:true}),bind(...v){return {
    first:async()=>op==='select'?(storage.get(v[0])||[...storage.values()].find(x=>
      x.web_order_id===v[1]&&x.file_id===v[2])||null):null,
    run:async()=>{
     if(op!=='insert')throw Error('Unexpected INSERT');
     writes++;
     storage.set(v[0],{web_order_id:v[1],file_id:v[2],object_key:v[3],
      sha256:v[4],etag:v[5],bytes:v[6],name:v[7],pages_claimed:v[8],
      status:'awaiting_pdf_analysis'});
     return {success:true};
    }
   }}};
  }}};
 const readSigned=async()=>({payload:p});
 const call=async payload=>stageR2PendienteCentral(new Request(
  'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/r2-pending-stage',
  {method:'POST',body:JSON.stringify(payload||p)}),env,
  {readSigned:async()=>({payload:payload||p})});
 return {env,call,storage,get writes(){return writes}};
}
test('R2 200 MiB pasa solo a pre-registro sin generar precio ni pedido',async()=>{
 assert.equal(p.receiptId,'DOC-'+UUID);
 assert.equal(p.sha256Verificado,true);
 assert.equal(p.contenidoPdfVerificado,false);
 assert.equal(p.paymentAuthorized,false);
 assert.equal(p.registeredInD1,false);
 assert.equal(validarPreRecepcionR2(p).orderId,ORDER);
 const f=fixture(),r=await f.call();
 assert.equal(r.status,201);
 const data=await r.json();
 assert.equal(data.status,'awaiting_pdf_analysis');
 assert.equal(data.registeredInD1,false);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(f.writes,1);
 assert.equal(f.storage.size,1);
});
test('misma carga repetida es idempotente sin nuevas escrituras',async()=>{
 const f=fixture();
 assert.equal((await f.call()).status,201);
 const again=await f.call();
 assert.equal(again.status,200);
 assert.equal((await again.json()).idempotent,true);
 assert.equal(f.writes,1);
});
test('no permite sobrescribir objeto, orden ajena ni saltar validación del PDF',async()=>{
 const f=fixture();
 await f.call();
 const modified={...p,sha256:'b'.repeat(64)};
 assert.equal((await f.call(modified)).status,409);
 assert.equal(f.writes,1);
 for(const b of [
  {...p,orderId:'WEB-OTRA-12345'},
  {...p,receiptId:'DOC-'+UUID.replace('8abc','9abc')},
  {...p,sha256Verificado:false},
  {...p,contenidoPdfVerificado:true},
  {...p,registeredInD1:true},
  {...p,paymentAuthorized:true},
  {...p,bytes:400*1024*1024}
 ]){
  assert.throws(()=>validarPreRecepcionR2(b),/R2_/);
  assert.equal((await f.call(b)).status,422);
 }
 assert.equal(f.writes,1);
});
test('flag apagado o firma inválida jamás escribe en D1',async()=>{
 const f=fixture();
 f.env.CENTRAL_R2_STAGING_ENABLED='false';
 assert.equal((await f.call()).status,503);
 f.env.CENTRAL_R2_STAGING_ENABLED='PRIVATE_TEST_ONLY';
 const r=await stageR2PendienteCentral(new Request('https://example.com/'),f.env,
  {readSigned:async()=>({error:'Invalid HMAC',status:401})});
 assert.equal(r.status,401);assert.equal(f.writes,0);
});
test('no se pre-registra un archivo cuyo SHA de R2 no coincide con el recibo',()=>{
 assert.throws(()=>prepararPreRecepcionR2(claim,{...verified,sha256:'b'.repeat(64)}),/R2_/);
 assert.throws(()=>prepararPreRecepcionR2(claim,{...verified,sha256Verificado:false}),/R2_/);
 assert.throws(()=>prepararPreRecepcionR2(claim,{...verified,etag:null}),/R2_/);
});
test('la ficha se firma por HMAC al Service Binding real; se confirma solo pre-registro',async()=>{
 let calls=0;
 const env={
  DOCS_R2_STAGING_ENABLED:'PRIVATE_TEST_ONLY',DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:secret,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'
 };
 const service={fetch:async req=>{
  calls++;
  assert.equal(new URL(req.url).pathname,'/internal/central/r2-pending-stage');
  const raw=await req.text(),payload=JSON.parse(raw);
  assert.deepEqual(payload,p);
  const ts=req.headers.get('x-saber-ts'),id=req.headers.get('x-saber-request-id');
  const expected=createHmac('sha256',secret).update(ts+'\n'+id+'\n'+raw).digest('hex');
  assert.equal(req.headers.get('x-saber-signature'),expected);
  return Response.json({ok:true,saved:true,status:'awaiting_pdf_analysis',
   registeredInD1:false,paymentAuthorized:false,webOrderId:ORDER},{status:201});
 }};
 const result=await enviarPreRecepcionR2Central({env,claim,verified,service,
  uuid:()=>UUID,now:()=>1793970000,subtle:webcrypto.subtle});
 assert.equal(result.stagedForCentral,true);
 assert.equal(result.registeredInD1,false);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(calls,1);
});
test('si la etapa R2 está apagada no llama a Central, sin bloquear cargas TUS',async()=>{
 const result=await enviarPreRecepcionR2Central({env:{},claim,verified,service:{
  fetch:async()=>{throw Error('No debe llamarse')}
 }});
 assert.equal(result.stagedForCentral,false);
});
