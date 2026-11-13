import test from 'node:test';
import assert from 'node:assert/strict';
import {planEntregaLive,encolarEntregaLive,procesarEntregaLive} from './central-entrega-purga-live.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const web='WEB-ENSAYO-'+'B'.repeat(32);
const id='123e4567-e89b-42d3-a456-426614174000';
const rid='123e4567-e89b-42d3-a456-426614174004';
const key='r2-v1/'+web+'/'+rid+'.pdf';
const sha='a'.repeat(64),etag='etag12345678',bytes=41*1048576;
function fixture({state='listo',version=3,received=1,reservationState='reserved',changed=false,deleted=false}={}){
 const operations=[],queue=[];
 const order={id,status:'paid',paid_at:'2026-11-13 02:00:00',
  amount_ars:1000,deposit_ars:1000,link_amount:1000,web_order_id:web,
  file_count:1,created_at:'2026-11-13 01:00:00',state,version};
 const files=[{file_id:'pdf_0',transport:'r2',web_order_id:web,sha256:sha,
  bytes,received,tus_receipt:null,tus_key:null,tus_sha:null,tus_bytes:null,
  r2_receipt:'DOC-'+rid,r2_key:key,r2_etag:etag,r2_sha:changed?'b'.repeat(64):sha,
  r2_bytes:bytes,r2_status:'awaiting_pdf_analysis',reservation_state:reservationState,pages_claimed:6}];
 const db={
  prepare(sql){const q={sql,values:[],bind(...v){this.values=v;return this},
   async first(){
    if(sql.includes('FROM orders o JOIN central_r2_universal_order_links'))return order;
    if(sql.includes('SELECT COUNT(*) AS total'))return {total:queue.length,
     deleted:queue.filter(x=>x.state==='deleted').length};
    return null;
   },async all(){
    if(sql.includes('FROM central_r2_universal_files f'))return {results:files};
    if(sql.includes('SELECT * FROM central_live_purge_files'))return {results:queue};
    if(sql.includes('SELECT * FROM central_live_purge_files WHERE'))return {results:queue};
    return {results:[]};
   },async run(){
    operations.push({sql,values:this.values});
    if(sql.startsWith('INSERT OR IGNORE INTO central_live_purge_files')){
     if(!queue.some(x=>x.file_id===this.values[1]))
      queue.push({order_id:this.values[0],file_id:this.values[1],
       web_order_id:this.values[2],transport:this.values[3],object_key:this.values[4],
       receipt_id:this.values[5],sha256:this.values[6],bytes:this.values[7],
       etag:this.values[8],production_version:this.values[9],state:'pending',attempts:0});
    }
    if(sql.includes("SET state='processing'"))queue[0].state='processing';
    if(sql.includes("SET state='deleted'"))queue[0].state='deleted';
    if(sql.includes("SET state='error'"))queue[0].state='error';
    return {meta:{changes:1}};
   }};
   return q;
  },
  async batch(qs){return Promise.all(qs.map(q=>q.run()))}
 };
 const env={DB:db,SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  CENTRAL_LIVE_PURGE_GATE:GO,CENTRAL_LIVE_PURGE_EXECUTE_GATE:GO,
  CENTRAL_LIVE_R2_INSPECTION_GATE:GO};
 const bucket={head:async name=>deleted?null:{size:bytes,etag},delete:async name=>{
  assert.equal(name,key);deleted=true}};
 return {env,bucket,operations,queue,order};
}
test('entrega LIVE prepara purga con pago, SHA, ETag, reserva R2 válida (sin inspección manual)',async()=>{
 for(const options of [{received:0},{reservationState:'invalid'},{changed:true}]){
  const f=fixture(options);
  assert.equal(await planEntregaLive(f.env,id,{state:'listo',version:3}),null);
  assert.equal(f.operations.length,0);
 }
 const f=fixture();
 const plan=await planEntregaLive(f.env,id,{state:'listo',version:3});
 assert.equal(plan.files.length,1);
 assert.equal(plan.files[0].object_key,key);
});
test('cola inmutable se crea ANTES de entregar y nunca borra si sigue listo',async()=>{
 const f=fixture();
 const queued=await encolarEntregaLive(f.env,id,4,{preflight:true});
 assert.equal(queued.state,'pending');
 assert.equal(queued.totalFiles,1);
 const processed=await procesarEntregaLive(f.env,id,{deleteFile:async(_env,_id,row)=>{assert.equal(row.object_key,key);await f.bucket.delete(row.object_key)}});
 assert.equal(processed.state,'pending_retry');
 assert.equal(f.queue[0].state,'pending');
 assert.equal(f.operations.some(x=>x.sql.includes("SET state='deleted'")),false);
});
test('una entrega confirmada borra R2 y verifica ausencia; el recibo de pago permanece',async()=>{
 const f=fixture({state:'entregado',version:4});
 const queued=await encolarEntregaLive(f.env,id,4);
 assert.equal(queued.state,'pending');
 const result=await procesarEntregaLive(f.env,id,{deleteFile:async(_env,_id,row)=>{assert.equal(row.object_key,key);await f.bucket.delete(row.object_key)}});
 assert.equal(result.state,'deleted');
 assert.equal(result.verifiedDeleted,1);
 assert.equal(f.queue[0].state,'deleted');
 assert.equal(f.operations.some(x=>/DELETE FROM orders|DELETE FROM payment_reviews/.test(x.sql)),false);
});
test('sin gate LIVE nunca consulta ni elimina originales',async()=>{
 const f=fixture();
 f.env.CENTRAL_LIVE_PURGE_GATE='NO_GO';
 assert.equal(await planEntregaLive(f.env,id,{state:'listo',version:3}),null);
 assert.equal((await encolarEntregaLive(f.env,id,4,{preflight:true})).state,'off');
 assert.equal((await procesarEntregaLive(f.env,id,{deleteFile:async(_env,_id,row)=>{assert.equal(row.object_key,key);await f.bucket.delete(row.object_key)}})).state,'off');
 assert.equal(f.operations.length,0);
});

test('no requiere tabla manual de inspecciones R2 para purgar trabajo revisado en ZIP',async()=>{
 const f=fixture();
 const plan=await planEntregaLive(f.env,id,{state:'listo',version:3});
 assert.ok(plan?.files?.length===1);
 assert.equal(plan.files[0].reservation_state,'reserved');
 const sql=f.operations.map(x=>x.sql).join('\n');
 assert.doesNotMatch(sql,/central_r2_live_inspections/);
 const queued=await encolarEntregaLive(f.env,id,4,{preflight:true});
 assert.equal(queued.state,'pending');
});
