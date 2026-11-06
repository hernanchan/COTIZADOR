import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {manejarCotizadorCliente,autorizadoCotizadorCliente}
 from '../integraciones/autocotizador/recepcion/cotizador-cliente-publico.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const url='https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/cotizar-cliente';
const now=1793962800000;
const secret='CF_QUOTE_ONLY_SITEVERIFY_SECRET_0123456789_DO_NOT_USE_IN_PROD';
const env={
 DOCS_PUBLIC_QUOTE_GATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TURNSTILE_SITE_KEY:'0x4AAAAAAAEXAMPLEPUBLICQUOTEKEY',
 DOCS_TURNSTILE_SECRET:secret,
 DOCS_V2_PRIVATE_UI_SECRET:'OTHER_SECRET_FOR_OPERATOR_ONLY_'+'X'.repeat(30),
 DOCS_CENTRAL_ADMIN_KEY:'OTHER_SECRET_FOR_ADMIN_ONLY_'+'Y'.repeat(30),
 CENTRAL_BRIDGE_KEY:'OTHER_SECRET_FOR_D1_BRIDGE_'+'Z'.repeat(30)
};
const req=(method='GET',cookie='',token='VALID_TURNSTILE_TOKEN_STRING_ABCDE')=>new Request(url,{
 method,headers:{
  ...(method==='POST'?{'Content-Type':'application/json','Origin':new URL(url).origin}:{}),
  ...(cookie?{'Cookie':cookie}:{})
 },...(method==='POST'?{body:JSON.stringify({token})}:{})
});
const opts={now,subtle:webcrypto.subtle,random:()=>new Uint8Array(16).fill(7),
 paginaCotizacion:paginaCargaUnica()};
test('función apagada no expone vista cliente ni emite cookie',async()=>{
 const r=await manejarCotizadorCliente(req(),{...env,DOCS_PUBLIC_QUOTE_GATE_ENABLED:'OFF'},opts);
 assert.equal(r.status,503);
 assert.equal(r.headers.get('Set-Cookie'),null);
 assert.equal(await autorizadoCotizadorCliente(req(),{...env,DOCS_PUBLIC_QUOTE_GATE_ENABLED:'OFF'},opts),false);
});
test('sin sesión, muestra verificación Turnstile y no monta formulario de envío',async()=>{
 const r=await manejarCotizadorCliente(req(),env,opts);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/cf-turnstile/);
 assert.match(html,/saber_quote/);
 assert.doesNotMatch(html,/DOCS_CENTRAL_ADMIN_KEY|DOCS_V2_PRIVATE_UI_SECRET|subir-vincular|ensayo-tus-iniciar/);
 assert.equal(r.headers.get('Set-Cookie'),null);
 assert.match(r.headers.get('Content-Security-Policy'),/frame-src https:\/\/challenges.cloudflare.com/);
});
test('sin origen válido o token inválido, no consulta Turnstile ni emite cookies',async()=>{
 let count=0;
 const fetcher=async()=>{count++;return Response.json({success:true})};
 const withoutOrigin=new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'SOME_TOKEN_LONGER_THAN_10'})});
 const a=await manejarCotizadorCliente(withoutOrigin,env,{...opts,fetcher});
 const b=await manejarCotizadorCliente(req('POST','','no'),env,{...opts,fetcher});
 assert.equal(a.status,403);assert.equal(b.status,422);assert.equal(count,0);
});
test('Turnstile exige hostname y action exactos; no acepta token de otro sitio',async()=>{
 const fetcher=async()=>Response.json({success:true,hostname:'otro.ejemplo.com',action:'saber_quote'});
 const a=await manejarCotizadorCliente(req('POST'),env,{...opts,fetcher});
 assert.equal(a.status,403);
 const b=await manejarCotizadorCliente(req('POST'),env,{...opts,fetcher:async()=>Response.json({
  success:true,hostname:new URL(url).hostname,action:'otro_servicio'
 })});
 assert.equal(b.status,403);
});
test('verificación exitosa emite cookie independiente, temporal, HttpOnly y solo cotiza',async()=>{
 let count=0;
 const fetcher=async(target,options)=>{
  count++;
  assert.match(target,/turnstile\/v0\/siteverify/);
  assert.equal(options.method,'POST');
  assert.equal(options.body.get('secret'),secret);
  return Response.json({success:true,hostname:new URL(url).hostname,action:'saber_quote'});
 };
 const r=await manejarCotizadorCliente(req('POST'),env,{...opts,fetcher});
 assert.equal(r.status,200);
 assert.equal(count,1);
 const data=await r.json();
 assert.equal(data.ok,true);
 assert.equal(data.filesUploaded,false);assert.equal(data.ordersCreated,false);
 const cookie=r.headers.get('Set-Cookie');
 assert.match(cookie,/saber_quote_client_v1=/);
 assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.match(cookie,/Max-Age=1200/);
 assert.doesNotMatch(cookie,/saber_v2_session|operador|saber_pagos/);
 const cookieValue=cookie.split(';')[0];
 assert.equal(await autorizadoCotizadorCliente(req('GET',cookieValue),env,opts),true);
 const page=await manejarCotizadorCliente(req('GET',cookieValue),env,opts);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,/Cotización preliminar/);
 assert.match(html,/id="presupuesto"/);
 assert.match(html,/no se suben, no se almacenan/);
 assert.doesNotMatch(html,/data-access-token|saber_v2_session/);
 assert.match(page.headers.get('Content-Security-Policy'),/connect-src 'self'/);
 assert.equal(await autorizadoCotizadorCliente(req('GET',cookieValue),env,{...opts,now:now+1201000}),false);
 const broken=cookieValue.slice(0,-1)+(cookieValue.endsWith('0')?'1':'0');
 assert.equal(await autorizadoCotizadorCliente(req('GET',broken),env,opts),false);
});
test('privilegios de cliente se autorizan únicamente en dos rutas de presupuesto, nunca TUS/admin',()=>{
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 const priceSection=worker.slice(worker.indexOf('async function preciosPrivados('),worker.indexOf('const INTERNAL_ALLOW_UPLOADS'));
 assert.match(priceSection,/soloPresupuesto/);
 assert.match(priceSection,/quotePath==='\/api\/ensayo-materiales-rapido'/);
 assert.match(priceSection,/quotePath==='\/api\/ensayo-carga-unica'/);
 assert.match(priceSection,/soloPresupuesto&&await autorizadoCotizadorCliente/);
 const tus=worker.slice(worker.indexOf("if(page==='/api/ensayo-tus-iniciar'"),worker.indexOf("if(page==='/api/ensayo-preparar-documentos-lote'"));
 assert.doesNotMatch(tus,/autorizadoCotizadorCliente/);
 assert.match(tus,/v2SessionAuthorized/);
});
