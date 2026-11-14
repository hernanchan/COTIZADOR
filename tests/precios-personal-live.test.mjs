import test from 'node:test';
import assert from 'node:assert/strict';
import {administrarPreciosLivePersonal} from '../integraciones/mercadopago/pruebas/central-precios-live-personal.mjs';
import {preciosPersonalLiveApi} from '../integraciones/autocotizador/recepcion/precios-personal-live-api.mjs';
import {leerFirmaInternaLive} from '../integraciones/mercadopago/pruebas/central-live-bridge.mjs';
import {paginaPreciosPersonalLive} from '../integraciones/autocotizador/recepcion/pagina-precios-personal-live.mjs';
import {paginaCentralPersonalLive} from '../integraciones/autocotizador/recepcion/pagina-central-personal-live.mjs';
const GO='GO_COMERCIAL_CONFIRMADO';
const field={path:'prices.bnA4.scales.0.simple',category:'B/N A4',label:'1 a 10 · Simple faz',kind:'price'};
const old={prices:{schema:'saber-web-prices-v1',bnA4:{scales:[{simple:100}]}},promotions:{codes:[]}};
const newer={prices:{schema:'saber-web-prices-v1',bnA4:{scales:[{simple:120}]}},promotions:{codes:[]}};
const at=(value,path)=>path.split('.').reduce((p,k)=>p?.[k],value);
const set=(value,path,v)=>{const parts=path.split('.');const last=parts.pop();const owner=parts.reduce((p,k)=>p[k],value);owner[last]=v};
const validate=value=>Number.isInteger(at(value,field.path))&&at(value,field.path)>0;
const preview=(before,after)=>({
 edits:[{category:'B/N A4',label:'Simple',before:at(before,field.path),after:at(after,field.path)}],
 examples:[{label:'10 copias',before:10*at(before,field.path),after:10*at(after,field.path)}]
});
function env({draft=false}={}){
 const state={revision:3,approved_revision:2,approved_json:JSON.stringify(old),draft_json:draft?JSON.stringify(newer):null,updated_at:'2026-11-13 12:00:00'};
 const events=[];
 const db={
  prepare(sql){
   const stmt={sql,args:[],bind(...args){this.args=args;return this},async first(){
    if(sql.includes('FROM central_pricing_admin_head'))return {...state};
    return null
   },async all(){return {results:[]}}};return stmt;
  },
  async batch(stmts){events.push(stmts.map(s=>({sql:s.sql,args:s.args})));return [{meta:{changes:1}},{meta:{changes:1}}]}
 };
 return {state,events,SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',MP_LIVE_GATE:GO,
 CENTRAL_LIVE_PRICING_GATE:GO,DB:db};
}
function input(action,changes=[],confirmed=false){
 return {schema:'saber-central-live-staff-pricing-v1',action,changes,
 confirmed,expectedRevision:3,operator:action==='read'?'':'Encargado'};
}
async function call(e,p){
 const request=new Request('https://pagos.libreriasaber.com.ar/internal/central/live/staff-pricing',{method:'POST'});
 const resp=await administrarPreciosLivePersonal(request,e,{
 readSigned:async()=>({payload:p}),fields:[field],validate,at,set,preview
 });
 return {status:resp.status,body:await resp.json()};
}
test('el panel está enlazado a Central, sin un segundo tarifario público',()=>{
 assert.match(paginaCentralPersonalLive(),/href="\/personal\/precios"/);
 const html=paginaPreciosPersonalLive();
 assert.match(html,/Aprobar y publicar/);
 assert.match(html,/Volver a la Central/);
 assert.equal(html.includes('precios-web.json (21/08'),false);
});
test('la lectura devuelve únicamente el valor LIVE aprobado y la revisión',async()=>{
 const e=env();const r=await call(e,input('read'));
 assert.equal(r.status,200);assert.equal(r.body.fields[0].value,100);
 assert.equal(r.body.fields[0].approvedValue,100);
 assert.equal(r.body.approvedRevision,2);
 assert.equal(e.events.length,0);
});
test('la vista previa no modifica D1',async()=>{
 const e=env();const r=await call(e,input('preview',[{path:field.path,value:120}]));
 assert.equal(r.status,200);assert.equal(r.body.edits[0].after,120);
 assert.equal(e.events.length,0);
});
test('el borrador guarda sólo una nueva revisión auditada, sin aprobar precios',async()=>{
 const e=env();const r=await call(e,input('draft',[{path:field.path,value:120}]));
 assert.equal(r.status,200);assert.equal(r.body.approved,false);
 assert.equal(r.body.draftPresent,true);
 assert.equal(r.body.approvedRevision,2);
 assert.equal(e.events.length,1);
 assert.equal(e.events[0][0].args[1],2);
 assert.equal(JSON.parse(e.events[0][0].args[2]).prices.bnA4.scales[0].simple,120);
});
test('la aprobación requiere borrador y confirmado:true',async()=>{
 const e=env();
 assert.equal((await call(e,input('approve',[],true))).status,422);
 assert.equal(e.events.length,0);
 const d=env({draft:true});
 assert.equal((await call(d,input('approve',[],false))).status,422);
 assert.equal(d.events.length,0);
 const r=await call(d,input('approve',[],true));
 assert.equal(r.status,200);assert.equal(r.body.approved,true);
 assert.equal(r.body.approvedRevision,4);
 assert.equal(d.events.length,1);
});
test('revisión antigua, campo inventado, precio negativo o cambios duplicados se rechazan',async()=>{
 const e=env();
 const stale=input('draft',[{path:field.path,value:110}]);stale.expectedRevision=1;
 assert.equal((await call(e,stale)).status,409);
 for(const changes of [
  [{path:'prices.sorpresa',value:1}],
  [{path:field.path,value:-1}],
  [{path:field.path,value:110},{path:field.path,value:120}]
 ])assert.equal((await call(e,input('draft',changes))).status,422);
 assert.equal(e.events.length,0);
});
test('el API no abre cambios a un Origin externo ni permite operar sin compuertas',async()=>{
 const e=env();e.DOCS_LIVE_STAFF_GATE=GO;e.DOCS_LIVE_PRICING_GATE=GO;
 e.CENTRAL_BRIDGE_KEY='X'.repeat(48);
 e.SABER_CENTRAL={fetch:async()=>new Response(JSON.stringify({ok:true}),{status:200})};
 const target='https://pedidos.libreriasaber.com.ar/personal/api/live-pricing';
 const post=new Request(target,{method:'POST',headers:{Origin:'https://inseguro.example',
  'Content-Type':'application/json'},body:JSON.stringify({action:'draft',changes:[],confirmed:false,
  expectedRevision:3,operator:'Encargado'})});
 const denied=await preciosPersonalLiveApi(post,e);
 assert.equal(denied.status,403);
 e.DOCS_LIVE_STAFF_GATE='NO_GO';
 const deniedGet=await preciosPersonalLiveApi(new Request(target),e);
 assert.equal(deniedGet.status,503);
});
test('el API firma una lectura y nunca envía el secreto al navegador',async()=>{
 const e=env();e.DOCS_LIVE_STAFF_GATE=GO;e.DOCS_LIVE_PRICING_GATE=GO;
 e.CENTRAL_BRIDGE_KEY='X'.repeat(48);
 const captured=[];
 const r=await preciosPersonalLiveApi(new Request('https://pedidos.libreriasaber.com.ar/personal/api/live-pricing'),
  {...e,SABER_CENTRAL:{fetch:async req=>{captured.push(req);return new Response(JSON.stringify({ok:true,revision:3}),{status:200})}}},
  {nonce:()=> 'cc75687e-8bb9-4f82-b06f-1beab68061c9',now:()=>1794545000});
 assert.equal(r.status,200);
 assert.equal(captured.length,1);
 assert.match(captured[0].headers.get('x-saber-signature'),/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(await captured[0].text()).action,'read');
 assert.equal((await r.text()).includes('XXXX'),false);
});

