import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {buildSync} from 'esbuild';

const source=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
const built=buildSync({
 entryPoints:[new URL('./carga-unica-cliente.mjs',import.meta.url).pathname],
 bundle:true,minify:true,platform:'browser',format:'iife',target:'es2022',write:false,
 logLevel:'silent'
}).outputFiles[0].text;

test('el cliente generado es JavaScript sintacticamente valido',()=>{
 assert.doesNotThrow(()=>new Script(built,{filename:'carga-inteligente.js'}));
});

test('ambas validaciones aceptan MUEBLES.pdf de 2.35 MB y rechazan extensiones ajenas',()=>{
 const patterns=[...source.matchAll(/\/([^\n/]*pdf\$)\/i\.test\((file\.name|e\.name)\)/g)];
 assert.equal(patterns.length,3,'Deben validarse PDF en carga, ploteos y transferencia privada');
 for(const [,pattern] of patterns){
  assert.equal(pattern,String.raw`\.pdf$`,'Expresión de extensión inesperada');
  const rx=new RegExp(pattern,'i');
  assert.equal(rx.test('MUEBLES.pdf'),true);
  assert.equal(rx.test('MUEBLES.txt'),false);
  assert.equal(rx.test('MUEBLESXpdf'),false);
 }
 const bytes=Math.round(2.35*1024*1024);
 assert.ok(bytes>=5&&bytes<=20*1024*1024);
 assert.ok('MUEBLES.pdf'.length<=120);
});

test('el archivo valido conserva la transferencia al portal privado',()=>{
 assert.match(source,/SABER_SMART_DOCUMENTS_TO_PRIVATE/);
 assert.match(source,/files,options,total:totalDocumentos/);
 assert.match(source,/archivoOriginal/);
});


const marker="const prepararEnvioPrivado=()=>{";
const begin=source.indexOf(marker);
const finish=source.indexOf("\n };\n bridgeButton.hidden=true",begin);
assert.ok(begin>=0&&finish>begin,'No se encontró el callback real del botón');
const clickHandler=new Function('leyendo','ultimoPresupuesto','entries','window','location','info','MAX_PDF_CARGA','paginasElegidas',
 `const MAX_PDF_TUS_BYTES=40*1024*1024;const MAX_LOTE_TUS_BYTES=60*1024*1024;const tamanoPdfMiB=f=>(f.size/(1024*1024)).toFixed(1).replace('.',',')+' MiB';
`+source.slice(begin+marker.length,finish));

function runPrivateHandoff(name='MUEBLES.pdf',size=2464154){
 const file=new File([new Uint8Array(size)],name,{type:'application/pdf'});
 const sent=[],info={textContent:''};
 const entry={
  archivoOriginal:file,name:file.name,anillado:'ninguno',paginasPorHoja:1,
  paginas:Array.from({length:8},(_,i)=>({numero:i+1})),modo:'bn',caras:'simple',copias:1
 };
 const quote={estado:'PRELIMINAR',total:800,
  plan:[{indice:0,destino:'documentos',formatoFinal:'a4',
   paginasElegidas:Array.from({length:8},(_,i)=>i+1)}]};
 const window={parent:{postMessage:(payload,origin)=>sent.push({payload,origin})}};
 clickHandler(false,quote,[entry],window,{origin:'https://example.test'},info,30,e=>e.paginas);
 return {sent,info,file};
}

test('el callback real agrega MUEBLES.pdf de ocho paginas a la cola privada, sin enviarlo a Drive',()=>{
 const {sent,info,file}=runPrivateHandoff();
 assert.equal(sent.length,2,info.textContent);
 assert.equal(sent[1].payload.type,'SABER_SMART_HANDOFF_READY');
 assert.equal(sent[1].payload.cantidad,1);
 assert.equal(sent[0].payload.type,'SABER_SMART_DOCUMENTS_TO_PRIVATE');
 assert.equal(sent[0].payload.files[0],file);
 assert.equal(sent[0].payload.total,800);
 assert.deepEqual(sent[0].payload.options.map(o=>({
  formato:o.formato,modo:o.modo,caras:o.caras,copias:o.copias,paginas:o.paginas,
  nombre:o.nombre
 })),[{formato:'a4',modo:'bn',caras:'simple',copias:1,paginas:8,nombre:'MUEBLES.pdf'}]);
 assert.match(info.textContent,/Pedido preparado/);
});

test('el callback real admite PDF de 21 MiB y rechaza formato ajeno o PDF >40 MiB con el nombre',()=>{
 const accepted=runPrivateHandoff('MUEBLES.pdf',21*1024*1024);
 assert.deepEqual(accepted.sent.map(x=>x.payload.type),
  ['SABER_SMART_DOCUMENTS_TO_PRIVATE','SABER_SMART_HANDOFF_READY'],accepted.info.textContent);
 for(const [name,size,pattern] of [
  ['MUEBLES.txt',2464154,/MUEBLES\.txt.*formato/i],
  ['MUEBLES.pdf',40*1024*1024+1,/MUEBLES\.pdf.*40 MiB/]
 ]){
  const {sent,info}=runPrivateHandoff(name,size);
  assert.equal(sent.length,1);
  assert.equal(sent[0].payload.type,'SABER_SMART_HANDOFF_ERROR');
  assert.match(info.textContent,pattern);
 }
});


