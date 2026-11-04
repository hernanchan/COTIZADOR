import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs',import.meta.url),'utf8');
const page=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
const firstId='0c61bcb0-aa32-4e92-85bd-56bbf0a04494',secondId='3c61bcb0-aa32-4e92-85bd-56bbf0a04494';
let model,bankReferences=new Map();
function reset(id=firstId){
 model={id,status:'awaiting_payment',amount_ars:8332,deposit_ars:8332,
  preference_id:null,payment_id:null,transfer_amount:8332,document_amount:8332,
  file_count:2,items_total:8332,document_lines:1,paid_at:null,bank:null,review:null};
}
reset();
const DB={
 prepare(sql){
  let args=[];
  return {
   get sql(){return sql},get args(){return args},
   bind(...values){args=values;return this},
   async run(){
    if(sql.startsWith('CREATE ')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
    throw Error('D1 write unexpected '+sql);
   },
   async first(){
    if(sql.includes('FROM orders o JOIN transfer_requests t'))return args[0]===model.id?{...model}:null;
    if(sql.includes('SELECT state FROM payment_reviews'))return model.review?{state:model.review}:null;
    if(sql.includes('SELECT operator,recorded_at FROM bank_accreditations'))return model.bank?{operator:model.bank.operator,recorded_at:model.bank.recorded_at}:null;
    throw Error('D1 read unexpected '+sql);
   }
  }
 },
 async batch(qs){
  const snapshot={...model,bank:model.bank?{...model.bank}:null};
  const refs=new Map(bankReferences),result=[];
  try{
   for(const q of qs){
    const {sql,args}=q;
    if(sql.startsWith('INSERT INTO bank_accreditations')){
     const [operator,reference,id]=args;
     if(id!==model.id||model.status!=='awaiting_payment'||model.preference_id||
        model.review||bankReferences.has(reference)||model.bank)throw Error('constraint');
     model.bank={operator,bank_reference:reference,recorded_at:'2026-11-04 18:00:00'};
     bankReferences.set(reference,id);
    }else if(sql.startsWith("UPDATE orders SET status='paid'")){
     if(args[0]!==model.id||!model.bank)throw Error('not paid');
     model.status='paid';model.paid_at='2026-11-04 18:00:00';
    }else if(sql.startsWith('INSERT INTO payment_reviews')){
     if(args[0]!==model.id||model.status!=='paid'||!model.bank)throw Error('review');
     model.review='verified';
    }else throw Error('unexpected batch '+sql);
    result.push({meta:{changes:1}});
   }
  }catch(e){model=snapshot;bankReferences=refs;throw e}
  return result;
 }
};
const scope={crypto:webcrypto,Request,Response,URL,URLSearchParams,TextEncoder,AbortSignal,console,
 fetch:async()=>{throw Error('Network not permitted')}};
scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(source.replace('export default {','globalThis.worker = {'),scope);
const env={DB,DEMO_ADMIN_KEY:'secret-for-tests',TRANSFER_PRIVATE_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_SANDBOX_CHECKOUT_ENABLED:'PRIVATE_TEST_ONLY',
 MP_TEST_ACCESS_TOKEN:'offline',MP_TEST_SELLER_ID:'test-seller',
 TEST_WEBHOOK_URL:'https://example.invalid/webhooks/test',MP_WEBHOOK_SECRET:'test-signature'};
async function call(data={},opts={}){
 const req=new Request('https://payments.test/admin/api/transfers/approve',{
  method:'POST',headers:{'Content-Type':'application/json',
   ...(!opts.anonymous?{'Authorization':'Bearer secret-for-tests'}:{}),
   ...(opts.origin?{Origin:opts.origin}:{})},
  body:JSON.stringify(data)
 });
 const r=await scope.worker.fetch(req,{...env,...(opts.env||{})});
 return {code:r.status,body:await r.json()};
}
const valid=(id=firstId,ref='BANCO-OP-123456')=>({
 order_id:id,amount_ars:8332,bank_reference:ref,operator:'Operador prueba',confirmed:true
});

test('sin clave, flag, origen o confirmación explícita NO acredita',async()=>{
 reset();bankReferences.clear();
 assert.equal((await call(valid(),{anonymous:true})).code,401);
 assert.equal((await call(valid(),{env:{TRANSFER_PRIVATE_ENABLED:'OFF'}})).code,503);
 assert.equal((await call(valid(),{env:{DOCS_SANDBOX_CHECKOUT_ENABLED:'OFF'}})).code,503);
 assert.equal((await call(valid(),{origin:'https://untrusted.test'})).code,403);
 assert.equal((await call({...valid(),confirmed:false})).code,400);
 assert.equal((await call({...valid(),bank_reference:'captura enviada.png'})).code,422);
 assert.equal(model.status,'awaiting_payment');
 assert.equal(model.review,null);
 assert.equal(model.bank,null);
});

test('importe incorrecto, pago MP previo o comprobante arbitrario no habilita',async()=>{
 reset();bankReferences.clear();
 assert.equal((await call({...valid(),amount_ars:1})).code,409);
 model.preference_id='mp-pref';
 assert.equal((await call(valid())).code,409);
 model.preference_id=null;model.payment_id='mp-payment';
 assert.equal((await call(valid())).code,409);
 model.payment_id=null;model.transfer_amount=1;
 assert.equal((await call(valid())).code,409);
 model.transfer_amount=8332;model.items_total=1;
 assert.equal((await call(valid())).code,409);
 assert.equal(model.status,'awaiting_payment');
});

test('confirmación bancaria manual hace una sola transición con auditoría de operador',async()=>{
 reset();bankReferences.clear();
 const r=await call(valid());
 assert.equal(r.code,200);
 assert.equal(r.body.payment_confirmed,true);
 assert.equal(r.body.production_enabled,false);
 assert.equal(model.status,'paid');
 assert.equal(model.review,'verified');
 assert.equal(model.bank.operator,'Operador prueba');
 assert.equal(model.bank.bank_reference,'BANCO-OP-123456');
 assert.equal((await call(valid())).code,409);
 assert.equal(model.status,'paid');
});

test('referencia bancaria con espacios se normaliza y no acredita comprobantes ni reutilizaciones',async()=>{
 reset();bankReferences.clear();
 const paid=await call(valid(firstId,'banco mp 34 55'));
 assert.equal(paid.code,200);
 assert.equal(model.bank.bank_reference,'BANCO-MP-34-55');
 reset(secondId);
 assert.equal((await call(valid(secondId,'BANCO-MP-34-55'))).code,409);
 assert.equal(model.status,'awaiting_payment');
 assert.equal((await call(valid(secondId,'captura enviada.png'))).code,422);
});

test('misma referencia bancaria no puede acreditar segundo pedido',async()=>{
 reset();bankReferences.clear();
 assert.equal((await call(valid())).code,200);
 reset(secondId);
 const r=await call(valid(secondId));
 assert.equal(r.code,409);
 assert.equal(model.status,'awaiting_payment');
 assert.equal(model.review,null);
 assert.equal(model.bank,null);
});

test('el contrato conserva MP, y el recibo cliente nunca confirma banca',()=>{
 assert.match(source,/\/admin\/api\/transfers\/approve/);
 assert.match(source,/bank_reference TEXT NOT NULL UNIQUE/);
 assert.match(source,/JOIN bank_accreditations b ON b.order_id=o.id AND b.amount_ars=o.amount_ars/);
 assert.match(source,/TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY"/);
 assert.match(source,/env\.DB\.batch\(\[/);
 assert.match(client,/data.action==='bank'/);
 assert.match(page,/Pagar con Mercado Pago \(prueba\)/);
 assert.match(page,/Transferencia bancaria \(prueba\)/);
 assert.match(page,/Solo Librería Saber puede confirmar el ingreso/);
 assert.doesNotMatch(client,/\/admin\/api\/transfers\/approve/);
 assert.doesNotMatch(page,/\/admin\/api\/transfers\/approve/);
});

test('la bandeja automática compila dentro del HTML y está antes del tablero',()=>{
 const a=source.indexOf('const secret=document.querySelector("#secret")');
 const b=source.indexOf('</script></body></html>',a);
 assert.ok(a>0&&b>a,'No se encontró JavaScript embebido en Central');
 assert.doesNotThrow(()=>new vm.Script(source.slice(a,b)),'JavaScript de Central inválido');
 assert.ok(source.indexOf('id="bankTransfersArea"')<source.indexOf('id="productionBoardArea"'));
 assert.match(source,/refreshTransfers\(\{silent:true\}\)/);
 assert.match(source,/secret\.addEventListener\("change"/);
 assert.match(source,/document\.addEventListener\("visibilitychange"/);
 assert.match(source,/key!==transferVisibleKey/);
});

test('botón de acreditación: falta de referencia visible, confirmación explícita y paso a Nuevos',async()=>{
 const begin=source.indexOf('let refreshingTransfers=false,transferVisibleKey=""');
 const end=source.indexOf('document.querySelector("#refreshUnpaid").addEventListener',begin);
 assert.ok(begin>0&&end>begin);
 const controls={};let focused=null,waiting=true,calls=[],boardRefreshes=0,confirms=0;
 const node=(tag,txt='')=>({
  tag,textContent:String(txt),value:'',disabled:false,attributes:{},children:[],events:{},
  append(...els){this.children.push(...els)},
  replaceChildren(...els){this.children=els},
  setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,cb){this.events[k]=cb},
  focus(){focused=this}
 });
 for(const id of ['#transferPanelStatus','#transferPending','#transferCount','#refreshTransfers'])controls[id]=node('div');
 const operatorInput=node('input');
 const secret=node('input');secret.value='test-key';
 const status=node('p');
 const context={
  document:{querySelector:s=>controls[s]},
  secret,status,operatorInput,node,money:n=>'$ '+n,
  requestOperator:()=> 'Operador de prueba',
  api:async()=>({orders:waiting?[{order_id:firstId,amount_ars:8332,
   numero_orden:20,created_at:'2026-11-04 12:00:00'}]:[]}),
  apiPost:async(path,payload)=>{
   calls.push({path,payload});waiting=false;
   return {ok:true,payment_confirmed:true,operator:payload.operator,recorded_at:'2026-11-04 12:01:00'}
  },
  confirm:()=>{confirms++;return true},
  refresh:async()=>{boardRefreshes++}
 };
 vm.createContext(context);
 vm.runInContext(source.slice(begin,end),context);
 await context.refreshTransfers();
 assert.equal(controls['#transferCount'].textContent,'1 pendiente(s)');
 const item=controls['#transferPending'].children[0];
 const input=item.children.find(x=>x.tag==='input');
 const button=item.children.find(x=>x.tag==='button');
 assert.ok(input&&button);
 await button.events.click();
 assert.equal(calls.length,0,'No aprobar sin referencia');
 assert.equal(focused,input);
 assert.match(controls['#transferPanelStatus'].textContent,/Falta la referencia bancaria/);
 input.value='banco mp 34 55';
 await context.refreshTransfers({silent:true});
 assert.equal(controls['#transferPending'].children[0],item,'Polling no destruye formulario en edición');
 await button.events.click();
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,'/admin/api/transfers/approve');
 assert.equal(calls[0].payload.confirmed,true);
 assert.equal(calls[0].payload.bank_reference,'BANCO-MP-34-55');
 assert.equal(confirms,1);
 assert.equal(boardRefreshes,1);
 assert.equal(controls['#transferCount'].textContent,'0 pendiente(s)');
 assert.match(controls['#transferPanelStatus'].textContent,/Ya debe figurar en/);
});
