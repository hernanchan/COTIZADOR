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
function scene({promptValue='Responsable del mostrador',failCode=null,stage='pendiente',timeSaveError=null}={}){
 const elements=new Map();
 for(const id of ['secret','productionOperator','status','details','orders',
  'refreshExpress','refreshReceipts','refreshR2Paid','r2PaidReview','refreshTransfers','refreshUnpaid','refresh',
  'etaStatus','etaHours','etaCapacity','etaLoad','etaSave',
  'deliveryPlanMode','deliveryPlanSave','deliveryPlanLoad','deliveryPlanStatus',
  'etaCalendarStatus','etaCalendarLoad','etaCalendarSave','etaCalendarWeekdayDraft',
  'etaSamplesStatus','etaSamplesHistory','etaSampleType','etaSampleQuantity','etaSampleMinutes','etaSamplesLoad','etaSamplesSave',
  'mobileInviteCreate','mobileInviteCopy','mobileInviteArea','mobileInviteLink','mobileInviteStatus',
  'etaResourcesStatus','etaResourcesSave','etaResourcesLoad','etaResourcesLoadResult','etaPrintParallel','etaBindingParallel','etaPlotterParallel',
  'sync','cronState','count-other','priceLoad','priceSave','priceApprove','priceMessage',
  'priceItems','priceGroup','priceSearch','priceDiffs','priceHistory','openPricing','pricingPanel','pricePreviewButton','pricePreviewResult',...['pendiente','en_preparacion','listo',
   'en_espera','entregado'].flatMap(x=>['lane-'+x,'count-'+x])]){
  elements.set('#'+id,new Element('div'));
 }
 elements.get('#secret').value='panel-key';
 const order={id:orderId,production_state:stage,production_version:stage==='pendiente'?0:1,
  estimated_ready_at:null,estimated_ready_version:0,
  work_number:13,amount_ars:4730,file_count:3,
  web_order_id:'WEB-ENSAYO-12345678901234567890123456789012',
  description:'3 PDF recibidos',paid_at:'2026-11-02 15:28:27'};
 const calls=[],deliveryCalls=[];
 const document={
  hidden:false,
  addEventListener(){},
  querySelector(selector){if(!elements.has(selector))throw Error('Missing DOM '+selector);return elements.get(selector)},
  createElement(tag){return new Element(tag)},body:new Element('body')
 };
 const storage=new Map();
 const env={document,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  console,URL,Intl,Promise,setTimeout,Blob,
  setInterval:()=>1,
  prompt(){return promptValue},confirm(){return true},
  async fetch(path,opts={}){
   if(path==='/admin/api/central/r2-paid-review')
    return {ok:true,json:async()=>({orders:[{
      webOrderId:'WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE',
      commercialOrderId:orderId,amountArs:4400,expectedBytes:62915011,
      declaredPages:1,estado:'RECIBIDO_PENDIENTE_PREPRENSA',
      receiptId:'DOC-12345678-1234-4123-8123-123456789abc',
      readyForPrinting:false,productionAuthorized:false
    }]})};
   if(path==='/admin/api/orders')
    return {ok:true,json:async()=>({orders:[{...order}]})};
   if(path==='/admin/api/central/preparation-estimate'){
    const input=JSON.parse(opts.body);deliveryCalls.push(input);
    if(timeSaveError!==null)
     return {ok:false,status:409,json:async()=>({error:timeSaveError})};
    order.estimated_ready_at=input.ready_at;
    order.estimated_ready_version=1;
    return {ok:true,json:async()=>({saved:true})};
   }
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
 return {env,elements,order,calls,deliveryCalls};
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

test('Definir hora abre formulario EN LA TARJETA sin navegar al detalle lejano',async()=>{
 const x=scene({stage:'en_preparacion'});
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-en_preparacion').children[0];
 const controls=card.children.find(e=>e.className==='actions');
 const open=controls.children.find(e=>e.textContent==='Definir hora de entrega');
 assert.ok(open,'el botón de hora debe estar disponible cuando se inició el pedido');
 const editor=card.children.find(e=>e.className==='delivery-editor');
 assert.ok(editor,'el formulario debe estar en la misma tarjeta');
 assert.equal(editor.hidden,true);
 assert.ok(card.children.indexOf(editor)>card.children.indexOf(controls),'el editor debe aparecer debajo de los controles');
 await open.listeners.click();
 assert.equal(editor.hidden,false,'clic revela de inmediato el formulario');
 assert.equal(x.deliveryCalls.length,0,'abrir no guarda ni cambia horarios');
 const input=editor.children.find(e=>e.tagName==='label').children.find(e=>e.tagName==='input');
 assert.equal(input.type,'datetime-local');
 assert.equal(input.focused,true);
 await open.listeners.click();
 assert.equal(editor.hidden,true,'otro clic cierra el editor');
});
test('guardar hora desde la tarjeta actualiza D1 y aparece en el tablero',async()=>{
 const x=scene({stage:'en_preparacion'});
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-en_preparacion').children[0];
 const open=card.children.find(e=>e.className==='actions').children.find(e=>e.textContent==='Definir hora de entrega');
 await open.listeners.click();
 const editor=card.children.find(e=>e.className==='delivery-editor');
 const input=editor.children.find(e=>e.tagName==='label').children.find(e=>e.tagName==='input');
 const local=new Date(Date.now()-3*3600000+2*3600000).toISOString().slice(0,16);
 input.value=local;
 const save=editor.children.find(e=>e.textContent==='Guardar hora estimada');
 assert.ok(save?.listeners.click);
 await save.listeners.click();
 assert.equal(x.deliveryCalls.length,1);
 assert.equal(x.deliveryCalls[0].order_id,orderId);
 assert.equal(x.deliveryCalls[0].expected_version,0);
 assert.equal(x.deliveryCalls[0].operator,'Responsable del mostrador');
 assert.equal(x.deliveryCalls[0].confirmed,true);
 assert.ok(Date.parse(x.deliveryCalls[0].ready_at)>Date.now());
 assert.equal(x.order.estimated_ready_at,x.deliveryCalls[0].ready_at);
 const updated=x.elements.get('#lane-en_preparacion').children[0];
 assert.ok(updated.children.some(e=>String(e.textContent).includes('Preparación estimada')),'el nuevo horario aparece después de guardar');
});
test('hora vacía y errores de D1 se muestran junto al botón',async()=>{
 const x=scene({stage:'en_preparacion',timeSaveError:'La estimación cambió en otro puesto'});
 await vm.runInContext('refresh({silent:true})',x.env);
 const card=x.elements.get('#lane-en_preparacion').children[0];
 const open=card.children.find(e=>e.className==='actions').children.find(e=>e.textContent==='Definir hora de entrega');
 await open.listeners.click();
 const editor=card.children.find(e=>e.className==='delivery-editor');
 const save=editor.children.find(e=>e.textContent==='Guardar hora estimada');
 const input=editor.children.find(e=>e.tagName==='label').children.find(e=>e.tagName==='input');
 const feedback=editor.children.find(e=>e.className==='delivery-feedback');
 await save.listeners.click();
 assert.match(feedback.textContent,/Elegí fecha y hora/);
 assert.equal(x.deliveryCalls.length,0);
 input.value=new Date(Date.now()-3*3600000+2*3600000).toISOString().slice(0,16);
 await save.listeners.click();
 assert.equal(x.deliveryCalls.length,1);
 assert.match(feedback.textContent,/La estimación cambió en otro puesto/);
 assert.equal(editor.hidden,false,'ante error, el editor permanece abierto');
 assert.equal(save.disabled,false);
});

test('La Central muestra original R2 pagado en revisión sin habilitar producción ni confundirlo con ZIP',async()=>{
 const x=scene();
 const button=x.elements.get('#refreshR2Paid');
 assert.equal(typeof button.listeners.click,'function');
 await button.listeners.click();
 const list=x.elements.get('#r2PaidReview');
 assert.equal(list.children.length,1);
 const card=list.children[0];
 assert.match(card.textContent,/Original recibido/);
 assert.ok(card.children.some(e=>String(e.textContent).includes('Pedido comercial:')));
 assert.ok(card.children.some(e=>String(e.textContent).includes('No habilitado para impresión')));
 const link=card.children.find(e=>e.tagName==='a');
 assert.ok(link,'el original recibido debe tener enlace privado al mostrador');
 assert.ok(String(link.href).includes('saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/r2-preprensa-personal'));
 assert.match(String(link.href),/receiptId=DOC-/);
 assert.equal(link.target,'_blank');
 assert.match(String(x.elements.get('#status').textContent),/ploteo/);
});
