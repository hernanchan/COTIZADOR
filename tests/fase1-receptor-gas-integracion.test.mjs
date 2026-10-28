import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs',import.meta.url),'utf8');
const SHA='a'.repeat(64), OTHER_SHA='b'.repeat(64);
const uuid=n=>'DOC-00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const input=(orderId,fileId,sha256=SHA)=>({meta:{orderId,fileId,name:fileId+'.pdf',mode:'bn',bytes:1024,sha256,partBytes:524288,parts:1}});
function harness(){
 const store=new Map(),sessions=new Map(),ctx=vm.createContext({});
 vm.runInContext(source,ctx);
 let serial=0;
 ctx.docsStore=()=>({
  getProperties:()=>Object.fromEntries(store),
  getProperty:k=>store.get(k)||null,
  setProperty:(k,v)=>store.set(k,v)
 });
 ctx.docsStart=({meta:m})=>{
  const s={uploadId:uuid(++serial),orderId:m.orderId,fileId:m.fileId,
   name:m.fileId+'__'+m.name,sha256:m.sha256,mode:m.mode,bytes:m.bytes,
   token:'t'.repeat(64),createdAt:Date.now()};
  sessions.set(s.uploadId,s);store.set('FILE_'+s.uploadId,JSON.stringify(s));
  return {uploadId:s.uploadId,token:s.token};
 };
 ctx.docsRead=id=>{
  if(!sessions.has(id))throw Error('Sesión no registrada');
  return sessions.get(id);
 };
 return {ctx,store,sessions};
}
test('tres PDFs distintos por pedido, recibos únicos y reintento idempotente',()=>{
 const {ctx}=harness();
 const order='WEB-ENSAYO-PRUEBA20261028';
 const one=ctx.docsMultiStart(input(order,'pdf-a4-uno'));
 const two=ctx.docsMultiStart(input(order,'pdf-a4-dos',OTHER_SHA));
 const three=ctx.docsMultiStart(input(order,'pdf-a0-cad'));
 assert.notEqual(one.uploadId,two.uploadId);
 assert.notEqual(two.uploadId,three.uploadId);
 assert.equal(three.remainingSlots,27);
 const repeated=ctx.docsMultiStart(input(order,'pdf-a0-cad'));
 assert.equal(repeated.uploadId,three.uploadId);
 assert.equal(ctx.docsMultiIds().length,3);
});
test('rechaza conflicto de contenido y metadatos falsos sin usar Drive',()=>{
 const {ctx}=harness(),order='WEB-ENSAYO-PRUEBA20261028';
 ctx.docsMultiStart(input(order,'pdf-a4-uno'));
 assert.throws(()=>ctx.docsMultiStart(input(order,'pdf-a4-uno',OTHER_SHA)),/Identificador de ensayo en uso/);
 const invalid=input(order,'pdf-a4-dos');
 invalid.meta.partBytes=2048;
 assert.throws(()=>ctx.docsMultiStart(invalid),/Metadatos de ensayo incorrectos/);
 assert.equal(ctx.docsMultiIds().length,1);
});
test('30 archivos por pedido y máximo global 120',()=>{
 const {ctx}=harness(),order='WEB-ENSAYO-PRUEBA20261028';
 for(let i=0;i<30;i++)ctx.docsMultiStart(input(order,'pdf-'+i));
 assert.equal(ctx.docsMultiIds().length,30);
 assert.throws(()=>ctx.docsMultiStart(input(order,'pdf-30')),/Límite de 30 archivos/);
 for(let j=0;j<3;j++)for(let i=0;i<30;i++)
  ctx.docsMultiStart(input('WEB-OTROPEDIDO-'+j,'pdf-'+i));
 assert.equal(ctx.docsMultiIds().length,120);
 assert.throws(()=>ctx.docsMultiStart(input('WEB-OTROPEDIDO-4','pdf-0')),/Cupo global/);
});
test('se mantiene bloqueo de pago y verificación real de páginas',()=>{
 const {ctx}=harness(),order='WEB-ENSAYO-PRUEBA20261028';
 const {uploadId,token}=ctx.docsMultiStart(input(order,'pdf-a0-cad'));
 const before=ctx.docsMultiVerifiedStatus({uploadId,token});
 assert.equal(before.verified,false);
 assert.equal(before.paymentAuthorized,false);
});
