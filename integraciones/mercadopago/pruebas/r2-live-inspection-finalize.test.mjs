import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {finalizarInspeccionR2Live,manifiestoInspeccionR2Live} from './r2-live-inspection-finalize.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',t=1794320000;
const web='WEB-ENSAYO-'+'A'.repeat(32);
const order='123e4567-e89b-42d3-a456-426614174000';
const receipt='DOC-123e4567-e89b-42d3-a456-426614174001';
const hash='a'.repeat(64),quote='b'.repeat(64),file='pdf_0';
const key='CENTRAL_R2_INSPECTION_SECRET_DIFFERENT_1234';
const proof={schema:'saber-r2-live-inspection-proof-v1',webOrderId:web,
 commercialOrderId:order,fileId:file,receiptId:receipt,
 quoteHash:quote,sha256:hash,bytes:60*1048576,issuedAt:t,
 measuredDimensions:[{numero:1,anchoCm:59.4,altoCm:84.1}]};
const sign=p=>createHmac('sha256',key).update(JSON.stringify(p)).digest('hex');
const request=(p=proof,sig=sign(p))=>new Request(
 'https://pagos.libreriasaber.com.ar/admin/api/central/live-r2-inspection',{
 method:'POST',headers:{Origin:'https://pagos.libreriasaber.com.ar',
 'Content-Type':'application/json'},
 body:JSON.stringify({operator:'Preprensa Saber',confirmed:true,proof:p,signature:sig})
});
const envBase={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 MP_LIVE_GATE:GO,CENTRAL_LIVE_POSTPAY_GATE:GO,
 CENTRAL_LIVE_R2_GATE:GO,CENTRAL_LIVE_R2_STAGING_GATE:GO,
 CENTRAL_LIVE_R2_INSPECTION_GATE:GO,
 CENTRAL_LIVE_R2_INSPECTION_KEY:key,
 CENTRAL_BRIDGE_KEY:'DIFFERENT_CENTRAL_BRIDGE_KEY_12345'};
function fixture({paid=true,geometry=59.4,received=0,pending=true,method='mercadopago'}={}){
 const queries=[],batches=[];
 const db={
  prepare(sql){queries.push(sql);let args=[];
   return {bind(...a){args=a;return this},async first(){
    if(sql.includes('FROM central_r2_universal_order_links'))return {commercial_order_id:order};
    if(sql.includes('FROM central_r2_large_pending')){
     return pending?{receipt_id:receipt,web_order_id:web,file_id:file,
      object_key:'r2-v1/'+web+'/'+receipt.slice(4)+'.pdf',
      sha256:hash,bytes:proof.bytes,status:'awaiting_pdf_analysis'}:null;
    }
    if(sql.includes('FROM central_r2_large_reservations'))
     return {web_order_id:web,file_id:file,sha256:hash,bytes:proof.bytes,state:'reserved'};
    if(sql.includes('FROM central_r2_live_inspections'))return null;
    throw Error('SQL inesperado '+sql);
   }};
  },
  async batch(statements){batches.push(statements);return statements.map(()=>({meta:{changes:1}}))}
 };
 const env={...envBase,DB:db};
 const verify=async()=>({ok:true,link:{quote_hash:quote},amountArs:4400,
  rows:[{file_id:file,transport:'r2',sha256:hash,bytes:proof.bytes,received}],
  works:[{fileId:file,configuracion:{paginas:[
   {numero:1,anchoCm:geometry,altoCm:84.1,modo:'sin-clasificar'}]}}]});
 const payment=async()=>({verified:paid,revoked:false,method});
 const opts={authorized:true,verify,payment,subtle:webcrypto.subtle,now:()=>t};
 return {env,opts,queries,batches};
}
test('comprobante local válido + D1 pago, reserva y geometría: recibo registrado sin impresión',async()=>{
 const f=fixture();
 const r=await finalizarInspeccionR2Live(request(),f.env,f.opts);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 const data=await r.json();
 assert.equal(data.originalVerified,true);
 assert.equal(data.productionAuthorized,false);
 assert.equal(data.prepressApproved,false);
 assert.equal(data.zipEnabled,false);
 assert.equal(f.batches.length,1);
 assert.equal(f.batches[0].length,2);
 const all=f.queries.join(' ');
 assert.match(all,/payment_reviews/);
 assert.match(all,/central_r2_live_inspections/);
 assert.equal(f.batches[0].every(x=>x.bind),true);
});
test('transferencia bancaria auditada admite inspección y exige pago D1 en SQL',async()=>{
 const f=fixture({method:'transferencia'});
 const r=await finalizarInspeccionR2Live(request(),f.env,f.opts);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 assert.ok(f.queries.join(' ').includes('central_live_bank_accreditations'));
 assert.equal(f.batches.length,1);
});
test('prohibido sin operador, gates o firma confiable; ninguna escritura',async()=>{
 for(const [change,authorized] of [[{CENTRAL_LIVE_R2_INSPECTION_GATE:'NO_GO'},true],
  [{MP_LIVE_GATE:'NO_GO'},true],[{SABER_ENTORNO:'preparacion'},true],
  [{CENTRAL_LIVE_R2_INSPECTION_KEY:envBase.CENTRAL_BRIDGE_KEY},true],
  [{},false]]){
  const f=fixture(),r=await finalizarInspeccionR2Live(request(),
   {...f.env,...change},{...f.opts,authorized});
  assert.equal(r.status,authorized?503:401);
  assert.equal(f.batches.length,0);
 }
 const f=fixture();
 const bad=await finalizarInspeccionR2Live(request(proof,'0'.repeat(64)),f.env,f.opts);
 assert.equal(bad.status,401);assert.equal(f.batches.length,0);
});
test('pago no conciliado, original ajeno, geometría distinta y reserva ausente bloquean',async()=>{
 for(const config of [{paid:false},{geometry:60.9},{pending:false}]){
  const f=fixture(config);
  const result=await finalizarInspeccionR2Live(request(),f.env,f.opts);
  assert.ok([402,409].includes(result.status),JSON.stringify(config));
  assert.equal(f.batches.length,0);
 }
 const f=fixture();
 const modified={...proof,bytes:70*1048576};
 const result=await finalizarInspeccionR2Live(
  request(modified,sign(modified)),f.env,f.opts);
 assert.equal(result.status,409);assert.equal(f.batches.length,0);
});
test('firma antigua, caducada y remitente remoto rechazados',async()=>{
 const f=fixture();
 const future={...proof,issuedAt:t+5};
 const rejected=await finalizarInspeccionR2Live(request(future,sign(future)),f.env,f.opts);
 assert.equal(rejected.status,409);
 const remote=new Request('https://pagos.libreriasaber.com.ar/admin/api/central/live-r2-inspection',{
  method:'POST',headers:{Origin:'https://other.example.com','Content-Type':'application/json'},
  body:JSON.stringify({operator:'Preprensa Saber',confirmed:true,proof,signature:sign(proof)})
 });
 assert.equal((await finalizarInspeccionR2Live(remote,f.env,f.opts)).status,403);
 assert.equal(f.batches.length,0);
});

