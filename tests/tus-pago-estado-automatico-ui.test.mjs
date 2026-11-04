import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';

const html=paginaCotizadorV2PruebaPrivada('sitekey-ensayo-privado-123456',true,{solicitado:true,listo:true,invalidos:[]},true);
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]||'';
const begin=script.indexOf('function pagoSandboxEnRecibo(){');
const end=script.indexOf('\nlet batchSending=',begin);
assert.ok(begin>0&&end>begin,'Falta recibo de cliente');
const source=script.slice(begin,end);
const maker=new Function('document','fetch','setInterval','registeredOrder',
 'registeredShortOrder','ultimoTotalServidor','orderId','clientOrderId',
 source+'\nreturn pagoSandboxEnRecibo();');

function setup(statuses=['pendiente']){
 const callbacks={};let interval=null;
 const price={textContent:''},requests=[],nodes=[];
 function node(tag){
  const element={
   tag,children:[],events:{},attributes:{},style:{},textContent:'',className:'',
   append(...items){this.children.push(...items);},
   insertBefore(item,target){const idx=this.children.indexOf(target);
    this.children.splice(idx<0?this.children.length:idx,0,item);},
   setAttribute(key,value){this.attributes[key]=value;},
   addEventListener(event,fn){this.events[event]=fn;}
  };
  nodes.push(element);return element;
 }
 const document={
  hidden:false,createElement:node,getElementById:()=>price,
  addEventListener(event,fn){callbacks[event]=fn;}
 };
 const fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body);requests.push({url,opts,body});
  assert.equal(url,'/prueba-v2/api/ensayo-tus-pago-sandbox');
  assert.equal(opts.credentials,'same-origin');
  if(body.action==='start')return {ok:true,json:async()=>({ok:true,
   checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=TEST'})};
  return {ok:true,json:async()=>({ok:true,estado:statuses.shift()||'pendiente'})};
 };
 const wrap=maker(document,fetch,(fn,ms)=>{interval={fn,ms};return 1;},
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','019',800,
  'WEB-ENSAYO-0123456789ABCDEF0123456789ABCDEF',
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
 const byClass=cls=>nodes.find(n=>n.className===cls);
 const button=nodes.find(n=>n.tag==='button');
 return {wrap,button,price,requests,interval,callbacks,document,byClass,nodes};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('recibo muestra pedido, precio y estado; no contiene botón de consulta manual',async()=>{
 const s=setup();
 await flush();
 assert.match(s.byClass('pago-total').textContent,/\$.*800/);
 assert.match(s.byClass('pago-estado').textContent,/pendiente/);
 assert.equal(s.button.textContent,'Pagar con Mercado Pago (prueba)');
 assert.equal(s.nodes.filter(n=>n.tag==='button').length,1);
 assert.equal(s.requests[0].body.action,'status');
 assert.equal(s.requests.filter(r=>r.body.action==='start').length,0);
 assert.equal(s.interval.ms,30000);
 assert.ok(s.callbacks.visibilitychange);
 assert.doesNotMatch(source,/Consultar confirmación|revisar\.addEventListener/);
});
test('solo la respuesta pagado del servidor activa confirmación; sin cobrar de nuevo',async()=>{
 const s=setup(['pendiente','pagado']);
 await flush();
 assert.match(s.byClass('pago-estado').textContent,/pendiente/);
 s.interval.fn();await flush();
 assert.match(s.byClass('pago-estado').textContent,/confirmado/);
 assert.match(s.price.textContent,/Pago de prueba confirmado/);
 assert.equal(s.button.disabled,true);
 assert.equal(s.requests.filter(r=>r.body.action==='start').length,0);
});
test('el estado se reconsulta al volver a Chrome; revocado bloquea imprimir',async()=>{
 const s=setup(['pendiente','revocado']);
 await flush();
 s.document.hidden=true;s.interval.fn();await flush();
 assert.equal(s.requests.length,1,'No consultar en segundo plano');
 s.document.hidden=false;s.callbacks.visibilitychange();await flush();
 assert.match(s.byClass('pago-estado').textContent,/requiere revisión/);
 assert.equal(s.button.disabled,true);
 assert.equal(s.requests.length,2);
});
test('la acción de pagar prepara enlace solo por clic y nunca declara pago confirmado anticipadamente',async()=>{
 const s=setup();
 await flush();
 await s.button.events.click();await flush();
 assert.deepEqual(s.requests.map(r=>r.body.action).slice(0,2),['status','start']);
 assert.ok(s.nodes.some(n=>n.tag==='a'&&n.href?.startsWith('https://www.mercadopago.com.ar/')));
 assert.match(s.byClass('pago-estado').textContent,/pendiente/);
 assert.doesNotMatch(s.price.textContent,/Pago de prueba confirmado/);
});
