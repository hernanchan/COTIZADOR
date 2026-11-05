import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {planDeBorradoEntregado,simularLimpiezaTUS,borrarPDFTUSEntregados} from '../integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs';
const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
const commercialOrderId='b69f8ef5-63eb-4728-a967-584c63f39c41';
const receipt='DOC-a69f8ef5-63eb-4728-a967-584c63f39c41';
const doc=()=>({receiptId:receipt,fileId:'PDF01',sha256:'b'.repeat(64),bytes:1800000});
const plan=()=>({ok:true,schema:'saber-central-tus-purge-plan-v1',webOrderId,
 commercialOrderId,productionState:'entregado',productionVersion:3,paymentVerified:true,
 deletionExecuted:false,retentionDays:0,files:[doc()]});
const req=(body,headers={})=>new Request('https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/api/ensayo-tus-retencion',{
 method:'POST',headers:{Origin:'https://saber-documentos-pruebas.libreriasaber.workers.dev',
 'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('El plan sólo admite PDF de entrega verificada y ruta determinista exacta',()=>{
 const p=planDeBorradoEntregado(plan(),webOrderId);
 assert.equal(p.paths[0],'v2/'+webOrderId+'/'+receipt.slice(4)+'.pdf');
 assert.equal(p.totalBytes,1800000);
 assert.equal(p.count,1);
 for(const [key,value] of [['productionState','listo'],['paymentVerified',false],
  ['productionVersion',0],['deletionExecuted',true]]){
  assert.throws(()=>planDeBorradoEntregado({...plan(),[key]:value},webOrderId));
 }
 assert.throws(()=>planDeBorradoEntregado(plan(),'WEB-ENSAYO-'+'B'.repeat(32)));
});
test('Rechaza recibos duplicados, ajenos, payload alterado y excesos',()=>{
 assert.throws(()=>planDeBorradoEntregado({...plan(),files:[doc(),doc()]},webOrderId));
 assert.throws(()=>planDeBorradoEntregado({...plan(),files:[{...doc(),receiptId:'DOC-../../pdf'}]},webOrderId));
 assert.throws(()=>planDeBorradoEntregado({...plan(),files:[{...doc(),bytes:999999999}]},webOrderId));
});
test('La simulación exige credenciales de operador y confirma solo cantidades',async()=>{
 const bad=await simularLimpiezaTUS(req({webOrderId}),{}, {authorized:false,central:()=>{throw Error('No consultar')}});
 assert.equal(bad.status,403);
 const r=await simularLimpiezaTUS(req({webOrderId}),{},{
  authorized:true,central:async()=>planDeBorradoEntregado(plan(),webOrderId)});
 assert.equal(r.status,200);const json=await r.json();
 assert.equal(json.mode,'simulacion');
 assert.equal(json.borrados,0);assert.equal(json.archivosAEliminar,1);
 assert.equal(JSON.stringify(json).includes(receipt),false);
 const invalid=await simularLimpiezaTUS(req({webOrderId:'WEB-ENSAYO-'+'B'.repeat(32),extra:1}),{},{authorized:true,
  central:async()=>{throw Error('No debería llamarse')}});
 assert.equal(invalid.status,422);
});
test('NUNCA borra sin compuerta, confirmación, aprobación y auditoría',async()=>{
 const p=planDeBorradoEntregado(plan(),webOrderId);
 let writes=0;const fetcher=async()=>{writes++;return new Response('[]')};
 for(const opts of [{},{mode:'execute',confirmed:true,approved:true},
  {mode:'execute',confirmed:false,approved:true}]){
  const r=await borrarPDFTUSEntregados(p,{DOCS_TUS_PURGE_ENABLED:'OFF'},{
   ...opts,fetcher});assert.equal(r.borrados,0);
 }
 assert.equal(writes,0);
 await assert.rejects(()=>borrarPDFTUSEntregados(p,{
   DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',DOCS_TUS_SUPABASE_SERVICE_KEY:'x'.repeat(40)},{
   mode:'execute',confirmed:true,approved:true,fetcher}),/Auditoría/);
 assert.equal(writes,0);
});
test('Ejecutor aislado: envía SOLO los archivos recibidos, exige confirmación del servidor',async()=>{
 const p=planDeBorradoEntregado(plan(),webOrderId);
 let request,events=[];
 const env={DOCS_TUS_PURGE_ENABLED:'PRIVATE_TEST_ONLY',DOCS_TUS_SUPABASE_SERVICE_KEY:'x'.repeat(40)};
 const fetcher=async(url,options)=>{
  request={url,method:options.method,body:JSON.parse(options.body)};
  return new Response(JSON.stringify([{name:p.paths[0]}]),{status:200});
 };
 const result=await borrarPDFTUSEntregados(p,env,{mode:'execute',confirmed:true,approved:true,
  fetcher,audit:async e=>events.push(e)});
 assert.equal(result.borrados,1);
 assert.equal(request.method,'DELETE');
 assert.equal(request.body.prefixes.length,1);
 assert.equal(request.body.prefixes[0],p.paths[0]);
 assert.equal(events[0].phase,'before');assert.equal(events[1].phase,'after');
 await assert.rejects(()=>borrarPDFTUSEntregados(p,env,{mode:'execute',confirmed:true,approved:true,
  fetcher:async()=>new Response('[]',{status:200}),audit:async()=>{}}),/No se confirmó/);
});