test('el puente HMAC verifica firma y contrato de edición, sin exponerla al cliente',async()=>{
 const e=env();e.DOCS_LIVE_STAFF_GATE=GO;e.DOCS_LIVE_PRICING_GATE=GO;
 e.CENTRAL_BRIDGE_KEY='X'.repeat(48);
 let checked=null;
 const centro={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',MP_LIVE_GATE:GO,
  CENTRAL_LIVE_BRIDGE_ENABLED:GO,CENTRAL_BRIDGE_KEY:e.CENTRAL_BRIDGE_KEY};
 const fetchService=async req=>{
  checked=await leerFirmaInternaLive(req,centro,{now:()=>1794545000});
  return new Response(JSON.stringify({ok:!checked.error,error:checked.error||null}),{status:checked.error?403:200});
 };
 const r=await preciosPersonalLiveApi(
  new Request('https://pedidos.libreriasaber.com.ar/personal/api/live-pricing'),
  {...e,SABER_CENTRAL:{fetch:fetchService}},
  {nonce:()=> 'cc75687e-8bb9-4f82-b06f-1beab68061c9',now:()=>1794545000}
 );
 assert.equal(r.status,200,'HMAC bridge response: '+JSON.stringify(await r.clone().json().catch(()=>({unreadable:true}))));
 assert.equal(checked.payload.action,'read');
 assert.equal(checked.payload.schema,'saber-central-live-staff-pricing-v1');
 assert.equal(checked.payload.operator,'');
});
