import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const centralSource=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const docsSource=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');

const base={Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,AbortSignal};
const central=vm.createContext({...base});central.globalThis=central;
vm.runInContext(centralSource.replace('export default {','globalThis.worker = {'),central);

const begin=docsSource.indexOf('const V2_SESSION_COOKIE=');
const end=docsSource.indexOf('async function probeTarifarioD1SoloOperador',begin);
const pageBegin=docsSource.indexOf('const v2MobileInviteHtml=');
const pageEnd=docsSource.indexOf('async function v2PrivateBrowserResponse',pageBegin);
assert.ok(begin>=0&&end>begin&&pageBegin>=0&&pageEnd>pageBegin);
const docs=vm.createContext({...base,testResponse:(d,code)=>new Response(JSON.stringify(d),{status:code,headers:{'content-type':'application/json'}}),closed:()=>new Response('',{status:404})});
vm.runInContext(docsSource.slice(begin,end)+'\n'+docsSource.slice(pageBegin,pageEnd)+'\nglobalThis.exchange=v2MobileInviteExchange;globalThis.sessionOK=v2SessionAuthorized;',docs);
const exchange=docs.exchange;

const bridge='A-secret-for-testing-worker-to-worker-2026-11-05';
let entries=new Map(),nowCount=0,created=0,consumed=0;
const centralEnv={
 CENTRAL_PRODUCTION_TRACKING_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:bridge,DEMO_ADMIN_KEY:'CENTRAL_PANEL_TEST',
 MP_TEST_ACCESS_TOKEN:'TEST',MP_TEST_SELLER_ID:'sandbox',MP_WEBHOOK_SECRET:'webhook-secret-2026',
 TEST_WEBHOOK_URL:'https://test.invalid/hook',
 DB:{prepare(sql){
  let args=[];return{
   bind(...values){args=values;return this;},
   async first(){
    if(sql.includes('COUNT(*) AS count FROM central_mobile_invites'))return {count:nowCount};
    throw Error('Consulta no esperada: '+sql);
   },
   async run(){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
    if(sql.startsWith('INSERT INTO central_mobile_invites')){
     assert.match(args[0],/^[a-f0-9]{64}$/);
     entries.set(args[0],{operator:args[1],used:false});created++;
     return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE central_mobile_invites SET consumed_at=')){
     const row=entries.get(args[0]);
     if(!row||row.used)return {meta:{changes:0}};
     row.used=true;consumed++;return {meta:{changes:1}};
    }
    throw Error('Escritura no esperada: '+sql);
   }
  };
 }}
};
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const portalEnv={
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_SECRET:'password-of-32-characters-0000000',
 CENTRAL_BRIDGE_KEY:bridge,
 SABER_CENTRAL:{fetch:req=>central.worker.fetch(req,centralEnv)}
};
async function issue(auth='CENTRAL_PANEL_TEST'){
 return central.worker.fetch(new Request('https://saber-pagos-pruebas.libreriasaber.workers.dev/admin/api/central/mobile-invite',{
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+auth},
  body:JSON.stringify({operator:'Mostrador',confirmed:true})
 }),centralEnv);
}
async function redeem(ticket,env=portalEnv,headers={}){
 return exchange(new Request(origin+'/prueba-v2/ingresar',{
  method:'POST',headers:{'content-type':'application/json',origin,...headers},
  body:JSON.stringify({ticket})
 }),env);
}
test('deniega emitir invitación sin clave de la Central',async()=>{
 entries=new Map();created=0;consumed=0;nowCount=0;
 assert.equal((await issue('clave-incorrecta')).status,401);
 assert.equal(created,0);
});
test('el enlace no incluye ticket en query HTTP y no persiste credencial en D1',async()=>{
 const r=await issue();assert.equal(r.status,200);
 assert.match(r.headers.get('cache-control'),/no-store/);
 const d=await r.json();assert.equal(d.expiresInSeconds,180);
 const url=new URL(d.url);
 assert.equal(url.pathname,'/prueba-v2/ingresar');
 assert.equal(url.search,'');
 assert.match(url.hash,/^#ticket=[a-f0-9-]{36}\.[a-f0-9-]{36}$/i);
 assert.equal(created,1);assert.equal(entries.size,1);
 assert.ok(![...entries.keys()].some(x=>d.url.includes(x)));
});
test('ticket de un uso sólo puede canjearse por Worker firmado y genera sesión HttpOnly',async()=>{
 const invitation=await (await issue()).json();
 const ticket=new URL(invitation.url).hash.slice('#ticket='.length);
 const html=await exchange(new Request(origin+'/prueba-v2/ingresar'),portalEnv);
 assert.equal(html.status,200);
 const htmlText=await html.text();assert.match(htmlText,/history\.replaceState/);
 assert.match(htmlText,/location\.replace/);assert.doesNotMatch(htmlText,/CENTRAL_BRIDGE_KEY/);
 const unauthorized=await redeem(ticket,{...portalEnv,SABER_CENTRAL:{fetch:()=>{throw Error('Unbound')}}});
 assert.equal(unauthorized.status,503);assert.equal(consumed,0);
 const first=await redeem(ticket);assert.equal(first.status,200);
 const setCookie=first.headers.get('set-cookie');
 assert.match(setCookie,/Path=\/prueba-v2\/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800/);
 const cookie=setCookie.split(';')[0];
 assert.equal(await docs.sessionOK(new Request(origin+'/prueba-v2/',{headers:{cookie}}),portalEnv),true);
 assert.equal(consumed,1);
 const again=await redeem(ticket);assert.equal(again.status,403);
 assert.equal(consumed,1);
 assert.equal(again.headers.has('set-cookie'),false);
});
test('rechaza origen ajeno, ticket inventado y ausencia de binding sin otorgar sesión',async()=>{
 assert.equal((await redeem('not-a-token')).status,400);
 const fake=webcrypto.randomUUID()+'.'+webcrypto.randomUUID();
 assert.equal((await redeem(fake)).status,403);
 const attempt=await redeem(fake,portalEnv,{origin:'https://foreign.invalid'});
 assert.equal(attempt.status,403);
 const off=await redeem(fake,{...portalEnv,DOCS_V2_PRIVATE_UI_ENABLED:'OFF'});
 assert.equal(off.status,503);
});
test('rutas de descargas personales mantienen obligatoriedad HTTP Basic',()=>{
 assert.match(docsSource,/path!=='\/prueba-v2\/personal-descargar'/);
 assert.match(docsSource,/authorized:v2PrivateBrowserAuthorized\(request,env\)==='allow'/);
 assert.match(docsSource,/if\(page==='\/prueba-v2\/ingresar'\)return v2MobileInviteExchange/);
 assert.doesNotMatch(docsSource,/service_role|MP_LIVE_ACCESS_TOKEN/);
});
test('invitaciones limitadas por volumen en D1',async()=>{
 nowCount=10;
 assert.equal((await issue()).status,429);
 nowCount=0;
});
