import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {createHash,createHmac} from 'node:crypto';
import {onRequestGet,onRequestPost} from '../integraciones/polaroids/express/worker-express.mjs';
const require=createRequire(new URL('../integraciones/polaroids/express/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const host='polaroids-express-ensayo.test';
const origin='https://'+host;
const ref='POL-'+'E'.repeat(24);
const jpeg=Uint8Array.from(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const image=Buffer.from(jpeg).toString('base64');
const config={enabled:true,rollout:'APROBADO',delivery:'express-pdf-only',
 allowedHost:host,maxSheetsForRealUploads:4,turnstileSiteKey:'0xEXPERIMENTAL12345678'};
const env={EXPRESS_ALLOWED_HOST:host,EXPRESS_RECEPTION_ENABLED:'PRIVATE_TEST_ONLY',
 EXPRESS_PDF_ENABLED:'PRIVATE_TEST_ONLY',
 EXPRESS_PDF_HMAC_KEY:'standalone-express-hmac-secret-key-0123456789',
 EXPRESS_PDF_SCRIPT_URL:'https://script.google.com/macros/s/AKfycbEXPERIMENTAL01234567890123456789/exec',
 EXPRESS_TURNSTILE_SECRET:'turnstile-private-secret-for-express-tests',
 EXPRESS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:'independent-central-express-hmac-key-01234567890',
 CENTRAL_EXPRESS_URL:'https://saber-pagos-pruebas.test.workers.dev/internal/central/polaroid-stage',
 ASSETS:{fetch:async()=>Response.json(config)}};
const received=new Map(),centralReceived=new Map();
let challenges=0,googleCalls=0,centralCalls=0;
const fetcher=async(url,opts)=>{
 if(url.startsWith('https://challenges.cloudflare.com/')){
  challenges++;
  assert.equal(opts.method,'POST');
  const form=new URLSearchParams(opts.body);
  assert.equal(form.get('secret'),env.EXPRESS_TURNSTILE_SECRET);
  return Response.json({success:true,hostname:host,action:'polaroids-express'});
 }
 if(url.startsWith('https://script.google.com/')){
  googleCalls++;
  assert.equal(opts.method,'POST');
  assert.equal(opts.redirect,'manual');
  const signed=JSON.parse(opts.body);
  const message=signed.timestamp+'\n'+signed.nonce+'\n'+signed.payloadJson;
  assert.equal(signed.signature,createHmac('sha256',env.EXPRESS_PDF_HMAC_KEY)
   .update(message).digest('hex'));
  const p=JSON.parse(signed.payloadJson);
  assert.equal(p.op,'guardarPdfExpress');
  assert.equal('crop' in p,false);
  assert.equal('original' in p,false);
  assert.equal('printJpeg' in p,false);
  assert.equal('encuadres' in p,false);
  const file=Buffer.from(p.pdfBase64,'base64');
  assert.equal(file.length,p.bytes);
  assert.equal(createHash('sha256').update(file).digest('hex'),p.sha256);
  const pdf=await PDFDocument.load(file);
  assert.equal(pdf.getPageCount(),p.paginas);
  assert.equal(pdf.getPages().every(x=>Math.abs(x.getWidth()-210*72/25.4)<.1),true);
  const previous=received.get(p.referencia);
  if(previous&&previous!==p.sha256)
   return Response.json({ok:false,verified:false,error:'Different PDF'},{status:200});
  received.set(p.referencia,p.sha256);
  return Response.json({ok:true,verified:true,
   referencia:p.referencia,sha256:p.sha256,bytes:p.bytes,paginas:p.paginas,fotos:p.fotos});
 }
 if(url.startsWith('https://saber-pagos-pruebas.test.workers.dev/')){
  centralCalls++;
  assert.equal(opts.redirect,'error');
  assert.equal(opts.method,'POST');
  const ts=opts.headers['x-saber-ts'],id=opts.headers['x-saber-request-id'];
  const calc=createHmac('sha256',env.CENTRAL_BRIDGE_KEY)
   .update(ts+'\n'+id+'\n'+opts.body).digest('hex');
  assert.equal(opts.headers['x-saber-signature'],calc);
  const d=JSON.parse(opts.body);
  assert.deepEqual(Object.keys(d).sort(),[
   'bytes','fotos','hojas','importeArs','listoParaProducir',
   'pagoConfirmado','pdfPrivadoVerificado','referencia','schema','sha256'
  ]);
  assert.equal(d.schema,'saber-polaroids-express-central-v1');
  assert.equal(d.importeArs,d.hojas*3000);
  assert.equal(d.pagoConfirmado,false);
  assert.equal(d.listoParaProducir,false);
  assert.equal(d.pdfPrivadoVerificado,true);
  assert.equal(d.sha256,received.get(d.referencia));
  assert.equal('pdfBase64' in d,false);
  const previous=centralReceived.get(d.referencia);
  if(previous&&previous!==d.sha256)
   return Response.json({error:'different PDF'},{status:409});
  centralReceived.set(d.referencia,d.sha256);
  return Response.json({saved:true,idempotent:Boolean(previous),
   referencia:d.referencia,paymentAuthorized:false,pdfPrivadoVerificado:true},
   {status:previous?200:201});
 }
 throw Error('Unexpected outbound host: '+url);
};
const sheets=n=>Array.from({length:Math.ceil(n/6)},(_,h)=>Array.from(
 {length:Math.min(n-h*6,6)},()=>image));
const request=(n,{hostname=host,reference=ref,token='turnstile-token-accepted',headers={}}={})=>
 new Request('https://'+hostname+'/api/polaroids-express',{
 method:'POST',headers:{Origin:'https://'+hostname,'Content-Type':'application/json',
 'Sec-Fetch-Site':'same-origin',...headers},
 body:JSON.stringify({reference,turnstileToken:token,hojas:sheets(n)})});
test('GET informa activación privada sin necesidad de cabecera Origin',async()=>{
 const result=await onRequestGet({request:new Request(origin+'/api/polaroids-express'),env});
 const d=await result.json();
 assert.equal(d.enabled,true);assert.equal(d.pdfForClient,false);
 assert.equal((await (await onRequestGet({request:new Request(origin+'/api/polaroids-express'),
  env:{...env,EXPRESS_RECEPTION_ENABLED:''}})).json()).enabled,false);
});
test('6, 12, 19 y 24 recortes producen un solo PDF privado por pedido',async()=>{
 for(const n of [6,12,19,24]){
  const reference='POL-'+String(n).padStart(24,'A');
  const response=await onRequestPost({
   request:request(n,{reference}),env,fetcher
  });
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.ok,true);
  assert.equal(body.reference,reference);
  assert.equal(body.photos,n);
  assert.equal(body.sheets,Math.ceil(n/6));
  assert.equal(body.priceReference,Math.ceil(n/6)*3000);
  assert.equal(body.pdfPrivateConfirmed,true);
  assert.equal(body.pdfForClient,false);
  assert.equal(body.checkoutAuthorized,false);
  assert.equal('pdfBytes' in body,false);
  assert.equal('pdfUrl' in body,false);
 }
 assert.equal(challenges,4);
 assert.equal(googleCalls,4);
 assert.equal(centralCalls,4);
 assert.equal(received.size,4);
 assert.equal(centralReceived.size,4);
});
test('si una respuesta se pierde, el mismo pedido es idempotente',async()=>{
 const first=await onRequestPost({request:request(12),env,fetcher});
 assert.equal(first.status,200);
 const second=await onRequestPost({request:request(12),env,fetcher});
 assert.equal(second.status,200,await second.text());
 assert.equal(received.size,5);
 assert.equal(centralReceived.size,5);
});
test('el Worker rechaza host, origen, secreto, servicio apagado y fotos inválidas',async()=>{
 const before=googleCalls;
 assert.equal((await onRequestPost({request:request(6),env:{...env,EXPRESS_CENTRAL_SYNC_ENABLED:''},fetcher})).status,503);
 assert.equal((await onRequestPost({request:request(6,{headers:{Origin:'https://bad.test'}}),env,fetcher})).status,403);
 assert.equal((await onRequestPost({request:request(6,{hostname:'bad.test'}),env,fetcher})).status,403);
 assert.equal((await onRequestPost({request:request(6),env:{...env,EXPRESS_RECEPTION_ENABLED:''},fetcher})).status,503);
 assert.equal((await onRequestPost({request:request(6),env:{...env,
  ASSETS:{fetch:async()=>Response.json({...config,enabled:false})}},fetcher})).status,503);
 assert.equal((await onRequestPost({request:request(25),env,fetcher})).status,413);
 const invalid=new Request(origin+'/api/polaroids-express',{method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({reference:ref,turnstileToken:'something-long',hojas:[[Buffer.alloc(200,4).toString('base64')]]})});
 assert.equal((await onRequestPost({request:invalid,env,fetcher})).status,413);
 assert.equal(googleCalls,before);
});
test('error de Turnstile no transmite PDF ni expone Drive',async()=>{
 const before=googleCalls;
 const invalid=await onRequestPost({request:request(6),env,
  fetcher:async(url)=>url.startsWith('https://challenges.cloudflare.com/')
   ? Response.json({success:true,hostname:host,action:'polaroids'})
   : fetcher(url)});
 assert.equal(invalid.status,403);
 assert.equal(googleCalls,before);
 const data=await invalid.json();
 assert.equal(JSON.stringify(data).includes(env.EXPRESS_PDF_HMAC_KEY),false);
});
