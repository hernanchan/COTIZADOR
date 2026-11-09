import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {planBorradoUniversalD1,encolarBorradoUniversalEntregado,
 procesarBorradoUniversalEntregado,reintentarBorradosUniversal}
 from '../integraciones/mercadopago/pruebas/r2-universal-purge-central.mjs';
import {eliminarOriginalUniversalTUS,atenderBorradoUniversalTUS}
 from '../integraciones/autocotizador/recepcion/r2-universal-purge-documentos.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF',
 ORDER='12345678-1234-4123-8123-123456789abc',
 TUS='12345678-1234-4123-8123-123456789abd',
 R2='12345678-1234-4123-8123-123456789abe',
 SHA='a'.repeat(64),BIG_SHA='b'.repeat(64);
function fixture({paid=true,delivered=true,received=true,prepress=true,alteredEtag=false}={}){
 const item=(id,transport,receipt,key,sha,bytes,etag=null)=>({
  web_order_id:WEB,file_id:id,transport,receipt_id:'DOC-'+receipt,
  object_key:key,sha256:sha,bytes,etag,production_version:3,state:'pending',
  attempts:0});
 const small=item('small','tus',TUS,'v2/'+WEB+'/'+TUS+'.pdf',SHA,23);
 const big=item('big','r2',R2,'r2-v1/'+WEB+'/'+R2+'.pdf',BIG_SHA,70*1048576,'source-etag-123');
 const rows=[small,big];
 let r2exists=true,removed=[],events=[],queue=[];
 const env={
  CENTRAL_R2_UNIVERSAL_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PURGE_SCOPE:'NEW_ORDERS_ONLY'
 };
 const originals=()=>rows.map(r=>({
  file_id:r.file_id,transport:r.transport,sha256:r.sha256,bytes:r.bytes,
  received:received?1:0,web_order_id:WEB,
  tus_receipt:r.transport==='tus'?r.receipt_id:null,
  tus_key:r.transport==='tus'?r.object_key:null,
  tus_sha:r.transport==='tus'?r.sha256:null,
  tus_bytes:r.transport==='tus'?r.bytes:null,
  r2_receipt:r.transport==='r2'?r.receipt_id:null,
  r2_key:r.transport==='r2'?r.object_key:null,
  r2_etag:r.transport==='r2'?r.etag:null,
  r2_sha:r.transport==='r2'?r.sha256:null,
  r2_bytes:r.transport==='r2'?r.bytes:null,
  r2_status:r.transport==='r2'?'awaiting_pdf_analysis':null,
  r2_reservation:r.transport==='r2'?'reserved':null
 }));
 const db={prepare(sql){return {args:[],sql,bind(...v){this.args=v;return this},
  async first(){
   if(sql.includes("name='central_r2_universal_prepress_approvals'"))
    return prepress?{name:'central_r2_universal_prepress_approvals'}:null;
   if(sql.includes('FROM central_r2_universal_prepress_approvals a'))
    return prepress?{web_order_id:WEB,quote_hash:SHA,file_count:2,operator:'Operador'}:null;
   if(sql.includes('FROM central_r2_universal_order_links l')&&
      sql.includes('JOIN central_r2_universal_drafts'))
    return {web_order_id:WEB,file_count:2,created_at:'2026-11-09 20:00:00',
     status:paid?'paid':'awaiting_payment',paid_at:paid?'2026-11-09 20:02:00':null,
     amount_ars:12000,deposit_ars:12000,review_state:paid?'verified':'pending',
     production_state:delivered?'entregado':'listo',production_version:3};
   if(sql.includes("name='central_r2_universal_purge_files'"))
    return {name:'central_r2_universal_purge_files'};
   throw Error('Unknown first '+sql);
  },
  async all(){
   if(sql.includes('FROM central_r2_universal_files f'))
    return {results:originals()};
   if(sql.includes('FROM central_r2_universal_purge_files'))
    return {results:sql.includes("state IN")?
     queue.filter(r=>r.state==='pending'||r.state==='error'):
     queue};
   if(sql.includes('SELECT DISTINCT order_id'))return {results:queue.some(r=>r.state!=='deleted')?[{order_id:ORDER}]:[]};
   throw Error('Unknown all '+sql);
  },
  async run(){
   if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
   if(sql.startsWith('INSERT OR IGNORE INTO central_r2_universal_purge_files')){
    const [order_id,web_order_id,file_id,transport,receipt_id,object_key,etag,sha256,bytes,production_version]=this.args;
    if(!queue.some(x=>x.file_id===file_id))
     queue.push({order_id,web_order_id,file_id,transport,receipt_id,
      object_key,etag,sha256,bytes,production_version,state:'pending',attempts:0});
    return {meta:{changes:1}};
   }
   if(sql.startsWith('UPDATE central_r2_universal_purge_files SET state=')){
    const [order_id,file_id]=this.args,x=queue.find(x=>x.order_id===order_id&&x.file_id===file_id);
    if(!x)return {meta:{changes:0}};
    if(sql.includes("'processing'")){
     if(x.state==='deleted')return {meta:{changes:0}};
     x.state='processing';x.attempts++;return {meta:{changes:1}};
    }
    if(sql.includes("'deleted'")){x.state='deleted';return {meta:{changes:1}}}
    if(sql.includes("'error'")){x.state='error';return {meta:{changes:1}}}
   }
   if(sql.startsWith('INSERT INTO central_r2_universal_purge_audit')){events.push(this.args);return {meta:{changes:1}}}
   throw Error('Unknown run '+sql);
  }
 }};
 db.batch=async statements=>{
  for(const s of statements)await s.run();
  return statements.map(()=>({meta:{changes:1}}));
 };
 env.DB=db;
 env.SABER_R2_GRANDES={
  head:async key=>r2exists?{size:big.bytes,etag:alteredEtag?'rogue-etag-999':big.etag}:null,
  delete:async key=>{removed.push(key);r2exists=false}
 };
 return {env,rows,queue:()=>queue,removed,events};
}
test('plan universal solo si pago, entrega, preprensa y ambos recibos',async()=>{
 const yes=fixture();
 const plan=await planBorradoUniversalD1(yes.env,ORDER,3);
 assert.equal(plan.files.length,2);
 assert.deepEqual(plan.files.map(x=>x.transport),['tus','r2']);
 assert.equal(plan.files[1].etag,'source-etag-123');
 for(const opts of [{paid:false},{delivered:false},{prepress:false},{received:false}]){
  const no=fixture(opts);
  assert.equal(await planBorradoUniversalD1(no.env,ORDER,3),null);
 }
 assert.equal(await planBorradoUniversalD1(yes.env,ORDER,4),null);
});
test('borrado mixto encolado y ejecutado por D1; nunca borra la llave equivocada',async()=>{
 const f=fixture();
 const queued=await encolarBorradoUniversalEntregado(f.env,ORDER,3);
 assert.equal(queued.state,'pending');
 assert.equal(queued.totalFiles,2);
 let tus=0;
 const result=await procesarBorradoUniversalEntregado(f.env,ORDER,{
  deleteTUS:async(env,id,row)=>{assert.equal(id,ORDER);
   assert.equal(row.object_key,'v2/'+WEB+'/'+TUS+'.pdf');tus++;return true}
 });
 assert.equal(result.filesDeleted,2);
 assert.equal(result.failed,0);
 assert.equal(tus,1);
 assert.deepEqual(f.removed,['r2-v1/'+WEB+'/'+R2+'.pdf']);
 assert.ok(f.queue().every(x=>x.state==='deleted'));
 const again=await procesarBorradoUniversalEntregado(f.env,ORDER,{
  deleteTUS:async()=>{throw Error('reenvío prohibido')}});
 assert.equal(again.filesDeleted,0);
});
test('R2 etag cambiado bloquea borrado y deja fila retry auditable',async()=>{
 const f=fixture({alteredEtag:true});
 await encolarBorradoUniversalEntregado(f.env,ORDER,3);
 const r=await procesarBorradoUniversalEntregado(f.env,ORDER,{deleteTUS:async()=>true});
 assert.equal(r.failed,1);
 assert.equal(f.removed.length,0);
 assert.equal(f.queue().find(x=>x.transport==='r2').state,'error');
});
test('TUS purga solo el objeto con SHA original, confirma ausencia',async()=>{
 const p={schema:'saber-docs-r2-universal-purge-file-v1',webOrderId:WEB,
  commercialOrderId:ORDER,fileId:'small',transport:'tus',receiptId:'DOC-'+TUS,
  objectKey:'v2/'+WEB+'/'+TUS+'.pdf',sha256:createHash('sha256').update('%PDF-abc').digest('hex'),
  bytes:8,productionVersion:3};
 const env={DOCS_R2_UNIVERSAL_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_R2_UNIVERSAL_PURGE_SCOPE:'NEW_ORDERS_ONLY',
  DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  DOCS_TUS_RECEIPT_KEY:'t'.repeat(40),
  DOCS_TUS_SUPABASE_SERVICE_KEY:'s'.repeat(45),
  DOCS_TUS_PUBLISHABLE_KEY:'p'.repeat(40)};
 let present=true,deleted=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='HEAD')return new Response('',{status:present?200:404});
  if(opts.method==='DELETE'){const body=JSON.parse(opts.body);assert.deepEqual(body.prefixes,[p.objectKey]);present=false;deleted++;return Response.json({ok:true});}
  throw Error('Unexpected request');
 };
 const safe=await eliminarOriginalUniversalTUS(env,p,{
  fetcher,read:async()=>new TextEncoder().encode('%PDF-abc'),subtle:webcrypto.subtle});
 assert.equal(safe.verifiedAbsent,true);
 assert.equal(deleted,1);
 present=true;
 const tampered=await assert.rejects(eliminarOriginalUniversalTUS(env,p,{
  fetcher,read:async()=>new TextEncoder().encode('%PDF-xyz'),subtle:webcrypto.subtle}),/SHA_CHANGED/);
 assert.equal(deleted,1);
 const denied=await atenderBorradoUniversalTUS(new Request('https://private.invalid',{
  method:'POST',body:'{}'}),{...env,DOCS_R2_UNIVERSAL_PURGE_ENABLED:'OFF'});
 assert.equal(denied.status,503);
});
