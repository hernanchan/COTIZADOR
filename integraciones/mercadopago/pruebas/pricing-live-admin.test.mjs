import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {pricingLiveAdmin} from './pricing-live-admin.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const HOST='https://pagos.libreriasaber.com.ar';
const live={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 CENTRAL_LIVE_PRICING_ADMIN_GATE:GO};
const snapshot={prices:{schema:'saber-web-prices-v1'},promotions:{codes:[]}};
const req=(path,body)=>new Request(HOST+path,{method:'POST',
 headers:{Origin:HOST,'Content-Type':'application/json'},body:JSON.stringify(body)});
const shape={confirmed:true,operator:'Responsable Saber',expectedRevision:0,snapshot};
function db(){
 let head=null,history=[];const statements=[];
 const db={
  prepare(sql){
   let args=[];
   return {bind(...v){args=v;return this},
    async first(){
     if(sql.includes('FROM central_pricing_admin_head'))return head&&{...head};
     return null;
    },
    async all(){
     if(sql.includes('FROM central_pricing_admin_history'))return {results:history};
     throw Error('SQL inesperado');
    },
    async run(){throw Error('no ejecutar run fuera de batch')},
    sql,args,
    get data(){return args}
   };
  },
  async batch(commands){
   for(const q of commands){
    statements.push(q.sql);
    if(q.sql.startsWith('INSERT INTO central_pricing_admin_head')){
     if(head)throw Error('duplicate');
     head={revision:0,approved_revision:0,draft_json:null,approved_json:null};
    }else if(q.sql.startsWith('UPDATE central_pricing_admin_head')){
     if(q.sql.includes('approved_json=draft_json')){
      const [newRevision,next,expected,payload]=q.data;
      if(!head||head.revision!==expected||head.draft_json!==payload)throw Error('conflict');
      head={...head,revision:next,approved_revision:newRevision,
       approved_json:head.draft_json,draft_json:null};
     }else{
      const [next,json,expected]=q.data;
      if((head?.revision||0)!==expected)throw Error('conflict');
      head={...head,revision:next,draft_json:json};
     }
    }else if(q.sql.startsWith('INSERT INTO central_pricing_admin_history')){
     const [revision,operator,json]=q.data;
     history.push({revision,operator,payload_json:json,action:revision===2?'approve':'draft'});
    }else throw Error('SQL inesperado: '+q.sql);
   }
   return commands.map(()=>({meta:{changes:1}}));
  }
 };
 return {db,statements,get head(){return head},get history(){return history}};
}
const opts={authorized:true,subtle:webcrypto.subtle,
 validate:x=>JSON.stringify(x)===JSON.stringify(snapshot)};
test('sin autorización o gate productivo no accede a D1',async()=>{
 const mock=db(),env={...live,DB:mock.db};
 for(const [patch,authorized] of [[{},false],
  [{CENTRAL_LIVE_PRICING_ADMIN_GATE:'NO_GO'},true],
  [{SABER_ENTORNO:'preparacion'},true]]){
  const r=await pricingLiveAdmin(req('/admin/api/pricing-live/draft',shape),
   {...env,...patch},{...opts,authorized});
  assert.equal(r.status,authorized?503:401);
 }
 assert.equal(mock.statements.length,0);
});
test('propuesta explícita, revisión y SHA obligatorios antes de aprobar',async()=>{
 const mock=db(),env={...live,DB:mock.db};
 const draft=await pricingLiveAdmin(req('/admin/api/pricing-live/draft',shape),env,opts);
 assert.equal(draft.status,201);
 const body=await draft.json();
 assert.equal(body.approvalRequired,true);
 assert.equal(body.paymentsEnabled,false);
 assert.match(body.draftHash,/^[a-f0-9]{64}$/);
 assert.equal(mock.head.approved_json,null);
 assert.equal(mock.head.revision,1);
 const bad=await pricingLiveAdmin(req('/admin/api/pricing-live/approve',{
  confirmed:true,operator:'Responsable Saber',expectedRevision:1,draftHash:'0'.repeat(64)}),env,opts);
 assert.equal(bad.status,409);
 assert.equal(mock.head.approved_json,null);
 const approved=await pricingLiveAdmin(req('/admin/api/pricing-live/approve',{
  confirmed:true,operator:'Responsable Saber',expectedRevision:1,draftHash:body.draftHash}),env,opts);
 assert.equal(approved.status,200);
 assert.equal((await approved.json()).commercialRelease,false);
 assert.equal(mock.head.approved_revision,2);
 assert.equal(mock.head.revision,2);
 assert.equal(mock.history.length,2);
 assert.equal(mock.statements.some(sql=>/\b(?:DROP|DELETE) FROM\b/.test(sql)),false);
});
test('no acepta aprobación directa, precio inválido ni revisión vieja',async()=>{
 const mock=db(),env={...live,DB:mock.db};
 const approval=await pricingLiveAdmin(req('/admin/api/pricing-live/approve',{
  confirmed:true,operator:'Responsable Saber',expectedRevision:0,draftHash:'a'.repeat(64)}),env,opts);
 assert.equal(approval.status,422);
 const invalid=await pricingLiveAdmin(req('/admin/api/pricing-live/draft',
  {...shape,snapshot:{prices:{}}}),env,opts);
 assert.equal(invalid.status,422);
 const old=await pricingLiveAdmin(req('/admin/api/pricing-live/draft',
  {...shape,expectedRevision:5}),env,opts);
 assert.equal(old.status,409);
 assert.equal(mock.head,null);
});
