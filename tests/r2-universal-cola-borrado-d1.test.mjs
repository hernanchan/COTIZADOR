import test from 'node:test';
import assert from 'node:assert/strict';
import {planBorradoUniversalD1,encolarBorradoUniversalEntregado,
 procesarBorradoUniversalEntregado} from '../integraciones/mercadopago/pruebas/r2-universal-purge-central.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const ID='12345678-1234-4123-8123-123456789abc';
const T='12345678-1234-4123-8123-123456789abd',R='12345678-1234-4123-8123-123456789abe';
const M=1048576;
const R2KEY='r2-v1/'+WEB+'/'+R+'.pdf';
const TKEY='v2/'+WEB+'/'+T+'.pdf';
function mock({delivered=true,paid=true,received=true,approved=true,scope=true}={}){
 const rows=[
  {web_order_id:WEB,file_id:'small',transport:'tus',sha256:'a'.repeat(64),
   bytes:2*M,received:1,name:'Apuntes.pdf',tus_receipt:'DOC-'+T,
   tus_key:TKEY,tus_sha:'a'.repeat(64),tus_bytes:2*M},
  {web_order_id:WEB,file_id:'huge',transport:'r2',sha256:'b'.repeat(64),
   bytes:70*M,received:received?1:0,name:'Plano.pdf',
   r2_receipt:'DOC-'+R,r2_key:R2KEY,r2_sha:'b'.repeat(64),r2_bytes:70*M,
   r2_status:'awaiting_pdf_analysis',r2_reservation:'reserved'}
 ];
 const queue=[],audit=[];
 const db={prepare(sql){const obj={sql,args:[],bind(...a){this.args=a;return this},
  async first(){
   if(sql.includes('FROM central_r2_universal_order_links l')&&sql.includes('JOIN central_r2_universal_drafts'))
    return {web_order_id:WEB,file_count:2,created_at:'2026-11-09 19:00:00',
     status:paid?'paid':'awaiting_payment',
     paid_at:paid?'2026-11-09 19:30:00':null,amount_ars:12500,
     deposit_ars:12500,review_state:paid?'verified':'pending',
     production_state:delivered?'entregado':'listo',production_version:2};
   if(sql.includes("name='central_r2_universal_prepress_approvals'"))
    return approved?{name:'central_r2_universal_prepress_approvals'}:null;
   if(sql.includes('FROM central_r2_universal_prepress_approvals a'))
    return approved?{web_order_id:WEB,quote_hash:'f'.repeat(64),file_count:2,
     operator:'Responsable'}:null;
   throw Error('Unknown first query '+sql);
  },
  async all(){
   if(sql.includes('FROM central_r2_universal_files f'))return {results:rows};
   if(sql.includes('FROM central_r2_universal_purge_files WHERE order_id=?'))
    return {results:queue};
   if(sql.includes('SELECT * FROM central_r2_universal_purge_files'))
    return {results:queue.filter(x=>x.state!=='deleted')};
   throw Error('Unknown all query '+sql);
  },
  async run(){
   if(sql.startsWith('INSERT INTO central_r2_universal_purge_audit')){
    audit.push({kind:'audit',args:this.args});return {meta:{changes:1}};
   }
   if(sql.includes("UPDATE central_r2_universal_purge_files")){
    const id=this.args[1];
    const item=queue.find(x=>x.file_id===id);
    if(!item)return {meta:{changes:0}};
    if(sql.includes("SET state='processing'")){
     item.state='processing';item.attempts++;return {meta:{changes:1}};
    }
    if(sql.includes("SET state='deleted'")){
     item.state='deleted';return {meta:{changes:1}};
    }
    if(sql.includes("SET state='error'")){
     item.state='error';return {meta:{changes:1}};
    }
   }
   return {meta:{changes:1}};
  }
 };return obj;},
 async batch(stmts){
  for(const s of stmts){
   assert.match(s.sql,/INSERT OR IGNORE INTO central_r2_universal_purge_files/);
   const a=s.args;
   if(!queue.some(x=>x.file_id===a[2]))queue.push({
    order_id:a[0],web_order_id:a[1],file_id:a[2],transport:a[3],
    receipt_id:a[4],object_key:a[5],sha256:a[6],bytes:a[7],
    production_version:a[8],state:'pending',attempts:0
   });
  }
  return stmts.map(()=>({meta:{changes:1}}));
 }};
 const env={DB:db,CENTRAL_R2_UNIVERSAL_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_R2_UNIVERSAL_PURGE_SCOPE:scope?'NEW_ORDERS_ONLY':'OFF'};
 return {env,queue,audit,rows};
}
test('D1 prepara borrado sólo si pagado, todos recibidos, aprobado y entregado',async()=>{
 const yes=mock();
 const p=await planBorradoUniversalD1(yes.env,ID,2);
 assert.equal(p.files.length,2);
 assert.deepEqual(p.files.map(x=>x.object_key),[TKEY,R2KEY]);
 for(const opts of [{delivered:false},{paid:false},{received:false},
  {approved:false},{scope:false}]){
  const no=mock(opts);
  assert.equal(await planBorradoUniversalD1(no.env,ID,2),null,JSON.stringify(opts));
 }
 const bad=mock();
 assert.equal(await planBorradoUniversalD1(bad.env,ID,3),null);
 bad.env.CENTRAL_R2_UNIVERSAL_PURGE_ENABLED='OFF';
 assert.equal(await planBorradoUniversalD1(bad.env,ID,2),null);
});
test('cola D1 encola exactamente dos recibos, reintenta R2/TUS sin duplicar ni tocar otros',async()=>{
 const s=mock();
 const stage=await encolarBorradoUniversalEntregado(s.env,ID,2);
 assert.equal(stage.state,'pending');assert.equal(s.queue.length,2);
 assert.deepEqual(new Set(s.queue.map(x=>x.object_key)),new Set([TKEY,R2KEY]));
 const again=await encolarBorradoUniversalEntregado(s.env,ID,2);
 assert.equal(again.state,'pending');assert.equal(s.queue.length,2);
 let deleted=0,checks=0,tus=0;
 const bucket={head:async key=>{checks++;assert.equal(key,R2KEY);
  return deleted?null:{etag:'strong-etag-0123',size:70*M};},
  delete:async key=>{deleted++;assert.equal(key,R2KEY);}};
 const result=await procesarBorradoUniversalEntregado(s.env,ID,{
  bucket,deleteTUS:async(_env,order,row)=>{
   assert.equal(order,ID);assert.equal(row.object_key,TKEY);tus++;
   return true;
  }
 });
 assert.equal(result.state,'processed');
 assert.equal(result.filesDeleted,2);assert.equal(result.failed,0);
 assert.equal(deleted,1);assert.equal(tus,1);assert.ok(checks>=2);
 assert.ok(s.queue.every(x=>x.state==='deleted'));
 const noop=await procesarBorradoUniversalEntregado(s.env,ID,{
  bucket,deleteTUS:async()=>{throw Error('Already deleted')}});
 assert.equal(noop.filesDeleted,0);
});
test('R2 con objeto cambiado NO se borra y queda en cola para reintento',async()=>{
 const s=mock();
 await encolarBorradoUniversalEntregado(s.env,ID,2);
 let deleteCalls=0;
 const bad=await procesarBorradoUniversalEntregado(s.env,ID,{
  bucket:{head:async()=>({size:1,etag:'wrong-etag-123'}),
   delete:async()=>{deleteCalls++}},
  deleteTUS:async()=>true
 });
 assert.equal(bad.failed,1);
 assert.equal(deleteCalls,0);
 assert.equal(s.queue.find(x=>x.transport==='r2').state,'error');
 assert.equal(s.queue.find(x=>x.transport==='tus').state,'deleted');
});
