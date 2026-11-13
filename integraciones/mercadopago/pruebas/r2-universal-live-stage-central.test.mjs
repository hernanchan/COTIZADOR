import test from 'node:test';
import assert from 'node:assert/strict';
import {registrarR2LivePendiente} from './r2-universal-live-stage-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const SHA='a'.repeat(64);
const NAME='APUNTE.pdf';
const INPUT={
 schema:'saber-central-r2-grande-pendiente-v1',
 orderId:WEB,fileId:'pdf_0',receiptId:'DOC-'+UUID,name:NAME,
 bytes:45*MIB,sha256:SHA,objectKey:'r2-v1/'+WEB+'/'+UUID+'.pdf',
 etag:'abcdef0123456789',pagesDeclaradas:112,
 sha256Verificado:true,contenidoPdfVerificado:false,
 registeredInD1:false,paymentAuthorized:false,listoParaProducir:false
};
const req=()=>new Request('https://pagos.libreriasaber.com.ar/internal/central/live/r2-stage',{method:'POST'});
function fixture({method='transferencia',paid=true,reserved=true,
 received=0,old=false,invalid=false,bankNotice=false}={}){
 const state={received,old,queries:[],batches:0,updates:0};
 const DB={
  prepare(sql){
   const item={sql,args:[],
    bind(...args){this.args=args;return this},
    async first(){
     if(sql.includes('SELECT commercial_order_id FROM central_r2_universal_order_links'))
      return {commercial_order_id:UUID};
     if(sql.includes('FROM central_r2_large_reservations')&&sql.includes('WHERE object_key=?'))
      return reserved?{web_order_id:WEB,file_id:INPUT.fileId,
        sha256:SHA,bytes:INPUT.bytes,state:'reserved'}:null;
     if(sql.includes('FROM central_r2_large_pending WHERE receipt_id=?'))
      return state.old?{web_order_id:WEB,file_id:INPUT.fileId,
       object_key:INPUT.objectKey,name:NAME,bytes:INPUT.bytes,
       sha256:SHA,etag:INPUT.etag,pages_claimed:112,
       status:'awaiting_pdf_analysis'}:null;
     if(sql.startsWith('SELECT o.id FROM central_r2_universal_order_links'))
      return bankNotice?{id:UUID}:null;
     if(sql.includes("sqlite_master"))return {name:'central_live_bank_accreditations'};
     return null;
    },
    async run(){
     state.queries.push({sql,args:this.args});
     if(sql.includes('UPDATE central_r2_universal_files SET received=1')){
      state.updates++;
      if(state.received===0){state.received=1;return {meta:{changes:1}}}
      return {meta:{changes:0}};
     }
     return {meta:{changes:1}};
    }
   };
   return item;
  },
  async batch(commands){
   state.batches++;
   const results=[];
   for(const q of commands){
    state.queries.push({sql:q.sql,args:q.args});
    if(q.sql.includes('INSERT INTO central_r2_large_pending')){
     state.old=true;results.push({meta:{changes:1}});
    }else if(q.sql.includes('UPDATE central_r2_universal_files SET received=1')){
     if(state.received!==0){results.push({meta:{changes:0}})}
     else{state.received=1;state.updates++;results.push({meta:{changes:1}})}
    }else throw Error('UNEXPECTED_SQL');
   }
   return results;
  }
 };
 const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  MP_LIVE_GATE:GO,CENTRAL_LIVE_BRIDGE_ENABLED:GO,
  CENTRAL_LIVE_POSTPAY_GATE:GO,CENTRAL_LIVE_R2_GATE:GO,
  CENTRAL_LIVE_R2_STAGING_GATE:GO,CENTRAL_LIVE_ORDER_GATE:GO,
  DB};
 const deps={
  readSigned:async()=>invalid?{error:'BAD_HMAC',status:401}:{payload:INPUT},
  verify:async()=>({ok:true,
   works:[{fileId:INPUT.fileId,configuracion:{paginas:Array.from({length:112},(_,i)=>
    ({numero:i+1,anchoCm:i===14||i===15?35.56:21,
     altoCm:i===14||i===15?21.59:29.7}))}}],
   rows:[{file_id:INPUT.fileId,transport:'r2',received:state.received,
    name:NAME,sha256:SHA,bytes:INPUT.bytes}]}),
  payment:async()=>({verified:paid,revoked:false,method})
 };
 return {state,env,deps};
}
test('transferencia acreditada: un solo asiento atómico habilita ZIP, no imprimir',async()=>{
 const f=fixture();
 const r=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 const d=await r.json();
 assert.equal(d.originalReceived,true);
 assert.equal(d.stagedForCentral,true);
 assert.equal(d.productionAuthorized,false);
 assert.equal(f.state.received,1);
 assert.equal(f.state.batches,1);
 assert.equal(f.state.updates,1);
 const sql=f.state.queries.map(x=>x.sql).join('\n');
 assert.match(sql,/central_live_bank_accreditations/);
 assert.match(sql,/pr.state='verified'/);
 assert.match(sql,/q.state='reserved'/);
 assert.match(sql,/s.sha256=\?/);
});
test('Mercado Pago acreditado: misma recepción y mismo ZIP',async()=>{
 const f=fixture({method:'mercadopago'});
 const r=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 assert.equal((await r.json()).originalReceived,true);
 assert.equal(f.state.received,1);
 const sql=f.state.queries.map(x=>x.sql).join(' ');
 assert.match(sql,/o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL/);
});
test('sin pago verificado, sin reserva o firma incorrecta: jamás marcar recibido',async()=>{
 for(const options of [{paid:false},{reserved:false},{invalid:true}]){
  const f=fixture(options);
  const r=await registrarR2LivePendiente(req(),f.env,f.deps);
  assert.ok([401,402,409].includes(r.status));
  assert.equal(f.state.received,0);
  assert.equal(f.state.updates,0);
  assert.equal(f.state.batches,0);
 }
});
test('reintento de R2 ya almacenado completa recibo anterior sin volver a cargar',async()=>{
 const f=fixture({old:true,received:0});
 const r=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 assert.equal((await r.json()).idempotent,true);
 assert.equal(f.state.received,1);
 assert.equal(f.state.batches,0);
 assert.equal(f.state.updates,1);
 const retry=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(retry.status,200);
 assert.equal((await retry.json()).idempotent,true);
 assert.equal(f.state.updates,1);
});

test('transferencia AVISADA sin pago: guarda R2 SHA con pago pendiente, ZIP aún bloqueado',async()=>{
 const f=fixture({paid:false,bankNotice:true});
 const r=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
 const out=await r.json();
 assert.equal(out.originalReceived,true);
 assert.equal(out.productionAuthorized,false);
 assert.equal(f.state.batches,1);
 assert.equal(f.state.received,1);
 const queries=f.state.queries.map(x=>x.sql).join('\n');
 assert.match(queries,/central_live_transfer_customer_notices/);
 assert.match(queries,/o.status='awaiting_payment'/);
 assert.match(queries,/o.paid_at IS NULL/);
 assert.doesNotMatch(queries,/pr.state='verified'/);
});
test('transferencia sin aviso D1 no permite reservar recibo R2 impago',async()=>{
 const f=fixture({paid:false,bankNotice:false});
 const r=await registrarR2LivePendiente(req(),f.env,f.deps);
 assert.equal(r.status,402);
 assert.equal(f.state.batches,0);
 assert.equal(f.state.received,0);
});
