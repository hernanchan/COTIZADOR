import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,randomUUID} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,
 crypto:webcrypto,console,AbortSignal,fetch:()=>{throw Error('No se permiten requests externos')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const commercial='e2d76c8b-ce1c-4daf-9030-4bd402295a68';
const webId='WEB-ENSAYO-01937C3514FB89DC23D78AE7BCBCDDDD';
const receipts=['DOC-1175c8c4-fac1-4cd2-bc71-23104635ecd3','DOC-6af43b5b-385c-4a04-9e68-494ddc3e647e'];
const manifest={
 trabajos:receipts.map((receipt,i)=>({
  orden:i+1,nombreOriginal:'Archivo_'+(i+1)+'.pdf',
  reciboPrivado:receipt,paginasOriginales:16,bytes:i?10131027:17849230,servicio:'documentos'
 }))
};
const db={
 prepare(sql){
  let args=[];
  const st={
   bind(...p){args=p;return st},
   async run(){return {meta:{changes:0}}},
   async first(){
    if(sql.includes('FROM orders WHERE id=? AND status='))
      return args[0]===commercial?{id:commercial,status:'awaiting_payment',amount_ars:2432}:null;
    if(sql.includes('FROM central_document_manifests WHERE commercial_order_id=?'))
      return args[0]===commercial?{web_order_id:webId,manifest_json:JSON.stringify(manifest),
       amount_ars:2432,file_count:2,created_at:'2026-11-01 15:36:00'}:null;
    return null;
   }
  };
  return st;
 }
};
const env={
 DB:db,DEMO_ADMIN_KEY:'TEST_PANEL_KEY',
 MP_TEST_ACCESS_TOKEN:'FAKE', MP_TEST_SELLER_ID:'test',
 TEST_WEBHOOK_URL:'https://test.invalid/webhook',
 MP_WEBHOOK_SECRET:'TEST_WEBHOOK_SECRET'
};
function call(key,id=commercial){
 const u='https://saber-pagos-pruebas.libreriasaber.workers.dev/admin/api/central/unpaid-detail?id='+id;
 const headers=key?{Authorization:'Bearer '+key}:{};
 return ctx.worker.fetch(new Request(u,{headers}),env);
}
test('sin clave del operador no se expone ningún recibo',async()=>{
 const response=await call();
 assert.equal(response.status,401);
 assert.ok(!(await response.text()).includes(receipts[0]));
});
test('D1 confirma dos recibos TUS, SIN cobro ni habilitación de producción',async()=>{
 const response=await call(env.DEMO_ADMIN_KEY);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.documentos.esTUS,true);
 assert.equal(data.documentos.webOrderId,webId);
 assert.equal(data.documentos.archivos,2);
 assert.deepEqual(data.documentos.trabajos.map(x=>x.reciboPrivado),receipts);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(data.listoParaProducir,false);
 assert.ok(!JSON.stringify(data).includes('service_role'));
});
test('clave incorrecta o pedido ajeno se rechazan',async()=>{
 assert.equal((await call('WRONG')).status,401);
 assert.equal((await call(env.DEMO_ADMIN_KEY,randomUUID())).status,404);
 assert.equal((await call(env.DEMO_ADMIN_KEY,'INVALID')).status,400);
});
test('la vista central enlaza solo recibos de TUS a portal Basic, no ofrece URLs de Storage',()=>{
 assert.ok(source.includes('Ver PDF privados'));
 assert.ok(source.includes('Descargar PDF original'));
 assert.ok(source.includes('/prueba-v2/personal-descargar'));
 assert.ok(!source.includes('getPublicUrl('));
});
