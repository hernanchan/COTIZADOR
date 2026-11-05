import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal,
 fetch:()=>{throw Error('Red prohibida en test')}};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const from=name=>vm.runInContext(name,ctx);
const normalize=from('etaNormalizeCalendar'),project=from('etaOperatingFinish'),queue=from('etaForQueue');
const week={mon:'07:00-14:00,16:30-20:00',tue:'07:00-14:00,16:30-20:00',
 wed:'07:00-14:00,16:30-20:00',thu:'07:00-14:00,16:30-20:00',
 fri:'07:00-14:00,16:30-20:00',sat:'',sun:''};
const calendar=(closedDates=[])=>({...normalize(week,closedDates),configured:true});
test('agenda cerrada por defecto y validación estricta de horarios y feriados',()=>{
 const closed=normalize({...week,mon:''},[]);
 assert.ok(closed);assert.equal(closed.weekly.mon,'');
 assert.equal(normalize({...week,mon:'07:00-12:00,11:00-16:00'},[]),null);
 assert.equal(normalize({...week,mon:'23:00-24:30'},[]),null);
 assert.equal(normalize({...week,mon:'07:00-07:05'},[]),null);
 assert.equal(normalize(week,['2026-02-30']),null);
 assert.equal(normalize(week,['2026-12-25','2026-12-25']),null);
 assert.equal(project({configured:false},'2026-11-05T12:00:00Z',180),null);
});
test('corte de mediodía: no cuenta las horas sin atención',()=>{
 const result=project(calendar(),'2026-11-05T16:30:00Z',60); // jueves 13:30 Córdoba
 assert.equal(result,'2026-11-05T20:00:00.000Z'); // 17:00 Córdoba
});
test('feriado, sábado y domingo: reanuda el lunes y no inventa tiempo productivo',()=>{
 const result=project(calendar(['2026-11-06']),'2026-11-05T21:30:00Z',180); // jueves 18:30
 assert.equal(result,'2026-11-09T11:30:00.000Z'); // lunes 08:30 Córdoba
});
test('pago fuera de horario usa la apertura siguiente y fija el ancla del pedido',()=>{
 const result=project(calendar(),'2026-11-08 18:00:00',90); // domingo 15:00 Córdoba
 assert.equal(result,'2026-11-09T11:30:00.000Z'); // lunes 08:30
 assert.equal(project(calendar(),'2026-11-08 18:00:00',90),result);
});
test('capacidad ocupada solicita revisión en vez de sumar tandas ficticias',()=>{
 const busy=queue({base_minutes:60,parallel_orders:3},7);
 assert.equal(busy.minutes,60);assert.equal(busy.requiresReview,true);
 assert.equal(busy.queueCalibrated,true);
 const available=queue({base_minutes:180,parallel_orders:3},2);
 assert.equal(available.minutes,180);assert.equal(available.requiresReview,false);
 const unknown=queue({base_minutes:180,parallel_orders:0},12);
 assert.equal(unknown.minutes,180);assert.equal(unknown.queueCalibrated,false);
});
test('API de agenda requiere clave, guarda revisión e historial, rechaza conflictos',async()=>{
 let stored=null,events=0;
 const env={DEMO_ADMIN_KEY:'PANEL_TEST',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY',
 MP_TEST_ACCESS_TOKEN:'FAKE',MP_TEST_SELLER_ID:'test',TEST_WEBHOOK_URL:'https://test.invalid/webhook',MP_WEBHOOK_SECRET:'FAKE',
 DB:{
  prepare(sql){
   let args=[];return{
    get args(){return args},get sql(){return sql},
    bind(...v){args=v;return this},
    async run(){if(sql.startsWith('CREATE '))return {meta:{changes:0}};throw Error(sql)},
    async first(){
     if(sql.includes('FROM central_eta_calendar WHERE id=1'))return stored;
     throw Error('Consulta imprevista: '+sql);
    }
   };
  },
  async batch(qs){
   const a=qs[0];assert.match(a.sql,/central_eta_calendar/);
   if(a.sql.startsWith('INSERT OR IGNORE'))stored={
    weekly_json:a.args[0],closed_json:a.args[1],revision:1,
    operator:a.args[2],updated_at:'2026-11-05 10:00:00'
   };
   else{
    assert.equal(a.args[3],stored.revision);
    stored={weekly_json:a.args[0],closed_json:a.args[1],
     revision:stored.revision+1,operator:a.args[2],updated_at:'2026-11-05 10:30:00'};
   }
   events++;
   return [{meta:{changes:1}},{meta:{changes:1}}];
  }
 }};
 const base='https://test.invalid/admin/api/central/eta-calendar';
 const get=(key)=>ctx.worker.fetch(new Request(base,{headers:key?{Authorization:'Bearer '+key}:{}}),env);
 const post=(d,key='PANEL_TEST')=>ctx.worker.fetch(new Request(base,{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify(d)}),env);
 assert.equal((await get()).status,401);
 assert.equal((await post({weekly:week,closedDates:[]},'INCORRECTA')).status,401);
 const empty=await (await get('PANEL_TEST')).json();
 assert.equal(empty.calendar.configured,false);
 assert.equal(empty.calendar.revision,0);
 const draft={weekly:week,closedDates:['2026-11-06'],expectedRevision:0,confirmed:true,operator:'Encargado'};
 const saved=await post(draft);
 assert.equal(saved.status,200,await saved.text().catch(()=>''));
 const after=await (await get('PANEL_TEST')).json();
 assert.equal(after.calendar.configured,true);
 assert.equal(after.calendar.revision,1);assert.equal(events,1);
 assert.equal((await post(draft)).status,409);
 assert.equal(events,1);
 const invalid=await post({...draft,expectedRevision:1,closedDates:['2026-02-30']});
 assert.equal(invalid.status,422);assert.equal(events,1);
});
test('panel y vista móvil compilan con protección privada y sin datos sensibles',()=>{
 const html=from('adminHtml'),tracking=from('clientTrackingHtml');
 const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
 const client=tracking.slice(tracking.indexOf('<script>')+8,tracking.indexOf('</script>'));
 new vm.Script(script);new vm.Script(client);
 assert.match(html,/etaCalendarPanel/);assert.match(script,/etaCalendarLoad/);
 assert.match(script,/expectedRevision:etaCalendarSnapshot.revision/);
 assert.match(tracking,/name="viewport"/);assert.match(client,/d.deliveryPlan/);
 assert.match(script,/07:00-13:30,16:30-20:00/);
 assert.doesNotMatch(script,/07:00-14:00,16:30-20:00/);
 assert.match(html,/Sábados y domingos: CERRADO \(confirmado\)/);
 assert.match(html,/Feriados sin atención y cierres especiales/);
 assert.match(html,/Nada se cierra automáticamente por ser feriado/);
 assert.match(script,/document\.querySelector\("#etaDaySat"\)\.value=""/);
 assert.match(script,/document\.querySelector\("#etaDaySun"\)\.value=""/);
 assert.match(script,/El horario informado es sábados y domingos CERRADO/);
 assert.match(html,/feriados y cierres excepcionales se pueden agregar, modificar o borrar/);
 assert.match(source,/\/admin\/api\/central\/eta-calendar/);
 assert.doesNotMatch(tracking,/customer_phone|bank_reference|DEMO_ADMIN_KEY/);
});