test('el portal privado recibe el evento real y agrega PDF con hash y precio, sin Drive ni D1',async()=>{
 const {paginaCotizadorV2PruebaPrivada}=await import('./pantalla-cotizador-v2-prueba-privada.mjs');
 const {webcrypto}=await import('node:crypto');
 const html=paginaCotizadorV2PruebaPrivada('sitekey-test');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Falta el script del portal privado');
 assert.doesNotThrow(()=>new Script(script.replace(/^import [^\n]+;\s*$/gm,''),{
  filename:'portal-privado.js'}));
 const marker="if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_DOCUMENTS_TO_PRIVATE'){";
 const begin=script.indexOf(marker);
 const finish=script.indexOf('\n if(event.source!==frame.contentWindow)return;',begin);
 assert.ok(begin>=0&&finish>begin,'No se encontró el receptor del pedido inteligente');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const onMessage=new AsyncFunction('event','smart','batchSending','registering',
  'registeredOrder','all','batchStatus','used','save','render','updateSummary',
  'status','document','crypto','File','TUS_ENABLED','MAX_PDF_PRIVADOS',script.slice(begin,finish));
 const bytes=Math.round(2.35*1024*1024);
 const file=new File([new Uint8Array([37,80,68,70,45]),new Uint8Array(bytes-5)],
  'MUEBLES.pdf',{type:'application/pdf'});
 const contentWindow={};
 const options=[{nombre:file.name,paginas:8,formato:'a4',modo:'bn',caras:'simple',
  copias:1,paginasPorHoja:1,anillado:'ninguno',materialColor:''}];
 const all=[],used=new Set(),batchStatus={textContent:''},status={textContent:''};
 let updates=0;
 await onMessage({
  source:contentWindow,data:{type:'SABER_SMART_DOCUMENTS_TO_PRIVATE',
   files:[file],options,total:800}
 },{contentWindow},false,false,false,all,batchStatus,used,
 ()=>updates++,()=>updates++,()=>updates++,
 status,{getElementById:()=>({open:false})},webcrypto,File,false,30);
 assert.equal(all.length,1,batchStatus.textContent);
 assert.equal(all[0].price,800);
 assert.equal(all[0].references.length,1);
 assert.equal(all[0].references[0].archivoLocal,file);
 assert.equal(all[0].references[0].reference.bytes,bytes);
 assert.equal(all[0].references[0].reference.estado,'PENDIENTE_DE_ENVIO');
 assert.match(all[0].references[0].reference.sha256,/^[0-9a-f]{64}$/);
 assert.match(batchStatus.textContent,/1 PDF listos para enviar/);
 assert.equal(updates,3);
});

test('cliente de prueba no anuncia falsamente que los ploteos quedan fuera de la recepción TUS',()=>{
 assert.ok(source.includes('Impresiones y ploteos se verifican y registran en la Central'));
 assert.ok(!source.includes('Los ploteos se cotizan, pero quedan pendientes de integración'));
 assert.ok(source.includes('Las páginas elegidas se verifican sobre el PDF original antes de registrar la orden.'));
});


test('envío inteligente preserva 1-3,5 de ocho páginas y rechaza plan desactualizado',()=>{
 const archivo=new File([new Uint8Array(500)],'Seleccion_A4.pdf',{type:'application/pdf'});
 const e={
  archivoOriginal:archivo,name:archivo.name,
  paginas:Array.from({length:8},(_,i)=>({numero:i+1,anchoCm:21,altoCm:29.7})),
  paginasSeleccionadas:'1-3,5',anillado:'ninguno',grupoAnillado:'',
  paginasPorHoja:1,materialColor:'obra70',modo:'bn',caras:'simple',copias:1
 };
 const plan=[{indice:0,destino:'documentos',formatoFinal:'a4',paginasElegidas:[1,2,3,5]}];
 const quote={estado:'PRELIMINAR',total:700,plan};
 const sent=[],info={textContent:''};
 const selected=x=>x.paginas.filter(p=>[1,2,3,5].includes(p.numero));
 const receiver={parent:{postMessage:m=>sent.push(m)}};
 clickHandler(false,quote,[e],receiver,{origin:'https://example.test'},info,10,selected);
 assert.deepEqual(sent.map(x=>x.type),
  ['SABER_SMART_DOCUMENTS_TO_PRIVATE','SABER_SMART_HANDOFF_READY'],info.textContent);
 assert.equal(sent[0].options[0].paginasSeleccionadas,'1-3,5');
 assert.equal(sent[0].options[0].paginas,8);
 assert.equal(sent[0].files[0],archivo);
 sent.length=0;
 quote.plan[0].paginasElegidas=[1,2,3,4];
 clickHandler(false,quote,[e],receiver,{origin:'https://example.test'},info,10,selected);
 assert.deepEqual(sent.map(x=>x.type),['SABER_SMART_HANDOFF_ERROR']);
 assert.match(info.textContent,/no coincide con el presupuesto/);
});
