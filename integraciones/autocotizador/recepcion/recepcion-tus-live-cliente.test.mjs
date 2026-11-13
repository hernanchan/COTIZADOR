import test from 'node:test';
import assert from 'node:assert/strict';
import {leerPedidoPostpagoLive,enviarPDFsTUSPagadosLive} from './recepcion-tus-live-cliente.mjs';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
const SHA='a'.repeat(64);
const meta={fileId:'pdf_0',name:'Apunte.pdf',bytes:200,sha256:SHA,pages:1,mode:'bn',transport:'tus'};
const makeStore=(entries=[meta])=>{
 const data=new Map([
 ['saber-live-pedido-v1',JSON.stringify({webOrderId:WEB,commercialOrderId:UUID})],
 ['saber-live-archivos-v1',JSON.stringify({webOrderId:WEB,commercialOrderId:UUID,metas:entries})]
 ]);
 return {getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,val)};
};
const file={name:'Apunte.pdf',size:200,slice:()=>({arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer})};
function makeFetch(paid=true){
 const calls=[];
 const fetcher=async(path,options)=>{
  calls.push({path,body:JSON.parse(options.body)});
  if(path.includes('checkout'))return Response.json({ok:true,webOrderId:WEB,
   commercialOrderId:UUID,estado:paid?'pagado_esperando_archivos':'pendiente',
   uploadAuthorized:paid,productionAuthorized:false,fileCount:1});
  if(path.endsWith('/iniciar'))return Response.json({ok:true,orderId:WEB,
   bucket:'saber-tus-live',projectRef:'abcdefghijklmnop',
   publishableKey:'PUBLIC_LIVE_KEY_NOT_REAL_BUT_LONG_ENOUGH_12345',
   paymentAuthorized:false,productionAuthorized:false,
   sessions:[{fileId:meta.fileId,bytes:200,pages:1,
    objectName:'v2/'+WEB+'/'+UUID+'.pdf',
    signature:'SIGNED_PRIVATE_UPLOAD_TOKEN_123',proof:'S'.repeat(50)}]});
  if(path.endsWith('/confirmar'))return Response.json({ok:true,webOrderId:WEB,
   savedFiles:1,productionAuthorized:false,receipts:[{fileId:meta.fileId,saved:true}]});
  throw Error('BAD_ROUTE');
 };
 return {calls,fetcher};
}
function uploaderFactory(uploads){
 class Uppy{
  files=[];
  use(Tus,options){uploads.push({type:'config',options});return this}
  on(){}
  addFile(f){this.files.push(f);return String(this.files.length)}
  setFileMeta(id,metadata){uploads.push({type:'meta',id,metadata})}
  async upload(){uploads.push({type:'upload'});return {successful:this.files,failed:[]}}
  close(){}
 }
 return async()=>({Uppy,Tus:class Tus{}});
}
const opts=(store,fetcher,loadUploader)=>({
 selectedFiles:[file],storage:store,origin:'https://pedidos.libreriasaber.com.ar',
 fetcher,loadUploader,hasher:async()=>SHA
});
test('retorno no acepta identidades de otra orden ni manifiestos manipulados',()=>{
 const store=makeStore();assert.equal(leerPedidoPostpagoLive(store).metas.length,1);
 const forged=makeStore();forged.setItem('saber-live-pedido-v1',JSON.stringify({
  webOrderId:'WEB-ENSAYO-'+'B'.repeat(32),commercialOrderId:UUID}));
 assert.throws(()=>leerPedidoPostpagoLive(forged),/REFERENCIA_NO_DISPONIBLE/);
 const metadata=makeStore([{...meta,transport:'r2'}]);
 assert.throws(()=>leerPedidoPostpagoLive(metadata),/REFERENCIA_NO_DISPONIBLE/);
});
test('archivo reemplazado se rechaza antes de consultar pago ni Storage',async()=>{
 const {calls,fetcher}=makeFetch();const uploads=[];
 await assert.rejects(enviarPDFsTUSPagadosLive({
  ...opts(makeStore(),fetcher,uploaderFactory(uploads)),
  hasher:async()=> 'b'.repeat(64)}),/SHA_DISTINTO/);
 assert.equal(calls.length,0);assert.equal(uploads.length,0);
});
test('pago pendiente no autoriza ninguna firma de Storage',async()=>{
 const {calls,fetcher}=makeFetch(false),uploads=[];
 await assert.rejects(enviarPDFsTUSPagadosLive(
  opts(makeStore(),fetcher,uploaderFactory(uploads))),/PAGO_O_AVISO_NO_CONCILIADO/);
 assert.equal(calls.length,1);assert.equal(uploads.length,0);
});
test('pago conciliado autoriza TUS productivo y guarda recibo sin nuevo checkout',async()=>{
 const {calls,fetcher}=makeFetch(),uploads=[];
 const result=await enviarPDFsTUSPagadosLive(
  opts(makeStore(),fetcher,uploaderFactory(uploads)));
 assert.equal(result.ok,true);assert.equal(result.savedFiles,1);
 assert.equal(result.pendingR2,0);
 assert.deepEqual(calls.map(x=>x.path),[
  '/api/pedido/live/checkout',
  '/api/pedido/live/tus/iniciar',
  '/api/pedido/live/tus/confirmar'
 ]);
 assert.equal(calls[1].body.metas[0].sha256,SHA);
 assert.equal(uploads.filter(x=>x.type==='upload').length,1);
 assert.equal(uploads.find(x=>x.type==='config').options.endpoint,
  'https://abcdefghijklmnop.storage.supabase.co/storage/v1/upload/resumable/sign');
 assert.equal(result.productionAuthorized,false);
});

