/** Ensayo de integración LOCAL con los mismos módulos del proyecto.
 * No requiere red, credenciales, Cloudflare, GAS real ni Drive. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {inflateSync} from 'node:zlib';
import {randomUUID,createHash,createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {onRequestPost} from '../integraciones/polaroids/express/worker-express.mjs';

const require=createRequire(new URL('../integraciones/polaroids/express/package.json',import.meta.url));
const {PDFDocument}=require('pdf-lib');
const base='https://saber-polaroids-express-pruebas.pages.dev';
const centralBase='https://saber-pagos-pruebas.test.workers.dev';
const centralPath='/internal/central/polaroid-stage';
const ref='POL-'+'C'.repeat(24),key='central-bridge-only-test-key-12345678901234';
const pdfKey='private-pdf-storage-only-test-key-12345678901234';
const jpeg=Uint8Array.from(inflateSync(Buffer.from('eNr7f+P/AwYBLzdPNwZGRgYGRiBk+H+bwZmBl5OLm4uDl5uLm4+Pl19YQVRYSEhYXUZOXEFP09BAT1NXx9jKy87YzM1cR9ch3NHNxy8oOMjILioxKiDBKzDIH2QIIx8fn7CgsJqoqJq/qa6pP8ng/wEGQQ7mMiBkVGJgEmRkFmT8f4RBFOxUFMAOFBYRQBdlAIqKMTKiq2ZmAakWxFR9i4GHmRFoD7Mggz3DAoYzOxhGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKCAb2P+/CQBcpjcR','base64')));
const workerSource=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const gasSource=readFileSync(new URL('../integraciones/polaroids/express/apps-script-solo-pdf.gs',import.meta.url),'utf8');
const schema=readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8');

function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(schema);
 const DB={
  prepare(sql){
   let args=[];
   const s={bind(...a){args=a;return s},
    async first(){return db.prepare(sql).get(...args)||null},
    async all(){return {results:db.prepare(sql).all(...args)}},
    async run(){const x=db.prepare(sql).run(...args);return {meta:{changes:Number(x.changes)}}}};
   return s;
  },
  async batch(list){
   db.exec('BEGIN');
   try{const r=[];for(const s of list)r.push(await s.run());db.exec('COMMIT');return r}
   catch(e){db.exec('ROLLBACK');throw e}
  }
 };
 const wc=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,console,
  crypto:webcrypto,fetch:async()=>{throw Error('No external fetch permitted')}});
 vm.runInContext(workerSource.replace('export default {','globalThis.worker = {'),wc);
 const centralEnv={DB,CENTRAL_BRIDGE_KEY:key,CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
  CENTRAL_EXPRESS_ENABLED:'PRIVATE_TEST_ONLY',CENTRAL_EXPRESS_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
  MP_TEST_ACCESS_TOKEN:'TEST-100',MP_TEST_SELLER_ID:'777',MP_WEBHOOK_SECRET:'different-webhook-key',
  TEST_WEBHOOK_URL:'https://localhost.invalid/webhook',DEMO_ADMIN_KEY:'different-admin-key'};
 const saved=new Map();let created=0,remoteCalls=0;
 const folder={
  getSharingAccess(){return 'PRIVATE'},
  getFilesByName(name){
   const matches=[...saved.values()].filter(x=>x.name===name);
   let idx=0;return {hasNext:()=>idx<matches.length,next:()=>matches[idx++]};
  },
  createFile(blob){
   created++;const id='FILE-'+created;
   const file={name:blob.getName(),getId:()=>id,getMimeType:()=> 'application/pdf',
    getBlob:()=>({getBytes:()=>blob.getBytes()})};
   saved.set(id,file);return file;
  }
 };
 const bytes=v=>Buffer.from(v.map(x=>(x+256)%256));
 const utilities={
  computeDigest(_algo,value){return [...createHash('sha256').update(bytes(value)).digest()]},
  computeHmacSha256Signature(message,secret){return [...createHmac('sha256',secret).update(message).digest()]},
  base64Decode:s=>Array.from(Buffer.from(s,'base64')),
  base64Encode:value=>bytes(value).toString('base64'),
  newBlob(value,mime,name){
   const data=typeof value==='string'?Array.from(Buffer.from(value)):Array.from(value);
   return {getName:()=>name,getBytes:()=>data,getContentType:()=>mime};
  },
  getUuid:randomUUID,DigestAlgorithm:{SHA_256:'SHA_256'}
 };
 const gas=vm.createContext({Utilities:utilities,
  DriveApp:{Access:{PRIVATE:'PRIVATE'},getFolderById(id){assert.equal(id,'TEST_FOLDER');return folder},
   getFileById(id){return saved.get(id)}},
  LockService:{getScriptLock(){return {tryLock(){return true},releaseLock(){}}}},
  PropertiesService:{getScriptProperties(){return {getProperty(name){return {
    EXPRESS_PDF_FOLDER_ID:'TEST_FOLDER',EXPRESS_PDF_HMAC_KEY:pdfKey}[name]}}}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput(content){
   return {content,setMimeType(){return this}}
  }},Logger:{log(){}}});
 vm.runInContext(gasSource,gas);
 const config={enabled:true,rollout:'APROBADO',delivery:'express-pdf-only',
  allowedHost:'saber-polaroids-express-pruebas.pages.dev',
  maxSheetsForRealUploads:4,turnstileSiteKey:'0xTEST_SITE_KEY'};
 const pageEnv={
  EXPRESS_ALLOWED_HOST:'saber-polaroids-express-pruebas.pages.dev',
  EXPRESS_RECEPTION_ENABLED:'PRIVATE_TEST_ONLY',EXPRESS_PDF_ENABLED:'PRIVATE_TEST_ONLY',
  EXPRESS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',EXPRESS_PDF_HMAC_KEY:pdfKey,
  EXPRESS_PDF_SCRIPT_URL:'https://script.google.com/macros/s/AKfycbEXPERIMENTAL01234567890123456789/exec',
  EXPRESS_TURNSTILE_SECRET:'test-private-turnstile-secret-123456',
  CENTRAL_BRIDGE_KEY:key,CENTRAL_EXPRESS_URL:centralBase+centralPath,
  ASSETS:{fetch:async()=>Response.json(config)},
  SABER_CENTRAL:{async fetch(request){
   remoteCalls++;
   assert.equal(request.url,centralBase+centralPath);
   assert.equal(request.headers.get('Origin'),null);
   return wc.worker.fetch(request,centralEnv);
  }}
 };
 const fetcher=async(url,opts)=>{
  if(url.startsWith('https://challenges.cloudflare.com/'))
   return Response.json({success:true,hostname:pageEnv.EXPRESS_ALLOWED_HOST,action:'polaroids-express'});
  if(url.startsWith('https://script.google.com/macros/s/')){
   const response=gas.doPost({postData:{contents:opts.body}});
   return Response.json(JSON.parse(response.content));
  }
  throw Error('Unexpected outbound request: '+url);
 };
 const encoded=Buffer.from(jpeg).toString('base64');
 const request=()=>new Request(base+'/api/polaroids-express',{method:'POST',
  headers:{Origin:base,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},
  body:JSON.stringify({reference:ref,turnstileToken:'test-turnstile-token',
   hojas:[Array.from({length:6},()=>encoded)]})});
 return {db,pageEnv,request,fetcher,saved,stats:()=>({created,remoteCalls})};
}
test('PDF real: Worker → GAS privado → Service Binding → D1, sin fotos persistidas ni checkout',async()=>{
 const h=setup();
 const first=await onRequestPost({request:h.request(),env:h.pageEnv,fetcher:h.fetcher});
 const reply=await first.json();
 assert.equal(first.status,200,JSON.stringify(reply));
 assert.equal(reply.verified,true);
 assert.equal(reply.pdfPrivateConfirmed,true);
 assert.equal(reply.checkoutAuthorized,false);
 assert.equal(reply.pdfForClient,false);
 assert.equal(reply.photos,6);
 assert.equal(reply.sheets,1);
 assert.equal(h.stats().created,1);
 assert.equal(h.stats().remoteCalls,1);
 const stored=[...h.saved.values()][0];
 assert.equal(stored.name,ref+'_IMPRIMIR.pdf');
 const bytes=Buffer.from(stored.getBlob().getBytes());
 const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);
 assert.ok(Math.abs(pdf.getPages()[0].getWidth()-210*72/25.4)<.1);
 assert.ok(Math.abs(pdf.getPages()[0].getHeight()-297*72/25.4)<.1);
 const row=h.db.prepare('SELECT * FROM central_polaroids_express WHERE reference=?').get(ref);
 assert.equal(row.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(row.bytes,bytes.length);
 assert.equal(row.photos,6);
 assert.equal(row.sheets,1);
 assert.equal(row.amount_ars,3000);
 assert.equal(row.commercial_order_id,null);
 assert.equal(h.db.prepare('SELECT COUNT(*) n FROM central_polaroids_express').get().n,1);
 const again=await onRequestPost({request:h.request(),env:h.pageEnv,fetcher:h.fetcher});
 const againBody=await again.json();
 assert.equal(again.status,200,JSON.stringify(againBody));
 assert.equal(h.stats().created,1);
 assert.equal(h.db.prepare('SELECT COUNT(*) n FROM central_polaroids_express').get().n,1);
});
