import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {iniciarSesionCompradorLive,autorizadoCompradorLive,
 vinculoOrdenLive,autorizadoOrdenLive} from './sesion-comprador-live.mjs';
const origin='https://pedidos.libreriasaber.com.ar';
const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',CENTRAL_DB_ENV:'produccion',
 DOCS_LIVE_SESSION_GATE:gate,DOCS_MP_LIVE_GATE:gate,
 DOCS_LIVE_SESSION_KEY:'PRIVATE-LIVE-CUSTOMER-SECRET-SIGNED-ISOLATED-ABC',
 DOCS_LIVE_TURNSTILE_SECRET:'PRIVATE-LIVE-CUSTOMER-TURNSTILE',
 CENTRAL_BRIDGE_KEY:'HMAC-CENTRAL-DIFFERENT-SECRET-XYZ'};
const web='WEB-ENSAYO-'+'A'.repeat(32),other='WEB-ENSAYO-'+'B'.repeat(32);
const time=1794320000000;
const request=(token='1234567890token')=>new Request(origin+'/api/pedido/live/sesion',{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({token})});
const opts={subtle:webcrypto.subtle,now:time,
 random:()=>Uint8Array.from({length:16},(_,i)=>i),
 fetcher:async()=>Response.json({success:true,hostname:'pedidos.libreriasaber.com.ar',
 action:'saber_pedido_live'})};
test('LIVE sesión se bloquea sin gates y no consulta Turnstile',async()=>{
 for(const patch of [{DOCS_LIVE_SESSION_GATE:'NO_GO'},
 {DOCS_MP_LIVE_GATE:'NO_GO'},{SABER_ENTORNO:'preparacion'},
 {DOCS_LIVE_SESSION_KEY:env.CENTRAL_BRIDGE_KEY}]){
  let calls=0;
  const r=await iniciarSesionCompradorLive(request(),{...env,...patch},{
   ...opts,fetcher:async()=>{calls++;return opts.fetcher()}});
  assert.equal(r.status,503);assert.equal(calls,0);
 }
});
test('Turnstile de producción emite cookie exclusiva HttpOnly y vincula un único pedido',async()=>{
 const res=await iniciarSesionCompradorLive(request(),env,opts);
 assert.equal(res.status,200);
 const cookie=res.headers.get('Set-Cookie');
 assert.match(cookie,/saber_pedido_live_v1=/);
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/SameSite=Strict/);
 const val=cookie.split(';')[0];
 const check=new Request(origin+'/api/pedido/live/orden',{headers:{Cookie:val}});
 assert.equal(await autorizadoCompradorLive(check,env,opts),true);
 const link=await vinculoOrdenLive(check,env,web,opts);
 assert.match(link,/saber_pedido_live_order_v1=/);
 const linked=new Request(origin+'/api/pedido/live/orden',{headers:{
  Cookie:val+'; '+link.split(';')[0]}});
 assert.equal(await autorizadoOrdenLive(linked,env,web,opts),true);
 assert.equal(await autorizadoOrdenLive(linked,env,other,opts),false);
 assert.equal(await autorizadoOrdenLive(check,env,web,opts),false);
 assert.equal(await autorizadoCompradorLive(new Request(
  'https://saber-documentos-pruebas.workers.dev/prueba-v2',{headers:{Cookie:val}}),env,opts),false);
});
test('Turnstile sandbox y sesión sin firma nunca se aceptan',async()=>{
 const bad=await iniciarSesionCompradorLive(request(),env,{...opts,
  fetcher:async()=>Response.json({success:true,hostname:'saber-documentos-pruebas.workers.dev',
   action:'saber_pedido'})});
 assert.equal(bad.status,403);
 const forged=new Request(origin+'/api/pedido/live/orden',{
  headers:{Cookie:'saber_pedido_live_v1=1794320000.'+'0'.repeat(32)+'.'+'f'.repeat(64)}});
 assert.equal(await autorizadoCompradorLive(forged,env,opts),false);
});
