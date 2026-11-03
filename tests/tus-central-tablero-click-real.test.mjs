import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(src.replace('export default {','globalThis.worker = {'),context);
const html=vm.runInContext('adminHtml',context);
const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
const orderId='b69f8ef5-63eb-4728-a967-584c63f39c41';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.value='';this.listeners={};this.parent=null}
 append(...nodes){for(const child of nodes){if(typeof child==='object'&&child!==null){child.parent=this;this.children.push(child)}}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 addEventListener(name,fn){this.listeners[name]=fn}
 setAttribute(){}
 focus(){this.focused=true}
 closest(selector){if(selector==='.board-card'){let p=this;while(p&&p.className!=='board-card')p=p.parent;return p}return null}
 querySelector(selector){
  if(selector==='.board-feedback'){const queue=[this];
   while(queue.length){const x=queue.shift();if(x.className==='board-feedback')return x;queue.push(...x.children)}
  }return null;
 }
}
function scene({promptValue='Responsable del mostrador',failCode=null}={}){
 const elements=new Map();
 for(const id of ['secret','productionOperator','status','details','orders',
  'refreshExpress','refreshReceipts','refreshTransfers','refreshUnpaid','refresh',
  'sync','cronState','count-other','priceLoad','priceSave','priceApprove','priceMessage',
  'priceItems','priceGroup','priceSearch','priceDiffs','priceHistory','openPricing','pricingPanel',...['pendiente','en_preparacion','listo',
   'en_espera','entregado'].flatMap(x=>['lane-'+x,'count-'+x])]){
  elements.set('#'+id,new Element('div'));
 }
 elements.get('#secret').value='panel-key';
 const order={id:orderId,production_state:'pendiente',production_version:0,
  work_number:13,amount_ars:4730,file_count:3,
  web_order_id:'WEB-ENSAYO-12345678901234567890123456789012',
  description:'3 PDF recibidos',paid_at:'2026-11-02 15:28:27'};
 const calls=[];
 const document={
  hidden:false,
  querySelector(selector){if(!elements.has(selector))throw Error('Missing DOM '+selector);return elements.get(selector)},
  createElement(tag){return new Element(tag)},body:new Element('body')
 };
 const storage=new Map();
 const env={document,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  console,URL,Intl,Promise,setTimeout,Blob,
  setInterval:()=>1,
  prompt(){return promptValue},confirm(){return true},
  async fetch(path,opts={}){
   if(path==='/admin/api/orders')
    return {ok:true,json:async()=>({orders:[{...order}]})};
   if(path==='/admin/api/central/production-status'){
    const input=JSON.parse(opts.body);calls.push(input);
    if(failCode!==null)
     return {ok:false,status:failCode,json:async()=>({error:'No se guardó el estado de producción'})};
    assert.equal(input.order_id,orderId);
    assert.equal(input.from,'pendiente');
    assert.equal(input.to,'en_preparacion');
    assert.equal(input.version,0);
    order.production_state='en_preparacion';order.production_version=1;
    return {ok:true,json:async()=>({saved:true})};
   }
   throw Error('Unexpected HTTP '+path);
  }};
 vm.createContext(env);
 vm.runInContext(script,env);
 return {env,elements,order,calls};
}
test('un clic en Iniciar pide responsable una sola vez y mueve de columna al guardar en D1',async()=>{
 const x=scene();
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-pendiente').children[0];
 assert.equal(card.tagName,'article');
 const button=card.children.find(e=>e.className==='actions').children[0];
 assert.equal(button.textContent,'Iniciar trabajo');
 await button.listeners.click();
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].operator,'Responsable del mostrador');
 assert.equal(x.elements.get('#lane-en_preparacion').children[0].tagName,'article');
 assert.equal(x.elements.get('#count-pendiente').textContent,0);
 assert.equal(x.elements.get('#count-en_preparacion').textContent,1);
 assert.equal(x.elements.get('#productionOperator').value,'Responsable del mostrador');
});
test('si no ingresan responsable, la tarjeta explica por qué no cambió',async()=>{
 const x=scene({promptValue:null});
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-pendiente').children[0];
 const button=card.children.find(e=>e.className==='actions').children[0];
 await button.listeners.click();
 assert.equal(x.calls.length,0);
 const feedback=card.querySelector('.board-feedback');
 assert.match(feedback.textContent,/responsable|preparando/i);
});
test('si D1 rechaza un cambio, se ve el error en la misma tarjeta',async()=>{
 const x=scene({failCode:409});
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-pendiente').children[0];
 const button=card.children.find(e=>e.className==='actions').children[0];
 await button.listeners.click();
 assert.equal(x.calls.length,1);
 assert.equal(x.elements.get('#lane-pendiente').children[0],card);
 assert.match(card.querySelector('.board-feedback').textContent,/No se guardó/);
});
