import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('../integraciones/mercadopago/pruebas/schema.sql',import.meta.url),'utf8'));
const DB={
 prepare(sql){
  let args=[];
  const stmt={bind(...v){args=v;return stmt},
   async first(){return sqlite.prepare(sql).get(...args)||null},
   async all(){return {results:sqlite.prepare(sql).all(...args)}},
   async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}};
  return stmt;
 },
 async batch(stmts){
  sqlite.exec('BEGIN');
  try{
   for(const s of stmts)await s.run();
   sqlite.exec('COMMIT');
  }catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
};
const context=vm.createContext({
 Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,crypto:webcrypto,
 console,fetch:async()=>{throw Error('No requests to external systems in CI')}
});
const js=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
vm.runInContext(js.replace('export default {','globalThis.worker = {'),context,{filename:'central-private-worker.js'});
const secret='saber-bridge-pilot-test-key-of-40-bytes-not-real';
const env={
 DB,DEMO_ADMIN_KEY:'operator-test-access-not-for-use',
 MP_TEST_ACCESS_TOKEN:'fake',
 MP_TEST_SELLER_ID:'fake',
 TEST_WEBHOOK_URL:'https://test.example/webhook',
 MP_WEBHOOK_SECRET:'fake-mp-test-secret',
 CENTRAL_BRIDGE_ENABLED:'PRIVATE_TEST_ONLY',
 CENTRAL_BRIDGE_KEY:secret
};
const order='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const receipt='DOC-12345678-1234-4234-8234-1234567890ab';
const sha='a'.repeat(64);
const stage={
 schema:'saber-central-recepcion-verificada-v1',orderId:order,
 paymentAuthorized:false,filesReceived:true,listoParaProducir:false,
 importeVerificado:1250,recibos:[{fileId:'doc1',receiptId:receipt,sha256:sha,bytes:2048,pages:2}],
 ficha:{schema:'saber-central-ficha-produccion-v1',orderId:order,
  pagoConfirmado:false,listoParaProducir:false,totalVerificadoSinPago:1250,
  trabajos:[{orden:1,idTrabajo:'pdf1',servicio:'documentos',fileId:'doc1',
   nombreOriginal:'Ensayo_original.pdf',reciboPrivado:receipt,sha256:sha,
   paginasOriginales:2,paginasElegidas:[1,2],copias:1,formatoFinal:'a4',
   carasPresupuestadas:'simple',paginasPorCaraPresupuestadas:1,
   material:'obra70',pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false
  }]
 }
};
const host='https://saber-pagos-pruebas.example';
async function call(path,payload,{key=secret,origin=null}={}){
 const body=JSON.stringify(payload),ts=Math.floor(Date.now()/1000),nonce=randomUUID();
 const signature=createHmac('sha256',key).update(ts+'\n'+nonce+'\n'+body).digest('hex');
 const request=new Request(host+path,{method:'POST',
  headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':nonce,'x-saber-signature':signature,...origin?{Origin:origin}:{}},body});
 const res=await context.worker.fetch(request,env);
 return {status:res.status,body:await res.json()};
}
const query=(orderId=order,receiptId=receipt)=>({
 schema:'saber-central-tus-recibo-lookup-v1',webOrderId:orderId,receiptId
});
test('Central de pruebas registra un manifiesto real y consulta pertenencia TUS con firma HMAC',async()=>{
 const staged=await call('/internal/central/stage',stage);
 assert.equal(staged.status,201);
 assert.equal(staged.body.saved,true);
 const good=await call('/internal/central/receipt-check',query());
 assert.equal(good.status,200);
 assert.equal(good.body.ok,true);assert.equal(good.body.found,true);
 assert.equal(good.body.sha256,sha);
 assert.equal(good.body.bytes,2048);
 assert.equal(good.body.pages,2);
 assert.equal(good.body.fileId,'doc1');
 assert.equal(good.body.name,'Ensayo_original.pdf');
 assert.equal(good.body.paymentAuthorized,false);
 assert.equal(good.body.listoParaProducir,false);
});
test('D1 niega recibos ajenos, identificadores falsificados y accesos sin firma',async()=>{
 const unknown=await call('/internal/central/receipt-check',
  query(order,'DOC-87654321-1234-4234-8234-1234567890ab'));
 assert.equal(unknown.status,404);
 const other=await call('/internal/central/receipt-check',
  query('WEB-ENSAYO-OTRO-12345',receipt));
 assert.equal(other.status,404);
 const forged=await call('/internal/central/receipt-check',query(),{key:'wrong-key'});
 assert.equal(forged.status,401);
 const browser=await call('/internal/central/receipt-check',query(),{origin:'https://malicious.example'});
 assert.equal(browser.status,403);
 const malicious=await call('/internal/central/receipt-check',{...query(),paymentAuthorized:true});
 assert.equal(malicious.status,422);
});
