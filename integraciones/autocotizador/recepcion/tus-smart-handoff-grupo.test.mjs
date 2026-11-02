import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
const start='const prepararEnvioPrivado=()=>{';
const begin=source.indexOf(start);
const end=source.indexOf('\n };\n bridgeButton.hidden=true',begin);
assert.ok(begin>=0&&end>begin,'Falta transferencia del cliente');
const handoff=new Function('leyendo','ultimoPresupuesto','entries','window','location','info',
 source.slice(begin+start.length,end));

function ensayo(grupo2='1'){
 const archivo=i=>new File([new Uint8Array(128)],'PDF_'+i+'.pdf',{type:'application/pdf'});
 const entries=[1,2].map(i=>({
  archivoOriginal:archivo(i),name:'PDF_'+i+'.pdf',anillado:'grupo',
  grupoAnillado:i===1?'1':grupo2,paginas:[1,2,3],
  modo:'bn',caras:'simple',copias:2,paginasPorHoja:2,materialColor:'obra70'
 }));
 const plan=entries.map((e,i)=>({indice:i,destino:'documentos',formatoFinal:'a4',
  paginasElegidas:[1,2,3]}));
 const quote={estado:'PRELIMINAR',total:5750,subtotalImpresiones:5750,plan};
 const sent=[],info={textContent:''};
 handoff(false,quote,entries,{parent:{postMessage:x=>sent.push(x)}},
  {origin:'https://example.test'},info);
 return {entries,sent,info};
}

test('dos PDF con anillado conjunto conservan grupo, 2 por cara y precio en la transferencia',()=>{
 const {sent,info}=ensayo();
 assert.deepEqual(sent.map(x=>x.type),[
  'SABER_SMART_DOCUMENTS_TO_PRIVATE','SABER_SMART_HANDOFF_READY'
 ],info.textContent);
 assert.equal(sent[0].files.length,2);
 assert.deepEqual(sent[0].options.map(o=>o.anillado),['grupo','grupo']);
 assert.deepEqual(sent[0].options.map(o=>o.grupoAnillado),['1','1']);
 assert.deepEqual(sent[0].options.map(o=>o.paginasPorHoja),[2,2]);
 assert.equal(sent[0].total,5750);
});
test('grupo sin identificador se rechaza antes de enviar PDF',()=>{
 const {sent,info}=ensayo('');
 assert.deepEqual(sent.map(x=>x.type),['SABER_SMART_HANDOFF_ERROR']);
 assert.match(info.textContent,/grupo de anillado/);
});
test('presupuesto completo habilita el botón de un grupo; incompleto lo bloquea',()=>{
 const begin=source.indexOf('function informarPrecioPrivado(estado,total=null){');
 const end=source.indexOf('\nfunction importeArchivo(',begin);
 assert.ok(begin>=0&&end>begin);
 const fn=new Function('estado','total','entries','ultimoPresupuesto','window','location',
  source.slice(begin,end)+'\nreturn informarPrecioPrivado(estado,total);');
 const messages=[];
 const win={parent:{postMessage:x=>messages.push(x)}};
 fn('listo',5750,[{anillado:'grupo',grupoAnillado:'1'}],
  {estado:'PRELIMINAR'},win,{origin:'https://example.test'});
 fn('incompleto',null,[{anillado:'grupo',grupoAnillado:'1'}],
  {estado:'INCOMPLETO'},win,{origin:'https://example.test'});
 assert.equal(messages[0].sendable,true);
 assert.equal(messages[0].blockReason,null);
 assert.equal(messages[1].sendable,false);
});
