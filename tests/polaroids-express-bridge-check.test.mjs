import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {onRequestPost,onRequestGet} from '../integraciones/polaroids/express/probar-puente-hmac.mjs';

const host='https://saber-polaroids-express-pruebas.pages.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage';
const secret='F'.repeat(64);
const env={
  EXPRESS_ALLOWED_HOST:'saber-polaroids-express-pruebas.pages.dev',
  EXPRESS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_PDF_HMAC_KEY:'an-independent-pdf-key-123456789',
  CENTRAL_BRIDGE_KEY:secret,CENTRAL_EXPRESS_URL:central
};
const makeRequest=({origin=host,key=secret,url=host+'/api/express-bridge-check'}={})=>
  new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+key,
    'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},body:'{}'});
const testParams={subtle:webcrypto.subtle,newId:randomUUID,now:()=>Math.floor(Date.now()/1000)};
test('prueba HMAC acepta únicamente rechazo 422 del manifiesto deliberadamente inválido',async()=>{
 let calls=0;
 const fetcher=async(url,opts)=>{
   calls++;
   assert.equal(url,central);
   assert.equal(opts.method,'POST');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.headers['Content-Type'],'application/json');
   assert.equal(opts.headers['Origin'],undefined);
   const signed=opts.headers['x-saber-ts']+'\n'+opts.headers['x-saber-request-id']+'\n'+opts.body;
   assert.equal(opts.headers['x-saber-signature'],createHmac('sha256',secret).update(signed).digest('hex'));
   const p=JSON.parse(opts.body);
   assert.equal(p.schema,'saber-polaroids-express-bridge-check-v1');
   assert.equal(p.invalid,true);
   assert.equal(Object.keys(p).length,2);
   return Response.json({error:'Recibo Express no válido'},{status:422});
 };
 const res=await onRequestPost({request:makeRequest(),env,fetcher,...testParams});
 assert.equal(res.status,200);const result=await res.json();
 assert.equal(result.signedConnection,true);
 assert.equal(result.writes,false);assert.equal(result.photosSent,false);
 assert.equal(result.paymentsEnabled,false);
 assert.equal(calls,1);
});
test('usa Service Binding de la Central y no fetch público',async()=>{
 let internalCalls=0, publicCalls=0;
 const localEnv={...env,SABER_CENTRAL:{async fetch(req){
   internalCalls++;
   assert.equal(req.url,central);
   assert.equal(req.method,'POST');
   assert.equal(req.headers.get('Origin'),null);
   const ts=req.headers.get('x-saber-ts');
   const id=req.headers.get('x-saber-request-id');
   const body=await req.text();
   assert.equal(req.headers.get('x-saber-signature'),
     createHmac('sha256',secret).update(ts+'\n'+id+'\n'+body).digest('hex'));
   assert.equal(JSON.parse(body).invalid,true);
   return Response.json({error:'Recibo Express no válido'},{status:422});
 }}};
 const fetcher=async()=>{publicCalls++;throw Error('No usar Internet para conectar Central')};
 const res=await onRequestPost({request:makeRequest(),env:localEnv,fetcher,...testParams});
 assert.equal(res.status,200);
 assert.equal((await res.json()).signedConnection,true);
 assert.equal(internalCalls,1);
 assert.equal(publicCalls,0);
});

test('no realiza llamadas sin clave correcta, host u Origin',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;throw Error('Should never call')};
 for(const req of [
   makeRequest({key:'wrong'}),makeRequest({origin:'https://otra-web.example'}),
   makeRequest({url:'https://not-pages.example/api/express-bridge-check'})
 ]){
   const res=await onRequestPost({request:req,env,fetcher,...testParams});
   assert.ok([401,403].includes(res.status));
 }
 assert.equal(calls,0);
 const read=await onRequestGet({});
 assert.equal(read.status,405);
});
test('evita envíos sin interruptor, con clave corta o destino diferente',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;throw Error('Should never call')};
 for(const otherEnv of [
   {...env,EXPRESS_CENTRAL_SYNC_ENABLED:''},
   {...env,CENTRAL_BRIDGE_KEY:'a'},
   {...env,EXPRESS_PDF_HMAC_KEY:secret},
   {...env,CENTRAL_EXPRESS_URL:'https://evil.example/internal/central/polaroid-stage'}
 ]){
   const res=await onRequestPost({request:makeRequest({key:otherEnv.CENTRAL_BRIDGE_KEY}),env:otherEnv,fetcher,...testParams});
   assert.equal(res.status,503);
 }
 assert.equal(calls,0);
});
test('rechazo HMAC 401 o cualquier 422 diferente no es éxito',async()=>{
 for(const [status,body] of [
   [401,{error:'Firma de sincronización rechazada'}],
   [503,{error:'Sincronización privada no configurada'}],
   [422,{error:'Otro manifiesto'}]
 ]){
  const fetcher=async()=>Response.json(body,{status});
  const res=await onRequestPost({request:makeRequest(),env,fetcher,...testParams});
  assert.equal(res.status,502);
  assert.equal((await res.json()).signedConnection,false);
 }
});


test('distingue fallo del Service Binding sin filtrar secretos',async()=>{
  const internalEnv={...env,SABER_CENTRAL:{async fetch(){
    throw new TypeError('Error interno con material reservado '+secret)
  }}};
  const result=await onRequestPost({request:makeRequest(),env:internalEnv,
    fetcher:async()=>{throw Error('No se debe usar fetch público')},
    ...testParams});
  assert.equal(result.status,502);
  const body=await result.json();
  assert.equal(body.phase,'invoke-central');
  assert.equal(body.errorType,'TypeError');
  assert.equal(body.signedConnection,false);
  assert.equal(body.writes,false);
  assert.ok(!JSON.stringify(body).includes(secret));
});
