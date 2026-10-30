import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const gas=readFileSync(new URL('../integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs',import.meta.url),'utf8');

const start=worker.indexOf('async function diagnosticoAutorizacionLoteSinArchivos(');
const end=worker.indexOf('/* PILOTO PDF único:',start);
assert.ok(start>=0&&end>start);
const probeSource=worker.slice(start,end);

function simulate(answer,guard={ok:true},enabled='true'){
 const calls=[];
 const sandbox={
  Date,fetch:()=>{},
  postToScript:async (_env,payload)=>{calls.push(payload);return answer(payload);},
  testTurnstilePost:async()=>guard,
  testResponse:(o,status=200)=>({...o,httpStatus:status}),
 };
 vm.runInNewContext(probeSource+';this.probe=diagnosticoAutorizacionLoteSinArchivos;',sandbox);
 return {calls,run:()=>sandbox.probe({}, {DOCS_PING_ENABLED:enabled})};
}
const goodPing={ok:true,service:'saber-docs-handshake',signed:true,
  receptionEnabled:false,apiVersion:'ping-v1'};
const answer=payload=>payload.op==='ping'?goodPing:{ok:false,errorCode:'RECEPTOR_ERROR'};

test('GAS rechaza lote vacío antes de propiedades o Drive',()=>{
 const a=gas.indexOf('function docsMultiStartBatch(');
 const b=gas.indexOf('function docsMultiAuth(',a);
 assert.ok(a>=0&&b>a);
 const s={};
 vm.runInNewContext(gas.slice(a,b)+';this.check=docsMultiStartBatch;',s);
 assert.throws(()=>s.check({metas:[]}),/Tanda privada fuera de límites/);
});

test('el diagnóstico firma ping ASCII, ping Unicode y lote vacío sin PDF',async()=>{
 const sim=simulate(answer);
 const result=await sim.run();
 assert.equal(result.ok,true);
 assert.equal(result.diagnostic,'UTF8_OK_LOTE_AUTORIZADO');
 assert.equal(result.receptionEnabled,false);
 assert.deepEqual(sim.calls.map(x=>x.op),['ping','ping','multiStartBatch']);
 assert.equal(sim.calls[1].probe,'prueba-áéíñ.pdf');
 assert.equal(sim.calls[2].metas.length,0);
 assert.equal(sim.calls.some(x=>Object.hasOwn(x,'file')||Object.hasOwn(x,'token')),false);
});

test('si la firma Unicode se rechaza, no se intenta crear lote',async()=>{
 const sim=simulate(payload=>payload.probe?{ok:false,errorCode:'UNAUTHORIZED'}:answer(payload));
 const result=await sim.run();
 assert.equal(result.ok,false);
 assert.equal(result.reason,'unicode_hmac_rejected');
 assert.equal(sim.calls.length,2);
});

test('UNAUTHORIZED en operación de lote se identifica sin reintento',async()=>{
 const sim=simulate(payload=>payload.op==='multiStartBatch'
   ?{ok:false,errorCode:'UNAUTHORIZED'}:goodPing);
 const result=await sim.run();
 assert.equal(result.ok,false);
 assert.equal(result.reason,'lote_no_autorizado');
 assert.equal(sim.calls.length,3);
});

test('deshabilitado o Turnstile fallido no contactan Google',async()=>{
 const disabled=simulate(answer,{ok:true},'false');
 assert.equal((await disabled.run()).reason,'google_ping_disabled');
 assert.equal(disabled.calls.length,0);
 const blocked=simulate(answer,{ok:false},'true');
 assert.equal((await blocked.run()).ok,false);
 assert.equal(blocked.calls.length,0);
});

test('ruta de diagnóstico es privada, independiente del endpoint de subida',()=>{
 assert.match(worker,/if\(page==='\/prueba-google-lote'\)/);
 assert.match(worker,/if\(request.method==='POST'\)return diagnosticoAutorizacionLoteSinArchivos\(request,env\)/);
 assert.match(probeSource,/DOCS_PING_ENABLED/);
 assert.match(probeSource,/testTurnstilePost\(request,env\)/);
 assert.doesNotMatch(probeSource,/docsStart\(|docsMultiStart\(|DriveApp\.|registrarManifiesto/);
});
