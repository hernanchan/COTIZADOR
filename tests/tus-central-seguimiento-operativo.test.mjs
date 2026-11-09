import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
 AbortSignal,fetch:()=>{throw Error('No external calls permitted')}};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const html=vm.runInContext('adminHtml',ctx);
const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
new vm.Script(script);

test('R2 ya presente en SELECT de pagos NO se descarta: entra a Nuevos sin preprensa aprobada',()=>{
 const merge=vm.runInContext('centralMergePendingR2Orders',ctx);
 const id='89608817-95b1-41bc-ac88-579da519d32c';
 const web='WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3';
 const board=[
  {id,amount_ars:4400,description:'Ploteo pagado',
   production_state:null,work_number:null,web_order_id:null},
  {id:'b69f8ef5-63eb-4728-a967-584c63f39c41',
   amount_ars:3600,production_state:'en_preparacion',work_number:12}
 ];
 const pending={commercialOrderId:id,webOrderId:web,amountArs:4400,
  estado:'RECIBIDO_PENDIENTE_PREPRENSA',received:true,verifiedReceipt:true,
  receiptId:'DOC-572d0a2e-6558-473b-98ca-121705bc8ba8',
  paidAt:'2026-11-09 13:14:00',quotedParametersAvailable:true,
  quoteSnapshot:{schema:'saber-r2-cotizacion-firmada-v1'}};
 merge(board,[pending]);
 assert.equal(board.length,2,'sin duplicar ni perder una orden');
 assert.equal(board[0].production_state,'pendiente');
 assert.equal(board[0].r2_prepress_pending,true);
 assert.equal(board[0].r2_prepress_receipt_verified,true);
 assert.equal(board[0].work_number,null,'preprensa pendiente no asigna número');
 assert.equal(board[1].production_state,'en_preparacion','no altera otros pedidos');
 merge(board,[pending]);assert.equal(board.length,2,'sin duplicar en refrescos');
});
test('R2 aprobado conserva su estado: nunca vuelve a preprensa ni reinicia producción',()=>{
 const merge=vm.runInContext('centralMergePendingR2Orders',ctx);
 const id='89608817-95b1-41bc-ac88-579da519d32c';
 const web='WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3';
 const board=[{id,amount_ars:4400,production_state:'listo',production_version:2,work_number:33}];
 merge(board,[{commercialOrderId:id,webOrderId:web,amountArs:4400,
  estado:'RECIBIDO_PENDIENTE_PREPRENSA',received:true,verifiedReceipt:true}]);
 assert.equal(board.length,1);
 assert.equal(board[0].production_state,'listo');
 assert.equal(board[0].work_number,33);
 assert.equal(board[0].r2_prepress_pending,undefined);
});
test('R2 sin recibo sigue en Nuevos esperando archivo, nunca ofrece producción',()=>{
 const merge=vm.runInContext('centralMergePendingR2Orders',ctx);
 const board=[];
 merge(board,[{commercialOrderId:'89608817-95b1-41bc-ac88-579da519d32c',
  webOrderId:'WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3',
  amountArs:4400,estado:'PAGADO_ESPERANDO_ARCHIVO',
  received:false,verifiedReceipt:false,quotedParametersAvailable:true,
  quoteSnapshot:{schema:'saber-r2-cotizacion-firmada-v1'}}]);
 assert.equal(board.length,1);
 assert.equal(board[0].production_state,'pendiente');
 assert.equal(board[0].file_count,0);
 assert.equal(board[0].r2_prepress_pending,true);
 assert.equal(board[0].r2_prepress_receipt_verified,false);
});
test('Dos R2 sandbox de $4400 son dos órdenes distintas: sólo V2 operativo va a Nuevos',()=>{
 const merge=vm.runInContext('centralMergePendingR2Orders',ctx);
 const currentId='89608817-95b1-41bc-ac88-579da519d32c';
 const legacyId='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
 const board=[
  {id:legacyId,amount_ars:4400,production_state:null,description:'Ploteo viejo',work_number:null},
  {id:currentId,amount_ars:4400,production_state:null,description:'Ploteo nuevo',work_number:null}
 ];
 merge(board,[
  {commercialOrderId:legacyId,webOrderId:'WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE',
   amountArs:4400,received:true,verifiedReceipt:true,
   estado:'RECIBIDO_PENDIENTE_PREPRENSA',quotedParametersAvailable:false,quoteSnapshot:null},
  {commercialOrderId:currentId,webOrderId:'WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3',
   amountArs:4400,received:true,verifiedReceipt:true,
   estado:'RECIBIDO_PENDIENTE_PREPRENSA',quotedParametersAvailable:true,
   quoteSnapshot:{schema:'saber-r2-cotizacion-firmada-v1'}}
 ]);
 assert.equal(board.length,2);
 assert.equal(board.filter(x=>x.production_state==='pendiente').length,1);
 assert.equal(board.filter(x=>x.production_state===null).length,1);
 const old=board.find(x=>x.id===legacyId);
 const fresh=board.find(x=>x.id===currentId);
 assert.equal(old.r2_legacy_unusable,true);
 assert.equal(old.r2_prepress_pending,false);
 assert.match(old.description,/histórico/);
 assert.equal(fresh.r2_prepress_pending,true);
 assert.equal(fresh.r2_legacy_unusable,undefined);
 merge(board,[]);
 assert.equal(board.length,2);
});
test('Un R2 ya aprobado no vuelve a revisión aunque venga una cotización legada',()=>{
 const merge=vm.runInContext('centralMergePendingR2Orders',ctx);
 const board=[{id:'66f10bd2-77ce-46ef-930c-49dc3d22d23e',
  amount_ars:4400,production_state:'en_preparacion',work_number:21}];
 merge(board,[{commercialOrderId:board[0].id,
  webOrderId:'WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE',
  amountArs:4400,quotedParametersAvailable:false,quoteSnapshot:null}]);
 assert.equal(board[0].production_state,'en_preparacion');
 assert.equal(board[0].work_number,21);
 assert.equal(board[0].r2_legacy_unusable,undefined);
});
test('El operador encuentra preprensa R2 desde el acceso superior con un clic',()=>{
 assert.match(html,/id="goR2Paid"[^>]*>Ver ploteos R2 para aprobar/);
 assert.match(html,/id="r2ReviewPanel"/);
 assert.match(script,/document\.querySelector\("#goR2Paid"\)/);
 assert.match(script,/document\.querySelector\("#refreshR2Paid"\)\?\.click\(\)/);
 assert.ok(html.indexOf('id="goR2Paid"')<html.indexOf('id="productionBoardArea"'));
 assert.ok(html.indexOf('id="r2ReviewPanel"')<html.indexOf('id="priceAdminFieldset"'));
 assert.equal((html.match(/id="r2PaidReview"/g)||[]).length,1);
});
const uuid='b69f8ef5-63eb-4728-a967-584c63f39c41';
let paid=true,current=null,events=[],writes=0;
const db={prepare(sql){
 let params=[];
 const stmt={
  bind(...args){params=args;return stmt},
  async run(){
   writes++;
   if(sql.startsWith('CREATE ')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
   if(sql.startsWith('INSERT OR IGNORE INTO central_production_status')){
    if(!current&&paid)current={state:'pendiente',version:0,operator:null,reason:null,updated_at:null};
    return {meta:{changes:current?1:0}};
   }
   throw Error('Unexpected write '+sql);
  },
  async first(){
   if(sql.startsWith('SELECT o.id FROM orders o')&&sql.includes('central_r2_prepress_approvals'))
    return paid?{id:uuid}:null;
   if(sql.startsWith('SELECT state,version FROM central_production_status'))
    return current&&params[0]===uuid?current:null;
   if(sql.startsWith('SELECT state,version,operator,reason,updated_at FROM central_production_status'))
    return current&&params[0]===uuid?current:null;
   throw Error('Unexpected read '+sql);
  },
  async all(){
   if(sql.includes('FROM central_production_events WHERE order_id=?'))
    return {results:events.slice().reverse()};
   throw Error('Unexpected all '+sql);
  }
 };
 return stmt;
},
async batch(statements){
 const [a,b]=statements;
 // Validate guarded production update.
 const [to,operator,reason,orderId,from,version]=a.params;
 if(!paid||!current||current.state!==from||current.version!==version||orderId!==uuid)
  return [{meta:{changes:0}},{meta:{changes:0}}];
 current={state:to,version:version+1,operator,reason,updated_at:'2026-11-02 18:00:00'};
 events.push({version:version+1,from_state:from,to_state:to,operator,reason,created_at:'2026-11-02 18:00:00'});
 return [{meta:{changes:1}},{meta:{changes:1}}];
}};
const originalPrepare=db.prepare;
db.prepare=function(sql){
 const obj=originalPrepare.call(db,sql);
 obj.params=[];
 const oldBind=obj.bind;
 obj.bind=function(...args){this.params=args;return oldBind(...args)};
 return obj;
};
const env={DB:db,DEMO_ADMIN_KEY:'TEST_PANEL_PRIVATE',MP_TEST_ACCESS_TOKEN:'FAKE',
 MP_TEST_SELLER_ID:'test',TEST_WEBHOOK_URL:'https://test.invalid/webhook',
 MP_WEBHOOK_SECRET:'FAKE',CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY'};
async function post(body,auth='TEST_PANEL_PRIVATE',e=env){
 const response=await ctx.worker.fetch(new Request('https://test.invalid/admin/api/central/production-status',{
  method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 }),e);
 return {status:response.status,data:await response.json()};
}
const data=(from,to,version,changes={})=>({
 order_id:uuid,from,to,version,operator:'Mostrador 1',reason:'',confirmed:false,...changes
});
test('protección: clave y compuerta privada, sin escrituras',async()=>{
 current=null;events=[];writes=0;
 const denied=await post(data('pendiente','en_preparacion',0),'WRONG');
 assert.equal(denied.status,401);assert.equal(writes,0);
 const disabled=await post(data('pendiente','en_preparacion',0),'TEST_PANEL_PRIVATE',
  {...env,CENTRAL_PRODUCTION_TRACKING_ENABLED:'OFF'});
 assert.equal(disabled.status,503);assert.equal(writes,0);
});
test('estado solo para pedidos documentales con pago verificado',async()=>{
 current=null;events=[];paid=false;
 const r=await post(data('pendiente','en_preparacion',0));
 assert.equal(r.status,409);assert.equal(current,null);assert.equal(events.length,0);
 paid=true;
});
test('transiciones seguras y auditoría con responsable',async()=>{
 current=null;events=[];paid=true;
 const start=await post(data('pendiente','en_preparacion',0));
 assert.equal(start.status,200,JSON.stringify(start.data));
 assert.equal(start.data.production.state,'en_preparacion');
 assert.equal(start.data.production.version,1);
 assert.equal(events.length,1);
 assert.equal(events[0].operator,'Mostrador 1');
 const stale=await post(data('pendiente','en_espera',0,{reason:'Falta papel'}));
 assert.equal(stale.status,409);
 const noConfirm=await post(data('en_preparacion','listo',1));
 assert.equal(noConfirm.status,422);
 const ready=await post(data('en_preparacion','listo',1,{confirmed:true}));
 assert.equal(ready.status,200);
 assert.equal(ready.data.production.state,'listo');
 const delivered=await post(data('listo','entregado',2,{confirmed:true}));
 assert.equal(delivered.status,200);
 assert.equal(delivered.data.production.state,'entregado');
 assert.equal(events.length,3);
 assert.equal(delivered.data.production.allowed.length,0);
 const rollback=await post(data('entregado','pendiente',3));
 assert.equal(rollback.status,409);
});
test('bloqueo por problemas requiere causa y puede retomarse',async()=>{
 current=null;events=[];paid=true;
 const noReason=await post(data('pendiente','en_espera',0));
 assert.equal(noReason.status,422);
 const blocked=await post(data('pendiente','en_espera',0,{reason:'Documento ilegible'}));
 assert.equal(blocked.status,200);
 assert.equal(blocked.data.production.state,'en_espera');
 const resume=await post(data('en_espera','en_preparacion',1));
 assert.equal(resume.status,200);
 assert.equal(resume.data.production.history.length,2);
 assert.equal(events[0].reason,'Documento ilegible');
});
test('tablero práctico: cuatro columnas, historial y control por tarjeta',()=>{
 for(const stage of ['pendiente','en_preparacion','listo','en_espera','entregado']){
  assert.ok(html.includes('id="lane-'+stage+'"'),stage);
  assert.ok(html.includes('id="count-'+stage+'"'),stage);
 }
 assert.ok(html.indexOf('id="productionBoard"')<html.indexOf('Polaroids Express'));
 assert.match(html,/id="productionOperator"/);
 assert.match(script,/function boardCard\(order\)/);
 assert.match(script,/function moveCard\(order,next,button\)/);
 assert.match(script,/await apiPost\("\/admin\/api\/central\/production-status"/);
 assert.match(script,/version:order\.production_version/);
 assert.match(script,/setInterval\(\(\)=>\{/);
 assert.match(script,/30000\)/);
 assert.match(script,/sessionStorage\.setItem/);
 assert.match(script,/Descargar ZIP/);
 assert.doesNotMatch(script,/zip\.addEventListener\("click",\(\)=>\{[^}]*production-status/s);
 assert.match(script,/await refresh\(\{silent:true,force:true\}\)/);
 assert.match(source,/state='verified'/);
});
test('GET del tablero incluye versión de D1 y recibo sin exponer credenciales',()=>{
 const area=source.slice(source.indexOf('if(url.pathname==="/admin/api/orders"'),source.indexOf('if(url.pathname==="/admin/api/central/asignar-numero"'));
 assert.match(area,/COALESCE\(s\.version,0\) AS production_version/);
 assert.match(area,/COALESCE\(m\.web_order_id,i\.web_order_id\) AS web_order_id/);
 assert.match(area,/COALESCE\(m\.file_count,CASE WHEN a\.order_id IS NOT NULL THEN 1 END\) AS file_count/);
 assert.match(area,/payment_reviews/);
 assert.match(area,/state='verified'/);
 assert.doesNotMatch(area,/service_role|secret_text/);
});
