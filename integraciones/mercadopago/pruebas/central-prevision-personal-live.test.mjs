import test from 'node:test';
import assert from 'node:assert/strict';
import {previsionCentralPersonalLive} from './central-prevision-personal-live.mjs';
const gate='GO_COMERCIAL_CONFIRMADO';
const url='https://pagos.libreriasaber.com.ar/internal/central/live/staff-forecast';
const defaults={schema:'saber-central-live-staff-forecast-v1',action:'read',expectedRevision:0,
 mode:null,orderId:null,readyAt:null,operator:'',reason:''};
const request=()=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(defaults)});
function fixture(){
 const queries=[];let mode='por_confirmar',revision=0;
 const db={prepare(sql){const q={sql,vals:[],bind(...values){this.vals=values;return this},
  async all(){return {results:[]}},
  async first(){
   if(sql.includes('FROM central_delivery_plan'))return revision?{mode,revision}:null;
   if(sql.startsWith('SELECT o.id'))return null;
   throw Error('Unexpected SELECT '+sql);
  },async run(){return {meta:{changes:1}}}};
  queries.push(q);return q;
 },async batch(items){if(items.length===2&&items[0].sql.includes('central_delivery_plan')){mode=items[0].vals[0];revision++;}return items.map(()=>({meta:{changes:1}}))}};
 return {env:{DB:db,SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
  MP_LIVE_GATE:gate,CENTRAL_LIVE_BRIDGE_ENABLED:gate,CENTRAL_LIVE_R2_INSPECTION_GATE:gate},queries};
}
test('lectura de previsión sin tablas devuelve A confirmar y no escribe',async()=>{
 const {env,queries}=fixture();
 const r=await previsionCentralPersonalLive(request(),env,{readSigned:async()=>({payload:defaults})});
 assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.settings.mode,'por_confirmar');assert.deepEqual(d.estimates,[]);
 assert.ok(queries.every(q=>/^(SELECT)/.test(q.sql)));
});
test('sin HMAC, sin gate o carga no admitida bloquea sin consultar D1',async()=>{
 const {env,queries}=fixture();
 assert.equal((await previsionCentralPersonalLive(request(),env)).status,403);
 assert.equal((await previsionCentralPersonalLive(request(),{...env,CENTRAL_LIVE_R2_INSPECTION_GATE:'NO_GO'},
  {readSigned:async()=>({payload:defaults})})).status,503);
 assert.equal((await previsionCentralPersonalLive(request(),env,{readSigned:async()=>({payload:{...defaults,action:'admin'}})})).status,422);
 assert.equal(queries.length,0);
});
test('previsión general se guarda con revisión y responsable auditable',async()=>{
 const {env,queries}=fixture(),p={...defaults,action:'global',mode:'hoy',operator:'Responsable Saber'};
 const r=await previsionCentralPersonalLive(request(),env,{readSigned:async()=>({payload:p})});
 assert.equal(r.status,200,await r.clone().text());
 assert.equal((await r.json()).settings.mode,'hoy');
 assert.ok(queries.some(q=>q.sql.startsWith('CREATE TABLE IF NOT EXISTS central_delivery_plan_events')));
 assert.ok(queries.some(q=>q.sql.startsWith('INSERT INTO central_delivery_plan_events')));
 assert.equal(queries.some(q=>/UPDATE orders|UPDATE payment_reviews/.test(q.sql)),false);
});
test('fecha individual no permite pedido inexistente, pagado no verificado o fuera de plazo',async()=>{
 const {env}=fixture(),p={...defaults,action:'order',orderId:'123e4567-e89b-42d3-a456-426614174000',operator:'Responsable Saber',readyAt:new Date(Date.now()+3600000).toISOString()};
 const r=await previsionCentralPersonalLive(request(),env,{readSigned:async()=>({payload:p})});
 assert.equal(r.status,409);
 const wrong=await previsionCentralPersonalLive(request(),env,{readSigned:async()=>({payload:{...p,readyAt:new Date(Date.now()-3600000).toISOString()}})});
 assert.equal(wrong.status,422);
});
