import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto,createHmac} from 'node:crypto';
import {validarSolicitudCupoR2,R2_QUOTA_LIMITS,reservarCupoR2Central}
 from '../integraciones/mercadopago/pruebas/r2-grandes-cuotas-central.mjs';
import {reservarR2GrandeAntesDeSubir}
 from '../integraciones/autocotizador/recepcion/r2-grandes-reserva-central.mjs';
const MIB=1024*1024;
const ORDER='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ORDER2='WEB-ENSAYO-2223456789ABCDEF0123456789ABCDEF';
const ID='12345678-1234-4123-8123-123456789abc';
const SECRET='clave-dummy-saber-central-r2-cuotas-prueba-1234567890';
const p=(orderId=ORDER,fileId='pdf200',uuid=ID,bytes=200*MIB)=>({
 schema:'saber-central-r2-reserva-v1',orderId,fileId,
 sha256:'a'.repeat(64),bytes,objectKey:'r2-v1/'+orderId+'/'+uuid+'.pdf'
});
function fixtures(){
 const rows=[];let selects=0,inserts=0;
 const db={prepare(sql){
  if(sql.startsWith('CREATE TABLE'))return {run:async()=>({success:true})};
  if(sql.startsWith('SELECT object_key'))return {bind:(...a)=>({first:async()=>{
   selects++;return rows.find(x=>x.web_order_id===a[0]&&x.file_id===a[1]||
    x.object_key===a[2])||null;
  }})};
  if(sql.startsWith('INSERT INTO'))return {bind:(...a)=>({run:async()=>{
   assert.match(sql,/INSERT INTO central_r2_large_reservations[\s\S]+SELECT[\s\S]+WHERE/);
   assert.equal(a.length,13);
   const [object_key,web_order_id,file_id,sha256,bytes,
     maxGlobalBefore,addGlobal,maxGlobal,oid,maxFiles,oid2,addOrder,maxOrder]=a;
   // SQL includes thirteen bindings; assert correct order.
   const active=rows.filter(x=>x.state==='reserved');
   const global=active.reduce((s,x)=>s+x.bytes,0);
   const order=active.filter(x=>x.web_order_id===oid);
   if(global>maxGlobalBefore||global+addGlobal>maxGlobal||
    order.length>=maxFiles||oid!==oid2||
    order.reduce((s,x)=>s+x.bytes,0)+addOrder>maxOrder)
    return {meta:{changes:0}};
   if(rows.some(x=>x.object_key===object_key||
     x.web_order_id===web_order_id&&x.file_id===file_id))
    throw Error('UNIQUE');
   rows.push({object_key,web_order_id,file_id,sha256,bytes,state:'reserved'});
   inserts++;return {meta:{changes:1}};
  }})};
  throw Error('unexpected query: '+sql);
 }};
 const env={CENTRAL_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',DB:db};
 const readSigned=async(request)=>({payload:await request.json()});
 const call=(data=p())=>reservarCupoR2Central(new Request(
  'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/r2-reserve',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  }),env,{readSigned});
 return {env,rows,call,get selects(){return selects},get inserts(){return inserts}};
}
test('reserva PDF 200 MiB sin generar pedido ni pago; repetida es idempotente',async()=>{
 assert.equal(R2_QUOTA_LIMITS.maxGlobalReservedBytes,2*1024*1024*1024);
 const f=fixtures(),first=await f.call();
 assert.equal(first.status,201);
 const d=await first.json();
 assert.equal(d.quotaGranted,true);
 assert.equal(d.paymentAuthorized,false);
 assert.equal(d.registeredInD1,false);
 assert.equal(f.inserts,1);
 const replay=await f.call();
 assert.equal(replay.status,200);
 assert.equal((await replay.json()).idempotent,true);
 assert.equal(f.inserts,1);
});
test('conflicto de un mismo fileId nunca sustituye una reserva anterior',async()=>{
 const f=fixtures();
 assert.equal((await f.call()).status,201);
 const altered=p(ORDER,'pdf200','12345678-1234-4123-8123-223456789abc');
 assert.equal((await f.call(altered)).status,409);
 assert.equal(f.inserts,1);
});
test('límite global 2GiB y 1GiB por pedido previenen gastos',async()=>{
 const f=fixtures();
 const ids=['12345678-1234-4123-8123-123456789abc',
  '12345678-1234-4123-8123-223456789abc',
  '12345678-1234-4123-8123-323456789abc',
  '12345678-1234-4123-8123-423456789abc',
  '12345678-1234-4123-8123-523456789abc',
  '12345678-1234-4123-8123-623456789abc',
  '12345678-1234-4123-8123-723456789abc',
  '12345678-1234-4123-8123-823456789abc',
  '12345678-1234-4123-8123-923456789abc'];
 for(let i=0;i<4;i++)
  assert.equal((await f.call(p(ORDER,'f'+i,ids[i],256*MIB))).status,201);
 assert.equal((await f.call(p(ORDER,'f5',ids[4],200*MIB))).status,429);
 for(let i=0;i<4;i++)
  assert.equal((await f.call(p(ORDER2,'b'+i,ids[i+4],256*MIB))).status,201);
 assert.equal(f.inserts,8);
 assert.equal((await f.call(p(ORDER2,'f5',ids[8],200*MIB))).status,429);
 assert.equal(f.rows.reduce((s,x)=>s+x.bytes,0),2*1024*1024*1024);
});
test('rechazar orden inventada, tamaño mayor 256MiB, firma ajena y flag apagado',async()=>{
 for(const invalid of [
  p('WEB-FAKE-CLIENTE-99999'),
  p(ORDER,'pdf200',ID,350*MIB),
  {...p(),sha256:'no-valid'},
  {...p(),objectKey:'r2-v1/'+ORDER2+'/'+ID+'.pdf'}
 ])assert.throws(()=>validarSolicitudCupoR2(invalid),/R2_QUOTA_/);
 const f=fixtures();f.env.CENTRAL_R2_QUOTA_ENABLED='OFF';
 assert.equal((await f.call()).status,503);
 f.env.CENTRAL_R2_QUOTA_ENABLED='PRIVATE_TEST_ONLY';
 const noAuth=await reservarCupoR2Central(new Request('https://any.example'),f.env,{
  readSigned:async()=>({error:'No HMAC',status:401})
 });
 assert.equal(noAuth.status,401);assert.equal(f.rows.length,0);
});
test('documentos consulta cuota de D1 mediante HMAC y rechaza destino externo',async()=>{
 const env={DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 let calls=0;
 const service={fetch:async request=>{
  calls++;
  assert.equal(new URL(request.url).pathname,'/internal/central/r2-reserve');
  const text=await request.text();
  const ts=request.headers.get('x-saber-ts');
  const rid=request.headers.get('x-saber-request-id');
  assert.equal(request.headers.get('x-saber-signature'),
   createHmac('sha256',SECRET).update(ts+'\n'+rid+'\n'+text).digest('hex'));
  assert.deepEqual(JSON.parse(text),p());
  return Response.json({ok:true,reserved:true,idempotent:false,
   orderId:ORDER,quotaGranted:true,registeredInD1:false,
   checkoutEnabled:false,paymentAuthorized:false},{status:201});
 }};
 const r=await reservarR2GrandeAntesDeSubir({env,orderId:ORDER,
  meta:{fileId:'pdf200',bytes:200*MIB,sha256:'a'.repeat(64)},
  objectUUID:ID,service,now:()=>1793970000,nonce:()=>ID,
  subtle:webcrypto.subtle});
 assert.equal(r.reserved,true);assert.equal(r.paymentAuthorized,false);
 assert.equal(calls,1);
 await assert.rejects(reservarR2GrandeAntesDeSubir({env:{...env,
  CENTRAL_TEST_URL:'https://example.com/internal/central/stage'},
  orderId:ORDER,meta:{fileId:'pdf200',bytes:200*MIB,sha256:'a'.repeat(64)},
  objectUUID:ID,service}),/DESTINO_INVALIDO/);
 assert.equal(calls,1);
});

test('Documentos: rechazo de cuota no filtra mensajes D1 ni secretos',async()=>{
 const env={DOCS_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_BRIDGE_KEY:SECRET,
  CENTRAL_TEST_URL:'https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/stage'};
 const opts={env,orderId:ORDER,meta:{fileId:'pdf200',bytes:200*MIB,sha256:'a'.repeat(64)},
  objectUUID:ID,now:()=>1793970000,nonce:()=>ID,subtle:webcrypto.subtle};
 const bad=await assert.rejects(reservarR2GrandeAntesDeSubir({
  ...opts,service:{fetch:async()=>Response.json(
   {ok:false,error:'No se pudo reservar R2',secret:'NUNCA'}, {status:409})}
 }),/R2_CUPO_RECHAZADO_D1_ESCRITURA_RECHAZADA_409/);
 await assert.rejects(reservarR2GrandeAntesDeSubir({
  ...opts,service:{fetch:async()=>Response.json({error:'token SECRET'}, {status:502})}
 }),/R2_CUPO_RECHAZADO_CENTRAL_ERROR_502/);
});

test('SQLite real: reserva atómica valida sintaxis, admite 60 MiB y evita repetición',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 const driver={prepare(sql){
  const prepared=sqlite.prepare(sql);
  return {
   run:async()=>{const r=prepared.run();return {meta:{changes:Number(r.changes)}}},
   bind:(...args)=>({
    first:async()=>prepared.get(...args)||null,
    run:async()=>{const r=prepared.run(...args);return {meta:{changes:Number(r.changes)}}}
   })
  };
 }};
 const env={CENTRAL_R2_QUOTA_ENABLED:'PRIVATE_TEST_ONLY',DB:driver};
 const signedPayload=p(ORDER,'archivoA1',ID,60*MIB+711);
 const send=()=>reservarCupoR2Central(new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/r2-reserve',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(signedPayload)}),
  env,{readSigned:async req=>({payload:await req.json()})});
 const first=await send(),r1=await first.json();
 assert.equal(first.status,201,JSON.stringify(r1));
 assert.equal(r1.reserved,true);
 assert.equal(r1.quotaGranted,true);
 const second=await send(),r2=await second.json();
 assert.equal(second.status,200,JSON.stringify(r2));
 assert.equal(r2.idempotent,true);
 const entries=sqlite.prepare('SELECT object_key,state,bytes FROM central_r2_large_reservations').all();
 assert.equal(entries.length,1);
 assert.equal(entries[0].state,'reserved');
 assert.equal(entries[0].bytes,60*MIB+711);
 sqlite.close();
});
