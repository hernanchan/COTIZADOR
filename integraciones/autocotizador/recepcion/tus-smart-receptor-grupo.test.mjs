import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {paginaCotizadorV2PruebaPrivada} from './pantalla-cotizador-v2-prueba-privada.mjs';
const html=paginaCotizadorV2PruebaPrivada('sitekey-test',true);
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'No se encontro el modulo del portal');
const start="if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_DOCUMENTS_TO_PRIVATE'){";
const begin=script.indexOf(start);
const end=script.indexOf('\n if(event.source!==frame.contentWindow)return;',begin);
assert.ok(begin>=0&&end>begin);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const onMessage=new AsyncFunction('event','smart','batchSending','registering',
 'registeredOrder','all','batchStatus','used','save','render','updateSummary',
 'status','document','crypto','File','TUS_ENABLED','MAX_PDF_PRIVADOS',script.slice(begin,end));
function fakeFile(n){
 return new File([new Uint8Array([37,80,68,70,45]),new Uint8Array(250)],
  'Documento_'+n+'.pdf',{type:'application/pdf'});
}
async function receive(options){
 const files=options.map((_,i)=>fakeFile(i+1));
 const contentWindow={};
 const all=[],used=new Set(),batchStatus={textContent:''},status={textContent:''};
 let saves=0,renders=0,summaries=0;
 await onMessage({source:contentWindow,
   data:{type:'SABER_SMART_DOCUMENTS_TO_PRIVATE',files,options,total:4200}},
  {contentWindow},false,false,false,all,batchStatus,used,
  ()=>saves++,()=>renders++,()=>summaries++,
  status,{getElementById:()=>({open:false})},webcrypto,File,true,10);
 return {all,files,batchStatus,saves,renders,summaries};
}
const opts=i=>({
 nombre:'Documento_'+i+'.pdf',paginas:4,formato:'a4',modo:'bn',
 caras:'double',copias:2,paginasPorHoja:2,
 anillado:'grupo',grupoAnillado:'1',materialColor:'obra70'
});
test('portal TUS conserva ambos grupos en la tarjeta del pedido inteligente',async()=>{
 const x=await receive([opts(1),opts(2)]);
 assert.equal(x.all.length,1,x.batchStatus.textContent);
 assert.equal(x.all[0].references.length,2);
 assert.deepEqual(x.all[0].references.map(d=>d.opcionesInteligentes.grupoAnillado),['1','1']);
 assert.deepEqual(x.all[0].references.map(d=>d.opcionesInteligentes.anillado),['grupo','grupo']);
 assert.equal(x.all[0].price,4200);
 assert.deepEqual([x.saves,x.renders,x.summaries],[1,1,1]);
 assert.equal(x.all[0].references[0].reference.estado,'PENDIENTE_DE_ENVIO');
});
test('portal TUS rechaza grupo sin identificador sin sumar al carrito',async()=>{
 const x=await receive([opts(1),{...opts(2),grupoAnillado:''}]);
 assert.equal(x.all.length,0);
 assert.match(x.batchStatus.textContent,/No se preparó la carga/);
});
