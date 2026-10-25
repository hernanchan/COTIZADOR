import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarWorkersEnsayoSoloLectura} from '../integraciones/cloudflare-ensayo/verificar-acceso-lectura.mjs';
const accountId='0'.repeat(32), token='TESTONLY_'+'k'.repeat(35);
const names=['saber-pagos-pruebas','saber-documentos-pruebas'];
test('GET configuraciones: sólo los dos Workers de ensayo, ni POST ni D1',async()=>{
 const paths=[], methods=[];
 const fetcher=async(url,init)=>{
  paths.push(url);methods.push(init.method);
  assert.equal(init.headers.Authorization,'Bearer '+token);
  assert.equal(init.redirect,'error');
  assert.equal(init.body,undefined);
  assert.ok(init.signal);
  return {
   ok:true,status:200,json:async()=>({success:true,result:{bindings:[
    {type:'secret_text',name:'CENTRAL_BRIDGE_KEY'},
    {type:'d1',name:'DB'},{type:'service',name:'SABER_CENTRAL'}
   ]}})
  };
 };
 const v=await verificarWorkersEnsayoSoloLectura({accountId,token,fetcher});
 assert.deepEqual(paths,names.map(n=>
  'https://api.cloudflare.com/client/v4/accounts/'+accountId+
  '/workers/scripts/'+n+'/settings'
 ));
 assert.deepEqual(methods,['GET','GET']);
 assert.equal(v.scope,'METADATA_ONLY');
 assert.equal(v.productionTouched,false);
 assert.equal(v.deploymentPerformed,false);
 assert.equal(v.paymentEnabled,false);
 assert.equal(v.d1Queried,false);
 assert.equal(v.workers.length,2);
 for(const w of v.workers){
  assert.equal(w.centralBridgeKeyConfigured,true);
  assert.equal(w.d1BindingConfigured,true);
  assert.equal(w.serviceBindingConfigured,true);
 }
 assert.doesNotMatch(JSON.stringify(v),/Bearer|token|accountId|https:\/\/api/);
});
test('sin permisos o fallos, nunca imprimir el secreto ni seguir consultando',async()=>{
 let n=0;
 const fetcher=async()=>{
  n++;return {ok:false,status:403,
   json:async()=>({error:'Bearer '+token})};
 };
 await assert.rejects(verificarWorkersEnsayoSoloLectura({
  accountId,token,fetcher
 }),e=>{
  assert.match(e.message,/HTTP 403/);
  assert.doesNotMatch(e.message,new RegExp(token));
  return true;
 });
 assert.equal(n,1);
});
test('formato de cuenta o token inválido: no toca API',async()=>{
 let n=0;
 const fetcher=async()=>{n++;throw Error('no debe usarse')};
 for(const props of [
  {accountId:'otro',token},
  {accountId,token:''},
  {accountId,token:'123456789012345678901'+'.'},
  {accountId:'/',token}
 ]){
  await assert.rejects(verificarWorkersEnsayoSoloLectura({...props,fetcher}),/credenciales/);
 }
 assert.equal(n,0);
});
test('Cloudflare rechaza metadatos ilegibles sin seguir al siguiente Worker',async()=>{
 let n=0;
 await assert.rejects(verificarWorkersEnsayoSoloLectura({
  accountId,token,
  fetcher:async()=>{n++;return {ok:true,status:200,json:async()=>({
   success:false,errors:[{message:'token_interno_no_mostrar'}]
  })}}
 }),/no confirmó los metadatos/);
 assert.equal(n,1);
});
test('Si bindings está ausente informa desconocido, no afirma incorrectamente ausencia',async()=>{
 const v=await verificarWorkersEnsayoSoloLectura({accountId,token,
  fetcher:async()=>({ok:true,status:200,json:async()=>({
   success:true,result:{script_id:'no-source'}
  })})
 });
 assert.equal(v.workers[0].centralBridgeKeyConfigured,null);
 assert.equal(v.workers[1].d1BindingConfigured,null);
});

// Reejecución segura de verificación de metadatos tras actualización de secretos (2026-10-25).
