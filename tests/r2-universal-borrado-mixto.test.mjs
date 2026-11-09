import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,webcrypto} from 'node:crypto';
import {eliminarOriginalUniversalTUS,atenderBorradoUniversalTUS}
 from '../integraciones/autocotizador/recepcion/r2-universal-purge-documentos.mjs';
const WEB='WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF';
const UUID='12345678-1234-4123-8123-123456789abc';
const RECEIPT='DOC-12345678-1234-4123-8123-123456789abd';
const CONTENT=new TextEncoder().encode('%PDF-1.4\nPrivate original\n%%EOF');
const HASH=createHash('sha256').update(CONTENT).digest('hex');
const KEY='v2/'+WEB+'/'+RECEIPT.slice(4)+'.pdf';
const SECRET='clave-saber-privada-purgar-mixto-ensayo-20261109';
const input={schema:'saber-docs-r2-universal-purge-file-v1',
 webOrderId:WEB,commercialOrderId:UUID,fileId:'pdf1',transport:'tus',
 receiptId:RECEIPT,objectKey:KEY,sha256:HASH,
 bytes:CONTENT.length,productionVersion:2};
const env=()=>({
 DOCS_R2_UNIVERSAL_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_R2_UNIVERSAL_PURGE_SCOPE:'NEW_ORDERS_ONLY',
 DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_CENTRAL_SYNC_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_ORDER_PREPARE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TUS_RECEIPT_KEY:'t'.repeat(40),
 DOCS_TUS_SUPABASE_SERVICE_KEY:'s'.repeat(45),
 DOCS_TUS_PUBLISHABLE_KEY:'p'.repeat(40),
 CENTRAL_BRIDGE_KEY:SECRET
});
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
function signed(p=input,{ts=1794240000,nonce=UUID,secret=SECRET}={}){
 const body=JSON.stringify(p);
 const mac=createHmac('sha256',secret).update(ts+'\n'+nonce+'\n'+body).digest('hex');
 return new Request(host+'/internal/r2-universal-purge-delivered',{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':nonce,'x-saber-signature':mac},body});
}
test('borrado TUS OFF no lee ni elimina Storage',async()=>{
 let called=0;
 const v=env();v.DOCS_R2_UNIVERSAL_PURGE_ENABLED='OFF';
 const r=await atenderBorradoUniversalTUS(signed(),v,{
  remove:async()=>{called++;throw Error('DELETE SHOULD NOT EXECUTE')}});
 assert.equal(r.status,503);assert.equal(called,0);
});
test('HMAC TUS ajeno, archivo mal formado, nombre y hash alterado rechazan',async()=>{
 let called=0;
 const opt={now:()=>1794240000,subtle:webcrypto.subtle,
  remove:async()=>{called++;throw Error('UNEXPECTED')}};
 for(const x of [
  signed(input,{secret:'otra-clave-mala-de-ensayo-privada-2026'}),
  signed({...input,objectKey:'v2/'+WEB+'/wrong.pdf'}),
  signed({...input,transport:'r2'}),
  signed({...input,sha256:'0'.repeat(63)})
 ]){
  const response=await atenderBorradoUniversalTUS(x,env(),opt);
  assert.equal(response.status,401);assert.equal(called,0);
 }
});
test('TUS borra sólo ruta firmada y confirma ausencia después del almacenamiento',async()=>{
 let exists=true,removed=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='HEAD')return new Response(null,{status:exists?200:404,
   headers:exists?{'Content-Length':String(CONTENT.length)}:{}});
  if(opts.method==='DELETE'){
   const p=JSON.parse(opts.body);
   assert.deepEqual(p.prefixes,[KEY]);
   assert.match(url,/\/storage\/v1\/object\/saber-tus-lab$/);
   assert.ok(opts.headers.Authorization.startsWith('Bearer '));
   exists=false;removed++;
   return new Response(JSON.stringify([{name:KEY}]),{status:200});
  }
  throw Error('Unexpected '+opts.method);
 };
 const options={fetcher,read:async(_env,name)=>{
  assert.equal(name,KEY);return CONTENT;},subtle:webcrypto.subtle};
 const r=await eliminarOriginalUniversalTUS(env(),input,options);
 assert.equal(r.verifiedAbsent,true);assert.equal(removed,1);
 const again=await eliminarOriginalUniversalTUS(env(),input,options);
 assert.equal(again.verifiedAbsent,true);assert.equal(removed,1);
});
test('TUS jamás borra si el SHA del original guardado ya cambió',async()=>{
 let deleted=0;
 const fetcher=async()=>new Response(null,{status:200,
  headers:{'Content-Length':String(CONTENT.length)}});
 await assert.rejects(()=>eliminarOriginalUniversalTUS(env(),input,{
  fetcher,read:async()=>new Uint8Array(CONTENT.length),
  subtle:webcrypto.subtle}),/SHA_CHANGED|BYTES_CHANGED/);
 assert.equal(deleted,0);
});
test('TUS exige ausencia ratificada: DELETE 200 no es prueba suficiente',async()=>{
 let deleted=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='HEAD')return new Response(null,{status:200,
   headers:{'Content-Length':String(CONTENT.length)}});
  if(opts.method==='DELETE'){deleted++;return new Response('[]',{status:200})}
  throw Error('Unexpected');
 };
 await assert.rejects(()=>eliminarOriginalUniversalTUS(env(),input,{
  fetcher,read:async()=>CONTENT,subtle:webcrypto.subtle}),/STILL_PRESENT/);
 assert.equal(deleted,1);
});