test('dos PDF TUS muestran porcentaje acumulado sin 100% antes de verificar D1',async()=>{
 const m2={...meta,fileId:'pdf_1',name:'Segundo.pdf',bytes:400};
 const f2={...file,name:'Segundo.pdf',size:400};
 const seen=[],calls=[];
 const fetcher=async(path,opts)=>{
  calls.push(path);
  if(path.endsWith('/checkout'))return Response.json({
   ok:true,webOrderId:WEB,commercialOrderId:UUID,estado:'pagado_esperando_archivos',
   uploadAuthorized:true,productionAuthorized:false,fileCount:2});
  if(path.endsWith('/iniciar'))return Response.json({
   ok:true,orderId:WEB,bucket:'saber-tus-live',projectRef:'abcdefghijklmnop',
   publishableKey:'PUBLIC_LIVE_KEY_NOT_REAL_BUT_LONG_ENOUGH_12345',
   paymentAuthorized:false,productionAuthorized:false,
   sessions:[meta,m2].map((m,i)=>({fileId:m.fileId,bytes:m.bytes,pages:m.pages,
    objectName:'v2/'+WEB+'/'+UUID.replace(/.$/,String(i))+'.pdf',
    signature:'SIGNED_PRIVATE_UPLOAD_TOKEN_'+i+'123',proof:'S'.repeat(50)+i}))
  });
  if(path.endsWith('/confirmar'))return Response.json({
   ok:true,webOrderId:WEB,savedFiles:2,productionAuthorized:false,
   receipts:[meta,m2].map(m=>({fileId:m.fileId,saved:true}))});
  throw Error(path);
 };
 class Uppy{
  constructor(){this.files=[];this.listeners=new Map()}
  use(){return this}
  on(name,callback){this.listeners.set(name,callback)}
  addFile(f){const id='mock_'+this.files.length;
   this.files.push({...f,id,size:f.data.size});return id}
  setFileMeta(){}
  async upload(){
   const cb=this.listeners.get('upload-progress');
   cb(this.files[0],{bytesUploaded:100});
   cb(this.files[1],{bytesUploaded:100});
   cb(this.files[0],{bytesUploaded:200});
   cb(this.files[1],{bytesUploaded:400});
   return {successful:this.files,failed:[]};
  }
  close(){}
 }
 const result=await enviarPDFsTUSPagadosLive({
  selectedFiles:[file,f2],storage:makeStore([meta,m2]),
  origin:'https://pedidos.libreriasaber.com.ar',
  fetcher,hasher:async()=>SHA,onProgress:p=>seen.push(p),
  loadUploader:async()=>({Uppy,Tus:class {}})
 });
 assert.equal(result.ok,true);
 const progress=seen.filter(p=>p.phase==='upload');
 assert.deepEqual(progress.map(p=>p.bytesUploaded),[100,200,300,600]);
 assert.deepEqual(progress.map(p=>p.percent),[16,33,50,99]);
 assert.equal(seen.at(-2).phase,'verificando-recibos');
 assert.equal(seen.at(-2).percent,99);
 assert.equal(seen.at(-1).phase,'recibido');
 assert.equal(seen.at(-1).percent,100);
 assert.equal(calls.filter(x=>x.endsWith('/confirmar')).length,1);
});