test('GET manifiesto D1 LIVE alimenta la preprensa sin token R2 ni pago navegador',async()=>{
 const f=fixture();
 const url='https://pagos.libreriasaber.com.ar/admin/api/central/live-r2-manifest'+
  '?webOrderId='+web+'&fileId='+file;
 const r=await manifiestoInspeccionR2Live(new Request(url),f.env,f.opts);
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 const data=await r.json();
 assert.equal(data.manifest.schema,'saber-r2-live-inspection-manifest-v1');
 assert.equal(data.manifest.expectedSha256,hash);
 assert.equal(data.manifest.quoteHash,quote);
 assert.equal(data.manifest.paginasDeclaradas[0].modo,'sin-clasificar');
 assert.equal(data.manifest.quoteSnapshot,null);
 assert.equal(data.downloadAuthorized,false);
 assert.equal(data.productionAuthorized,false);
 assert.equal(JSON.stringify(data).includes('objectKey'),false);
 assert.equal(f.batches.length,0);
});
test('GET manifiesto cierra por identidad, pago pendiente y sesión operador',async()=>{
 const endpoint='https://pagos.libreriasaber.com.ar/admin/api/central/live-r2-manifest'+
  '?webOrderId='+web+'&fileId='+file;
 for(const opt of [{paid:false},{pending:false}]){
  const f=fixture(opt);
  const r=await manifiestoInspeccionR2Live(new Request(endpoint),f.env,f.opts);
  assert.ok([402,409].includes(r.status));
 }
 const f=fixture();
 assert.equal((await manifiestoInspeccionR2Live(
  new Request(endpoint),f.env,{...f.opts,authorized:false})).status,401);
 assert.equal((await manifiestoInspeccionR2Live(
  new Request(endpoint+'&fileId=pdf_1'),f.env,f.opts)).status,422);
});

test('inspección de PDF ya pagado funciona con checkout y staging R2 nuevos NO_GO',async()=>{
 const f=fixture();
 const e={...f.env,CENTRAL_LIVE_R2_GATE:'NO_GO',
  CENTRAL_LIVE_R2_STAGING_GATE:'NO_GO',CENTRAL_LIVE_R2_QUOTA_GATE:'NO_GO'};
 const r=await finalizarInspeccionR2Live(request(),e,f.opts);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 assert.equal((await r.json()).productionAuthorized,false);
 assert.equal(f.batches.length,1,'Solo guarda inspección pagada; jamás genera pago');
});
test('manifiesto de sólo lectura no necesita habilitar cobros R2',async()=>{
 const f=fixture();
 const e={...f.env,CENTRAL_LIVE_R2_GATE:'NO_GO',
  CENTRAL_LIVE_R2_STAGING_GATE:'NO_GO',CENTRAL_LIVE_R2_QUOTA_GATE:'NO_GO'};
 const url='https://pagos.libreriasaber.com.ar/admin/api/central/live-r2-manifest'+
  '?webOrderId='+web+'&fileId='+file;
 const r=await manifiestoInspeccionR2Live(new Request(url),e,f.opts);
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 assert.equal((await r.json()).downloadAuthorized,false);
 assert.equal(f.batches.length,0,'Lectura sin escrituras D1');
 e.CENTRAL_LIVE_R2_INSPECTION_GATE='NO_GO';
 const blocked=await manifiestoInspeccionR2Live(new Request(url),e,f.opts);
 assert.equal(blocked.status,503);
});
